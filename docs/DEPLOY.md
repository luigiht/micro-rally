# Deploying Micro Rally

The app is a standard Next.js 16 project: zero-config on Vercel, or
`pnpm build && pnpm start` on any Node 22 host. The one piece that needs a
decision is where online saves live.

## Vercel + Supabase

1. **Import the repository** at vercel.com/new. Framework preset: Next.js
   (auto-detected). Build command `pnpm build`, output handled by Next.
2. **Node and pnpm.** The `engines` field pins Node ≥ 22; pick 22.x in
   Project → Settings → General if it isn't already. To build with the exact
   pnpm from `packageManager`, add the env var `ENABLE_EXPERIMENTAL_COREPACK=1`.
3. **Supabase project.** Create one at supabase.com, then run the migration in
   `supabase/migrations/20261030120000_games.sql` (SQL editor, or
   `supabase db push` with the CLI). It creates `public.games`
   (`id text primary key, save jsonb, updated_at timestamptz`) with
   row-level security enabled and no policies: only the service role can
   touch it.
4. **Credentials.** Either add the **Supabase** integration from the Vercel
   Marketplace, which injects `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY`, or set `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` by hand from Project Settings → API. The
   service-role key is secret: server-only, never `NEXT_PUBLIC_`. The API
   route picks Supabase automatically when both are present; saves are one
   row per Game ID, last write wins. Without them, Vercel deployments answer
   `503 storage_unconfigured` on `/api/games/*`; the game keeps working and
   saves stay on each device ("Saved on this device only").
5. **Public URL.** `NEXT_PUBLIC_SITE_URL` is optional on Vercel: the
   production domain from `VERCEL_PROJECT_PRODUCTION_URL` (or the preview
   `VERCEL_URL`) is used for Open Graph, robots and the sitemap. Set it
   explicitly if you serve the game from a custom domain that isn't the
   Vercel production domain.
6. **Deploy.** Every push to `main` is a production deployment; pull requests
   get preview URLs. CI (`.github/workflows/ci.yml`) runs the same
   `pnpm check` and the Playwright suite.

### Smoke test after deploying

```sh
curl -i https://<domain>/api/games/ZZZZ2345        # 404 not_found (or 503 without Supabase)
curl -i https://<domain>/robots.txt                # Sitemap: https://<domain>/sitemap.xml
curl -s https://<domain>/ | grep -o 'og:image[^>]*' # absolute image URL
```

## Self-hosting

```sh
pnpm install --frozen-lockfile
pnpm build
MICRO_RALLY_SAVE_DIR=/var/lib/micro-rally/games NEXT_PUBLIC_SITE_URL=https://<domain> pnpm start
```

The file store writes one JSON file per game with an atomic rename. Point
`MICRO_RALLY_SAVE_DIR` at persistent storage, or set the two Supabase
variables to use Postgres instead.

## Environment variables

| Variable                                       | Where                   | Purpose                                               |
| ---------------------------------------------- | ----------------------- | ----------------------------------------------------- |
| `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`) | Vercel / server         | Supabase project URL.                                 |
| `SUPABASE_SERVICE_ROLE_KEY`                    | Vercel / server, secret | Service-role key for the `games` table.               |
| `NEXT_PUBLIC_SITE_URL`                         | optional                | Public origin for absolute URLs.                      |
| `MICRO_RALLY_SAVE_DIR`                         | self-hosting            | Directory for the file store (default `.data/games`). |
| `ENABLE_EXPERIMENTAL_COREPACK`                 | Vercel, optional        | Use the pnpm version from `packageManager`.           |

See `.env.example`.
