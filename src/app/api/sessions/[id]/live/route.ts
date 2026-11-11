import { parseLiveRecord } from '@/game/multiplayer/LiveTrack';
import { isValidGameId, normalizeGameId } from '@/game/save/GameId';
import { getLiveStore } from '../../liveStore';
import { fail, ok, readBody, tokenMatches } from '../../sessionApi';
import { getSessionStore, type SessionStore } from '../../sessionStore';

type Ctx = { params: Promise<{ id: string }> };

/** Seats never change once taken, so their token hashes are cached rather than read a few times a second. */
const seatHashes = new Map<string, string>();
const MAX_CACHED_SEATS = 2000;

async function seatHash(
  store: SessionStore,
  id: string,
  playerId: unknown,
): Promise<string | null> {
  if (typeof playerId !== 'string') return null;
  const key = `${id}:${playerId}`;
  const cached = seatHashes.get(key);
  if (cached) return cached;
  const session = await store.read(id);
  const hash = session?.players.find((p) => p.id === playerId)?.tokenHash ?? null;
  if (hash) {
    if (seatHashes.size >= MAX_CACHED_SEATS) seatHashes.clear();
    seatHashes.set(key, hash);
  }
  return hash;
}

/**
 * Live positions: a driver on a stage sends the last second of their car
 * and gets the other driver's back, a few times a second. The seat's secret
 * token proves who is sending. Nothing here is kept beyond a few seconds.
 */
export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const id = normalizeGameId((await params).id);
  if (!isValidGameId(id)) return fail('invalid_id');
  const sessions = getSessionStore();
  const live = getLiveStore();
  if (!sessions || !live) return fail('storage_unconfigured', 503);
  const body = await readBody(req);
  if (!body) return fail('invalid_json');
  const record = parseLiveRecord(body);
  if (!record) return fail('invalid_live');

  const hash = await seatHash(sessions, id, body.playerId);
  if (!hash || !tokenMatches(hash, body.token)) return fail('forbidden', 403);
  const other = await live.exchange(id, body.playerId as string, record);
  return ok({ other });
}
