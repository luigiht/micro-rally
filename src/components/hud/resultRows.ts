import { fill, formatSeconds } from '@/i18n/format';
import type { Messages } from '@/i18n/messages/en';
import type { StageResult } from '@/state/gameStore';

/**
 * The hit penalties inside a result's time, as a row to show under it, so
 * the seconds they added are visible on the result and not only mid-stage.
 * Empty for a clean run.
 */
export function penaltyRows(
  result: Pick<StageResult, 'penalties' | 'hits'>,
  m: Messages,
): [string, string][] {
  if (result.penalties <= 0) return [];
  return [
    [fill(m.stage.penaltiesIncluded, { n: result.hits }), `+${formatSeconds(result.penalties)}`],
  ];
}
