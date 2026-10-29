import { isValidGameId, normalizeGameId } from '@/game/save/GameId';

const PARAM = 'game';

/** The Game ID from `?game=`, normalized, or null when absent/invalid. */
export function readGameParam(search: string): string | null {
  const id = normalizeGameId(new URLSearchParams(search).get(PARAM) ?? '');
  return isValidGameId(id) ? id : null;
}

/** Put the active game in the URL so a bookmark resumes it; other params are left alone. */
export function writeGameParam(gameId: string | null): void {
  const url = new URL(window.location.href);
  if (gameId) url.searchParams.set(PARAM, gameId);
  else url.searchParams.delete(PARAM);
  window.history.replaceState(null, '', url);
}
