import type { NextConfig } from 'next';

/** Hardening headers for every route; the API additionally sends no-store itself. */
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
];

/** Identifies this deploy, so open pages can tell a newer one has gone out (see `UpdatePrompt`). */
const BUILD_ID =
  process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? `local-${Date.now()}`;

/**
 * The game moved from `/` to `/game`. Links made before then (a saved game,
 * a multiplayer invite, the demo and test switches) still name `/`, so `/`
 * with any of those passes on to the game with its query string intact.
 */
const GAME_PARAMS = ['game', 'session', 'autopilot', 'spawn', 'shot', 'track'];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
  poweredByHeader: false,
  transpilePackages: ['three'],
  experimental: { agentUpgrade: 'security' },
  async redirects() {
    return [
      ...GAME_PARAMS.map((key) => ({
        source: '/',
        has: [{ type: 'query' as const, key }],
        destination: '/game',
        permanent: false,
      })),
      { source: '/landing', destination: '/', permanent: true },
    ];
  },
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
