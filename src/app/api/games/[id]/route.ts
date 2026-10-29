import { isValidGameId, normalizeGameId } from '@/game/save/GameId';
import { parseSaveFile } from '@/game/save/SaveFile';
import { getGameStore } from '../gameStore';

type Ctx = { params: Promise<{ id: string }> };

const NO_STORE = { 'cache-control': 'no-store' };

function fail(error: string, status = 400): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

/** Fetch a saved game. 404 when the ID has never been saved; 503 when the deployment has no store. */
export async function GET(_req: Request, { params }: Ctx): Promise<Response> {
  const id = normalizeGameId((await params).id);
  if (!isValidGameId(id)) return fail('invalid_id');
  const store = getGameStore();
  if (!store) return fail('storage_unconfigured', 503);
  const save = await store.read(id);
  if (!save) return fail('not_found', 404);
  return Response.json(save, { headers: NO_STORE });
}

/** Store a save. Last write wins; the body must be a valid SaveFile for this ID. */
export async function PUT(req: Request, { params }: Ctx): Promise<Response> {
  const id = normalizeGameId((await params).id);
  if (!isValidGameId(id)) return fail('invalid_id');
  const store = getGameStore();
  if (!store) return fail('storage_unconfigured', 503);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('invalid_json');
  }
  const save = parseSaveFile(body);
  if (!save) return fail('invalid_save');
  if (save.gameId !== id) return fail('id_mismatch');
  await store.write(save);
  return Response.json({ ok: true, updatedAt: save.updatedAt }, { headers: NO_STORE });
}
