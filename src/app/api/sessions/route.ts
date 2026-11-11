import {
  isSessionLength,
  SESSION_STAGE_TYPES,
  sessionDriverName,
  sessionStageTypes,
} from '@/game/multiplayer/Session';
import { createGameId } from '@/game/save/GameId';
import { fail, hashToken, newPlayerId, newSeed, newToken, ok, readBody } from './sessionApi';
import { getSessionStore, toView, type StoredSession } from './sessionStore';

/** Fresh IDs to try before giving up; 32^8 IDs make even a second try a rarity. */
const ID_ATTEMPTS = 5;

/**
 * Create a session of `stageCount` stages cycling through the ticked
 * `stageTypes` (every type when absent), with its host in seat 0. Drivers
 * pick their cars in the lobby. Answers the session, the host's player ID
 * and secret token.
 */
export async function POST(req: Request): Promise<Response> {
  const store = getSessionStore();
  if (!store) return fail('storage_unconfigured', 503);
  const body = await readBody(req);
  if (!body) return fail('invalid_json');
  const name = sessionDriverName(body.name);
  if (!name) return fail('invalid_name');
  const { stageCount } = body;
  if (!isSessionLength(stageCount)) return fail('invalid_length');
  const stageTypes =
    body.stageTypes === undefined ? [...SESSION_STAGE_TYPES] : sessionStageTypes(body.stageTypes);
  if (!stageTypes) return fail('invalid_types');

  const token = newToken();
  const host = { id: newPlayerId(), name, seat: 0, tokenHash: hashToken(token) };
  for (let i = 0; i < ID_ATTEMPTS; i++) {
    const session: StoredSession = {
      id: createGameId(),
      seed: newSeed(),
      stageCount,
      stageTypes,
      createdAt: Date.now(),
      players: [host],
      results: [],
    };
    if (await store.create(session))
      return ok({ session: toView(session), playerId: host.id, token }, 201);
  }
  return fail('id_exhausted', 500);
}
