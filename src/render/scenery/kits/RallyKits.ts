import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  type Material,
  MeshStandardMaterial,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { StagePalette } from '@/game/stage/regions';
import type { Prop, PropKind } from '@/game/stage/SceneryScatter';
import type { BuildingStyle } from '@/game/stage/Town';
import { buildingRoofGeometry, buildingWallsGeometry } from '../BuildingGeometry';
import { houseRoofGeometry, houseWallsGeometry } from '../HouseGeometry';
import { buildingPlantersGeometry } from '../PlanterGeometry';
import { canopyGeometry, foliageGeometry } from '../TreeGeometry';
import { autumnKits } from './AutumnKits';
import { pineKits } from './PineKits';
import { leafLitterGeometry, leafLitterMaterial } from '../LeafLitterGeometry';
import { tallGrassKits } from './GrassKits';
import type { KindKit } from '../SceneryChunkManager';
import { spectatorKits } from './SpectatorKits';
import {
  benchGeometry,
  binGeometry,
  bollardGeometry,
  hydrantGeometry,
  manholeGeometry,
  trafficLightGeometry,
  treePitGeometry,
} from '../CityFurnitureGeometry';
import {
  PARKED_CAR_MODELS,
  parkedCarBodyGeometry,
  parkedCarLightsGeometry,
} from '../CityVehicleGeometry';
import { arrowBoardGeometry, coneGeometry, lampPostGeometry } from '../StreetFurnitureGeometry';

/**
 * A tall Finnish spruce, after the low-poly snowy pine in `context/environment`
 * (used as a reference only) and the photographs: a thin trunk the whole
 * height, with irregular whorls of foliage on it, each an octagonal truncated
 * cone of its own width and depth, set a little off the axis and turned, with
 * gaps between them where the trunk shows, narrowing to a tip near 14 m. Two
 * silhouettes: the snowy trees (even variants) and the bare ones (odd), so
 * the forest wall never repeats one cone. In instanced parts so each takes
 * the right colour: the trunk in the palette's trunk colour, the foliage
 * white for the pine tint, and, on the snowy trees, a white snow sleeve
 * round every whorl's top, a snowed tip and a drift round the foot.
 */
interface Whorl {
  y: number;
  h: number;
  r: number;
  dx: number;
  dz: number;
  turn: number;
}
const SPRUCE_TOP = 13.6;
const SPRUCE_SNOWY: readonly Whorl[] = [
  { y: 1.3, h: 1.6, r: 2.5, dx: -0.1, dz: 0.15, turn: 0.45 },
  { y: 3.1, h: 1.3, r: 1.9, dx: 0.15, dz: -0.1, turn: 0.2 },
  { y: 4.6, h: 1.1, r: 1.45, dx: -0.2, dz: 0.1, turn: 0.6 },
  { y: 5.9, h: 1.55, r: 1.95, dx: 0.1, dz: 0.2, turn: 0.1 },
  { y: 7.7, h: 1.0, r: 1.15, dx: -0.1, dz: -0.2, turn: 0.4 },
  { y: 8.9, h: 1.3, r: 1.5, dx: 0.2, dz: 0.05, turn: 0.3 },
  { y: 10.4, h: 0.9, r: 0.9, dx: -0.1, dz: 0.1, turn: 0.5 },
  { y: 11.5, h: 1.1, r: 0.95, dx: 0.1, dz: -0.05, turn: 0.2 },
  // Clear of the whorl below: touching, its snow's top and this whorl's foot would share a plane.
  { y: 12.7, h: 0.85, r: 0.6, dx: 0.0, dz: 0.05, turn: 0.3 },
];
const SPRUCE_BARE: readonly Whorl[] = [
  { y: 1.6, h: 1.4, r: 2.2, dx: 0.15, dz: -0.15, turn: 0.1 },
  { y: 3.3, h: 1.2, r: 1.6, dx: -0.15, dz: 0.15, turn: 0.3 },
  { y: 4.8, h: 1.7, r: 2.15, dx: 0.2, dz: -0.1, turn: 0.1 },
  { y: 6.9, h: 1.0, r: 1.25, dx: -0.1, dz: -0.2, turn: 0.5 },
  { y: 8.2, h: 1.45, r: 1.6, dx: 0.15, dz: 0.2, turn: 0.2 },
  { y: 9.9, h: 0.9, r: 1.0, dx: -0.2, dz: 0.0, turn: 0.6 },
  { y: 11.1, h: 1.2, r: 1.05, dx: 0.1, dz: 0.1, turn: 0.4 },
  { y: 12.5, h: 1.0, r: 0.6, dx: -0.05, dz: 0.05, turn: 0.2 },
];
/** How much narrower a whorl's top is than its base. */
const WHORL_TAPER = 0.42;
/** The snow sleeve round each whorl's top: this tall, this much proud of the foliage. */
const SNOW_SLEEVE = 0.45;
const SNOW_PROUD = 1.07;

