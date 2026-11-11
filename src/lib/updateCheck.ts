/** The build this page was served from; set at build time in next.config. */
export const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev';

/**
 * True when the server has been deployed since this page loaded: its build ID
 * differs from ours. Offline or a failed request counts as no news.
 */
export async function newVersionAvailable(
  fetchFn: typeof fetch = (...args) => fetch(...args),
  current = BUILD_ID,
): Promise<boolean> {
  try {
    const res = await fetchFn('/api/version', { cache: 'no-store' });
    if (!res.ok) return false;
    const { buildId } = (await res.json()) as { buildId?: unknown };
    return typeof buildId === 'string' && buildId !== '' && buildId !== current;
  } catch {
    return false;
  }
}
