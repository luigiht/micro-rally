'use client';

import { useEffect } from 'react';
import { useAutopilotStore } from '@/state/autopilotStore';
import { useGameStore } from '@/state/gameStore';
import { useStageHudStore } from '@/state/stageHudStore';
import { useUiStore } from '@/state/uiStore';

/** How long the result panel shows before the demo drives on, ms. */
export const AUTOPILOT_NEXT_DELAY = 4000;

/**
 * The demo keeps driving: a few seconds after each finish it moves on to the
 * next stage. Waits while a panel or the replay is open, so a viewer can look
 * at the result; nothing here re-renders.
 */
export function useAutopilotLoop(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const advance = () => {
      timer = null;
      const ui = useUiStore.getState();
      if (!useAutopilotStore.getState().running || !useStageHudStore.getState().result) return;
      if (ui.panel || ui.replay) {
        timer = setTimeout(advance, AUTOPILOT_NEXT_DELAY);
        return;
      }
      useGameStore.getState().nextStage();
    };
    const unsubscribe = useStageHudStore.subscribe((s, prev) => {
      if (s.result && !prev.result && timer === null)
        timer = setTimeout(advance, AUTOPILOT_NEXT_DELAY);
    });
    return () => {
      unsubscribe();
      if (timer !== null) clearTimeout(timer);
    };
  }, []);
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/** P shows or hides the demo's window, leaving the rest of the HUD as it is. */
export function useAutopilotWindowKey(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyP' || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target)) return;
      useAutopilotStore.getState().toggleWindow();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
