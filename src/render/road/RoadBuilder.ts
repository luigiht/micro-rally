import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
} from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { STAGE_TYPES } from '@/game/stage/regions';
import type { StageDef } from '@/game/stage/StageGenerator';
import { controlBoardSkip, markerDistances, type MarkerSkip } from '@/game/stage/RoadMarkers';
import { ROAD_LIFT, TRENCH_OUT, VERGE_WIDTH, type TerrainField } from '@/game/stage/TerrainField';
import { halfWidthAt } from '@/game/stage/RoadWidth';
import { roundaboutOpenings } from '@/game/stage/Roundabout';
import { KERB_LIFT, townFade } from '@/game/stage/Town';
import { routeOpenings, type Openings } from '@/game/stage/TownKerbs';
import {
  ASPHALT_JITTER,
  cellTone,
  laneBands,
  MAX_BANDS,
  SLAB_JITTER,
  SLAB_ROWS,
  WHEEL_TONE,
} from './SurfaceDetail';
import { themeColor, themedMaterial } from '../theme/themeColor';
import type { RoadTheme } from '../theme/WorldTheme';

/**
 * Snow stages: asphalt with snow lying in patches every ~28 m, the same cover
 * across the full width, so a clear stretch is bare out to the edge lines
 * and a snowy one is even from side to side. The wide threshold band gives
 * each patch a long run-in and run-out rather than a cut.
 */
const PATCH_PERIOD = 14;
/** Noise thresholds where a patch starts and saturates. */
const PATCH_FROM = 0.3;
const PATCH_TO = 0.7;
const SNOW_COVER = 0.45;
/*
 * Verge strips `VERGE_WIDTH` wide either side of the ribbon are built from
 * the same samples, so road and verge share their edge vertices and meet
 * flush. The terrain bed sinks under them on the open road and rises to meet
 * their outer edge, so the coarse terrain mesh never shares their plane.
 */
const SAMPLES_PER_PIECE = 100;
/** Snow poles on bank-lined roads stand this tall. */
const SNOW_POLE_HEIGHT = 2.4;
/** The edge line stands this far above the carriageway it is painted on. */
export const LINE_ABOVE_DECK = 0.02;
export const LINE_LIFT = ROAD_LIFT + LINE_ABOVE_DECK;
const LINE_WIDTH = 0.22;

