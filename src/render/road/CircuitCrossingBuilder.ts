import { type BufferGeometry, Color, DoubleSide, Group, Mesh, MeshStandardMaterial } from 'three';
import {
  BRIDGE_REACH,
  PARAPET_GAP,
  ROOF_HALF,
  SLAB_DEPTH,
  WALL_BODY,
  WALL_GAP,
  WALL_REACH,
  lapGap,
  type CircuitCrossing,
} from '@/game/stage/CircuitCrossing';
import { createRoadHit, type RoadSample } from '@/game/stage/RoadPath';
import type { StageDef } from '@/game/stage/StageGenerator';
import { ROAD_LIFT, type TerrainField } from '@/game/stage/TerrainField';
import { cellHash } from './SurfaceDetail';
import { TrackMesh } from './TrackMesh';

/**
 * A circuit's crossing (`CircuitCrossing`), built: the tunnel road's
 * cutting lined with concrete retaining walls from its deck up to the
 * ground above, the bridge road carried over it on a broad concrete slab
 * (the tunnel's roof, reaching well past the bridge's carriageway either
 * side) with parapets along its edges. The barrier rail stops where these
 * stand in for it (`BarrierBuilder`). One flat-shaded, vertex-coloured mesh.
 */

const WALL = new Color('#a9a497');
const WALL_CAP = new Color('#c9c5bb');
const SLAB = new Color('#b7b3aa');
const PARAPET = new Color('#d6d2c8');
/** How far the walls' foot reaches under the deck, and their coping over the ground. */
const WALL_FOOT = 0.5;
const WALL_COPE = 0.3;
/** The walls stand at least this high over the tunnel road everywhere along it, as tall as the barrier rail they meet. */
const WALL_MIN = 0.8;
/** The walls are cast in courses this tall, panels this many samples long; every block strays this much lighter or darker. */
const COURSE = 1.1;
const PANEL_SAMPLES = 2;
const CONCRETE_JITTER = 0.07;
/** A share of the wall's panel columns are weathered, up to this much darker at their foot. */
const STAIN_SHARE = 0.3;
const STAIN = 0.14;
/** The slab is cast in this many blocks across. */
const SLAB_BLOCKS = 4;
/** Scratch colour for each shaded face. */
const tint = new Color();

/** The parapets' height over the deck, and thickness. */
const PARAPET_HEIGHT = 1;
const PARAPET_THICK = 0.4;

export class CircuitCrossingBuilder {
  readonly group = new Group();
  private readonly geometry: BufferGeometry | null;
  private readonly material: MeshStandardMaterial;

