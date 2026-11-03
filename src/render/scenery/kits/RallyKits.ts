import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  MeshStandardMaterial,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { RegionPalette } from '@/game/stage/regions';
import { buildingRoofGeometry, buildingWallsGeometry } from '../BuildingGeometry';
import { houseRoofGeometry, houseWallsGeometry } from '../HouseGeometry';
import { buildingPlantersGeometry } from '../PlanterGeometry';
import type { KindKit } from '../SceneryChunkManager';
import { arrowBoardGeometry, coneGeometry, lampPostGeometry } from '../StreetFurnitureGeometry';

function foliageGeometry(): BufferGeometry {
  // Foliage starts 1.3 m up so the trunk shows, in the tree and in its shadow.
  const low = new ConeGeometry(1.35, 2.6, 7).translate(0, 2.6, 0);
  const high = new ConeGeometry(0.95, 2.1, 7).translate(0, 3.8, 0);
  const merged = mergeGeometries([low, high])!;
  low.dispose();
  high.dispose();
  return merged;
}

function canopyGeometry(): BufferGeometry {
  const parts = [
    new IcosahedronGeometry(1.5, 0).translate(0, 3.1, 0),
    new IcosahedronGeometry(1.05, 0).translate(0.9, 2.7, 0.3),
    new IcosahedronGeometry(0.95, 0).translate(-0.7, 3.6, -0.4),
  ];
  const merged = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  return merged;
}

/** A date palm's trunk: slim, tapering, leaning a little. */
const PALM_LEAN = 0.1;
const PALM_HEIGHT = 4.4;

function palmTrunkGeometry(): BufferGeometry {
  const g = new CylinderGeometry(0.13, 0.22, PALM_HEIGHT, 6).translate(0, PALM_HEIGHT / 2, 0);
  g.rotateZ(PALM_LEAN);
  return g;
}

/** Seven drooping fronds and a knot of dates at the top of the leaning trunk. */
function palmCrownGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const topX = -Math.sin(PALM_LEAN) * PALM_HEIGHT;
  const topY = Math.cos(PALM_LEAN) * PALM_HEIGHT;
  for (let i = 0; i < 7; i++) {
    // Non-indexed like the date knot, so the parts merge.
    const frond = new BoxGeometry(0.5, 0.08, 2.4).translate(0, 0, 1.2).toNonIndexed();
    frond.rotateX(0.55 + (i % 2) * 0.25);
    frond.rotateY((Math.PI * 2 * i) / 7);
    frond.translate(topX, topY, 0);
    parts.push(frond);
  }
  parts.push(new IcosahedronGeometry(0.35, 0).translate(topX, topY - 0.2, 0));
  const merged = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  return merged;
}

function mat(color: string, vertexColors = false): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, vertexColors });
}

/**
 * The daytime scenery: cone pines, round broadleaf trees, blob bushes, faceted
 * rocks, farmhouses, the four town building styles with their flower boxes,
 * and the town's street furniture. `snow` (alpine) puts the houses under snow.
 */
export function rallyKits(palette: RegionPalette, shadows: boolean, snow: boolean): KindKit[] {
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
  return [
    {
      sources: ['tree'],
      geometry: foliageGeometry(),
      material: mat('#ffffff'),
      tint: pine,
      castShadow: shadows,
    },
    {
      sources: ['broadleaf'],
      geometry: canopyGeometry(),
      material: mat('#ffffff'),
      tint: leaf,
      castShadow: shadows,
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
      sources: ['tree', 'broadleaf'],
      geometry: new CylinderGeometry(0.16, 0.24, 1.6, 5).translate(0, 0.8, 0),
      material: mat(palette.trunk),
      tint: null,
      castShadow: shadows,
      // Broadleaf canopies sit higher, so stretch their trunks.
      place: (p, dummy) => {
        if (p.kind === 'broadleaf') dummy.scale.y *= 1.6;
      },
    },
    {
      sources: ['bush'],
      geometry: new IcosahedronGeometry(0.9, 0).translate(0, 0.45, 0),
      material: mat('#ffffff'),
      tint: pine,
      castShadow: false,
    },
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
    ...(['townhouse', 'shop', 'tower', 'hall'] as const).flatMap((style): KindKit[] => {
      const planters = buildingPlantersGeometry(style);
      return [
        {
          sources: [style],
          geometry: buildingWallsGeometry(style),
          material: mat('#ffffff', true),
          tint: townWalls,
          castShadow: shadows,
          vertexColors: true,
        },
        {
          sources: [style],
          geometry: buildingRoofGeometry(style),
          material: mat('#ffffff', true),
          tint: townRoofs,
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
                accept: (p) => p.variant === 1,
              } satisfies KindKit,
            ]
          : []),
      ];
    }),
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
  ];
}
