'use client';

import { useMemo, useState } from 'react';
import { stageBrief } from '@/game/stage/StageGenerator';
import { frontierStage, stageWindow } from '@/game/stage/StageHistory';
import type { Surface } from '@/game/vehicle/surfaces';
import { fill, formatTime } from '@/i18n/format';
import { useMessages } from '@/i18n/useMessages';
import { useGameStore } from '@/state/gameStore';
import { useUiStore } from '@/state/uiStore';
import { PixelIcon, type PixelIconName } from './PixelIcon';

/** Stages listed before "show more" has been pressed. */
const PAGE_SIZE = 6;

const SURFACE_ICON: Readonly<Record<Surface, PixelIconName>> = {
  tarmac: 'tarmac',
  gravel: 'gravel',
  mud: 'mud',
  snow: 'snow',
  grass: 'grass',
};

/**
 * Each item reserves a fixed compact slot; the button sits on top of it and
 * widens over its neighbours on hover or keyboard focus, so the row never
 * reflows under the pointer. Touch devices have no hover: there the button
 * flows normally with the detail always open.
 */
const SLOT = 'relative h-9 w-[4.5rem] coarse:h-auto coarse:w-auto';
const BUTTON =
  'group absolute inset-y-0 inline-flex min-w-full items-center justify-center px-3 py-2 ' +
  'hover:z-10 focus-visible:z-10 coarse:static coarse:min-w-0';
/** Collapsed with max-width, not display, so the accessible name keeps the stage name. */
const DETAIL =
  'max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity,margin] duration-300 ease-out ' +
  'group-hover:max-w-72 group-hover:opacity-100 group-focus-visible:max-w-72 group-focus-visible:opacity-100 ' +
  'motion-reduce:transition-none coarse:max-w-none coarse:opacity-100';
const DETAIL_RIGHT = 'group-hover:ml-2 group-focus-visible:ml-2 coarse:ml-2';
const DETAIL_LEFT = 'order-first group-hover:mr-2 group-focus-visible:mr-2 coarse:mr-2';

/** Items in the right half of the list open leftwards so they stay inside the panel. */
function opensLeft(item: HTMLElement): boolean {
  const list = item.parentElement;
  if (!list) return false;
  const r = item.getBoundingClientRect();
  const l = list.getBoundingClientRect();
  return r.left + r.width / 2 > l.left + l.width / 2;
}

/** Quiet text link for uncovering older stages; deliberately not a pixel button. */
const SHOW_MORE =
  'self-center font-pixel text-[10px] text-ink/70 underline underline-offset-4 hover:text-rally focus-visible:text-rally';

/**
 * Every stage reached so far, newest first, as a row of wrapping buttons:
 * number and surface glyph, widening on hover to show the name. The one
 * being driven is filled and marked current; pressing another drives it
 * again. Long histories collapse to the newest page with a "show more" link
 * after the oldest shown.
 */
export function StageList() {
  const m = useMessages();
  const gameSeed = useGameStore((s) => s.gameSeed);
  const stageIndex = useGameStore((s) => s.stageIndex);
  const records = useGameStore((s) => s.records);
  const [revealed, setRevealed] = useState(0);
  const [leftIndex, setLeftIndex] = useState<number | null>(null);

  const frontier = frontierStage(stageIndex, records);
  const count = frontier + 1;
  const { start, hidden } = stageWindow(count, stageIndex, revealed, PAGE_SIZE);
  const briefs = useMemo(
    () => Array.from({ length: count - start }, (_, i) => stageBrief(gameSeed, count - 1 - i)),
    [gameSeed, start, count],
  );

  const drive = (index: number) => {
    if (index !== stageIndex) useGameStore.getState().driveStage(index);
    useUiStore.getState().closePanel();
  };

  return (
    <>
      <h3 className="mt-5 font-pixel text-xs">{m.game.stagesSection}</h3>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-5 px-1 pb-2" data-testid="stage-list">
        {briefs.map((b) => {
          const driving = b.index === stageIndex;
          const best = records[b.index]?.best;
          const surface = m.surfaces[b.surface];
          const left = leftIndex === b.index;
          const aim = (el: HTMLElement) => setLeftIndex(opensLeft(el) ? b.index : null);
          return (
            <li
              key={b.index}
              className={SLOT}
              onPointerEnter={(e) => aim(e.currentTarget)}
              onFocus={(e) => aim(e.currentTarget)}
            >
              <button
                type="button"
                aria-current={driving ? 'true' : undefined}
                title={`${b.name} · ${surface} · ${best !== undefined ? formatTime(best) : m.game.none}`}
                onClick={() => drive(b.index)}
                className={`${driving ? 'pixel-btn' : 'pixel-btn-ghost'} ${BUTTON} ${left ? 'right-0' : 'left-0'}`}
              >
                <span className="mr-2 tabular-nums">{b.index + 1}</span>
                <PixelIcon name={SURFACE_ICON[b.surface]} />
                <span className={`${DETAIL} ${left ? DETAIL_LEFT : DETAIL_RIGHT}`}>{b.name}</span>
                <span className="sr-only">, {surface}</span>
                {b.index === frontier && <span className="sr-only">, {m.game.currentStage}</span>}
              </button>
            </li>
          );
        })}
        {hidden > 0 && (
          <li className="flex">
            <button
              type="button"
              onClick={() => setRevealed((n) => n + PAGE_SIZE)}
              className={SHOW_MORE}
            >
              {fill(m.game.showMore, { n: Math.min(PAGE_SIZE, hidden) })}
            </button>
          </li>
        )}
      </ul>
    </>
  );
}
