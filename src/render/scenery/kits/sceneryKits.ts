import { STAGE_TYPES, stagePalette } from '@/game/stage/regions';
import type { Prop } from '@/game/stage/SceneryScatter';
import type { StageBrief } from '@/game/stage/StageGenerator';
import type { BufferGeometry } from 'three';
import type { KindKit } from '../SceneryChunkManager';
import { FURNITURE_KINDS, rallyKits } from './RallyKits';

/** The instanced prop kits for a stage, tinted with its stage-type palette. */
export function sceneryKitsFor(
  stage: Pick<StageBrief, 'stageType'>,
  shadows: boolean,
  furniture = true,
): KindKit[] {
  const kits = rallyKits(
    stagePalette(stage.stageType),
    shadows,
    STAGE_TYPES[stage.stageType].offroad === 'snow',
    stage.stageType === 'alpine'
      ? 'alpine'
      : stage.stageType === 'forest'
        ? 'greenvale'
        : stage.stageType === 'lakeland'
          ? 'lakeland'
          : stage.stageType === 'savanna'
            ? 'savanna'
            : undefined,
  );
  for (const k of kits) if (k.sources.some((src) => ROOTED.has(src))) sinkBase(k.geometry);
  if (furniture) return kits;
  // Without the furniture its props are simply not drawn (their colliders stand either way).
  const drop = new Set<Prop['kind']>(FURNITURE_KINDS);
  return kits.filter((k) => {
    const keep = !k.sources.every((s) => drop.has(s));
    if (!keep) {
      k.geometry.dispose();
      k.material.dispose();
    }
    return keep;
  });
}

/** Props that stand on a trunk: their trunks reach down into the ground (`sinkBase`). */
const ROOTED: ReadonlySet<Prop['kind']> = new Set<Prop['kind']>([
  'tree',
  'broadleaf',
  'spruce',
  'sapling',
  'palm',
]);
/** How far below its foot a trunk reaches, so a slope's downhill side never shows a gap under it. */
const SINK = 0.9;

/**
 * Drop the foot of a tree's geometry (every vertex at ground level) below the ground, so the
 * trunk runs on down into the hillside: the prop stands at the ground's height under its centre,
 * and on a slope the downhill side of its foot would otherwise float.
 */
const sunk = new WeakSet<BufferGeometry>();
function sinkBase(g: BufferGeometry): void {
  // A geometry two kits share is sunk once.
  if (sunk.has(g)) return;
  sunk.add(g);
  const pos = g.getAttribute('position');
  let moved = false;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > 0.02) continue;
    pos.setY(i, pos.getY(i) - SINK);
    moved = true;
  }
  if (!moved) return;
  pos.needsUpdate = true;
  g.computeBoundingSphere();
}
