# Micro Rally — agent guide

A cozy, flat-shaded low-poly rally game for the browser (and later iOS/Android
via Capacitor). Full design brief: [docs/BRIEF.md](docs/BRIEF.md). Milestone
status: [docs/PLAN.md](docs/PLAN.md). Code map:
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Technical choices:
[docs/DECISIONS.md](docs/DECISIONS.md).

## Project rules

1. Simulation (vehicle physics, stage timing, economy) is pure TS with no
   three/React imports, runs at a fixed timestep (e.g. 120 Hz physics,
   interpolated render), and is unit-tested.
2. No per-frame React state updates. Hot paths use refs, `useFrame` and
   imperative Zustand reads; the HUD updates at ≤ 10 Hz.
3. Dispose every geometry/material/texture/render target on unmount; reuse
   temp vectors/quaternions in hot loops; no allocations per frame.
4. Every post-processing effect and every visual extra (shadows, particles,
   skid marks, AO) is individually toggleable and degrades gracefully across
   quality tiers Auto / Low / Medium / High / Ultra.
5. Accessibility and `prefers-reduced-motion` are requirements: keyboard-only
   play, focus-visible menus, camera shake and motion effects off under
   reduced motion, colour-blind-safe HUD.
6. Before finishing any task: `pnpm typecheck && pnpm lint && pnpm test &&
pnpm build` must pass. Visual changes are verified in the dev server and
   with a Playwright screenshot.
7. Log every significant technical choice in `docs/DECISIONS.md`.
8. Files stay focused (< ~400 lines) and are named for the domain
   (`VehicleSim`, `StageGenerator`, `GarageShop`, `ChaseCameraRig`).
9. No external copyrighted assets. Anything CC0 you do add goes in
   `CREDITS.md`.

## Commands

| Command                             | Purpose                                     |
| ----------------------------------- | ------------------------------------------- |
| `pnpm dev`                          | Next.js dev server on http://localhost:3000 |
| `pnpm typecheck`                    | `tsc --noEmit` (strict)                     |
| `pnpm lint`                         | ESLint, zero warnings allowed               |
| `pnpm format` / `pnpm format:check` | Prettier                                    |
| `pnpm test`                         | Vitest unit tests (`tests/unit`)            |
| `pnpm test:e2e`                     | Playwright e2e (`tests/e2e`)                |
| `pnpm build`                        | Production build                            |
| `pnpm check`                        | typecheck + lint + test + build             |

## Layout

- `src/game/**`, `src/lib/**` — pure TS (no three/React): `vehicle/`,
  `stage/`, `economy/`, `save/`
- `src/render/**` — three.js builders: terrain chunks + workers, road mesh,
  car models, scenery, particles, skid marks, effects
- `src/components/game/**` — R3F canvas, scene, camera rigs (`cameras/`)
- `src/components/hud/**` — React HUD, menus, garage, settings
- `src/state/**` — Zustand stores
- `src/i18n/messages/{en,es,it}.ts` — typed dictionaries; no player-facing
  string literals in components
- `src/app/api/games/[id]/route.ts` — online save API
- `tests/unit`, `tests/e2e`
