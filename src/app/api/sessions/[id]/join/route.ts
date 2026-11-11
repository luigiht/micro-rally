import { SESSION_SEATS, sessionDriverName } from '@/game/multiplayer/Session';
import { isValidGameId, normalizeGameId } from '@/game/save/GameId';
import { fail, hashToken, newPlayerId, newToken, ok, readBody } from '../../sessionApi';
import { getSessionStore, toView } from '../../sessionStore';

type Ctx = { params: Promise<{ id: string }> };

/** Take the free seat. 409 `full` when both are taken (or another driver took it a moment ago). */
export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const id = normalizeGameId((await params).id);
  if (!isValidGameId(id)) return fail('invalid_id');
  const store = getSessionStore();
  if (!store) return fail('storage_unconfigured', 503);
  const body = await readBody(req);
  if (!body) return fail('invalid_json');
  const name = sessionDriverName(body.name);
  if (!name) return fail('invalid_name');

  const session = await store.read(id);
  if (!session) return fail('not_found', 404);
  const taken = new Set(session.players.map((p) => p.seat));
  const seat = Array.from({ length: SESSION_SEATS }, (_, i) => i).find((i) => !taken.has(i));
  if (seat === undefined) return fail('full', 409);

  const token = newToken();
  const player = { id: newPlayerId(), name, seat, tokenHash: hashToken(token) };
  if (!(await store.addPlayer(id, player))) return fail('full', 409);
  const joined = { ...session, players: [...session.players, player] };
  return ok({ session: toView(joined), playerId: player.id, token }, 201);
}
