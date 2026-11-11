import { isValidGameId, normalizeGameId } from '@/game/save/GameId';
import { fail, ok } from '../sessionApi';
import { getSessionStore, toView } from '../sessionStore';

type Ctx = { params: Promise<{ id: string }> };

/** A session's public state: players, settings and every counted run. */
export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const id = normalizeGameId((await params).id);
  if (!isValidGameId(id)) return fail('invalid_id');
  const store = getSessionStore();
  if (!store) return fail('storage_unconfigured', 503);
  const session = await store.read(id);
  if (!session) return fail('not_found', 404);
  return ok({ session: toView(session) });
}