/** Integer mix hash to 0..1; a plain multiply-mod ramps instead of scattering. */
function hash01(k: number): number {
  let h = Math.imul(k ^ 0x9e3779b9, 374761393);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Patch noise 0..1 along the road, smooth between hashed knots. */
function patchNoise(i: number): number {
  const c = i / PATCH_PERIOD;
  const k = Math.floor(c);
  const f = c - k;
  const a = hash01(k);
  return a + (hash01(k + 1) - a) * (f * f * (3 - 2 * f));
}

/** Snow cover at road sample `i`: zero in clear stretches, rising to `SNOW_COVER` inside a patch. */
function snowCover(i: number): number {
  return SNOW_COVER * smoothstep(PATCH_FROM, PATCH_TO, patchNoise(i));
}

/**
 * Where a region heaps snow banks (`terrain.banks`), snow lies on the road
 * in two ways. Blobs: short tongues from each edge, two to six metres long,
 * up to `DRIFT_MAX_SHARE` of the half width where two quick noises run high
 * together. Patches: long drifts across the whole width, tens of metres,
 * from a slow noise, with a sharp core and ragged ends: each side's snow
 * runs out to the centre on its own, shifted a few metres back or forth by
 * its own noise, so a patch starts and ends unevenly rather than fading
 * across the road at once. Each side draws from its own stretch of the hash
 * so the two never mirror.
 */
const DRIFT_PERIOD = 2.2;
const DRIFT_PERIOD_B = 1.4;
const DRIFT_FROM = 0.68;
const DRIFT_TO = 0.8;
const DRIFT_MAX_SHARE = 0.45;
const PATCH_LONG_PERIOD = 9;
const PATCH_CORE_FROM = 0.6;
const PATCH_CORE_TO = 0.66;
const PATCH_EDGE_FROM = 0.52;
const PATCH_EDGE_TO = 0.6;
/** How far (in samples) a side's patch end wanders from the core's. */
const PATCH_RAG = 4;
function driftNoise(i: number, period: number, salt: number): number {
  const c = i / period;
  const k = Math.floor(c);
  const f = c - k;
  const a = hash01(k * 7 + salt);
  return a + (hash01((k + 1) * 7 + salt) - a) * (f * f * (3 - 2 * f));
}
const longPatch = (i: number) => driftNoise(i, PATCH_LONG_PERIOD, 21);
function driftShare(i: number, side: number): number {
  const j = i + (side > 0 ? 0 : 100003);
  const n = 0.6 * driftNoise(j, DRIFT_PERIOD, 3) + 0.4 * driftNoise(j, DRIFT_PERIOD_B, 11);
  const blob = DRIFT_MAX_SHARE * smoothstep(DRIFT_FROM, DRIFT_TO, n);
  // This side's reach of the long patch, its end shifted by its own noise; past the centre when full.
  const shift = (driftNoise(j, 3, 17) - 0.5) * 2 * PATCH_RAG;
  const edge = 1.05 * smoothstep(PATCH_EDGE_FROM, PATCH_EDGE_TO, longPatch(i + shift));
  return Math.max(blob, edge);
}
/** The long patches' core across the full width, sharp-edged; the sides' ragged ends carry it further. */
function sparseSnowCover(i: number): number {
  return SNOW_COVER * smoothstep(PATCH_CORE_FROM, PATCH_CORE_TO, longPatch(i));
}

/**
 * Wheel ruts in a snowed-over road: two grooves about `RUT_GAUGE` apart, each
 * about `RUT_WIDTH` across with sloped walls and a floor `RUT_DEPTH` down, a
 * shade darker where the snow is packed. The pair wanders up to `RUT_WANDER`
 * either side of the centre line over tens of metres, as the cars before
 * drove it; each groove also strays on its own and widens and narrows every
 * few metres, and its walls are uneven, so the tracks read as trodden rather
 * than ruled.
 */
const RUT_GAUGE = 1.55;
const RUT_WIDTH = 0.8;
const RUT_DEPTH = 0.045;
const MUD_RUT_DEPTH = 0.075;
const RUT_WANDER = 0.3;
const RUT_PERIOD = 11;
/** Each groove's own stray (m) and its width swing (share of `RUT_WIDTH`), over a few metres. */
const RUT_STRAY = 0.12;
const RUT_STRAY_PERIOD = 3.2;
const RUT_SWELL = 0.35;
const RUT_SWELL_PERIOD = 2.3;
// Packed snow needs a clear step against pale loose snow; mud tracks use a deeper umber shade.
const SNOW_RUT_TONE = [1, 0.9, 0.8, 0.9] as const;
const MUD_RUT_TONE = [1, 0.85, 0.68, 0.85] as const;

interface RutProfile {
  depth: number;
  tone: readonly [number, number, number, number];
  /** 0..1 along the road: how plainly the tracks show there (1 when unset): its tones ease to 1 as it falls. */
  fade?: (k: number) => number;
}

const SNOW_RUTS: RutProfile = { depth: RUT_DEPTH, tone: SNOW_RUT_TONE };
const MUD_RUTS: RutProfile = { depth: MUD_RUT_DEPTH, tone: MUD_RUT_TONE };
/**
 * Gravel keeps only faint tyre traces: a shallow pair a few shades darker
 * where the wheels have packed the stones, and the loose gravel between and
 * beside them a shade lighter. They come and go over tens of metres, plain
 * in places and almost gone in others.
 */
const GRAVEL_RUTS: RutProfile = {
  depth: 0.02,
  tone: [1.06, 0.94, 0.86, 0.94],
  fade: (k) => 0.25 + 0.75 * smoothstep(0.3, 0.7, driftNoise(k, 14, 97)),
};

function rutStrips(base: Strip, profile: RutProfile): Strip[] {
  const centre = (k: number) => (driftNoise(k, RUT_PERIOD, 31) - 0.5) * 2 * RUT_WANDER;
  // Cut `n` across the carriageway, right to left: wall top, floor, floor, wall top for each rut.
  // Each groove (r) draws its stray, its width and its two walls' slopes from its own noise.
  const at = (n: number, k: number) => {
    const r = n < 4 ? 0 : 1;
    const f = [-0.5, -0.25, 0.25, 0.5][n % 4]!;
    const salt = 41 + r * 13;
    const stray = (driftNoise(k, RUT_STRAY_PERIOD, salt) - 0.5) * 2 * RUT_STRAY;
    const width =
      RUT_WIDTH * (1 + (driftNoise(k, RUT_SWELL_PERIOD, salt + 5) - 0.5) * 2 * RUT_SWELL);
    // The floor's edges sit anywhere from a third to two thirds of the way in, wall by wall.
    const floor = f > 0 ? 1 : -1;
    const wall =
      Math.abs(f) === 0.25 ? 0.15 + 0.2 * driftNoise(k, 1.7, salt + (floor > 0 ? 7 : 9)) : 0.5;
    return centre(k) + (r === 0 ? -1 : 1) * (RUT_GAUGE / 2) + stray + floor * wall * width;
  };
  const cut = (n: number) => (hw: number, k: number) =>
    n < 0 ? -hw : n >= 8 ? hw : Math.max(-hw, Math.min(hw, at(n, k)));
  // Edge depths per band: flat, down the wall, floor, up the wall, then again for the second rut.
  const dips: (readonly [number, number])[] = [
    [0, 0],
    [0, profile.depth],
    [profile.depth, profile.depth],
    [profile.depth, 0],
  ];
  const out: Strip[] = [];
  for (let n = -1; n < 8; n++) {
    const band = (n + 1) % 4;
    const tone = profile.tone[band]!;
    const fade = profile.fade;
    out.push({
      ...base,
      a: cut(n),
      b: cut(n + 1),
      dip: dips[band]!,
      tone: fade ? (k) => 1 + (tone - 1) * fade(k) : tone,
    });
  }
  return out;
}

/**
 * How far the centre pair's outer walls can ever reach from the centre line:
 * the gauge, the pair's wander, a groove's own stray and half its widest swell.
 */
const CENTRE_RUT_REACH = RUT_GAUGE / 2 + RUT_WANDER + RUT_STRAY + (RUT_WIDTH * (1 + RUT_SWELL)) / 2;

/**
 * One muddy tyre groove near a road edge, using the centre tracks' uneven
 * width, wander and tread shade. It keeps outside the centre pair's reach,
 * so on a narrow lane the two never overlap.
 */
function mudEdgeTrack(base: Strip, profile: RutProfile, side: 1 | -1): Strip[] {
  const salt = side > 0 ? 307 : 419;
  const widthAt = (k: number) =>
    RUT_WIDTH * (1 + (driftNoise(k, RUT_SWELL_PERIOD, salt) - 0.5) * 2 * RUT_SWELL);
  const centerAt = (hw: number, k: number) => {
    const width = widthAt(k);
    const wander = (driftNoise(k, RUT_PERIOD, salt + 17) - 0.5) * 2 * RUT_WANDER * 0.7;
    const distance = Math.min(
      hw - width / 2 - 0.12,
      Math.max(CENTRE_RUT_REACH + width / 2, hw - width / 2 - 0.25 + wander),
    );
    return side * distance;
  };
  const edge = (n: number) => (hw: number, k: number) => {
    const center = centerAt(hw, k);
    const width = widthAt(k);
    if (n === 0) return side < 0 ? -hw : center - width / 2;
    if (n === 5) return side > 0 ? hw : center + width / 2;
    return center + [-0.5, -0.25, 0.25, 0.5][n - 1]! * width;
  };
  const dips: readonly (readonly [number, number])[] = [
    [0, 0],
    [0, profile.depth],
    [profile.depth, profile.depth],
    [profile.depth, 0],
    [0, 0],
  ];
  return dips.map((dip, band) => ({
    ...base,
    a: edge(band),
    b: edge(band + 1),
    dip,
    tone: band === 0 || band === 4 ? 1 : profile.tone[band]!,
  }));
}

/** One cross-section of the ribbon: where it is, which way is left, how wide, how high, and its tarmac shade. */
interface Station {
  d: number;
  /** Sample index the shade and snow cover are drawn from. */
  k: number;
  x: number;
  z: number;
  lx: number;
  lz: number;
  hw: number;
  y: number;
  shade: number;
}

/** One ribbon strip: lateral extent, lift, flat colour, optional snow cover and tarmac shade jitter; `town` overrides inside a town. */
interface Strip {
  /** Lateral extents as functions of the local half width and the station's sample index. */
  a: (hw: number, k: number) => number;
  b: (hw: number, k: number) => number;
  lift: number;
  color: Color;
  cover?: (i: number) => number;
  shaded: boolean;
  town?: { color: Color; lift: number };
  /** Which verge this strip lies on (+1 left, -1 right); such strips stop across junction openings. */
  side?: number;
  /** A vertical kerb face, only in town: a positive rise lifts the `b` edge by this much, a negative one the `a` edge. */
  rise?: number;
  /** Heights of the `a` and `b` edges below the strip's lift (a rut's walls and floor), and a shade on its colour. */
  dip?: readonly [number, number];
  /** A shade on the strip's colour, fixed or varying along the road (by station sample index). */
  tone?: number | ((k: number) => number);
  blendFromRoad?: boolean;
  /** A shade on each piece of its own (a city's slabs and asphalt, `SurfaceDetail`), from the half width and station there. */
  detail?: (hw: number, k: number) => number;
}

/** Ribbon road split into pieces for frustum culling, plus verges, edge lines and marker posts. */
export class RoadBuilder {
  readonly group = new Group();
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: MeshStandardMaterial[] = [];
  private readonly instanced: InstancedMesh[] = [];
  private readonly verge: Color;
  private readonly scratch = { x: 0, z: 0, heading: 0 };

  /** The theme's verge is the region's shoulder by day, so the strips match the terrain beside them. */
  constructor(
    stage: StageDef,
    field: TerrainField,
    private readonly theme: RoadTheme,
  ) {
    this.group.name = 'road';
    this.verge = new Color(theme.verge);
    const openings: Openings = stage.town
      ? routeOpenings(stage.town, stage)
      : { left: [], right: [] };
    // Inside a roundabout's hand-off radius the ring's surface paints the pavements, kerbs and lines.
    if (stage.town?.roundabouts) {
      const ring = roundaboutOpenings(stage.town.roundabouts, stage);
      openings.left.push(...ring.left);
      openings.right.push(...ring.right);
      openings.left.sort((p, q) => p.from - q.from);
      openings.right.sort((p, q) => p.from - q.from);
    }
    if (VERGE_WIDTH <= TRENCH_OUT) throw new Error('verge strip must cover the trench ramp');
    const roadMat = new MeshStandardMaterial({
      vertexColors: true,
      roughness: stage.surface === 'tarmac' || stage.surface === 'track' ? 0.75 : 1,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.materials.push(roadMat);
    const path = stage.path;
    for (let s0 = 0; s0 < path.count - 1; s0 += SAMPLES_PER_PIECE) {
      const s1 = Math.min(path.count - 1, s0 + SAMPLES_PER_PIECE);
      const geo = this.buildPiece(stage, field, s0, s1, openings);
      this.geometries.push(geo);
      const mesh = new Mesh(geo, roadMat);
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
    // A sand piste is marked by nothing but its own colour, a circuit by its kerbs and barriers, and
    // an Autumnal mud lane by its fading verges and crowds: none of them has verge posts.
    const posts = stage.surface !== 'sand' && !stage.circuit && stage.stageType !== 'autumnal';
    if (posts) this.buildMarkers(stage, field);
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    for (const i of this.instanced) i.dispose();
  }

  private buildPiece(
    stage: StageDef,
    field: TerrainField,
    s0: number,
    s1: number,
    openings: Openings,
  ): BufferGeometry {
    const path = stage.path;
    const sp = path.spacing;
    const theme = this.theme;
    // Snow lies on the road where the surface is snow, and wherever a region heaps banks: there the
    // whole carriageway is snowed over, edge to edge.
    const drifts = STAGE_TYPES[stage.stageType].terrain.banks !== undefined;
    const snowy = stage.surface === 'snow' || drifts;
    const surfaces = theme.surfaces;
    const tarmac = theme.surface ?? surfaces.tarmac;
    const road = new Color(
      theme.surface ?? (drifts ? surfaces.snow : snowy ? surfaces.tarmac : surfaces[stage.surface]),
    );
    const dust = new Color(surfaces.snow);
    const tint = new Color();
    const line = themeColor(theme.line);
    const paved = { color: new Color(tarmac), lift: ROAD_LIFT };
    const pavement = { color: new Color(theme.pavement), lift: ROAD_LIFT + KERB_LIFT };
    const kerb = themeColor(theme.kerb);
    const town = stage.town;
    // A station is a cross-section of the ribbon: every sample, plus the exact ends of each
    // junction opening, where the verge and edge line stop and the junction surface takes over.
    const stationAt = (d: number, i: number | null): Station => {
      let x: number;
      let z: number;
      let heading: number;
      if (i !== null) {
        x = path.xs[i]!;
        z = path.zs[i]!;
        heading = path.headings[i]!;
      } else {
        path.sample(d, this.scratch);
        x = this.scratch.x;
        z = this.scratch.z;
        heading = this.scratch.heading;
      }
      const k = i ?? Math.floor(d / sp);
      return {
        d,
        k,
        x,
        z,
        lx: Math.cos(heading),
        lz: -Math.sin(heading),
        hw: halfWidthAt(stage, d),
        y: field.roadHeightAt(d),
        shade: 0.96 + hash01(k) * 0.08,
      };
    };
    const base: Station[] = [];
    for (let i = s0; i <= s1; i++) base.push(stationAt(i * sp, i));
    const stationsFor = (side: number | undefined): Station[] => {
      if (side === undefined) return base;
      const cuts = (side > 0 ? openings.left : openings.right)
        .flatMap((o) => [o.from, o.to])
        .filter((d) => d > s0 * sp + 1e-6 && d < s1 * sp - 1e-6);
      if (cuts.length === 0) return base;
      return [...base, ...cuts.map((d) => stationAt(d, null))].sort((p, q) => p.d - q.d);
    };
    const open = (side: number, d: number) =>
      (side > 0 ? openings.left : openings.right).some((o) => d > o.from && d < o.to);
    // Road, two verges and two edge lines; lateral extents follow the local half width. A sand
    // piste has no painted lines: its packed sand reads against the dunes on its own.
    // No edge lines on a sand piste, nor where snow banks line the road: the winter road is unmarked.
    const lined = stage.surface !== 'sand' && !drifts && stage.stageType !== 'autumnal';
    const edgeLines: Strip[] = [
      {
        a: (hw) => hw - 0.35 - LINE_WIDTH,
        b: (hw) => hw - 0.35,
        lift: LINE_LIFT,
        color: line,
        shaded: false,
        side: 1,
      },
      {
        a: (hw) => -hw + 0.35,
        b: (hw) => -hw + 0.35 + LINE_WIDTH,
        lift: LINE_LIFT,
        color: line,
        shaded: false,
        side: -1,
      },
    ];
    // Snow tongues from the banks onto the carriageway where the region heaps banks. They are part
    // of the carriageway itself, not a layer over it: the ribbon is cut across into a snowy band at
    // each edge and the bare middle, in one plane with shared edges, so tarmac never shows through
    // the snow nor fights it for depth or shadow. Across a junction's mouth the edge stays bare.
    // Snow tongues from the banks are only needed where bare tarmac shows between them; a
    // snowed-over road (banked regions) is snow from edge to edge already.
    const tongues = snowy && drifts && road.getHex() !== dust.getHex();
    const reach = (k: number, side: number) =>
      tongues && !open(side, k * sp) ? Math.min(1, driftShare(k, side)) : 0;
    // The bare middle's right (−) and left (+) edges, meeting halfway where the two tongues cross.
    const middleA = (hw: number, k: number) => {
      const lo = -hw + hw * reach(k, -1);
      const hi = hw - hw * reach(k, 1);
      return lo <= hi ? lo : (lo + hi) / 2;
    };
    const middleB = (hw: number, k: number) => {
      const lo = -hw + hw * reach(k, -1);
      const hi = hw - hw * reach(k, 1);
      return lo <= hi ? hi : (lo + hi) / 2;
    };
    const strips: Strip[] = [
      {
        a: middleA,
        b: middleB,
        lift: ROAD_LIFT,
        color: road,
        cover:
          !snowy || !theme.snowPatches
            ? undefined
            : !drifts
              ? snowCover
              : road.getHex() !== dust.getHex()
                ? sparseSnowCover
                : undefined,
        shaded: true,
        town: paved,
      },
      ...(tongues
        ? ([
            { a: middleB, b: (hw) => hw, lift: ROAD_LIFT, color: dust, shaded: true },
            { a: (hw) => -hw, b: middleA, lift: ROAD_LIFT, color: dust, shaded: true },
          ] satisfies Strip[])
        : []),
      {
        a: (hw) => hw,
        b: (hw) => hw + VERGE_WIDTH,
        lift: ROAD_LIFT,
        color: this.verge,
        shaded: true,
        town: pavement,
        side: 1,
        blendFromRoad: stage.stageType === 'autumnal',
      },
      {
        a: (hw) => -hw - VERGE_WIDTH,
        b: (hw) => -hw,
        lift: ROAD_LIFT,
        color: this.verge,
        shaded: true,
        town: pavement,
        side: -1,
        blendFromRoad: stage.stageType === 'autumnal',
      },
      ...(lined ? edgeLines : []),
      // Kerb faces in town, each wound with its raised edge placed so the face looks at the carriageway.
      {
        a: (hw) => hw,
        b: (hw) => hw,
        lift: ROAD_LIFT,
        color: kerb,
        shaded: false,
        town: { color: kerb, lift: ROAD_LIFT },
        side: 1,
        rise: KERB_LIFT,
      },
      {
        a: (hw) => -hw,
        b: (hw) => -hw,
        lift: ROAD_LIFT,
        color: kerb,
        shaded: false,
        town: { color: kerb, lift: ROAD_LIFT },
        side: -1,
        rise: -KERB_LIFT,
      },
    ];
    const pos: number[] = [];
    const col: number[] = [];
    const index: number[] = [];
    for (let stripIndex = strips.length - 1; stripIndex >= 0; stripIndex--) {
      const verge = strips[stripIndex]!;
      if (!verge.blendFromRoad) continue;
      const offsetAt = (band: number, k: number) => {
        const salt = verge.side === 1 ? 613 : 727;
        if (band === 0) return 0;
        if (band === 3) return VERGE_WIDTH;
        return band === 1
          ? 0.45 + 0.4 * driftNoise(k, 2.3, salt)
          : 1.1 + 0.5 * driftNoise(k, 3.1, salt + 19);
      };
      const bands = [0, 1, 2].map((band): Strip => ({
        ...verge,
        color: road.clone().lerp(verge.color, [0.18, 0.58, 1][band]!),
        a: (hw, k) => (verge.side === 1 ? hw + offsetAt(band, k) : -hw - offsetAt(band + 1, k)),
        b: (hw, k) => (verge.side === 1 ? hw + offsetAt(band + 1, k) : -hw - offsetAt(band, k)),
      }));
      strips.splice(stripIndex, 1, ...bands);
    }
    // Arctic snow and Autumnal mud keep the wheel ruts from cars before: two wandering grooves
    // cut into the road, with the mud tracks deeper and darker than the packed-snow pair; gravel
    // keeps only faint, fading traces of them.
    const roadBase = strips[0]!;
    const ruts =
      stage.surface === 'mud'
        ? MUD_RUTS
        : drifts && road.getHex() === dust.getHex()
          ? SNOW_RUTS
          : stage.surface === 'gravel'
            ? GRAVEL_RUTS
            : null;
    if (ruts) {
      const tracks = rutStrips(roadBase, ruts);
      if (stage.stageType === 'autumnal') {
        const left = mudEdgeTrack(roadBase, MUD_RUTS, -1);
        const right = mudEdgeTrack(roadBase, MUD_RUTS, 1);
        tracks[0]!.a = left[left.length - 1]!.b;
        tracks[tracks.length - 1]!.b = right[0]!.a;
        strips.splice(0, 1, ...left, ...tracks, ...right);
      } else strips.splice(0, 1, ...tracks);
    }
    // A city's carriageway in lane bands, each lane's wheel paths worn darker and the asphalt
    // mottled piece by piece; its pavements in rows of slabs (`SurfaceDetail`).
    if (stage.town?.city) {
      const carriageway = strips.indexOf(roadBase);
      if (carriageway >= 0)
        strips.splice(
          carriageway,
          1,
          ...Array.from({ length: MAX_BANDS }, (_, i): Strip => ({
            ...roadBase,
            a: (hw) => laneBands(hw)[i]?.a ?? hw,
            b: (hw) => laneBands(hw)[i]?.b ?? hw,
            detail: (hw, k) =>
              (laneBands(hw)[i]?.wheel ? WHEEL_TONE : 1) * cellTone(k, i, 101, ASPHALT_JITTER),
          })),
        );
      for (const side of [1, -1] as const) {
        const at = strips.findIndex((st) => st.side === side && st.town?.color === pavement.color);
        if (at < 0) continue;
        const verge = strips[at]!;
        const row = VERGE_WIDTH / SLAB_ROWS;
        strips.splice(
          at,
          1,
          ...Array.from({ length: SLAB_ROWS }, (_, r): Strip => ({
            ...verge,
            a: (hw) => (side === 1 ? hw + row * r : -hw - row * (r + 1)),
            b: (hw) => (side === 1 ? hw + row * (r + 1) : -hw - row * r),
            detail: (_hw, k) => cellTone(k, r, side === 1 ? 211 : 223, SLAB_JITTER),
          })),
        );
      }
    }
    // Into and out of a town the ribbon eases over TOWN_FADE: the surface colour toward tarmac, the
    // verges up into pavements, the kerb faces growing with them.
    const vertex = (st: Station, e: number, strip: Strip, raise = 0, dip = 0) => {
      const t = strip.town !== undefined && town !== undefined ? townFade(town, st.d) : 0;
      const rutBlend = 1 - t;
      // A built-up road's verges slope down its bank with the ground (none in town).
      const bank =
        strip.side !== undefined && strip.rise === undefined
          ? field.bankDrop(Math.abs(e) - st.hw) * (1 - t)
          : 0;
      const y =
        st.y +
        strip.lift +
        (t > 0 ? (strip.town!.lift - strip.lift) * t : 0) +
        raise * t -
        dip * rutBlend -
        bank;
      const tone = typeof strip.tone === 'function' ? strip.tone(st.k) : (strip.tone ?? 1);
      const shade = (strip.shaded ? st.shade : 1) * (1 + (tone - 1) * rutBlend);
      const c = strip.cover
        ? tint.copy(strip.color).lerp(dust, strip.cover(st.k) * (1 - t))
        : tint.copy(strip.color);
      if (t > 0) c.lerp(strip.town!.color, t);
      pos.push(st.x + st.lx * e, y, st.z + st.lz * e);
      col.push(c.r * shade, c.g * shade, c.b * shade);
    };
    for (const strip of strips) {
      const stations = stationsFor(strip.side);
      for (let k = 0; k + 1 < stations.length; k++) {
        const p = stations[k]!;
        const q = stations[k + 1]!;
        if (strip.side !== undefined && open(strip.side, (p.d + q.d) / 2)) continue;
        const mid = (p.d + q.d) / 2;
        if (strip.rise !== undefined && (!town || townFade(town, mid) < 0.02)) continue;
        // A band with no width at either end (a tongue-free stretch of edge) draws nothing.
        if (
          strip.rise === undefined &&
          strip.b(p.hw, p.k) - strip.a(p.hw, p.k) < 1e-4 &&
          strip.b(q.hw, q.k) - strip.a(q.hw, q.k) < 1e-4
        )
          continue;
        const base = pos.length / 3;
        // a is the right-hand edge; wind counter-clockwise seen from above. A kerb face raises one edge instead.
        const ra = strip.rise !== undefined && strip.rise < 0 ? -strip.rise : 0;
        const rb = strip.rise !== undefined && strip.rise > 0 ? strip.rise : 0;
        const [da, db] = strip.dip ?? [0, 0];
        if (strip.blendFromRoad) {
          const corners = [
            [p, strip.a(p.hw, p.k)],
            [q, strip.a(q.hw, q.k)],
            [p, strip.b(p.hw, p.k)],
            [q, strip.a(q.hw, q.k)],
            [q, strip.b(q.hw, q.k)],
            [p, strip.b(p.hw, p.k)],
          ] as const;
          for (const [station, lateral] of corners) vertex(station, lateral, strip);
          for (let triangle = 0; triangle < 2; triangle++) {
            const start = (base + triangle * 3) * 3;
            const variation =
              0.96 + 0.08 * hash01(p.k * 7 + triangle + (strip.side === 1 ? 31 : 59));
            for (let channel = 0; channel < 3; channel++) {
              const flat =
                ((col[start + channel]! + col[start + 3 + channel]! + col[start + 6 + channel]!) /
                  3) *
                variation;
              for (let corner = 0; corner < 3; corner++) col[start + corner * 3 + channel] = flat;
            }
          }
          index.push(base, base + 1, base + 2, base + 3, base + 4, base + 5);
          continue;
        }
        vertex(p, strip.a(p.hw, p.k), strip, ra, da);
        vertex(p, strip.b(p.hw, p.k), strip, rb, db);
        vertex(q, strip.a(q.hw, q.k), strip, ra, da);
        vertex(q, strip.b(q.hw, q.k), strip, rb, db);
        // A piece shaded on its own keeps its own corners: they do not weld to the next piece's.
        if (strip.detail) {
          const shade = strip.detail(p.hw, p.k);
          for (let i = base * 3; i < (base + 4) * 3; i++) col[i]! *= shade;
        }
        index.push(base, base + 2, base + 1, base + 2, base + 3, base + 1);
      }
    }
    const raw = new BufferGeometry();
    raw.setAttribute('position', new BufferAttribute(Float32Array.from(pos), 3));
    raw.setAttribute('color', new BufferAttribute(Float32Array.from(col), 3));
    raw.setIndex(index);
    // Quads are laid one by one; weld them so the normals smooth along the ribbon instead of faceting it.
    const geo = mergeVertices(raw, 1e-4);
    raw.dispose();
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }

  /** Verge posts every 20 m, except where a checkpoint, start or finish board stands. */
  private buildMarkers(stage: StageDef, field: TerrainField): void {
    const path = stage.path;
    const skip: MarkerSkip[] = stage.town ? [[stage.town.from, stage.town.to]] : [];
    if (!stage.circuit) {
      skip.push(controlBoardSkip(stage.startDistance));
      for (const g of stage.gates) if (g.kind === 'finish') skip.push(controlBoardSkip(g.distance));
    }
    const distances = markerDistances(path.length, stage.gates, skip);
    const count = distances.length * 2;
    // Where snow banks line the road the posts are snow poles: a tall thin orange rod with a white
    // band near the top, standing clear of the drifts; elsewhere a short white post with an orange cap.
    const snowPoles = STAGE_TYPES[stage.stageType].terrain.banks !== undefined;
    const postGeo = snowPoles
      ? new BoxGeometry(0.06, SNOW_POLE_HEIGHT, 0.06).translate(0, SNOW_POLE_HEIGHT / 2, 0)
      : new BoxGeometry(0.14, 0.9, 0.14).translate(0, 0.45, 0);
    const capGeo = snowPoles
      ? new BoxGeometry(0.07, 0.3, 0.07).translate(0, SNOW_POLE_HEIGHT - 0.45, 0)
      : new BoxGeometry(0.16, 0.18, 0.16).translate(0, 0.98, 0);
    this.geometries.push(postGeo, capGeo);
    const postMat = themedMaterial(snowPoles ? this.theme.cap : this.theme.post);
    const capMat = themedMaterial(snowPoles ? this.theme.post : this.theme.cap);
    this.materials.push(postMat, capMat);
    const posts = new InstancedMesh(postGeo, postMat, count);
    const caps = new InstancedMesh(capGeo, capMat, count);
    const dummy = new Object3D();
    const sample = { x: 0, z: 0, heading: 0 };
    let n = 0;
    for (const d of distances) {
      path.sample(d, sample);
      for (const side of [-1, 1]) {
        const off = (halfWidthAt(stage, d) + 1.4) * side;
        const x = sample.x + Math.cos(sample.heading) * off;
        const z = sample.z - Math.sin(sample.heading) * off;
        dummy.position.set(x, field.heightAt(x, z), z);
        dummy.rotation.set(0, sample.heading, 0);
        dummy.updateMatrix();
        posts.setMatrixAt(n, dummy.matrix);
        caps.setMatrixAt(n, dummy.matrix);
        n++;
      }
    }
    posts.computeBoundingSphere();
    caps.computeBoundingSphere();
    this.instanced.push(posts, caps);
    this.group.add(posts, caps);
  }
}
