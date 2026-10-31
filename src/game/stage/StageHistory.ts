import type { StageRecord } from '../save/SaveFile';

/**
 * The stage the player has reached but not yet finished: one past the last
 * recorded stage, or the one being driven, whichever is further. Records
 * only exist for finished stages, so everything below it is completed.
 */
export function frontierStage(
  stageIndex: number,
  records: Readonly<Record<number, StageRecord>>,
): number {
  let frontier = Math.max(0, stageIndex);
  for (const key of Object.keys(records)) {
    const index = Number(key);
    if (Number.isInteger(index) && index + 1 > frontier) frontier = index + 1;
  }
  return frontier;
}

export interface StageWindow {
  /** First stage index to list; everything from here to the end is shown. */
  start: number;
  /** Earlier stages a "show more" control would uncover. */
  hidden: number;
}

/**
 * Which of stages 0..count-1 to list: the newest `pageSize` plus `revealed`
 * earlier ones, widened so `focus` (the stage being driven) is always visible.
 */
export function stageWindow(
  count: number,
  focus: number,
  revealed: number,
  pageSize: number,
): StageWindow {
  const start = Math.max(0, Math.min(count - pageSize - revealed, focus));
  return { start, hidden: start };
}