function whorlGeometry(w: Whorl, rTop: number, rBottom: number, h: number, y: number) {
  return new CylinderGeometry(rTop, rBottom, h, 8).rotateY(w.turn).translate(w.dx, y + h / 2, w.dz);
}

function spruceTrunkGeometry(): BufferGeometry {
  return new CylinderGeometry(0.09, 0.32, SPRUCE_TOP, 6).translate(0, SPRUCE_TOP / 2, 0);
}
/** A whorl's radius where its snow sleeve starts. */
function sleeveRadius(w: Whorl): number {
  const rTop = w.r * WHORL_TAPER;
  return w.r + ((rTop - w.r) * (w.h - SNOW_SLEEVE)) / w.h;
}
/**
 * The green of the whorls and the tip. On a snowy tree each whorl stops
 * where its snow sleeve starts and the sleeve carries on above it, and the
 * snowed tip stands alone: stacked, never one surface laid over another, so
 * no two faces share a plane and fight for depth.
 */
function spruceFoliageGeometry(whorls: readonly Whorl[], snowy: boolean): BufferGeometry {
  const parts = whorls.map((w) =>
    snowy
      ? whorlGeometry(w, sleeveRadius(w), w.r, w.h - SNOW_SLEEVE, w.y)
      : whorlGeometry(w, w.r * WHORL_TAPER, w.r, w.h, w.y),
  );
  if (!snowy) parts.push(new ConeGeometry(0.42, 1.4, 8).translate(0, SPRUCE_TOP - 0.1, 0));
  const merged = mergeGeometries(parts)!;
  for (const g of parts) g.dispose();
  return merged;
}
function spruceSnowGeometry(whorls: readonly Whorl[]): BufferGeometry {
  // A sleeve on top of each whorl's green, flaring a hair proud of it so it reads as a lip of
  // snow; the tip under snow, and a mound of drifted snow round the foot.
  const parts = whorls.map((w) => {
    const rTop = w.r * WHORL_TAPER;
    const rAt = sleeveRadius(w);
    return whorlGeometry(
      w,
      rTop * SNOW_PROUD,
      rAt * SNOW_PROUD,
      SNOW_SLEEVE,
      w.y + w.h - SNOW_SLEEVE,
    );
  });
  parts.push(new ConeGeometry(0.44, 1.44, 8).translate(0, SPRUCE_TOP - 0.06, 0));
  parts.push(new CylinderGeometry(1.1, 1.45, 0.32, 8).translate(0, 0.16, 0));
  const merged = mergeGeometries(parts)!;
  for (const g of parts) g.dispose();
  return merged;
}
/** Which spruce variants wear snow: the even ones, about half. */
const snowySpruce = (p: Prop) => p.variant % 2 === 0;

/**
 * A coconut palm, after the low-poly model in `context/palm-tree` (used as a
 * reference only): a trunk that leans and curves 2.3 m off the vertical over
 * 6.75 m, ringed, carrying eight drooping fronds (each three flat segments
 * bending down from the crown) and a cluster of coconuts under them. Three
 * instanced parts: the trunk in the palette's trunk colour, the fronds
 * white for the leaf tint, the coconuts their own brown.
 */
