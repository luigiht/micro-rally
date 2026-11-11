'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SessionView } from '@/game/multiplayer/Session';
import { stageBrief, type StageBrief } from '@/game/stage/StageGenerator';
import { sessionLink } from '@/lib/multiplayer/SessionClient';
import { refreshSession } from '@/state/sessionStore';

const POLL_MS = 4000;
const COPIED_MS = 1500;

/**
 * Refetch the session every few seconds while mounted (and `enabled`) and
 * the tab is visible, and straight away when it becomes visible again: how
 * a driver learns the other one has joined or finished.
 */
export function useSessionPolling(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (document.visibilityState === 'visible') void refreshSession();
    };
    const interval = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    tick();
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [enabled]);
}

/** Name, type, length and par of each of the session's stages, without building their roads. */
export function useSessionBriefs(session: Pick<SessionView, 'seed' | 'stageCount'>): StageBrief[] {
  const { seed, stageCount } = session;
  return useMemo(
    () => Array.from({ length: stageCount }, (_, i) => stageBrief(seed, i)),
    [seed, stageCount],
  );
}

/** Copy the session's join link; `copied` stays true for a moment afterwards. */
export function useCopySessionLink(id: string): { copied: boolean; copy: () => Promise<void> } {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sessionLink(id, window.location.origin));
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      // Clipboard unavailable (insecure context); the ID stays selectable on screen.
    }
  };
  return { copied, copy };
}
