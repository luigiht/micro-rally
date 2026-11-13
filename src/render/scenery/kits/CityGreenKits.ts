import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  MeshStandardMaterial,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Prop } from '@/game/stage/SceneryScatter';
import { STREET_TREE_SPECIES, SHRUB_SHAPES } from '@/game/stage/StreetFurniture';
import type { KindKit } from '../SceneryChunkManager';
import {
  canopyGeometry,
  ovalCanopyGeometry,
  spotHash,
  tieredCanopyGeometry,
} from '../TreeGeometry';

/**
 * A city's greenery (`StreetFurniture`): street trees of six species, each
 * street mostly planted with one, and the boulevards' median shrubs in five
 * shapes, all in shades of green, each median planted to a scheme. A species or shape is the prop's
 * `variant`; its colour is drawn from that species' own few, a shade either
 * way by the tree's spot, so no two trees in a row are quite alike.
 */

const mat = () => new MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.9 });

/** The street trees' crowns, all green: round lime, oval hornbeam, layered plane, slim column, pale birch, dark holm oak. */
const TREE_COLOURS: readonly (readonly string[])[] = [
  ['#6aa84f', '#7cb35a', '#5f9c48'],
  ['#3f7a3f', '#4a8a46', '#376d3a'],
  ['#6b8f3a', '#7a9c44', '#5f8435'],
  ['#4f8a4a', '#5a9852', '#457c42'],
  ['#8fbf5e', '#9cc96a', '#83b354'],
  ['#2e5e34', '#376a3c', '#28542e'],
];

/** The median shrubs, all green, each shape its own shades: round bush, hedge mound, small conifer, leafy bush, grass clump. */
const SHRUB_COLOURS: readonly (readonly string[])[] = [
  ['#4f8a3c', '#5e9a46', '#447a35'],
  ['#2f6b35', '#38783d', '#29602f'],
  ['#2b5e3a', '#336a42', '#244f31'],
  ['#7fb35a', '#8cbf62', '#72a84f'],
  ['#6f9a45', '#7ea852', '#628d3d'],
];

/** A colour from `colours` by the prop's spot, a shade either way. */
function colourAt(colours: readonly (readonly string[])[], salt: number) {
  const palettes = colours.map((c) => c.map((h) => new Color(h)));
  return (p: Prop, out: Color) => {
    const set = palettes[p.variant % palettes.length]!;
    out.copy(set[Math.floor(spotHash(p, salt) * set.length)]!);
    out.multiplyScalar(0.92 + spotHash(p, salt + 1) * 0.16);
  };
}

/** A low hedge mound: three rounded clumps of leaves run together, longest along the divider. */
function hedgeMound(): BufferGeometry {
  return mergeGeometries([
    new IcosahedronGeometry(0.6, 0).rotateY(0.4).scale(1, 0.8, 0.9).translate(-0.55, 0.42, 0.04),
    new IcosahedronGeometry(0.72, 0).rotateY(1.1).scale(1, 0.85, 1).translate(0.05, 0.52, -0.03),
    new IcosahedronGeometry(0.56, 0).rotateY(2.3).scale(1, 0.8, 0.9).translate(0.62, 0.4, 0.05),
  ])!;
}

/** A clump of ornamental grass: thin blades leaning out from the middle. */
function grassClump(): BufferGeometry {
  const blades: BufferGeometry[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    blades.push(
      new ConeGeometry(0.13, 1.3, 4)
        .translate(0, 0.65, 0)
        .rotateX(0.32)
        .rotateY(a)
        .translate(Math.sin(a) * 0.12, 0, Math.cos(a) * 0.12),
    );
  }
  blades.push(new ConeGeometry(0.16, 1.5, 4).translate(0, 0.75, 0));
  // The blades are non-indexed cones: merge them as they are.
  return mergeGeometries(blades.map((b) => b.toNonIndexed()))!;
}

export function cityGreenKits(shadows: boolean): KindKit[] {
  const crowns: BufferGeometry[] = [
    canopyGeometry(),
    ovalCanopyGeometry(),
    tieredCanopyGeometry(),
    ovalCanopyGeometry(),
    canopyGeometry(),
    tieredCanopyGeometry(),
  ];
  const shrubs: BufferGeometry[] = [
    new IcosahedronGeometry(0.9, 0).translate(0, 0.45, 0),
    hedgeMound(),
    new ConeGeometry(0.55, 1.9, 6).translate(0, 0.95, 0),
    new IcosahedronGeometry(0.85, 0).scale(1, 0.8, 1).translate(0, 0.4, 0),
    grassClump(),
  ];
  const species = (n: number) => (p: Prop) => p.variant % STREET_TREE_SPECIES === n;
  const shape = (n: number) => (p: Prop) => p.variant % SHRUB_SHAPES === n;
  return [
    ...crowns.map((geometry, n): KindKit => ({
      sources: ['streetTree'],
      geometry,
      material: mat(),
      tint: null,
      castShadow: shadows,
      accept: species(n),
      colorAt: colourAt(TREE_COLOURS, 41),
      // The columnar species: the oval crown drawn narrow and tall.
      ...(n === 3
        ? {
            place: (_p: Prop, dummy) => {
              dummy.scale.x *= 0.6;
              dummy.scale.z *= 0.6;
              dummy.scale.y *= 1.25;
            },
          }
        : {}),
    })),
    {
      sources: ['streetTree'],
      geometry: new CylinderGeometry(0.14, 0.2, 1.6, 5).translate(0, 0.8, 0),
      material: new MeshStandardMaterial({ color: '#5a4636', flatShading: true, roughness: 0.9 }),
      tint: null,
      castShadow: shadows,
      // Crowns sit high over the pavement: stretch the trunk up to them.
      place: (p, dummy) => {
        dummy.scale.y *= p.variant % STREET_TREE_SPECIES === 3 ? 2 : 1.6;
      },
    },
    ...shrubs.map((geometry, n): KindKit => ({
      sources: ['shrub'],
      geometry,
      material: mat(),
      tint: null,
      castShadow: false,
      accept: shape(n),
      colorAt: colourAt(SHRUB_COLOURS, 53),
    })),
  ];
}
