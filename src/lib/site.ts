/**
 * Public origin for absolute URLs in metadata, robots and the sitemap.
 * Explicit NEXT_PUBLIC_SITE_URL wins; on Vercel fall back to the production
 * domain, then the deployment URL (previews); locally, the dev server.
 */
export type SiteEnv = Readonly<Record<string, string | undefined>>;

export function resolveSiteUrl(env: SiteEnv = process.env): string {
  const explicit = env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL ?? env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
  return 'http://localhost:3000';
}

export const SITE_URL = resolveSiteUrl();

/** Credited in the splash footer and on the privacy page. */
export const AUTHOR = { name: 'Luis Hermosilla', url: 'https://www.luigiht.com' } as const;
