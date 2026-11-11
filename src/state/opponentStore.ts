import { create } from 'zustand';
import { LiveRelay, type LivePresence } from '@/lib/multiplayer/LiveRelay';
import { opponentOf, refreshSession, useSessionStore } from './sessionStore';

/**
 * Multiplayer: whether the other driver is on this stage right now and how
 * far along. Written by the live relay a few times a second at most, so the
 * HUD can subscribe to it.
 */
export const useOpponentStore = create<LivePresence>()(() => ({ present: false, progress: 0 }));

let relay: LiveRelay | null = null;

/**
 * The one live relay; the scene reads its ghost track every frame.
 * Client-side only. A driver can start a stage before their lobby has seen
 * the second driver join or pick their car (the drive screen doesn't poll),
 * so live samples from a driver this page can't draw yet fetch the session.
 */
export function getLiveRelay(): LiveRelay {
  relay ??= new LiveRelay((p) => {
    useOpponentStore.setState(p);
    if (p.present && !opponentOf(useSessionStore.getState())?.carId) void refreshSession();
  });
  return relay;
}
