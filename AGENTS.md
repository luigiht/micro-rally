# Agent guide

Micro Rally is a cozy, flat-shaded low-poly rally game for the browser (and
later iOS/Android via Capacitor), built with Next.js, React Three Fiber and
Zustand in strict TypeScript.

This file is the entry point for AI coding agents. The project rules live in
[CLAUDE.md](CLAUDE.md) and apply to every agent, whatever tool it runs in.
Read that first, then the documents below as the task needs them.

## Where things are

| Document                                     | Use it for                                                          |
| -------------------------------------------- | ------------------------------------------------------------------- |
| [CLAUDE.md](CLAUDE.md)                       | Project rules, commands, directory layout                           |
| [docs/BRIEF.md](docs/BRIEF.md)               | The design brief: what the game is and is not                       |
| [docs/PLAN.md](docs/PLAN.md)                 | Milestones and what is done                                         |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Code map: sim, stage pipeline, save pipeline, rendering             |
| [docs/DECISIONS.md](docs/DECISIONS.md)       | Numbered log of technical choices, newest last                      |
| [docs/DEPLOY.md](docs/DEPLOY.md)             | Vercel and Supabase deployment                                      |
| [docs/GAMEPLAY.md](docs/GAMEPLAY.md)         | How the game plays today: stages, prizes, cameras, garage, controls |
| [docs/CONTENT.md](docs/CONTENT.md)           | Stage and town generation, regions, the car catalogue               |
| [docs/TESTING.md](docs/TESTING.md)           | Test suites, e2e setup, screenshotting a change                     |
| [CHANGELOG.md](CHANGELOG.md)                 | User-visible changes by day                                         |

## Working here

- The simulation (`src/game`, `src/lib`) is pure TypeScript with no three.js
  or React imports and is unit-tested. Rendering lives in `src/render` and
  `src/components/game`; the HUD in `src/components/hud`.
- Before finishing any task run `pnpm check` (typecheck, lint, unit tests,
  build). Visual changes are verified in the dev server and with a
  Playwright screenshot; the e2e suite is `pnpm test:e2e`.
- Log every significant technical choice as a new numbered entry at the end
  of `docs/DECISIONS.md`, including what was tried and dropped.
- Player-facing strings go in `src/i18n/messages/{en,es,it}.ts`; every locale
  must carry the same keys.
- Dev-only URL flags: `/?track=test` opens the flat proving ground;
  `/?spawn=<metres>` starts a stage that far along its road and
  `/?spawn=town` 120 m before its town (handy for screenshotting a town
  section without driving to it).
- No external copyrighted assets. Liveries and models are colour-blocked
  originals; anything CC0 that is added goes in `CREDITS.md`. The `context/`
  folder holds reference material only and is excluded from Prettier.

## Next.js

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
