import { type BufferGeometry, Color, IcosahedronGeometry, MeshStandardMaterial } from 'three';
import type { StagePalette } from '@/game/stage/regions';
import type { Prop } from '@/game/stage/SceneryScatter';
import type { KindKit } from '../SceneryChunkManager';
import {
  canopyGeometry,
  firGeometry,
  foliageGeometry,
  ovalCanopyGeometry,
  spireGeometry,
  spotHash,
  tieredCanopyGeometry,
} from '../TreeGeometry';

function mat(): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.9 });
}

/** Picks from `colors` by the prop's spot, a little lighter or darker per tree. */
function mixColor(colors: readonly Color[], salt: number) {
  return (p: Prop, out: Color) => {
    out.copy(colors[Math.floor(spotHash(p, salt) * colors.length)]!);
    out.multiplyScalar(0.9 + spotHash(p, salt + 1) * 0.2);
  };
}

/**
 * The Autumnal woods: three conifer silhouettes (the cone pine, a layered fir,
 * a tall spire) and three broadleaf crowns (round, a tall oval, a layered
 * dome), each tree's shape and colour chosen by its spot from the palette's
 * autumn mix, from evergreen and olive through gold and orange to crimson.
 */
export function autumnKits(mix: NonNullable<StagePalette['autumn']>, shadows: boolean): KindKit[] {
  const conifers = mix.conifers.map((c) => new Color(c));
  const crowns = mix.broadleaves.map((c) => new Color(c));
  const bushes = mix.bushes.map((c) => new Color(c));
  const shape = (n: number, of: number) => (p: Prop) => Math.floor(spotHash(p, 7) * of) === n;
  const tree = (
    source: 'tree' | 'broadleaf',
    geometry: BufferGeometry,
    n: number,
    colors: Color[],
  ): KindKit => ({
    sources: [source],
    geometry,
    material: mat(),
    tint: null,
    castShadow: shadows,
    accept: shape(n, 3),
    colorAt: mixColor(colors, source === 'tree' ? 11 : 23),
  });
  return [
    tree('tree', foliageGeometry(), 0, conifers),
    tree('tree', firGeometry(), 1, conifers),
    tree('tree', spireGeometry(), 2, conifers),
    tree('broadleaf', canopyGeometry(), 0, crowns),
    tree('broadleaf', ovalCanopyGeometry(), 1, crowns),
    tree('broadleaf', tieredCanopyGeometry(), 2, crowns),
    {
      sources: ['bush'],
      geometry: new IcosahedronGeometry(0.9, 0).translate(0, 0.45, 0),
      material: mat(),
      tint: null,
      castShadow: false,
      colorAt: mixColor(bushes, 31),
    },
  ];
}
