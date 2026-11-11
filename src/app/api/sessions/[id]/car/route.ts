import { sessionCar } from '@/game/multiplayer/Session';
import { isValidGameId, normalizeGameId } from '@/game/save/GameId';
import { fail, ok, readBody, tokenMatches } from '../../sessionApi';
import { getSessionStore, toView } from '../../sessionStore';

type Ctx = { params: Promise<{ id: string }> };

/**
 * A driver picks their car for the whole session, once, in the lobby. The
 * seat's token proves who is picking; a second pick is a 409 `car_set`.
 */
export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const id = normalizeGameId((await params).id);
  if (!isValidGameId(id)) return fail('invalid_id');
  const store = getSessionStore();
  if (!store) return fail('storage_unconfigured', 503);
  const body = await readBody(req);
  if (!body) return fail('invalid_json');
  const carId = sessionCar(body.carId);
  if (!carId) return fail('invalid_car');

  const session = await store.read(id);
  if (!session) return fail('not_found', 404);
  const player = session.players.find((p) => p.id === body.playerId);
  if (!player || !tokenMatches(player.tokenHash, body.token)) return fail('forbidden', 403);
  if (player.carId ?? session.carId) return fail('car_set', 409);
  if (!(await store.setCar(id, player.id, carId))) return fail('car_set', 409);
  const players = session.players.map((p) => (p.id === player.id ? { ...p, carId } : p));
  return ok({ session: toView({ ...session, players }) });
}