const PALM_HEIGHT = 6.75;
const PALM_LEAN = 2.3;
const PALM_SEGMENTS = 7;
const FROND_COUNT = 8;
/** The crown's centre: where the curved trunk ends. */
function palmTop(): [number, number] {
  return [-PALM_LEAN, PALM_HEIGHT];
}
/** A point on the trunk's curve at height share `t`: a parabola leaning to −x. */
function palmAxis(t: number): [number, number] {
  return [-PALM_LEAN * t * t, PALM_HEIGHT * t];
}
function palmTrunkGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < PALM_SEGMENTS; i++) {
    const t0 = i / PALM_SEGMENTS;
    const t1 = (i + 1) / PALM_SEGMENTS;
    const [x0, y0] = palmAxis(t0);
    const [x1, y1] = palmAxis(t1);
    const len = Math.hypot(x1 - x0, y1 - y0) + 0.08;
    const r0 = 0.3 - 0.14 * t0;
    const r1 = 0.3 - 0.14 * t1;
    const seg = new CylinderGeometry(r1, r0, len, 7).toNonIndexed();
    // Lean each segment along its chord (a rotation about z by θ tips the axis to (−sin θ, cos θ)),
    // and ring it with a slightly wider collar at its foot.
    const tilt = Math.atan2(-(x1 - x0), y1 - y0);
    seg.rotateZ(tilt);
    seg.translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
    parts.push(seg);
    const ring = new CylinderGeometry(r0 * 1.12, r0 * 1.12, 0.14, 7).toNonIndexed();
    ring.rotateZ(tilt);
    ring.translate(x0, y0 + 0.07, 0);
    parts.push(ring);
  }
  const merged = mergeGeometries(parts)!;
  for (const g of parts) g.dispose();
  return merged;
}

/** Eight fronds from the crown, each three flat segments that droop further the further out. */
function palmCrownGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const [topX, topY] = palmTop();
  for (let i = 0; i < FROND_COUNT; i++) {
    const yaw = (Math.PI * 2 * i) / FROND_COUNT + (i % 2) * 0.2;
    // The frond's own droop: a little upward at the base, then down and further down.
    let x = 0;
    let y = 0.25;
    let pitch = -0.25 + (i % 3) * 0.08;
    const lengths = [1.1, 1.0, 0.9];
    const widths = [0.55, 0.6, 0.42];
    for (let k = 0; k < 3; k++) {
      const seg = new BoxGeometry(widths[k]!, 0.07, lengths[k]!)
        .translate(0, 0, lengths[k]! / 2)
        .toNonIndexed();
      seg.rotateX(pitch);
      seg.translate(0, y, x);
      seg.rotateY(yaw);
      seg.translate(topX, topY, 0);
      parts.push(seg);
      x += Math.cos(pitch) * lengths[k]!;
      y -= Math.sin(pitch) * lengths[k]!;
      pitch += 0.45;
    }
  }
  // A knot where the fronds meet, hiding their roots.
  parts.push(new IcosahedronGeometry(0.42, 0).translate(topX, topY + 0.1, 0));
  const merged = mergeGeometries(parts)!;
  for (const g of parts) g.dispose();
  return merged;
}

/** A cluster of coconuts hanging under the crown. */
function palmCoconutGeometry(): BufferGeometry {
  const [topX, topY] = palmTop();
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (Math.PI * 2 * i) / 5;
    parts.push(
      new IcosahedronGeometry(0.2, 0).translate(
        topX + Math.cos(a) * 0.32,
        topY - 0.35 - (i % 2) * 0.12,
        Math.sin(a) * 0.32,
      ),
    );
  }
  const merged = mergeGeometries(parts)!;
  for (const g of parts) g.dispose();
  return merged;
}

