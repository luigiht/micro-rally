import type { NextConfig } from 'next';

/** Hardening headers for every route; the API additionally sends no-store itself. */
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['three'],
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
