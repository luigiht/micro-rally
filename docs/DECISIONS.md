# Decisions

Newest at the bottom. Format: date — decision — why.

1. **2026-10-29 — Scaffold by hand rather than `create-next-app`.** Keeps the
   initial commit minimal and avoids interactive prompts; config files are
   few and explicit.
2. **2026-10-29 — TypeScript 5.x instead of 7.x.** TS 7 (native port) is
   the npm `latest`, but Next.js and typescript-eslint tooling still target
   the 5.x JS API. Revisit once `typescript-eslint` supports 7.
3. **2026-10-29 — pnpm pinned via `packageManager`.** Matches the locally
   installed pnpm; CI uses `pnpm/action-setup`, which reads the field.
4. **2026-10-29 — R3F canvas loaded with `next/dynamic` (`ssr: false`).**
   WebGL has no server rendering; this keeps the static export (Capacitor)
   and SSR paths identical.
5. **2026-10-29 — Minimal i18n now, full ES/IT in milestone 7.** Rule
   "no hard-coded strings in components" applies from day one, so a typed
   `en` dictionary + `t()` helper exists already; `es`/`it` start as full
   copies typed against `en` so missing keys fail typecheck.
6. **2026-10-29 — Zustand stores live in `src/state`.** Not listed in the
   brief layout; separates React-facing state from the pure sim in
   `src/game`.
7. **2026-10-29 — Playwright starts the production server (`next start`)**
   for e2e to match what ships; uses Chromium only with SwiftShader-friendly
   WebGL flags so CI without a GPU still renders.
8. **2026-10-29 — Aggregate script is `pnpm check`, not `pnpm ci`.** `ci` is
   a reserved pnpm command name.
9. **2026-10-29 — ESLint 9, not 10.** `eslint-config-next@16` peer range
   rejects ESLint 10. Upgrade together when Next supports it.
10. **2026-10-29 — `unrs-resolver` build script disabled** in
    `pnpm-workspace.yaml` (`allowBuilds`). Its postinstall is only a fallback
    for missing prebuilt binaries; lint works without it.
11. **2026-10-29 — Lint enforces sim purity.** `no-restricted-imports` blocks
    `three`, `react` and `@react-three/*` in `src/game/**` and `src/lib/**`.
12. **2026-10-29 — Vehicle model.** Bicycle model with per-axle linear tyres
    clamped by a friction circle (μ × axle load) and an 18% post-peak
    fall-off for controllable slides. Load comes from the suspension spring,
    so crests lighten the car; `stability` filters that variation (the
    Suspension upgrade hook). Below 4 m/s yaw blends to kinematic steering to
    avoid low-speed pirouettes. Surface drag is longitudinal only — lateral
    drag would add grip off-road.
13. **2026-10-29 — Brake pedal doubles as reverse** once stopped, throttle
    re-selects first. No separate reverse key; matches arcade expectations.
14. **2026-10-29 — `DrivingSession` class owns the runtime** (sim, stepper,
    input, rig, telemetry) and lives in a ref. React Compiler lint forbids
    mutating hook-held values, and this keeps the R3F component thin.
15. **2026-10-29 — Shadows use PCF (`shadows="percentage"`)**; three r186
    deprecates `PCFSoftShadowMap`. The remaining `THREE.Clock` deprecation
    warning comes from R3F internals.
16. **2026-10-29 — Speed-sensitive steering.** Steering lock is
    `maxSteer / (1 + v / steerFalloffSpeed)` and digital input ramps at
    3.2/s (returns at 5.5/s), scaled by the steering-sensitivity setting.
17. **2026-10-29 — Playwright runs with one worker.** SwiftShader WebGL is
    CPU-bound; parallel pages starved each other's frame loops and the
    driving test saw 0 km/h.
18. **2026-10-29 — Workers regenerate the stage from its seed** instead of
    receiving serialised geometry. Generation takes ~1 ms and is
    deterministic, so main thread and worker always agree.
19. **2026-10-29 — Road never self-intersects by construction:** heading is
    a damped random walk clamped to ±1.1 rad of a main axis, so the road
    always makes forward progress.
20. **2026-10-29 — Terrain is non-indexed and flat-shaded** with per-face
    colours computed in the worker (linear-space vertex colours). Costs
    ~3× vertices but gives the faceted diorama look with zero textures.
21. **2026-10-29 — Timing advances inside the fixed physics step**, so
    stage times are frame-rate independent and comparable across devices.
22. **2026-10-29 — Repair fees are charged at the finish**, netted against
    prize money, never taking the balance below zero.
23. **2026-10-29 — Stage names are procedural proper nouns** (syllable
    pairs) and are not translated; everything around them is.
24. **2026-10-29 — Prize money uses a `$` prefix in every locale** with
    locale digit grouping; it's a fictional currency.
25. **2026-10-29 — Pixel font: Press Start 2P (OFL 1.1), bundled via
    `@fontsource`.** Requested by the user for headline HUD info (timer,
    speed, gear, countdown, money, result values). It's the one non-procedural
    asset: OFL rather than CC0, self-hosted (no runtime network), covers
    Latin-1 for ES/IT, and is listed in `CREDITS.md`. Labels and buttons stay
    in the rounded sans for legibility.
26. **2026-10-29 — Two tree species.** Forest mixes cone pines with round
    broadleaf trees (merged icosahedra) at ~100 trees per 100 m of road,
    clumped by a slow along-road wobble; both share one instanced trunk mesh.