/**
 * The city's parked cars: one body kit per hull shape, taken by the even or
 * odd variants, tinted from `colours` (each colour twice, so a variant's
 * colour is the same whichever hull it gets), and the cars' own lights.
 */
export function parkedCarKits(
  colours: readonly Color[],
  material: () => Material,
  lights: () => Material,
  shadows: boolean,
  lightsHook: Pick<KindKit, 'colorAt'> = {},
): KindKit[] {
  const tint = colours.flatMap((c) => [c, c]);
  return PARKED_CAR_MODELS.flatMap((model, i): KindKit[] => {
    const accept = (p: Prop) => p.variant % PARKED_CAR_MODELS.length === i;
    return [
      {
        sources: ['parkedCar'],
        geometry: parkedCarBodyGeometry(model),
        material: material(),
        tint,
        castShadow: shadows,
        vertexColors: true,
        accept,
      },
      {
        sources: ['parkedCar'],
        geometry: parkedCarLightsGeometry(model),
        material: lights(),
        tint: null,
        castShadow: false,
        vertexColors: true,
        accept,
        ...lightsHook,
      },
    ];
  });
}

/** The city's pavement furniture, each kind its own painted kit; only the tall pieces cast shadows. */
export const FURNITURE_KINDS = [
  'trafficLight',
  'bench',
  'bin',
  'hydrant',
  'bollard',
  'treePit',
  'manhole',
] as const satisfies readonly PropKind[];

export function furnitureGeometry(kind: (typeof FURNITURE_KINDS)[number]): BufferGeometry {
  return {
    trafficLight: trafficLightGeometry,
    bench: benchGeometry,
    bin: binGeometry,
    hydrant: hydrantGeometry,
    bollard: bollardGeometry,
    treePit: treePitGeometry,
    manhole: manholeGeometry,
  }[kind]();
}

function cityFurnitureKits(shadows: boolean): KindKit[] {
  return FURNITURE_KINDS.map((kind) => ({
    sources: [kind],
    geometry: furnitureGeometry(kind),
    material: mat('#ffffff', true),
    tint: null,
    castShadow: shadows && kind === 'trafficLight',
    vertexColors: true,
  }));
}

/** Every building style, and the ones that take the city renders. */
export const BUILDING_STYLES = [
  'townhouse',
  'shop',
  'tower',
  'hall',
  'block',
  'office',
  'tenement',
  'arcade',
] as const satisfies readonly BuildingStyle[];
const CITY_STYLES: readonly BuildingStyle[] = ['block', 'tenement', 'arcade'];

/** Per-cluster tints over the leaves' own colours, one per `LEAF_VARIANTS`. */
const LEAF_TINTS = ['#ffffff', '#f3e1c6', '#ffe6cf', '#e2d2bf'].map((c) => new Color(c));

function mat(color: string, vertexColors = false): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, vertexColors });
}

/**
 * The daytime scenery: cone pines, round broadleaf trees, blob bushes, faceted
 * rocks, farmhouses, the four town building styles with their flower boxes,
 * and the town's street furniture. `snow` (alpine) puts the houses under snow.
 */
