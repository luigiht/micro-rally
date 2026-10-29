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

## 4. Cockpit + Isometric cameras, V cycling, reduced motion — [ ]

## 5. HUD, service park, Garage, car models, economy tests — [ ]

## 6. Save system, API route, Game ID URL, start/continue — [ ]

## 7. i18n ES/IT, Settings, quality tiers, post-processing, audio — [ ]

## 8. Regions, weather, night, polish, smoke tests, screenshot script — [ ]

## 9. Capacitor iOS/Android, docs/ANDROID.md — [ ]
