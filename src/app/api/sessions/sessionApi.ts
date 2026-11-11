import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

export const NO_STORE = { 'cache-control': 'no-store' };

export function fail(error: string, status = 400): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

export function ok(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

/** The parsed JSON body as a plain object, or null when it isn't one. */
export async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await req.json();
    return typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** A seat's secret: handed to the device once, kept on the server only as a hash. */
export function newToken(): string {
  return randomBytes(24).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Constant-time check of a presented token against a stored hash. */
export function tokenMatches(hash: string, token: unknown): boolean {
  if (typeof token !== 'string' || token === '') return false;
  const a = Buffer.from(hashToken(token), 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function newPlayerId(): string {
  return randomUUID();
}

/** A fresh world seed for the session's stages. */
export function newSeed(): number {
  return randomBytes(4).readUInt32LE(0);
}
