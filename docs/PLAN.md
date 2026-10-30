# Plan

Status legend: [x] done · [~] in progress · [ ] not started

## 1. Scaffold — [x]

- [x] Next.js App Router + React 19 + TypeScript strict
- [x] Tailwind CSS 4, R3F + drei, Zustand
- [x] Vitest (unit) + Playwright (e2e) with a smoke test each
- [x] ESLint (zero warnings) + Prettier
- [x] CLAUDE.md, docs/BRIEF, PLAN, ARCHITECTURE, DECISIONS
- [x] `pnpm check` script + GitHub Actions workflow
- [x] Minimal typed i18n dictionary so components never hold literals

## 2. Vehicle sim + flat test track + chase camera — [x]

- [x] `src/game/vehicle`: bicycle model, friction circle, weight transfer,
      surfaces, torque curve, 5-speed auto (manual via env), turbo, handbrake
- [x] Suspension spring/damper over terrain height, airtime + landings
- [x] Fixed 120 Hz stepper (`FixedStepper`) with render interpolation
- [x] `KeyboardControls` → `ControlInput`; `DrivingSession` runtime outside React
- [x] Flat test track (tarmac ring, gravel/snow/mud pads, jump ramp) + `ChaseCameraRig`
- [x] Speed readout + backtick debug overlay (10 Hz telemetry store)
- [x] Unit tests: top speed per car, 0–100, braking distance, grip ordering,
      off-road drag, reverse, handbrake, ramp airtime, turbo, determinism

## 3. Terrain, road, checkpoints, timing, Forest — [x]

- [x] `StageGenerator`: seeded (game seed, region, index) Catmull-Rom road,
      heading clamped to ±63° of a main axis so it never self-crosses
- [x] `TerrainField`: simplex fBm, road bed smoothed + grade-limited (12%),
      corridor blended flat; surface = stage surface on the road, grass off it
- [x] Terrain chunks (64 m, 32² quads) meshed in a Web Worker, streamed by
      `ChunkStreamer`; sync fallback when workers are unavailable
- [x] Road ribbon pieces, edge lines, marker posts; start/checkpoint/finish arches
- [x] Instanced, chunked scenery (trees, bushes, rocks) + tree/rock colliders
- [x] `StageRun`: countdown, gated checkpoints (order enforced), penalties,
      repair fees, respawn at last checkpoint (R)
- [x] Prize formula (length × surface × pace vs par × loop) + records
- [x] Minimal stage HUD: timer, checkpoints, money, countdown, result panel
- [x] Free-roam test track kept at `/?track=test`

## 4. Cockpit + Isometric cameras, V cycling, reduced motion — [x]

- [x] `CockpitCameraRig` (eye on the chassis, glance into corners, cabin hidden), `IsometricCameraRig` (long lens, 55° pitch, stage axis + 45°, zoom)
- [x] `C` / `V` cycle; Camera dropdown in Settings; rigs swap via `createCameraRig` and snap
- [x] Interior view behind the wheel with a modelled cabin (`CarInterior`): working speedo/tacho, turning wheel, seats, pillars
- [x] Reduced motion: level head in the cab, no roll / FOV kick in chase
- [ ] Look-around in the interior view (drag / arrows) — later

## 5. HUD, service park, Garage, car models, economy tests — [ ]

- [x] Stage progress bar down the left edge with checkpoint ticks and a finish flag
- [x] Garage panel: Upgrades (7 cards, per-level pricing, applied via `applyUpgrades`) and Dealership carousel with a spinning 3D preview
- [x] Car models: coupé, saloon and Group B built from primitives in the hatchback style, proportions measured from the reference GLBs
- [x] Economy tests for upgrade pricing/effects, catalogue and store purchases; save v2 migration
- [x] Grip rework: steering assist, friction ellipse, rear grip bias — every car composed under power and off-throttle (unit-tested)
- [x] Tyre marks: one-mesh ring buffer fading from the oldest end, per-surface ink, Settings toggle
- [x] Dealership preview centred on the car; garage modal responsive (phone portrait/landscape, tablet, desktop)

## 6. Save system, API route, Game ID URL, start/continue — [ ]

- [x] Versioned `SaveFile` + Crockford Game IDs in `src/game/save`, unit-tested
- [x] Device-first saves (Web Storage) pushed to `/api/games/[id]` (file-backed), newest-wins merge
- [x] Autosave on start, after progress, every minute, on hide/unload and on leave
- [x] Splash: driver name + Game ID, Continue for returning players, `?game=` deep link
- [x] Game panel: driver, Game ID + Copy, sync status
- [x] Splash backdrop: live attract-mode drive (`RoadFollower` + chase camera) under a dark overlay; parked under reduced motion
- [ ] Delete this game, privacy policy link

## 7. i18n ES/IT, Settings, quality tiers, post-processing, audio — [ ]

- [x] Settings panel scaffold with Language (EN/ES/IT); HUD toolbar with Restart / Settings / Game
- [x] Touch-first responsive HUD: safe-area frame, icon-only toolbar on narrow widths, on-screen steer/pedal pads merged with keyboard input

## 8. Regions, weather, night, polish, smoke tests, screenshot script — [ ]

- [x] Deploy-ready for Vercel: Supabase Postgres save store (migration in `supabase/`), URL resolution from Vercel env, security headers, `docs/DEPLOY.md`

## 9. Capacitor iOS/Android, docs/ANDROID.md — [ ]
