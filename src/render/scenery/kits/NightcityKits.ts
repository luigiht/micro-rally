import { Color, MeshBasicMaterial, MeshStandardMaterial, type Object3D } from 'three';
import type { Prop } from '@/game/stage/SceneryScatter';
import { buildingRoofGeometry, buildingWallsGeometry } from '../BuildingGeometry';
import { arrowBoardGeometry, coneGeometry } from '../StreetFurnitureGeometry';
import {
  bollardBodyGeometry,
  bollardGlowGeometry,
  SIGN_VARIANTS,
  signBodyGeometry,
  signGlowGeometry,
} from '../night/NightSignGeometry';
import {
  blockBodyGeometry,
  blockGlowGeometry,
  buildingTrimGeometry,
  lampHeadGlowGeometry,
  nightLampBodyGeometry,
  podBodyGeometry,
  podGlowGeometry,
} from '../night/NightStreetGeometry';
import {
  mastBodyGeometry,
  mastGlowGeometry,
  towerBodyGeometry,
  towerGlowGeometry,
  type TowerTier,
} from '../night/NightTowerGeometry';
import type { KindKit } from '../SceneryChunkManager';
import { NEON } from '../../theme/WorldTheme';

/** The nearest point of the stage road to a prop, and how far it is. */
export interface RoadNear {
  dist: number;
  x: number;
  z: number;
}

export interface NightcityKitOptions {
  shadows: boolean;
  /** Where the road passes a prop; decides tower height and which way signs face. */
  near: (p: Prop) => RoadNear;
}

/** How bright the glow kits are baked: HDR, so the neon shader and bloom lift them. */
export const GLOW = 2.4;
const HUES = [NEON.cyan, NEON.magenta, NEON.amber, NEON.violet].map((h) => new Color(h));

/** Integer mix hash to 0..1 from a prop's position, salted so one prop can draw several independent numbers. */
export function propHash(p: Prop, salt: number): number {
  let h = Math.imul(
    Math.round(p.x * 8) ^ (Math.round(p.z * 8) << 13) ^ (salt * 0x9e3779b9),
    374761393,
  );
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** One of the four neon hues, by hash, at glow brightness. */
export function hueAt(p: Prop, out: Color): Color {
  return out.copy(HUES[Math.floor(propHash(p, 7) * HUES.length)]!).multiplyScalar(GLOW);
}

/** Trees become towers near the road only when they can stay low; height tiers by distance. */
export function tierFor(dist: number): TowerTier {
  if (dist <= 12) return 'kiosk';
  if (dist <= 30) return 'mid';
  return 'tall';
}

/** What a tree slot becomes: three towers and two masts in ten, the rest left dark (110 trees per 100 m is too dense for buildings). */
export function treeRole(p: Prop): 'tower' | 'mast' | null {
  const u = propHash(p, 3);
  if (u < 0.3) return 'tower';
  if (u < 0.5) return 'mast';
  return null;
}

function body(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: '#ffffff',
    flatShading: true,
    roughness: 0.85,
    vertexColors: true,
  });
}

function glow(): MeshBasicMaterial {
  return new MeshBasicMaterial({ vertexColors: true });
}

/** Turn the instance so its -z face looks at the road. */
function faceRoad(p: Prop, hit: RoadNear, dummy: Object3D): void {
  dummy.rotation.y = Math.atan2(p.x - hit.x, p.z - hit.z);
}

/** A body kit and its glow kit over the same props. */
function pair(
  sources: KindKit['sources'],
  bodyGeo: KindKit['geometry'],
  glowGeo: KindKit['geometry'],
  shadows: boolean,
  hooks: Pick<KindKit, 'accept' | 'place'> = {},
): KindKit[] {
  return [
    {
      sources,
      geometry: bodyGeo,
      material: body(),
      tint: null,
      castShadow: shadows,
      vertexColors: true,
      ...hooks,
    },
    {
      sources,
      geometry: glowGeo,
      material: glow(),
      tint: null,
      castShadow: false,
      vertexColors: true,
      colorAt: hueAt,
      ...hooks,
    },
  ];
}

/**
 * Nightcity's dress for a region's props: stilt towers and masts where the
 * trees stood, neon signs and bollards for the bushes, cargo pods for the
 * rocks, mid-rise blocks on the farmhouse pads, the town's buildings tinted
 * dark under a neon roofline, lit lamp heads, and the cones and boards as
 * they are. Colliders are the daytime ones, so every body stays inside them.
 */
export function nightcityKits({ shadows, near }: NightcityKitOptions): KindKit[] {
  const trees = ['tree', 'broadleaf', 'palm'] as const;
  const townWalls = [new Color('#1a1c26'), new Color('#20232f')] as const;
  const townRoofs = [new Color('#0f1118'), new Color('#141722')] as const;
  const heightJitter = (p: Prop, dummy: Object3D) => {
    dummy.scale.y *= 0.9 + propHash(p, 11) * 0.25;
  };
  return [
    ...(['kiosk', 'mid', 'tall'] as const).flatMap((tier) =>
      pair(trees, towerBodyGeometry(tier), towerGlowGeometry(tier), shadows, {
        accept: (p) => treeRole(p) === 'tower' && tierFor(near(p).dist) === tier,
        place: heightJitter,
      }),
    ),
    ...pair(trees, mastBodyGeometry(), mastGlowGeometry(), shadows, {
      accept: (p) => treeRole(p) === 'mast',
    }),
    ...Array.from({ length: SIGN_VARIANTS }, (_, v) =>
      pair(['bush'], signBodyGeometry(v), signGlowGeometry(v), shadows, {
        accept: (p) => propHash(p, 5) < 0.5 && Math.floor(propHash(p, 9) * SIGN_VARIANTS) === v,
        place: (p, dummy) => faceRoad(p, near(p), dummy),
      }),
    ).flat(),
    ...pair(['bush'], bollardBodyGeometry(), bollardGlowGeometry(), false, {
      accept: (p) => propHash(p, 5) >= 0.5,
    }),
    ...pair(['rock'], podBodyGeometry(), podGlowGeometry(), shadows, {
      place: (p, dummy) => {
        dummy.position.y -= 0.1 * p.scale;
      },
    }),
    ...pair(['house'], blockBodyGeometry(), blockGlowGeometry(), shadows),
    ...(['townhouse', 'shop', 'tower', 'hall'] as const).flatMap((style): KindKit[] => [
      {
        sources: [style],
        geometry: buildingWallsGeometry(style),
        material: body(),
        tint: townWalls,
        castShadow: shadows,
        vertexColors: true,
      },
      {
        sources: [style],
        geometry: buildingRoofGeometry(style),
        material: body(),
        tint: townRoofs,
        castShadow: shadows,
        vertexColors: true,
      },
      {
        sources: [style],
        geometry: buildingTrimGeometry(style),
        material: glow(),
        tint: null,
        castShadow: false,
        vertexColors: true,
        colorAt: hueAt,
      },
    ]),
    ...pair(['lamp'], nightLampBodyGeometry(), lampHeadGlowGeometry(), shadows),
    ...(
      [
        ['cone', coneGeometry()],
        ['arrowLeft', arrowBoardGeometry('left')],
        ['arrowRight', arrowBoardGeometry('right')],
      ] as const
    ).map(([kind, geometry]): KindKit => ({
      sources: [kind],
      geometry,
      material: body(),
      tint: null,
      castShadow: shadows,
      vertexColors: true,
    })),
  ];
}
