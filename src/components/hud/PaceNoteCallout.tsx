'use client';

import { nextPaceNote, type PaceNote } from '@/game/stage/PaceNotes';
import { fill } from '@/i18n/format';
import type { Messages } from '@/i18n/messages/en';
import { useMessages } from '@/i18n/useMessages';
import { useStageHudStore } from '@/state/stageHudStore';
import { useUiStore } from '@/state/uiStore';
import { PaceNoteIcon } from './PaceNoteIcon';

/** Distances are called in 10 m steps, never under 10. */
function calledDistance(m: number): number {
  return Math.max(10, Math.round(m / 10) * 10);
}

/** The spoken call for a note: "Left 3 long", "Right hairpin". */
export function callText(note: PaceNote, m: Messages['paceNotes']): string {
  const side = note.side === 'left' ? m.left : m.right;
  const grade = typeof note.grade === 'number' ? String(note.grade) : m.grades[note.grade];
  return note.long ? `${side} ${grade} ${m.long}` : `${side} ${grade}`;
}

/**
 * The co-driver's call for the next corner, centred under the stage clock
 * (on touch devices, left under the checkpoint and money row, clear of the countdown):
 * its card, how far off it starts and, when the next corner follows with no
 * road between, that one too after "into" or "and". It shows from the start
 * line, holds through the corner and moves on to the next once the car is
 * out of it. Reads the 10 Hz HUD store.
 */
export function PaceNoteCallout() {
  const m = useMessages();
  const notes = useStageHudStore((s) => s.paceNotes);
  const along = useStageHudStore((s) => s.along);
  const lapLength = useStageHudStore((s) => s.stage?.lapLength ?? 0);
  const phase = useStageHudStore((s) => s.phase);
  const replay = useUiStore((s) => s.replay);
  if (phase === 'finished' && !replay) return null;
  const next = nextPaceNote(notes, along, lapLength);
  if (!next) return null;
  const note = notes[next.index]!;
  const linked = note.link ? notes[(next.index + 1) % notes.length] : undefined;
  const p = m.paceNotes;
  // Within a few metres of the entry the call is simply "now": no distance.
  const ahead = next.distance >= 5;
  const call = linked
    ? `${callText(note, p)} ${p[note.link!]} ${callText(linked, p)}`
    : callText(note, p);
  return (
    <div
      className="pointer-events-none mt-3 flex flex-col items-center gap-2 self-center coarse:items-start coarse:self-start"
      data-testid="pace-note"
      data-grade={String(note.grade)}
      data-side={note.side}
      data-distance={Math.round(next.distance)}
    >
      <span className="sr-only" aria-live="polite">
        {p.label}: {call}
      </span>
      <div className="flex items-center gap-1" aria-hidden="true">
        <PaceNoteIcon grade={note.grade} side={note.side} className="size-15" />
        {linked && (
          <>
            <span className="pixel-tag px-1.5 py-1 text-[10px]">{p[note.link!]}</span>
            <PaceNoteIcon grade={linked.grade} side={linked.side} className="size-10" />
          </>
        )}
      </div>
      {(ahead || note.long) && (
        <p className="pixel-tag px-2 py-1 text-[10px]" aria-hidden="true">
          {ahead && fill(p.distance, { m: calledDistance(next.distance) })}
          {ahead && note.long && ' · '}
          {note.long && p.long}
        </p>
      )}
    </div>
  );
}
