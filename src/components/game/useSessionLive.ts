'use client';

import { useEffect } from 'react';
import { useGameStore } from '@/state/gameStore';
import { getLiveRelay } from '@/state/opponentStore';
import { useSessionStore } from '@/state/sessionStore';

/**
 * Multiplayer: relay live positions while this driver is on a session stage,
 * starting over with each run of it (a restart bumps the attempt).
 */
export function useSessionLive(): void {
  const sessionId = useSessionStore((s) => s.session?.id ?? null);
  const playerId = useSessionStore((s) => s.seat?.playerId ?? null);
  const stage = useSessionStore((s) => (s.screen === 'drive' ? s.driving : null));
  const attempt = useGameStore((s) => s.attempt);

  useEffect(() => {
    const seat = useSessionStore.getState().seat;
    if (!sessionId || !seat || seat.playerId !== playerId || stage === null) return;
    const relay = getLiveRelay();
    relay.start(sessionId, seat, stage);
    return () => relay.stop();
  }, [sessionId, playerId, stage, attempt]);
}
