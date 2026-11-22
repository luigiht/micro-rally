import {
  isCityStage,
  rallyIndex,
  stageSlot,
  STAGE_TYPES,
  STAGES_PER_LOOP,
  type StageTypeId,
} from '@/game/stage/regions';
import {
  generateStage,
  stageHasTown,
  type StageDef,
  type StageSlot,
} from '@/game/stage/StageGenerator';
import { createStageWorld, type StageWorld } from '@/game/stage/StageWorld';

/** The index of the `nth` stage (0-based) of a stage type at or after `from`. */
export function stageIndexOf(stageType: StageTypeId, nth = 0, from = 0): number {
  let seen = 0;
  for (let i = from; i < 2000; i++) {
    if (stageSlot(i) !== stageType) continue;
    if (seen++ === nth) return i;
  }
  throw new Error(`no ${stageType} stage`);
}

/**
 * The seven-type rally mix before Lakeland joined it (save v13). Tests whose
 * stages were chosen and tuned on that calendar generate the same stages
 * here: a stage is fixed by its seed, index and slot, not by the calendar.
 */
const RALLY_CYCLE_V13: readonly StageTypeId[] = [
  'pinewood',
  'alpine',
  'forest',
  'coastal',
  'arctic',
  'autumnal',
  'desert',
];

/** The eight-type rally mix before Moorland joined it (save v14). */
const RALLY_CYCLE_V14: readonly StageTypeId[] = [...RALLY_CYCLE_V13, 'lakeland'];

function typeOn(cycle: readonly StageTypeId[], index: number): StageTypeId {
  const rally = rallyIndex(index);
  if (rally === null) return isCityStage(index) ? 'urban' : 'circuit';
  return cycle[rally % cycle.length]!;
}

function typeV13(index: number): StageTypeId {
  return typeOn(RALLY_CYCLE_V13, index);
}

/** Stage `index`'s type on the v14 calendar (Lakeland last, no Moorland). */
export function typeV14(index: number): StageTypeId {
  return typeOn(RALLY_CYCLE_V14, index);
}

/** The nine-type rally mix before Savanna joined it (save v15). */
const RALLY_CYCLE_V15: readonly StageTypeId[] = [...RALLY_CYCLE_V14, 'moorland'];

/** Stage `index`'s type on the v15 calendar (Moorland last, no Savanna). */
export function typeV15(index: number): StageTypeId {
  return typeOn(RALLY_CYCLE_V15, index);
}

/** Whether stage `index` carried a town on the v15 calendar: stepping round the nine-type mix. */
function townV15(index: number): boolean {
  const rally = rallyIndex(index);
  if (rally === null) return false;
  const shift = Math.floor(rally / RALLY_CYCLE_V15.length);
  return (rally + shift) % 3 === 2 && STAGE_TYPES[typeV15(index)].towns;
}

/** Stage `index`'s slot on the v15 calendar: its type, loop, town and dusk as they were then. */
export function slotV15(index: number): StageSlot {
  const stageType = typeV15(index);
  const def = STAGE_TYPES[stageType];
  let ordinal = 0;
  for (let j = 0; j < index; j++) if (typeV15(j) === stageType) ordinal++;
  return {
    stageType,
    loop: Math.floor(index / STAGES_PER_LOOP),
    town: townV15(index),
    dusk: def.dusk === true && ordinal % 3 === 2,
  };
}

/** The index of the `nth` stage of a type on the v15 calendar, at or after `from`. */
export function indexV15(stageType: StageTypeId, nth = 0, from = 0): number {
  let seen = 0;
  for (let i = from; i < 2000; i++) {
    if (typeV15(i) !== stageType) continue;
    if (seen++ === nth) return i;
  }
  throw new Error(`no ${stageType} stage`);
}

/** Stage `index`'s slot on the v13 calendar: its type, loop, town and dusk as they were then. */
export function slotV13(index: number): StageSlot {
  const stageType = typeV13(index);
  const def = STAGE_TYPES[stageType];
  let ordinal = 0;
  for (let j = 0; j < index; j++) if (typeV13(j) === stageType) ordinal++;
  return {
    stageType,
    loop: Math.floor(index / STAGES_PER_LOOP),
    // v13's towns: every third rally stage, before they stepped on round the nine-type mix.
    town: rallyIndex(index) !== null && rallyIndex(index)! % 3 === 2 && def.towns,
    dusk: def.dusk === true && ordinal % 3 === 2,
  };
}

/** The index of the `nth` stage of a type on the v13 calendar, at or after `from`. */
export function indexV13(stageType: StageTypeId, nth = 0, from = 0): number {
  let seen = 0;
  for (let i = from; i < 2000; i++) {
    if (typeV13(i) !== stageType) continue;
    if (seen++ === nth) return i;
  }
  throw new Error(`no ${stageType} stage`);
}

/** The `nth` stage of a type as the v13 calendar laid it. */
export function stageV13(seed: number, stageType: StageTypeId, nth = 0, from = 0): StageDef {
  const index = indexV13(stageType, nth, from);
  return generateStage(seed, index, slotV13(index));
}

/** The `nth` stage of a type's world as the v13 calendar laid it. */
export function worldV13(seed: number, stageType: StageTypeId, nth = 0, from = 0): StageWorld {
  const index = indexV13(stageType, nth, from);
  return createStageWorld(seed, index, slotV13(index));
}

/**
 * The index of the `nth` stage of a type on the v13 calendar that is still
 * that type on every calendar since: a record set there survives Lakeland's
 * arrival (v14), Moorland's (v15) and Savanna's (v16).
 */
export function stableIndexV13(stageType: StageTypeId, nth = 0): number {
  let seen = 0;
  // Every calendar since agrees only every 7·8·9·10 rally stages: search far enough to find a second.
  for (let i = 0; i < 4000; i++) {
    if (
      typeV13(i) !== stageType ||
      typeV14(i) !== stageType ||
      typeV15(i) !== stageType ||
      stageSlot(i) !== stageType
    )
      continue;
    // Nor did it gain or lose its town on any calendar since (the towns stepped round the
    // nine-type mix in v15, and back to every third stage in v16).
    const townBefore = rallyIndex(i)! % 3 === 2 && STAGE_TYPES[stageType].towns;
    if (townBefore !== stageHasTown(i) || townV15(i) !== stageHasTown(i)) continue;
    if (seen++ === nth) return i;
  }
  throw new Error(`no stable ${stageType} stage`);
}