export function rallyKits(palette: StagePalette, shadows: boolean, snow: boolean): KindKit[] {
  const pine = [new Color(palette.foliage), new Color(palette.foliageAlt)] as const;
  const leaf = [new Color(palette.canopy), new Color(palette.canopyAlt)] as const;
  const walls = snow
    ? ([new Color('#e9e6dd'), new Color('#cfc3a8')] as const)
    : ([new Color('#efe6cf'), new Color('#d9b26b')] as const);
  const roofs = snow
    ? ([new Color('#eef2f5'), new Color('#e4e9ee')] as const)
    : ([new Color('#b5523c'), new Color('#4a5160')] as const);
  // Town buildings: warmer render than the farmhouses, slate or terracotta roofs, all under snow in alpine towns.
  const townWalls = snow
    ? ([new Color('#e6e2d8'), new Color('#d3c6ad')] as const)
    : ([new Color('#f1e4c8'), new Color('#dcc8a3')] as const);
  const townRoofs = snow
    ? ([new Color('#eef2f5'), new Color('#e4e9ee')] as const)
    : ([new Color('#a8503a'), new Color('#4e5668')] as const);
  // City façades in four renders (brick, sandstone, white render, ochre) over four muted roofs; the
  // office's tint only reaches its spandrels and crown, so it runs pale to slate.
  const cityWalls = ['#9c5b47', '#d8b88a', '#ece6d6', '#c9923f'].map((c) => new Color(c));
  const cityRoofs = ['#6d6a66', '#8a7f72', '#5e6673', '#7a6358'].map((c) => new Color(c));
  const officeWalls = ['#dfe3e8', '#5f6b7a', '#c9bfae', '#8a95a3'].map((c) => new Color(c));
  const cars = ['#d9343a', '#2f5fa8', '#e9e4d8', '#3b3d44', '#e0a52a'].map((c) => new Color(c));
  const wallsFor = (style: BuildingStyle) =>
    style === 'office' ? officeWalls : CITY_STYLES.includes(style) ? cityWalls : townWalls;
  const roofsFor = (style: BuildingStyle) =>
    style === 'office' || CITY_STYLES.includes(style) ? cityRoofs : townRoofs;
  const autumn = palette.autumn ? autumnKits(palette.autumn, shadows) : null;
  return [
    ...(autumn ?? [
      ...(palette.pines
        ? pineKits(palette.pines, shadows)
        : [
            {
              sources: ['tree'],
              geometry: foliageGeometry(),
              material: mat('#ffffff'),
              tint: pine,
              castShadow: shadows,
            } satisfies KindKit,
          ]),
      {
        sources: ['broadleaf'],
        geometry: canopyGeometry(),
        material: mat('#ffffff'),
        tint: leaf,
        castShadow: shadows,
      } satisfies KindKit,
      {
        sources: ['bush'],
        geometry: new IcosahedronGeometry(0.9, 0).translate(0, 0.45, 0),
        material: mat('#ffffff'),
        tint: pine,
        castShadow: false,
      } satisfies KindKit,
    ]),
    {
      sources: ['spruce'],
      geometry: spruceFoliageGeometry(SPRUCE_SNOWY, true),
      material: mat('#ffffff'),
      tint: pine,
      castShadow: shadows,
      accept: snowySpruce,
    },
    {
      sources: ['spruce'],
      geometry: spruceFoliageGeometry(SPRUCE_BARE, false),
      material: mat('#ffffff'),
      tint: pine,
      castShadow: shadows,
      accept: (p) => !snowySpruce(p),
    },
    {
      sources: ['spruce'],
      geometry: spruceTrunkGeometry(),
      material: mat(palette.trunk),
      tint: null,
      castShadow: shadows,
    },
    {
      sources: ['spruce'],
      geometry: spruceSnowGeometry(SPRUCE_SNOWY),
      material: mat('#eef2f5'),
      tint: null,
      castShadow: false,
      accept: snowySpruce,
    },
    {
      sources: ['palm'],
      geometry: palmTrunkGeometry(),
      material: mat(palette.trunk),
      tint: null,
      castShadow: shadows,
    },
    {
      sources: ['palm'],
      geometry: palmCrownGeometry(),
      material: mat('#ffffff'),
      tint: leaf,
      castShadow: shadows,
    },
    {
      sources: ['palm'],
      geometry: palmCoconutGeometry(),
      material: mat('#6e4a2a'),
      tint: null,
      castShadow: false,
    },
    {
      sources: ['tree', 'broadleaf'],
      geometry: new CylinderGeometry(0.16, 0.24, 1.6, 5).translate(0, 0.8, 0),
      material: mat(palette.trunk),
      tint: null,
      castShadow: shadows,
      // Pine woods give their pines their own long trunks.
      ...(palette.pines ? { accept: (p: Prop) => p.kind !== 'tree' } : {}),
      // Broadleaf canopies sit higher, so stretch their trunks.
      place: (p, dummy) => {
        if (p.kind === 'broadleaf') dummy.scale.y *= 1.6;
      },
    },
    {
      // Fallen leaves (stage types with `leaves`): flat on the ground, warmer or paler cluster by cluster.
      sources: ['leaves'],
      geometry: leafLitterGeometry(),
      material: leafLitterMaterial(),
      tint: LEAF_TINTS,
      vertexColors: true,
      castShadow: false,
      receiveShadow: shadows,
    },
    ...tallGrassKits(palette, shadows),
    {
      sources: ['rock'],
      geometry: new DodecahedronGeometry(0.9, 0).translate(0, 0.25, 0),
      material: mat(palette.boulder),
      tint: null,
      castShadow: shadows,
      // Rocks sit into the ground and tumble about their heading.
      place: (p, dummy) => {
        dummy.position.y -= 0.2 * p.scale;
        dummy.rotation.x = p.rotation;
      },
    },
    {
      sources: ['house'],
      geometry: houseWallsGeometry(),
      material: mat('#ffffff', true),
      tint: walls,
      castShadow: shadows,
      vertexColors: true,
    },
    {
      sources: ['house'],
      geometry: houseRoofGeometry(),
      material: mat('#ffffff', true),
      tint: roofs,
      castShadow: shadows,
      vertexColors: true,
    },
    // Town buildings: walls and roofs tinted per variant like the houses, in four footprints,
    // and untinted flower boxes under the windows of the houses and shops.
    ...BUILDING_STYLES.flatMap((style): KindKit[] => {
      const planters = buildingPlantersGeometry(style);
      return [
        {
          sources: [style],
          geometry: buildingWallsGeometry(style),
          material: mat('#ffffff', true),
          tint: wallsFor(style),
          castShadow: shadows,
          vertexColors: true,
        },
        {
          sources: [style],
          geometry: buildingRoofGeometry(style),
          material: mat('#ffffff', true),
          tint: roofsFor(style),
          castShadow: shadows,
          vertexColors: true,
        },
        ...(planters
          ? [
              {
                sources: [style] as const,
                geometry: planters,
                material: mat('#ffffff', true),
                tint: null,
                castShadow: false,
                vertexColors: true,
                accept: (p) => p.variant % 2 === 1,
              } satisfies KindKit,
            ]
          : []),
      ];
    }),
    // Parked cars: the drivable hulls in plain paint, and their own lights.
    ...parkedCarKits(
      cars,
      () => mat('#ffffff', true),
      () => mat('#ffffff', true),
      shadows,
    ),
    // Town street furniture keeps its own painted colours.
    ...(
      [
        ['cone', coneGeometry()],
        ['arrowLeft', arrowBoardGeometry('left')],
        ['arrowRight', arrowBoardGeometry('right')],
        ['lamp', lampPostGeometry()],
      ] as const
    ).map(([kind, geometry]): KindKit => ({
      sources: [kind],
      geometry,
      material: mat('#ffffff', true),
      tint: null,
      castShadow: shadows,
      vertexColors: true,
    })),
    ...cityFurnitureKits(shadows),
    // Snow stage types dress the crowd in padded jackets; elsewhere in T-shirts and long sleeves.
    ...(snow
      ? spectatorKits(() => mat('#ffffff', true), JACKETS, shadows)
      : spectatorKits(() => mat('#ffffff', true), SHIRTS, shadows, null, 'casual')),
  ];
}

/** Spectators' jackets, by variant: red, blue, yellow, green, orange, black. */
const JACKETS = ['#d8343a', '#2f6fb0', '#e9b53a', '#3f8a4a', '#e0702a', '#2a2d33'].map(
  (c) => new Color(c),
);
/** Their tops on a mild day, by variant: white, blue, red, yellow, green, purple. */
const SHIRTS = ['#f2efe8', '#2f6fb0', '#d8343a', '#e9b53a', '#3f8a4a', '#7a4e9c'].map(
  (c) => new Color(c),
);
