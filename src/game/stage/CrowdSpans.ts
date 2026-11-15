import type { StageDef } from './StageGenerator';

/** Crowds: people about a stride apart down the front row. */
export const STRIDE = 1.15;

/**
 * A stretch of road lined on both sides: front-row places `spacing` strides
 * apart, `rows` the chance one has someone behind it.
 */
export interface Crowd {
  from: number;
  to: number;
  rows: number;
  spacing: number;
  gap?: number;
  /** Event and crest crowds stand behind a berm where the stage has them. */
  berm?: boolean;
}

/**
 * Where the crowds gather: round the start, at each checkpoint, along the
 * run-up and landing of every crest the car can jump, and down the run-in
 * to the finish, in road order, trimmed so none overlaps the one before.
 */
export function crowdSpans(
  stage: Pick<StageDef, 'startDistance' | 'gates' | 'path'>,
  crestsAt: readonly number[],
  eventsOnly: boolean,
): Crowd[] {
  const start = stage.startDistance;
  // The finish draws the biggest crowd; the start, the checkpoints and the jumps half as thick.
  const list: Crowd[] = [
    { from: start - 25, to: start + 35, rows: 0.8, spacing: 2, gap: start, berm: true },
  ];
  for (const g of stage.gates) {
    const d = g.distance;
    if (g.kind === 'finish')
      list.push({ from: d - 45, to: d + 25, rows: 0.8, spacing: 1, gap: d, berm: true });
    else list.push({ from: d - 22, to: d + 18, rows: 0.4, spacing: 2, gap: d, berm: true });
  }
  if (!eventsOnly)
    for (const c of crestsAt)
      list.push({ from: c - 26, to: c + 10, rows: 0.25, spacing: 2, berm: true });
  list.sort((a, b) => a.from - b.from);
  let end = 2;
  const out: Crowd[] = [];
  for (const c of list) {
    const from = Math.max(c.from, end);
    const to = Math.min(c.to, stage.path.length - 2);
    if (to - from < STRIDE * c.spacing) continue;
    out.push({ ...c, from, to });
    end = to;
  }
  return out;
}
