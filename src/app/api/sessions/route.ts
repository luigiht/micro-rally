import { isCatalogCar } from '@/game/economy/cars';
import { isSessionLength, sessionDriverName } from '@/game/multiplayer/Session';
import { createGameId } from '@/game/save/GameId';
import { fail, hashToken, newPlayerId, newSeed, newToken, ok, readBody } from './sessionApi';
import { getSessionStore, toView, type StoredSession } from './sessionStore';

/** Fresh IDs to try before giving up; 32^8 IDs make even a second try a rarity. */
const ID_ATTEMPTS = 5;

/** Create a session with its host in seat 0. Answers the session, the host's player ID and secret token. */
export async function POST(req: Request): Promise<Response> {
  const store = getSessionStore();
  if (!store) return fail('storage_unconfigured', 503);
  const body = await readBody(req);
  if (!body) return fail('invalid_json');
  const name = sessionDriverName(body.name);
  if (!name) return fail('invalid_name');
  const { stageCount, carId } = body;
  if (!isSessionLength(stageCount)) return fail('invalid_length');
  if (typeof carId !== 'string' || !isCatalogCar(carId)) return fail('invalid_car');

  const token = newToken();
  const host = { id: newPlayerId(), name, seat: 0, tokenHash: hashToken(token) };
  for (let i = 0; i < ID_ATTEMPTS; i++) {
    const session: StoredSession = {
      id: createGameId(),
      seed: newSeed(),
      stageCount,
      carId,
      createdAt: Date.now(),
      players: [host],
      results: [],
    };
    if (await store.create(session))
      return ok({ session: toView(session), playerId: host.id, token }, 201);
  }
  return fail('id_exhausted', 500);
}
