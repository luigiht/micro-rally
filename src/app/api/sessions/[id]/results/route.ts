import { checkResult, parseResultInput, sessionBrief } from '@/game/multiplayer/Session';
import { isValidGameId, normalizeGameId } from '@/game/save/GameId';
import { fail, ok, readBody, tokenMatches } from '../../sessionApi';
import { getSessionStore, toView } from '../../sessionStore';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Count a driver's run (or retirement) for the session's current stage. The
 * player's secret token proves the seat; the first run sent for a stage is
 * the one that counts, and a later one is a 409.
 */
export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const id = normalizeGameId((await params).id);
  if (!isValidGameId(id)) return fail('invalid_id');
  const store = getSessionStore();
  if (!store) return fail('storage_unconfigured', 503);
  const body = await readBody(req);
  if (!body) return fail('invalid_json');
  const input = parseResultInput(body);
  if (!input) return fail('invalid_result');

  const session = await store.read(id);
  if (!session) return fail('not_found', 404);
  const player = session.players.find((p) => p.id === body.playerId);
  if (!player || !tokenMatches(player.tokenHash, body.token)) return fail('forbidden', 403);
  // A run is driven in the seat's car, so a seat without one can't have run a stage.
  if (!(player.carId ?? session.carId)) return fail('no_car', 409);

  const par =
    input.stageIndex < session.stageCount ? sessionBrief(session, input.stageIndex).parTime : 0;
  const problem = checkResult(session, player.id, input, par);
  if (problem === 'over' || problem === 'not_current' || problem === 'duplicate')
    return fail(problem, 409);
  if (problem) return fail(problem);

  const result = { ...input, playerId: player.id };
  if (!(await store.addResult(id, result))) return fail('duplicate', 409);
  return ok({ session: toView({ ...session, results: [...session.results, result] }) });
}
