import { BUILD_ID } from '@/lib/updateCheck';

export const dynamic = 'force-dynamic';

/** The deployed build's ID, for open pages to notice a newer deploy and offer a reload. */
export function GET(): Response {
  return Response.json({ buildId: BUILD_ID }, { headers: { 'cache-control': 'no-store' } });
}
