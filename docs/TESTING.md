# Testing and verification

How the project is checked, and how to see a change working in the real
game. Rule 6 of [../CLAUDE.md](../CLAUDE.md) applies to every task:
`pnpm typecheck && pnpm lint && pnpm test && pnpm build` must pass, and
visual changes are verified in the dev server and with a Playwright
screenshot.

## Commands

| Command                    | What it does                                                     |
| -------------------------- | ---------------------------------------------------------------- |
| `pnpm check`               | typecheck + lint (zero warnings) + unit tests + production build |
| `pnpm format:check`        | Prettier over the repo (CI runs it first)                        |
| `pnpm test` / `test:watch` | Vitest unit tests in `tests/unit`                                |
| `pnpm test:e2e`            | Playwright suite in `tests/e2e`                                  |
| `pnpm dev`                 | Dev server on http://localhost:3000                              |

CI (`.github/workflows/ci.yml`) runs `format:check`, `check`, installs
Chromium and runs the e2e suite on every push to `main` and every pull
request.

## Unit tests

Vitest runs in a Node environment over `tests/unit/**/*.test.ts`. The suites
cover the pure-TS core and anything else that can run without a browser:

- **Vehicle**: `vehicleSim` (top speed per car, 0–100, braking, grip
  ordering, off-road drag, reverse, handbrake, ramp airtime, turbo,
  determinism, every car composed under power), `controlInput`,
  `fixedStepper`, `collisions`, `wheelContacts`, `skidMarks`.
- **Stages and towns**: `stage` (generation invariants, regions, curvature),
  `coast` (the region cycle, hairpins and grade, water and beach, the fall
  and climb either side of the road, the retainers and their colliders, the
  rock mask and shore colours), `town`, `townJunctions`, `townKerbs`, `roadMarkers`, `roadFollower`,
  `stageHistory`. `fixtures/openRoad.json` pins six open-road stages
  byte-for-byte so town work can never move a road that has no town (keys
  are `gameSeed/index`; the four index-0 and index-3 entries date from
  before towns, the two later-loop ones were re-recorded on 2026-11-03 when
  the region cycle changed).
- **Economy and saves**: `prize`, `garage`, `save`, `saveManager`,
  `gameStore.server`.
- **Rendering geometry built in pure TS**: `carHull` (lofted hulls, wells,
  decals, glow groups), `houseGeometry`, `buildingGeometry`,
  `streetFurnitureGeometry`, `interiorSpecs`, `nightcityHull` (the one
  Nightcity body fits every catalogue car and clears the first-person eye).
- **Themes and kits**: `worldTheme` (the day theme equals the old constants;
  Nightcity carries HDR neon), `neonMaterial` (the shader patch and three's
  chunk order), `rallyKits` (the extracted daytime kits), `nightcityKits`
  (every prop kind dressed, towers inside the tree collider, tiers by
  distance, signs facing the road), `skidMarks` (`setInk`).
- **Cameras and replay**: `cameraRigs`, `cinematicCamera` (director rules,
  framing, cuts), `replayTrack`.
- **i18n**: every locale carries the same keys.

Tests for generators sample many seeds; keep new ones fast enough for CI
(the whole suite runs in a few seconds).

## End-to-end tests

Playwright builds the app and starts the production server on port 3100
(`pnpm build && pnpm start --port 3100`), reusing a server already on that
port outside CI. One worker, Chromium only, with software WebGL
(`--use-angle=swiftshader`): rendering is CPU-bound, so parallel pages would
starve each other's frame loops.

| Spec                | Covers                                                                             |
| ------------------- | ---------------------------------------------------------------------------------- |
| `smoke.spec.ts`     | Start a game, drive, the progress bar moves                                        |
| `camera.spec.ts`    | `C` cycles the four cameras and Settings shows and sets the same view              |
| `hud.spec.ts`       | `H` hides and shows the HUD chrome; Esc opens a dialog over it                     |
| `nightcity.spec.ts` | `N` toggles the hidden Nightcity re-skin in place; the clock and progress bar stay |
| `mobile.spec.ts`    | Phone-landscape profile: touch pads, pause menu, Garage in the toolbar             |
| `save.spec.ts`      | Game IDs, the save API, continuing a game                                          |

Tips: run the suite on its own with nothing else on port 3100 and no heavy
process alongside, because the camera spec is sensitive to load. Press keys
only once the HUD shows (the session attaches its key handlers when the
canvas mounts). Development URL flags are disabled in production builds, so
e2e tests cannot use `?spawn=`.

## Seeing a change in the game

Keep `pnpm dev` running and drive a Playwright script against it. The
pattern used throughout the project:

1. Inject a version-2 save into Web Storage before the page loads, under
   `micro-rally:save:<GAME ID>`, with the `gameSeed`, `stageIndex`, `carId`
   and `ownedCars` you want. Game IDs are eight Crockford base32 characters
   (digits and letters except I, L, O and U).
2. Open `http://localhost:3000/` with a development flag if useful:
   `?spawn=<metres>` to start part-way along the stage (checkpoints behind
   the spawn count as passed, so `?spawn=` a few metres before the finish
   lets you finish in seconds), `?spawn=town` for the town, `?track=test`
   for the proving ground.
3. Fill the driver name and Game ID, press Drive, wait for the canvas
   (`[data-testid="game-canvas"] canvas`) and about 3.6 s of countdown.
4. Hold `KeyW` for a second or two, press `KeyC` to change camera, `KeyH`
   to hide the HUD or `KeyN` for Nightcity, and take `page.screenshot()`.

Useful stages: game seed 6, stage index 2 is a forest stage with a town
(spawn about 690 m for the town entry, 1983 m for a finish in three
seconds); game seed 3, stage index 5 is an alpine town. Launch Chromium with
`--use-angle=swiftshader --enable-unsafe-swiftshader` where there is no GPU.

## What to check before finishing

- Hot paths allocate nothing per frame and never set React state; the HUD
  updates at 10 Hz from the session's snapshots.
- Every geometry, material and texture is disposed with its owner.
- New player-facing strings exist in `en`, `es` and `it`.
- `prefers-reduced-motion` has a sensible variant for any new motion.
- A significant technical choice gets a numbered entry at the end of
  [DECISIONS.md](DECISIONS.md), and user-visible changes a line in
  [../CHANGELOG.md](../CHANGELOG.md).
