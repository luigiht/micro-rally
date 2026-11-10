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
  `paceNotes` (grades from radius and turn on built roads, named corners,
  long, links, the next call through and past a corner and round a lap,
  every grade across generated stages), `paceNotePixels` (cards inside
  their frame, right-handers mirrored, digits only on the scale),
  `coast` (the region cycle, hairpins and grade, water and beach, the fall
  and climb either side of the road, the retainers and their colliders, the
  rock mask and shore colours), `desert` (the cycle, the two sand surfaces,
  dunes, oases and their palms, the pools), `circuit` (closed paths, the
  generator's invariants across 80 seeds and its fallback, the three styles,
  circuit stages and their unrolled gates, pole position, three laps with
  progress unwrapping across the seam, lap times after a part-way spawn, the
  prize factor), `circuitTrackside` (kerbs only on corners, barriers clear
  of the track and never folding, gravel on corner outsides, colliders, the
  seamless road profile, kerb bumps and surfaces, scenery outside the fences
  and off the grandstand), `town`, `townJunctions`, `townKerbs`, `roadMarkers`, `roadFollower`,
  `stageHistory`, `urban` (the fifteen-stage cycle and the v5 save
  migration, the whole-stage town and its lane widths, right angles and
  self-separation, the roundabout's level ring, island, chords and exits,
  tram ridges, grade and relief, gates between junctions, colliders off
  the carriageway, later loops and the planner over 40 seeds, the city's
  four building kits and renders, open-ended side streets meeting their
  roads without a step), `crossings` (every zebra and stop line on plain
  carriageway clear of pavements, medians, trams and rings; parking
  stretches on three-lane straights off the junctions with two lanes
  between and cars in the bays), `streetFurniture` (every piece on a
  pavement off the doors and buildings, manholes on the carriageway, every
  kind present), `tramService` (the timetable's headway, direction and
  fades, the tram body's size and lights).
  `fixtures/openRoad.json` pins four open-road stages (Forest gravel at
  index 0, Alpine at index 27) byte-for-byte so town work can never move a
  road that has no town (keys are `gameSeed/index`; the two later-loop
  entries `5/16` and `13/18` were dropped on 2026-11-08 when the fixed
  schedule gave those indices other regions). Tests find stages by region
  and surface with `tests/unit/stageIndex.ts` rather than fixed indices.
- **Economy and saves**: `prize`, `garage`, `save`, `saveManager`,
  `gameStore.server`.
- **Rendering geometry built in pure TS**: `carHull` (lofted hulls, wells,
  decals, glow groups), `fenderShell` (the buggy's free-standing mudguards: mirrored, clear of the tyre, wound outward), `svgSilhouette` (the SVG path reader and the extruded bull), `houseGeometry`, `buildingGeometry`,
  `streetFurnitureGeometry`, `cityFurnitureGeometry` (the city's furniture
  and parked car: box parts, outward faces, sizes, white only on the car
  body), `interiorSpecs` (every catalogue car fits its first-person cabin).
- **Themes and kits**: `worldTheme` (day and dusk palettes), `rallyKits`
  (region and surface scenery), `skidMarks` (`setInk`).
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

| Spec              | Covers                                                                                                                                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `install.spec.ts` | The install strip: Android shows Install once `beforeinstallprompt` fires and Not now hides it across a reload; iPhone gets the Share → Add to Home Screen text; nothing when standalone or on a desktop pointer |
| `smoke.spec.ts`   | The splash keeps its still backdrop under Playwright's software WebGL; start a game, drive, the progress bar moves                                                                                               |
| `camera.spec.ts`  | `C` cycles the four cameras and Settings shows and sets the same view                                                                                                                                            |
| `hud.spec.ts`     | `H` hides and shows the HUD chrome; Esc opens a dialog over it; the pace note shows from the start and Settings has no toggle for it                                                                             |
| `mobile.spec.ts`  | Phone-landscape profile: touch pads, pause menu, Garage in the toolbar; checkpoint and money icons in one row, the pace note below, the turbo pad over steer-left only when fitted                               |
| `save.spec.ts`    | Game IDs, the save API, continuing a game                                                                                                                                                                        |

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
   for the proving ground, `?autopilot` (optionally `=<km/h>`, 108 by
   default) to let the car drive itself, and `?shot=helicopter` (or
   `lowChase`, `sideDolly`, `frontReverse`, `trackside`) to hold the
   cinematic camera on one shot kind, centred on the car.
3. Fill the driver name and Game ID, press Drive, wait for the canvas
   (`[data-testid="game-canvas"] canvas`) and about 3.6 s of countdown.
4. Hold `KeyW` for a second or two, press `KeyC` to change camera, `KeyH`
   to hide the HUD, and take `page.screenshot()`.

Useful stages (any game seed): index 2 is Forest on tarmac with a village
(`?spawn=town` for its entry), index 3 Coast, index 4 Arctic, index 5
Forest on mud with a village and the crowds behind berms, index 6 Desert,
index 8 the first city, index 9 the first circuit and index 10 an Alpine
village. Launch Chromium with
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

## Export tools

`tests/unit/exportCarStl.test.ts` is a dev tool wearing a test's clothes: run
with `CAR_STL=<carId> pnpm exec vitest run tests/unit/exportCarStl.test.ts`
it renders that car's `CarModel` with `@react-three/test-renderer` (no
browser, no WebGL), walks every visible mesh with its world transform and
writes a binary STL in metres (X right, Y forward, Z up) to `exports/`
(ignored by git) and to the Downloads folder. Without `CAR_STL` it skips,
so `pnpm test` is unaffected.