  constructor(stage: StageDef, field: TerrainField, c: CircuitCrossing) {
    this.group.name = 'circuit-crossing';
    this.material = new MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.9,
      // The walls' faces are single quads seen from either side.
      side: DoubleSide,
    });
    const mesh = new TrackMesh();
    const { path, halfWidth: hw } = stage;
    const a: RoadSample = { x: 0, z: 0, heading: 0 };
    const b: RoadSample = { x: 0, z: 0, heading: 0 };
    const step = path.spacing;
    const deck = (d: number) => field.roadHeightAt(d) + ROAD_LIFT;
    // Under the slab a wall stops at its underside: the slab is the tunnel's roof.
    const hit = createRoadHit();
    const window = lapGap(c.over, c.under, path.length) / 2;
    const roofOver = (x: number, z: number) =>
      path.nearest(x, z, ROOF_HALF + 0.5, hit, c.over, window) &&
      Math.abs(lapGap(hit.along, c.over, path.length)) <= BRIDGE_REACH
        ? deck(hit.along) - SLAB_DEPTH - 0.04
        : Infinity;

    // The cutting's walls: a continuous concrete face either side of the tunnel road, from under
    // its deck up to the ground behind (or the slab's underside), capped with a coping.
    const inner = hw + WALL_GAP;
    // The block's top meets the ground behind it, past the cutting's climb out.
    const behind = inner + WALL_BODY + 0.5;
    const portal = deck(c.over) + 0.2;
    for (const side of [1, -1]) {
      type Station = { ix: number; iz: number; ox: number; oz: number; floor: number; top: number };
      const stations: Station[] = [];
      for (let d = c.under - WALL_REACH; d <= c.under + WALL_REACH; d += step) {
        path.sample(d, a);
        // Left of travel is (cos h, −sin h).
        const lx = Math.cos(a.heading) * side;
        const lz = -Math.sin(a.heading) * side;
        const ix = a.x + lx * inner;
        const iz = a.z + lz * inner;
        const floor = deck(d) - WALL_FOOT;
        // Level along its top: never over the bridge deck's own height (the portal's), so the
        // embankment's hump behind does not lift it into a ramp; never lower than a barrier's height
        // over the road, so it runs on to meet the barrier rail at each end.
        const top = Math.min(
          field.heightAt(a.x + lx * behind, a.z + lz * behind) + WALL_COPE,
          roofOver(ix, iz),
          portal,
        );
        stations.push({
          ix,
          iz,
          ox: ix + lx * WALL_BODY,
          oz: iz + lz * WALL_BODY,
          floor,
          top: Math.max(top, floor + WALL_FOOT + WALL_MIN),
        });
      }
      for (let k = 0; k + 1 < stations.length; k++) {
        const p = stations[k]!;
        const q = stations[k + 1]!;
        // The face in courses of cast panels, each a shade of its own, some columns weathered
        // darker toward their foot.
        const panel = Math.floor(k / PANEL_SAMPLES);
        const stain = cellHash(panel, side, 811) < STAIN_SHARE;
        const rows = Math.max(
          1,
          Math.ceil((Math.max(p.top, q.top) - Math.min(p.floor, q.floor)) / COURSE),
        );
        for (let r = 0; r < rows; r++) {
          const y = (st: { floor: number; top: number }, f: number) =>
            st.floor + (st.top - st.floor) * f;
          const f0 = r / rows;
          const f1 = (r + 1) / rows;
          const tone =
            1 +
            (cellHash(panel, r + side * 31, 809) - 0.5) * 2 * CONCRETE_JITTER -
            (stain ? STAIN * (1 - f0) : 0);
          mesh.ribbon(
            [p.ix, y(p, f0), p.iz],
            [p.ix, y(p, f1), p.iz],
            [q.ix, y(q, f0), q.iz],
            [q.ix, y(q, f1), q.iz],
            tint.copy(WALL).multiplyScalar(tone),
          );
        }
        mesh.ribbon(
          [p.ox, p.floor, p.oz],
          [p.ox, p.top, p.oz],
          [q.ox, q.floor, q.oz],
          [q.ox, q.top, q.oz],
          WALL,
        );
        mesh.ribbon(
          [p.ix, p.top, p.iz],
          [p.ox, p.top, p.oz],
          [q.ix, q.top, q.iz],
          [q.ox, q.top, q.oz],
          tint.copy(WALL_CAP).multiplyScalar(1 + (cellHash(panel, side, 813) - 0.5) * 0.08),
        );
      }
    }

    // The bridge: the slab under the bridge road's deck (the tunnel's roof) and its parapets.
    const parapetAt = hw + PARAPET_GAP + PARAPET_THICK / 2;
    for (let d = c.over - BRIDGE_REACH; d < c.over + BRIDGE_REACH; d += step) {
      path.sample(d, a);
      path.sample(d + step, b);
      const heading = Math.atan2(b.x - a.x, b.z - a.z);
      const mx = (a.x + b.x) / 2;
      const mz = (a.z + b.z) / 2;
      const top = deck(d + step / 2) - 0.04;
      // The slab in cast blocks across, each its own shade.
      const along = Math.round((d - c.over) / step);
      const blockW = (ROOF_HALF * 2) / SLAB_BLOCKS;
      for (let n = 0; n < SLAB_BLOCKS; n++) {
        const off = -ROOF_HALF + blockW * (n + 0.5);
        const lx = Math.cos(heading);
        const lz = -Math.sin(heading);
        mesh.box(
          mx + lx * off,
          top - SLAB_DEPTH / 2,
          mz + lz * off,
          blockW + 0.02,
          SLAB_DEPTH,
          step + 0.05,
          heading,
          tint
            .copy(SLAB)
            .multiplyScalar(
              1 + (cellHash(Math.floor(along / 2), n, 817) - 0.5) * 2 * CONCRETE_JITTER,
            ),
        );
      }
      for (const side of [1, -1]) {
        const lx = Math.cos(heading) * side;
        const lz = -Math.sin(heading) * side;
        mesh.box(
          mx + lx * parapetAt,
          top + PARAPET_HEIGHT / 2,
          mz + lz * parapetAt,
          PARAPET_THICK,
          PARAPET_HEIGHT,
          step + 0.05,
          heading,
          tint.copy(PARAPET).multiplyScalar(1 + (cellHash(along, side, 821) - 0.5) * 0.1),
        );
      }
    }

    this.geometry = mesh.empty ? null : mesh.build();
    if (this.geometry) {
      const m = new Mesh(this.geometry, this.material);
      m.castShadow = true;
      m.receiveShadow = true;
      m.matrixAutoUpdate = false;
      this.group.add(m);
    }
  }

  dispose(): void {
    this.geometry?.dispose();
    this.material.dispose();
  }
}
