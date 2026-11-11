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
27. **2026-10-29 — Curvier roads from a bend sequencer.** The road is built
    from bends (1–3 × 20 m control steps, mostly alternating direction into
    S-curves) and short straights, instead of a random-walk curvature. That
    roughly doubles average turning (~15 rad/km). Heading stays within ±1.25
    rad of the main axis, and a unit test checks that parts of the road more
    than 200 m apart stay at least 50 m apart, keeping terrain corridors from
    overlapping. Forest par speed dropped to 15 m/s to match.
28. **2026-10-29 — HUD layout and Game panel.** Money sits bottom-left; a
    top-right Game button (or Esc) opens a modal with stage info, the full
    controls table and an about blurb. The sim pauses while it's open. The
    always-on controls hint is gone. Game ID/delete/privacy join this panel
    in milestone 6.
29. **2026-10-29 — HUD toolbar: Restart / Settings / Game.** The lone Game
    button became a top-right toolbar. Buttons carry 8×8 one-bit glyphs drawn
    as crisp SVG rects in the text colour (`PixelIcon`), so icons need no
    image assets and recolour with the theme. One `uiStore.panel` slot tracks
    which modal is open; the sim pauses for any panel and Esc closes it.
    Restart bumps `attempt` (same path as "Drive it again") and is disabled on
    the free-roam test track. Settings offers a Language dropdown (native `<select>` dressed as a pixel box, so it works with keyboard, touch and screen readers) now; audio, quality,
    camera and controls join it in milestone 7. Panels are borderless
    (drop shadow only); buttons keep the ink ring.
30. **2026-10-29 — Touch-first responsive HUD.** Racing phones are held in
    landscape (wide but ~400 px tall), so width breakpoints alone misplace
    things. Layout is driven by a `coarse` Tailwind variant
    (`@media (pointer: coarse)`): timer, checkpoint and money stack top-left,
    the speed readout sits bottom-centre, and on-screen pads appear
    (handbrake + steer left/right bottom-left, brake + gas bottom-right).
    Toolbar labels collapse to icons below `md` but stay in the accessible
    name. The whole HUD lives in a `.hud-frame` inset by `env(safe-area-inset-*)`
    with pointer events off, so the canvas keeps wheel zoom; interactive
    pieces opt back in. Touch pads write a shared `TOUCH_INPUT` object that
    the session merges with the keyboard each physics step
    (`mergeControlInput`: max pedals, summed steer, ORed buttons, shift edges
    moved to the merged input). No React state on the input path.
31. **2026-10-29 — Save system and start screen (milestone 6).** Game IDs
    are 8 chars of Crockford base32 (no I/L/O/U; typed look-alikes are
    mapped), shown as XXXX-XXXX. A fresh ID is generated for a new game and
    never looked up; a typed or prefilled one is, and an unknown typed ID asks
    before starting a new game under it. Saves are device-first (Web Storage)
    then pushed to `PUT /api/games/:id`; the server keeps one JSON file per
    game under `.data/games` (temp file + atomic rename, last write wins), so
    dev and a single self-hosted node need no database and a KV/Postgres
    store can replace `gameFileStore.ts` later. Loads merge local and online
    by `updatedAt`. Autosave runs on start, 2.5 s after progress changes,
    every minute (which also retries a failed upload), on tab hide / pagehide
    with `keepalive`, and on leaving the game; nothing on the input path uses
    React state. Save files are versioned and parsed defensively, so a bad
    file is ignored rather than crashing. The ID lives in `?game=` so a
    bookmark resumes. The Game panel now shows stage info plus driver name,
    Game ID with Copy, sync status and Change driver; the controls table moved
    to Settings and the about blurb is gone. Knowing an ID is the only
    credential, and the splash says so. "Delete this game" and the privacy
    link from the brief are still to come.
32. **2026-10-29 — Three camera views, C cycles (milestone 4).** `C` (and
    `V`, as the brief lists) cycles chase → cab → isometric; Settings has the
    same choice as a dropdown. The mode lives in `settingsStore`; the
    `DrivingSession` reads it imperatively each frame and swaps rigs through
    `createCameraRig`, snapping the new rig on its first frame, so key and
    dropdown stay in sync without React on the frame path. **Cab:** the eye
    rides the chassis at the left seat, high under the roofline (+x is the
    car's left; forward is +z), looks along the heading with a 3° downward
    tilt and a small damped glance into the steering, and the car model hides
    its cabin, glass and mirror pods so the view is out over the bonnet;
    no zoom. **Isometric:** a 28° lens 32 m away at 55° pitch, fixed
    at the stage's spawn heading + 45° so the road runs diagonally up-screen,
    following the car with damped position and slow height; wheel/pinch zooms.
    Under reduced motion the cab keeps the head level and ignores steering,
    and the chase rig already drops roll and the speed FOV kick. The chase
    rig now resets its FOV on snap so switching back doesn't ease in from the
    long lens. Camera preference is per device and not yet persisted; it
    resets on reload like the language.
33. **2026-10-29 — Interior view and a modelled cabin.** A fourth camera,
    _interior_, sits behind the wheel (eye at 0.34 left, 1.2 up, 0.33 back in
    the car frame, 70° lens, 4° down tilt). Rather than making the exterior
    glass translucent (which would expose the solid cabin box behind it), the
    car model keeps its exterior as is and carries a separate `CarInterior`
    group inside the leaning body: dark floor, roof lining, windscreen header,
    A- and B-pillars, door cards with armrests, dash with a driver's binnacle,
    speedo (0–240 km/h) and tacho (to redline) needles driven from the pose,
    a three-spoke wheel on a raked column that turns 4.5× the road-wheel angle
    (clockwise for a right turn), centre console with gear lever, co-driver's
    pace-note pad, rear-view mirror and two bucket seats. The exterior cabin
    and glass are hidden in both first-person views; the interior is shown
    only in this one, so chase and isometric cost nothing extra. Both
    first-person views share `FirstPersonCameraRig` with a preset per mode.
    `rpm` joined the interpolated pose so the tacho is frame-smooth. The cycle
    is now chase → cab → interior → isometric.
34. **2026-10-29 — Stage progress bar.** A 12 px vertical bar down the left
    edge: start at the top, chequered flag at the bottom, a tick per
    checkpoint (paper once passed) and a pointer at the car. Progress is the
    nearest centreline point's arc length mapped onto the start→finish span
    (`StageRun.progressAt`, pure and unit-tested), sampled at the 10 Hz HUD
    tick. It holds its last value while the car is more than six road
    half-widths from the centreline, so cutting a bend never jolts it. Hidden
    on the free-roam test track. On touch layouts the top-left timer stack
    moves right to clear the bar and its pointer.
35. **2026-10-29 — Restart moves into the Game panel.** The toolbar is down
    to Settings and Game; "Restart stage" sits under the stage facts inside
    the Game panel, where a destructive action belongs behind one deliberate
    tap rather than next to the always-visible buttons. The progress bar lost
    its finish flag: the bottom of the bar is self-evidently the finish. "Change driver" went too: switching games is done
    from the splash, which a reload (or a `?game=` link) brings back.
36. **2026-10-29 — Attract-mode splash backdrop.** The splash card now sits
    over a live scene instead of paper: a freshly generated stage, the
    hatchback following the centreline at a steady 17 m/s through the pure
    `RoadFollower` (position and heading from the arc-length sample, height
    and pitch from the terrain, steering and lateral g from the heading rate,
    no physics), the normal `ChaseCameraRig` behind it, and a 45 % ink
    overlay so the card reads. Coasting past the finish regenerates the world
    with a new seed, so the backdrop never repeats. Under
    `prefers-reduced-motion` the car stays parked and the camera still. The
    scene has its own client-only canvas (`SplashScene`), unmounted when the
    game starts; sky, fog and lights moved into `SceneLights` so the game and
    the demo share them.
37. **2026-10-29 — Splash: logo, no tagline, paste-to-continue ID.** The
    card shows the brand SVG from `assets/` (imported through the `@assets`
    alias with `next/image`, which leaves SVGs unoptimised) inside the `h1`,
    so the heading keeps its accessible name. The Game ID field is now empty
    and optional: leave it to start a new game under a generated ID (shown
    later in the Game panel), or paste one to resume. An unknown ID is
    refused with an inline message rather than offered as a new game, which
    removes the typo-creates-a-game path. Returning players still get their
    ID and name prefilled and a Continue button. On wide screens the demo
    camera's view is offset so the car drives beside the card, not under it.
38. **2026-10-29 — Brand assets, metadata and SEO.** `assets/` holds the
    source SVGs (logo, favicon, Open Graph). `pnpm brand`
    (`scripts/render-brand.mjs`, Playwright) copies the favicon to
    `src/app/icon0.svg` and renders `icon1.png` (192), `apple-icon.png` (180)
    and `opengraph-image.png` (1200×630) by inlining the SVGs, since the OG
    art uses `foreignObject` and scrapers need raster. Next's file
    conventions then emit the icon, Apple touch and `og:image` tags with
    sizes. `layout.tsx` sets `metadataBase` from `NEXT_PUBLIC_SITE_URL`
    (localhost fallback), a title template, keywords, canonical, robots,
    Open Graph with ES/IT alternate locales, a `summary_large_image` Twitter
    card, iOS web-app hints and VideoGame JSON-LD; `robots.ts` disallows
    `/api/` and `sitemap.ts` lists the single page. The logo is centred in
    the splash card.
39. **2026-10-29 — Splash fields.** Both inputs type in the rounded sans
    (the pixel font stays for labels and buttons); the Game ID explanation
    sits behind a "?" button beside the field, revealed on tap but always
    present for screen readers through `aria-describedby`.
40. **2026-10-29 — Splash help dialog, footer and privacy page.** The "?"
    beside the Game ID is a square `pixel-input-btn` that matches the input's
    height and border and opens a small `InfoDialog` (Close button, Esc,
    focus returned to the opener); the same text stays as an `sr-only`
    description of the field. A footer in paper-white over the backdrop
    carries the copyright, a Privacy link, "Created by Luis Hermosilla"
    (luigiht.com) and a compact language select bound to the same settings
    store as the Settings panel. `/privacy` is a short, translated policy
    describing exactly what is stored (driver name, game state, Game ID),
    where (browser storage and the server under the ID), the no-cookies /
    no-analytics stance, and how to have a save removed; it is in the
    sitemap. Site constants (`SITE_URL`, `AUTHOR`) live in `src/lib/site.ts`.
41. **2026-10-29 — Garage: upgrades and dealership (milestone 5 start).** A
    Garage button beside Money opens a tabbed panel. _Upgrades_ (seven cards:
    engine, turbo, tyres, suspension, brakes, gearbox, weight) have per-level
    prices that grow geometrically and apply to the `CarSpec` through the
    pure `applyUpgrades`, so the sim never knows about money. _Dealership_
    lists cars from `CAR_CATALOG` with stat bars derived from the physics; the
    second car is an original low-poly 1970s wedge coupé with a generic
    green/white/red stripe set (no real marque names or logos), built from an
    extruded side profile plus boxes, in `bodies/CoupeBody.tsx`; the
    hatchback shell moved to `bodies/HatchbackBody.tsx`. Purchases update the
    store at once but the car on track changes on the next run: `DriveRig`
    snapshots car + upgrades when a run mounts, which keeps mid-stage
    shopping from resetting the clock. Lower cabins pass a `cabinDrop` to the
    interior group and the first-person eye. Saves are now v2 (`carId`,
    `ownedCars`, `upgrades`); v1 files migrate to the hatchback with nothing
    bought.
42. **2026-10-29 — Vercel-ready persistence and URLs.** Serverless has no
    writable disk, so the save API now selects its store from the
    environment: `RedisGameStore` talks to Upstash Redis (Vercel's KV
    integration) through its REST API with plain `fetch` (no SDK, one key per
    Game ID), `FileGameStore` stays for dev and self-hosting, and on Vercel
    without Redis the route answers `503 storage_unconfigured` instead of
    silently losing writes; the client already degrades to device-only saves.
    `SITE_URL` resolves from `NEXT_PUBLIC_SITE_URL`, then Vercel's
    `VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL`, then localhost. Security
    headers (`nosniff`, referrer policy, permissions policy) come from
    `next.config.ts` so they apply on any host; `X-Powered-By` is off. No
    `vercel.json` is needed: Next.js is zero-config there. Steps and env vars
    are in `docs/DEPLOY.md` and `.env.example`.
43. **2026-10-30 — Three more primitive-built cars and a showroom carousel.**
    The reference GLBs in `assets/rally-cars-references` are used only as
    measurements: a script (`scripts/profile-glb.mjs`) bins their body meshes
    along the length to read the roof line, body width and cabin width, and
    those silhouettes drive hand-placed boxes in the hatchback's style, so
    nothing from the files ships and the look stays one family. Coupé (low
    wide tub, forward narrow cabin, louvred engine cover, lamp pod, tricolour
    bands), saloon (long shell, bonnet scoop, four-door cabin, tall wing on
    uprights, gold flank stripe and rims) and Group B (square louvred bonnet,
    boxy cabin, roof-mounted wing on raked struts, wide arches, side intakes,
    red/blue bands). Physics follow the reference wheelbase, track and wheel
    radius; `cabinDrop` places the shared interior under each roof. The
    Dealership is a carousel: a small R3F turntable (static under reduced
    motion) with prev/next, dots and the car's card. Display names are
    generic on purpose; the reference components in `assets/` are excluded
    from ESLint and `tsc`.
44. **2026-10-30 — Lofted hulls instead of box stacks.** Every car body is
    now a procedural low-poly hull (`src/render/car/CarHull.ts`, pure TS,
    unit-tested): a table of cross-section stations (floor, sill, belt and
    roof heights; sill, belt and roof half-widths; glass segments and pillar
    gaps) is lofted into a flat-shaded triangle soup with per-face vertex
    colours for underside, sill, paint, belt stripe, glass and roof, and
    faces are wound outward from the profile normals. That gives the raked
    windscreens, tapering greenhouses, wedge noses and sloping decks the
    reference models have, in one draw call per body, while details stay as
    primitives (lamps, wings, scoops, louvres, mirrors) and arches become
    half-torus lips. The glass is part of the hull, so first-person views
    see out through the culled inner faces; only mirrors are hidden.
    Station tables were read off the reference silhouettes.
45. **2026-10-30 — Supabase replaces Upstash Redis for online saves.** By
    request, production saves live in a Supabase Postgres table
    (`public.games`: `id text primary key`, `save jsonb`, `updated_at`), one
    row per Game ID, upserted with last-write-wins. The route talks to
    PostgREST with plain `fetch` and the service-role key, which stays
    server-only; row-level security is enabled with no policies so the public
    anon key cannot read saves. The schema ships as a Supabase CLI migration.
    Selection logic is unchanged otherwise: file store for dev and
    self-hosting, `503 storage_unconfigured` on Vercel without credentials.
    Postgres also leaves room for later queries (leaderboards, cleanup of
    stale saves) that a key-value store would not.
46. **2026-10-30 — Garage changes apply immediately.** Buying or selecting a
    car (or an upgrade) now retunes the running `VehicleSim` in place
    (`retune`: position and speed carry over, gear clamped to the new box),
    swaps the model, and rebuilds the first-person rig when the cabin height
    differs, so every camera view sees the chosen car at once. The previous
    "next run" snapshot was simpler but read as a bug: the showroom said you
    owned a car you were visibly not driving.
47. **2026-10-30 — One grip setup for every car.** The coupé's softer rear
    cornering stiffness and lower stability made it feel like it was on ice,
    so tyre grip, cornering stiffness, stability and aero grip are now the
    hatchback's values for every dealership car; cars still differ in mass,
    torque, drag, gearing and drive split (the coupé stays rear-driven). The
    showroom's Grip bar is therefore equal across cars by design. The game
    canvas carries `data-car` so tests can see that a purchase lands on track
    at once.
48. **2026-10-30 — Grip rework: cars no longer slide through ordinary
    corners.** Measured with the sim harness before the change, the coupé spun
    at 72 km/h with half throttle and half steer (body slip 77°) and the
    hatchback ploughed with 22° of front slip at full lock. Five changes,
    all in `VehicleSim`/`CarSpec`: (a) cornering stiffness 9/9.5 → 14/16 per
    rad and tyre grip 1 → 1.1, so the same lateral force needs less slip;
    (b) a steering assist clamps the front steer angle so the front slip
    angle stays within 1.35× the tyre's peak slip — the window follows the
    axle's own slip, so counter-steer is never blocked, and always spans 30%
    of the mechanical lock so the car can still be over-driven; (c) a
    friction ellipse in which the lateral demand reserves grip first (0.9
    weight) and longitudinal force costs lateral grip at only 0.5 weight;
    (d) built-in understeer: the rear axle gets 20% more grip
    (`REAR_GRIP_BIAS`) so the front lets go first — this is what removed the
    lift-off spins on gravel, which happened even at zero throttle because
    coasting shifts load forward on a neutral car; (e) post-peak fall-off
    18% → 12%. Afterwards every dealership car corners at 72 km/h under power
    with 1–3° of body slip on tarmac and gravel, and the handbrake still
    spins the car (rear grip × 0.4). Tests pin body slip under 6° on tarmac
    and 7° on gravel, on and off the throttle.
49. **2026-10-30 — Tyre marks.** Researched before building: Nition's
    `UnitySkidmarks` (ring buffer of 2048 quads in one mesh, ~0.25 m sections,
    intensity in vertex data, polygon offset −4, no depth write, each wheel
    joins its new section to its last one) and the Irrlicht forum's skid-node
    thread (side vector = up × travel direction; sample densely in curves,
    sparsely on straights). Ours: `render/effects/SkidMarks` owns one
    `ShaderMaterial` mesh with per-vertex intensity and birth time; the
    vertex shader holds a mark solid for 8 s and then fades it over 22 s, so
    strips fade from their oldest end with no per-frame CPU work; the ring
    buffer recycles the oldest quads. The pure `game/vehicle/wheelContacts`
    decides where and how hard: slip beyond 2.2× the tyre's peak (sharp
    turns, drifts), the handbrake, or a real burnout/lock-up (over 60% of the
    demanded longitudinal force lost); hard-but-gripping cornering leaves
    nothing. Ink is per surface — rubber-black on tarmac, light brown on
    gravel, churned dark green/brown on grass and mud, compressed grey on
    snow. Settings has a toggle (`skidMarks`, default on) and `capacity` is
    the quality knob; a session clock that pauses with the panels drives the
    fade so marks don't age while paused.
50. **2026-10-30 — Dealership turntable aims at the car's mid-height.** The
    default look-at (the origin, at ground level) placed the horizon near the
    top edge of the 16:9 preview and cropped the roof; the camera now looks
    at y = 0.7 m from a slightly farther, higher position so the car sits in
    the vertical centre.
51. **2026-10-30 — Responsive garage modal.** On a 375 px phone the
    dealership's 3D canvas pushed the dialog to 452 px (the canvas's pixel
    width fed the panel's min-content size), and on landscape phones the
    512 px-wide dialog left ~110 px of visible content. `HudDialog` is now a
    `min-w-0` flex child, which breaks that chain, and takes a `className`
    for per-panel sizing. A `short` custom variant (`max-height: 480px`)
    widens the Garage to `max-w-3xl`, trims padding, lays the dealership out
    as preview | card and the upgrades as three columns. On phones the
    carousel arrows move under the full-width preview (prev · dots · next)
    via CSS grid placement, so the DOM and tab order are unchanged.
52. **2026-10-30 — Two more lofted cars from the `assets/new-cars`
    references.** The Ford Focus WRC folder holds a 3ds Max scene plus its
    livery textures (side, top, tail, wing, lamps) and the Audi folder a
    Blender file; neither opens here, so the textures were read by eye and
    the `.blend` only for its material names (base white, base yellow, red,
    black, rubber, lamps). Both cars follow the hull-station pattern. The
    `wrc` hatch (`WrcHatchBody`) has a sloping nose, a fast windscreen far
    forward, a tall roof and a near-vertical tailgate; its Martini-style
    flank is the hull's stripe band stretched from the sill to just under
    the belt with five sub-bands (sky, navy, red, navy, navy) so the skirt
    reads double height, plus a navy bonnet oval, bonnet bands, roof scoop
    and a navy two-tier wing on the roof's trailing edge over a flat, plain
    white tailgate (by request: no red on the back under the wing). The `s1` coupé
    (`S1CoupeBody`) gets its box flares from the hull itself: stations step
    the half-width from 0.88 m to 0.97 m over each axle and run wide to the
    bumpers, so no arch lips are needed; red-over-yellow band with yellow
    pinstripes along the flare tops, sill blades, bonnet, splitter, wing and
    tail in the Audi Sport manner, louvred bonnet, quad lamps in a deep air
    dam and a shelf wing with yellow end plates on the boot. Physics follow the real wheelbases (2.615 m and 2.22 m);
    the S1 is the most powerful and shortest car in the shop and prices
    stay strictly ascending (saloon → wrc → groupb → s1). Display names are
    generic (Riviera WRC, Edelweiss S1); nothing from the reference files
    ships. Bonnet graphics (the WRC's navy oval, bands and vent slots; the
    S1's yellow stripes, red centre line and louvres) were first thin boxes
    laid on the bonnet and visibly floated or cut through its slopes, so
    the hull builder gained _deck decals_: signed x/z rectangles painted
    onto the top faces by splitting them along x at each decal edge (an
    oval is five slices), with stations inserted at the decal's z edges and
    glass never overpainted. The S1's flare pinstripe likewise moved into
    the flank stripe band (six equal sub-bands under the belt) so it follows
    the belt crease over the box flares.
53. **2026-10-30 — Wheels rest on the road ribbon, body rides the springs.**
    The tyres sat ~10 cm into the road: the sim grounded on the terrain bed
    while the road ribbon is drawn 8 cm above it (`ROAD_LIFT`), and the whole
    model, wheels included, hung from the sprung body, which sags 2.6 cm at
    rest and up to 35 cm over bumps. Two changes. `TerrainField.heightAt`
    (the surface wheels, cameras, props and the demo car query) now adds the
    ribbon's lift across the carriageway with a 0.6 m blend at the edge, while
    `sample` stays the bare bed the ground mesh is built from; `ROAD_LIFT`
    moved to the pure stage module and the road builder imports it, and skid
    marks drop their extra 0.1 m lift to 0.02 m since the query already
    includes the ribbon. `VehiclePose` carries `groundHeight`; `CarModel`
    places the four wheels in their own group raised by
    `groundHeight − y` (clamped to the sim's maximum compression), so the
    tyres stay on the surface and the body visibly compresses over them.
    Tests pin the lifted surface on the road and the bare bed beside it,
    and the resting sag of the body above the ground.
54. **2026-10-30 — Garage in the toolbar on touch devices, drawn as a car.**
    On phones the Garage button sat beside Money in the bottom-left, under the
    steering pad and easy to miss, and its 8×8 glyph (a diagonal spanner
    sliver) did not read at 16 px. The toolbar now carries a Garage button
    on coarse-pointer devices, placed before Settings, and the bottom-left
    button hides there (`hidden coarse:inline-flex` / `coarse:hidden`, so
    exactly one is in the accessibility tree; `ToolbarButton` takes its
    display class as a prop because a base `inline-flex` cannot be
    overridden by `hidden` at equal specificity). Desktop keeps the button
    next to Money. The glyph is now a car seen head-on — windscreen, two
    headlights either side of a grille gap, bumper, two wheels — chosen from
    nine side- and front-view candidates rendered at 16/24/64 px against the
    gear glyph; the filled front view with open headlights read best at the
    small size (by request: front-facing). The mobile e2e test checks the
    Garage is inside the toolbar and that there is only one.
55. **2026-10-30 — Open Graph art refresh, web manifest and richer SEO.**
    `assets/og-image.svg` now carries the pixel wordmark over a rendered
    forest stage (Figma export with embedded PNGs, so it is ~3 MB and stays
    a source asset); `pnpm brand` re-rendered `opengraph-image.png` and the
    alt text (`opengraph-image.alt.txt`, mirrored in `meta.ogAlt` for all
    three locales) describes the new picture. The brand script also renders
    a 512×512 `icon2.png`, the size browsers require to install a web app.
    `src/app/manifest.ts` adds `/manifest.webmanifest` (name, short name,
    description, standalone landscape display, paper theme colour, the SVG
    - 192 + 512 icons and the OG image as a wide screenshot); Next links it
      from `<head>` automatically. `layout.tsx` gains author, creator and
      publisher (from `AUTHOR` in `lib/site.ts`), a `googleBot` rule allowing
      large image previews and unlimited snippets, and JSON-LD rewritten as a
      `@graph` of `WebSite`, `Person` and `VideoGame` with `image`, genres,
      keywords, `isAccessibleForFree`, play mode, browser requirements and
      cross-references by `@id`. No visible splash copy was added: decision
      37 keeps the splash to the logo, and the description already reaches
      crawlers through the meta tags and structured data.
56. **2026-10-30 — Stage history in the Game panel.** Finished stages were
    already persisted per Game ID as `records[index]` (best time, splits),
    and every stage is deterministic from `(gameSeed, index)`, so the save
    schema is unchanged: the list is regenerated, not stored. The generator
    is split so `stageBrief` draws name, surface, weather, length and par
    from the first RNG calls and `generateStage` continues the same stream
    for the road, keeping existing worlds identical (pinned by a test). The
    "current" stage is the frontier, derived by `frontierStage` as the
    larger of the driven index and one past the highest record, so
    `stageIndex` can point at an older stage while replaying without a new
    field. `driveStage(index)` refuses anything past the frontier and bumps
    `attempt`, so `DrivingScene` remounts exactly as on Restart; "Next
    stage" after a replay simply advances by one. The panel lists stages as
    wrapping pixel buttons (surface glyph + place name; the driven one is
    filled and `aria-current`, the frontier is announced as "Current
    stage", surface and best time sit in the tooltip and screen-reader
    text). Stages list newest first (the current one leads, then the latest
    completed); long histories show the newest six plus the stage being
    driven, with a quiet underlined "Show n more" text link after the oldest
    shown rather than another pixel button (`stageWindow`, pure). Five new
    8×8 glyphs: road with dashed centre line, pebbles, puddle, snowflake,
    grass blades. Buttons are compact (stage number + glyph) and widen on
    hover or keyboard focus to reveal the name (the glyph alone carries the
    surface; its label stays in screen-reader text and the tooltip), collapsed with
    `max-width` rather than `display` so the accessible name is always the
    full one. Widening in flow made a button at the end of a row wrap away
    from under the pointer and flicker, so each item reserves a fixed slot
    and the button widens over its neighbours (raised z-index); items in
    the right half open leftwards (measured on pointer enter / focus) so
    they stay inside the panel. The transition is off under reduced motion,
    and touch devices, having no hover, use in-flow buttons with the detail
    always open.
57. **2026-10-30 — Three cameras, tyre marks always on, quieter Settings.**
    By request the Cab (bonnet) view is gone: `CAMERA_MODES` is chase →
    interior → isometric, `CAB_VIEW` and its factory case are removed, and
    the car hides its roof and glass only for the interior. The "Tyre marks"
    toggle left Settings and `settingsStore`; `DriveRig` always builds
    `SkidMarks`, so this visual extra is no longer individually toggleable
    (rule 4 is relaxed here on purpose; the quality tiers of milestone 7 can
    reintroduce a switch if low-end devices need one). The Settings dialog
    drops the "Paused while this panel is open" subtitle; the Game panel
    keeps it. Settings are not persisted, so no saved `cockpit` value needs
    migrating.
58. **2026-10-31 — Alpine region: asphalt under snow, sharper bends.** The
    progression loop is now forest ×3 → alpine ×3 (`REGION_ORDER`). Alpine
    stages roll `snow` three times out of four (else cleared `tarmac`) with
    `snow` off-road, a snowfield palette (near-white ground, grey-blue
    shoulder and rock, frosted pine and bare broadleaf tints, pale sky and
    fog), larger hills (amplitude 34, frequency 1/230), shorter base length
    (1.5 km) and twistiness 1.4 against the forest's 0.9, which the
    centreline builder turns into tighter bend curvature; a test checks the
    mean heading change per sample is at least 15 % above the forest's over
    six seeds. The `snow` surface keeps its physics (grip 0.42, par factor
    0.82, prize ×1.35) but is drawn differently: `RoadBuilder` tints snow
    stages per sample from tarmac toward the snow colour by a patch signal
    (hashed knots every ~28 m, smoothstep across a wide 0.3–0.7 band for
    long run-ins), to 45 % cover, the same across the full width: clear
    stretches are bare out to the edge lines and snowy ones are even from
    side to side. Earlier iterations tried heavier verges than the wheel
    lanes; by request the cover is uniform. A first attempt lerped the whole
    ribbon by a smooth 25–85 % noise and looked flat grey: the gradient was
    gentle and the scene lighting compresses light tones, so patches now
    switch via a short smoothstep and the lanes stay near bare. The
    per-sample jitter hash moved from a multiply-mod (which ramps for
    consecutive indices) to an integer mix. Because stage seeds hash the
    region, existing games' stages at indices 3–5, 9–11, … regenerate as
    alpine stages (records stay keyed by index); forest
    indices keep their exact stages.
59. **2026-10-31 — Houses in the landscape; checkpoints as time-control
    boards.** `SceneryScatter` gains a `house` prop kind placed by the same
    seeded pass as trees (`REGIONS[*].scenery.houses` per 100 m: forest 0.9,
    alpine 0.7): never within 14 m of any part of the road (`path.nearest`
    over the whole path), at least 24 m × scale from each other, and only
    where the ground rises less than 1.6 m × scale within 3.5 m, since the
    terrain is not flattened under them; each turns its door toward the
    nearest stretch of road (±0.4 rad), which a test checks.
    Collision is three circles (r 2.4, spread 1.8, × scale) along the long
    axis, so the existing circle grid needs no new shape. Rendering stays
    instanced: `HouseGeometry` merges boxes and a hand-built gable prism
    into two kits with vertex colours (slab, door, window glass and frames,
    brick chimney on white walls; roof plus ridge), and the per-instance
    tint — cream or ochre walls, terracotta or slate roof by `variant` —
    multiplies them, so one draw call per kit per chunk. Checkpoint arches
    are replaced by a pair of roadside time-control boards standing on the
    ground with no post (as at real controls): a plain white plate 1.15 m
    tall on each verge (a dark border was tried and dropped by request),
    sunk 0.1 m into sloping ground, carrying a yellow clock face with a
    black ring, hands and hub in its upper half, facing the approaching car
    — the "start of control" (yellow clock) sign. The clock layers are 3 mm
    apart so the face is flat with no relief, and the hands read 2:50 as the
    driver sees them (a positive z-rotation is clockwise from the -z side).
    Verge marker posts (every 20 m) are placed via the pure `markerDistances`,
    which skips any pair within 1.2 m along the road of a checkpoint, so a
    board is never pierced by a post; the board wins, the post is dropped. Start and finish
    keep their gantries; gate crossing logic is untouched. Two lessons from
    the first cut: `mergeGeometries` needs every part indexed or none, so
    house parts are made non-indexed before merging (a null merge crashed
    the scenery loader), and the hand-built gable must be wound
    counter-clockwise seen from outside or it is back-face culled; a test
    checks every prism face points away from the roof centre. The roof is a
    closed pentagonal prism (flat soffit seated 0.12 m below the wall top,
    0.22 m eave faces, slopes, gable ends) rather than an open shell, which
    had read as a gap between wall and roof; detail added by request: front
    dormer with its own gable, door canopy on two posts with a step, sills,
    shutters, chimney cap.
60. **2026-10-31 — Terrain sunk under the carriageway.** Over crests and
    dips the terrain showed through the road: the terrain grid (2 m cells)
    and the road ribbon (2 m samples) are both chord approximations of the
    same smoothed, grade-limited profile but sampled at different points,
    and the grade clamp leaves kinks where curvature spikes, so in a dip the
    terrain's chords bowed above the ribbon's 0.08 m lift. `TerrainField.
sample` (the mesh bed) now subtracts `ROAD_BED_DROP` (0.25 m) under the
    carriageway, ramping to zero over the last 1.2 m before the road edge,
    so the verge still meets the ribbon edge cleanly while anything the
    terrain does under the road stays hidden. `heightAt` (what wheels and
    props use) is unchanged, so physics and scenery placement are
    untouched; tests pin the bed at road − 0.25 across the carriageway.
    With the verge at bare road height the ribbon's 0.08 m lift then read as
    a second layer hovering over the ground, so the verge (flat margin) now
    sits at deck level (road + lift) and blends to the hills from there,
    meeting the ribbon flush; `heightAt` returns the deck across road and
    verge alike, so wheels roll off the road without a step. That still left
    a seam: terrain triangles (2 m cells) straddling the road edge
    interpolate between a sunk vertex and a deck vertex, so the ground at
    the exact edge sat a few cm under the ribbon and shadows broke there.
    The road mesh therefore carries its own 2 m verge strips either side,
    built from the same samples as the ribbon (shared edge vertices → flush
    by construction) and coloured with the region's shoulder colour; the
    trench ramps closed under the strip (0.6 m inside to 0.4 m beyond the
    edge) and the terrain's flat margin widened to 3 m, so the coarse
    terrain only shows beyond the strip, where it is the same colour and a
    small height difference is invisible. Tests pin the bed at deck level
    past the ramp and at the strip's outer edge.
61. **2026-10-31 — Impreza-shaped Boreal Saloon; Sirocco Dakar Truck.** The
    saloon hull was reshaped in the GC8 Impreza mould: low wedge bonnet to a
    scuttle, fast windscreen, low roof over a short four-door cabin with a
    B-pillar, fast C-pillar onto a short high boot, blistered arches (the
    hull steps from 0.85 to 0.92 half-width over each axle) and WR-blue over
    gold (flank pinstripe, bonnet pinstripes, wing plates, wheels), with a
    big bonnet scoop, roof vent, tall wing and twin round fogs. The new
    `dakar` car (price 26 000, after the S1) is a cab-over rally-raid truck
    built from two hulls — the cab (orange over a navy lower band, steep
    windscreen) and the cargo box (orange top, white band, red rule, navy
    skirt) — plus chassis rails, exhaust stack, roof light bar and rails,
    navy grille, orange bumper with four lamps, steps, handles, big mirrors
    and a spare on the back wall. Its spec is heavy and tall (3.2 t, cg
    0.95 m, 0.6 m tyres, 3.9 m wheelbase) with slow-revving diesel torque
    and low gearing. Two generic changes carry it: tyre width now scales
    with wheel radius (0.8 ×, unchanged for cars to within 4 mm) and mud
    flaps size with the wheel; and `cabinForward` joins `cabinDrop` on the
    spec so the interior and the first-person eye can move along the car
    (truck: 1.6 m forward, 1.25 m up), plumbed through `createCameraRig`
    and `FirstPersonCameraRig`; and `bodyScale` (truck 2.0) pushes the
    chase camera's distance and height, the isometric distance (by its
    square root) and the showroom camera back in proportion, so a body
    twice a car's size is framed like one. The truck keeps the dealership's
    shared grip setup (tyres, cornering, stability, aero) like every other
    car; it differs in mass, power, gearing, drag and suspension. A first
    pass left the saloon's tail lamps, wing uprights, boot lip, headlamps
    and bonnet scoop hovering over the lofted surface (parts were placed
    for a higher deck than the stations gave); the boot and nose were
    raised, lamps moved inside the end faces, uprights seated on the deck
    and the scoop tilted 0.16 rad to lie along the bonnet; the boot deck
    was then raised again (0.92–0.95 m) so the body itself forms the tail
    edge and the separate black lip was dropped. Rule for added parts:
    every box must overlap the hull surface it sits on.
62. **2026-10-31 — Launch revs scale with the rev range; truck retuned for
    agility.** The truck would not move: the clutch-slip launch model held
    the engine at idle + 2600 rpm, sized for a 7000 rpm car, which on a
    2600 rpm diesel sat above the redline where `torqueAt` returns zero.
    Launch revs are now idle + 0.43 × (redline − idle) — ≈3500 rpm on the
    cars as before, ≈1460 rpm on the truck — and a test checks every
    dealership car pulls away from rest. The truck is also tuned for feel
    rather than realism: 2.6 t (was 3.2), cg 0.85 m, yaw inertia 1.5 (was
    2.2), steering lock 0.55 rad with a later speed falloff, 1500 N·m,
    stronger brakes and a little more turbo, so it turns in far better than
    its size suggests while keeping the shared grip setup. The hull builder
    gained `wrapStripes`, which paints the stripe bands across the end caps
    instead of body colour, so the truck's white/red/navy box bands and the
    cab's navy band continue around the back and front; cars keep plain
    noses and tails.
63. **2026-10-31 — Albion RS Hatch (Castrol-Focus-style WRC).** New `focus`
    car at 21 000, between the S1 and the truck. The hull is a mid-2000s
    three-door World Rally hatch: sloping nose to a high scuttle, fast
    screen, tall roof over a long door and quarter window with the B-pillar
    set back, steep hatch glass onto a tall tail, box flares (0.88 → 0.97).
    Livery after the 2006 works car: white shell, royal-blue roof (hull
    `roof` colour), bonnet centre band with a white oval and blue dot, blue
    hatch deck (deck decals), lime lower flanks over a blue sill (stripe
    band `[0.56, 0.14]` as lime ×3 + blue), four-lamp pod on a blue bar
    tilted with the bonnet, white wing on blue uprights with big blue end
    plates, lime bumper with a white band and twin lime lamps, blue
    splitter and rear bumper, blue mirrors and arch lips, white wheels, and
    a numbered door plate. Spec sits beside the Riviera WRC with a little
    more torque and turbo. No brand marks are drawn; the look is
    colour-blocking only. By request the tail was then rebuilt as a true
    hatchback — the rear glass falls steeply from the roof straight to a
    flat vertical back panel at z −2.0 with no boot deck — the wing moved
    onto the roof's trailing edge above the glass, the flank bands wrap
    around the tail (`wrapStripes`), and the door roundel was dropped. From
    the rear reference: the glass narrows at the tail (xRoof 0.7) so body
    corners flank it, each carrying a tall lens that hugs the inward-leaning
    C-pillar surface for the full height of the glass (oriented from the
    surface's own axis and outward normal, built with a three.js basis); the wing is black, its uprights rising from the
    base of the glass at the tail's top edge to a blade at about roof
    height with modest plates (lowered and shrunk by request). Detail pass
    from the photos: lamp pod moved to the bonnet's leading edge with the
    lamps hanging over the nose, bonnet vent slots behind it, blue bumper
    corners over the lime with a dark lower grille and a red tow strap,
    headlamp bezel lines and a second antenna (a blue rear-quarter panel
    was tried and removed by request; the quarter stays white).
64. **2026-10-31 — Edelweiss S1 rebuilt on the Sport Quattro S1 E2.** From
    the reference photos: long flat bonnet to an upright screen, tall flat
    roof over a short cabin, near-vertical rear window onto a short boot,
    box flares stepping straight out (0.86 → 0.99) over both axles and
    running to the bumpers. Livery white over yellow: the flank band is
    eight equal sub-bands (yellow pinstripe, white, red pinstripe, white,
    solid yellow lower half to the sill) and wraps the nose and tail;
    offset red/black/grey wedges and two louvre banks on the bonnet. Parts:
    black sill blades with a yellow edge, door plate, black vents on the
    rear flares, twin rectangular headlamps either side of a black grille,
    a deep black air dam with a forward white splitter, yellow lip and white
    side wings, two pairs of round lamps, a roof-height shelf wing on two
    uprights with tall end plates and a red rear lip, side fins running the
    plates forward along the rear quarters to the pillars, a black vent
    panel between wide tail lamps, scuttle and roof vents, and twin
    exhausts. Spec unchanged. No brand marks; colour-blocking only. To
    read less slab-sided, the hull builder gained an optional `xBelt`
    (belt-line half-width): the flank now leans from `xBody` at the sill
    top out to `xBelt` at the belt, so with a tucked sill the side is a
    convex shoulder rather than a vertical plane (S1: 0.78 → 0.86 → 0.91
    between the arches, flares stay vertical). The S1 also got chamfered
    nose and tail stations, black arch lips and a raised sill tuck (a
    bonnet bulge was tried and dropped: it hid the wedges). Still too flat
    and wide, so it was re-proportioned to the real car: body 0.8 / belt
    0.85 / flares 0.93 half-width (1.86 m over the arches, was 1.98), roof
    1.45 with an upright screen and a small steep rear window; and the rear
    rebuilt from the photos — a short deck, white quarter towers rising to
    roof height either side of the window with the shelf wing across their
    tops (no separate uprights), tall plates and a thin red lip, a black
    vent panel with grey insets and a white centre divider between small
    corner tail lamps, the wrapped yellow band, a black bumper and twin
    exhausts offset to the left. The flat tail was still wrong: the real
    car's rear glass runs into a panel that keeps sloping down to the
    lamps, and the wing stands on triangular plates. The stations now slope
    the top band from the glass bottom (z −1.45, y 1.05) to the lamps
    (z −2.05, y 0.8), with the vent panel and lamps laid on that incline;
    `CarParts` gained a `Prism` (convex (z, y) polygon extruded along x,
    faces wound outward, unit-tested) used for the plates — wide along the
    wing from the roof's trailing edge to the tail, hugging the glass and
    the slope below — with the shelf wing spanning them from the roof edge.
    That rear still looked broken and the wing oversized, so the reference
    GLB's mesh bounds were read (names and accessor min/max, no import):
    wing 1.55 m wide × 0.42 m deep at the very tail, top 4 cm over the
    roof; rear panel ~28° off vertical from a short window (top 1.2 m) down
    to 0.7 m, with two vent openings high in it. Stations now follow that
    (roof to z −1.58 with solid C-pillars, short steep window to −1.78,
    steep panel to the tail), the wing and its small triangular plates are
    sized to the model, and the lamps and vents lie on the panel. The hull
    builder also stops painting pillar slants as glass: the side band is
    glass only between two greenhouse stations (a real window), so A- and
    C-pillars on every car are body-coloured, which removed the glass
    triangles on the S1's quarters. Finally the whole hull was rebuilt
    from the reference GLB's silhouette (max half-width per 10 cm height
    band at 20 cm stations, decoded from the vertex buffer): roof 1.33 flat
    from the B-pillar back to z −1.1, a 0.5 m screen rising 0.36, a steep
    rear window into a raised ducktail deck at 1.2, a tail panel inclined
    ~25° to a lamp bar at 0.75, 0.81 body / 0.91 flares / 0.55 roof panel
    with real tumblehome (via `xBelt`), a nose tapering to a 0.67 half-wide
    face over a wide splitter, flare intakes on the rear flares' leading
    faces, and the wing (1.56 × 0.42) on inboard plates standing on the
    deck. Stations are built by a small `st()` helper so the list reads as
    the measured numbers. A follow-up kept the belt level (0.86–0.9) along
    the tail so the wrapped flank stripes run straight to the back instead
    of chevroning up the quarter, made the lamp panel vertical with the
    incline above it, painted the rear window as a glass deck decal between
    body-coloured C-pillars, ran the wing plates' lower edge down the
    incline to the lamp panel, and made the air dam white with a black slot.
    From the user's projection set (blueprint, head-on front and rear): the
    nose is a wide upright face, not a wedge — stations now run the flares
    to the front (0.86–0.88 half) under a slightly sloped bonnet edge, with
    a full-width black lamp panel (rectangular headlamps at the ends, two
    big round lamps on the grille), a white bumper with a yellow top edge,
    mesh slot and amber corner indicators, four round lamps in front of it
    and a deep splitter; the tail stacks a yellow lip, white mesh bumper, a
    black band with two mesh vents and a white divider flanked by smoked
    corner lamps with red strips, the yellow belt band from the wrapped
    stripes, and the white plate panel on the incline between the wing
    plates, with a single offset exhaust. The wing was then rebuilt from the
    projections GLB (Z-up, metres; silhouette per 5 cm height band along
    the length): the rear window is longer and shallower (0.5 m run, 0.18
    drop) into a deck at 1.17; the blade is a `Prism` 1.56 wide × 0.6 deep
    from z −1.7 to −2.3 (0.28 overhang), 5 cm thick and upswept from 1.28 to
    a 1.42 trailing edge with a red lip; the side plates sit at ±0.74, tall
    at the back (1.08–1.38) and tapering forward onto the glass at z −1.3,
    with small end plates standing up from the blade tips. By request the
    wing then came down and in — blade 1.22–1.33 from z −1.6 to −2.12 (0.1
    overhang), plates 0.9–1.3 at the back running down the tail incline so
    nothing floats — and the number plate on the incline was removed (its
    white inset z-fought the black backing and read as a black box).
65. **2026-10-31 — Dealership card: names only, "Special" tag.** The car
    blurbs were removed from the dealership card and from all three
    dictionaries (the card is name, stats, price); `CarListing` gained
    `special`, set on the Dakar truck, which the card shows as a pixel tag
    beside the name, and a test pins the truck as the last and only
    special listing. The S1 also lost the grey mesh strip on its rear
    bumper by request.
66. **2026-10-31 — Snow-covered houses on snow stages.** `SceneryChunkManager`
    takes a `snow` flag (`region.offroad === 'snow'`, i.e. alpine) and swaps
    the house tints: roofs become near-white (snow lying on them, ridge
    included since it shares the roof kit) and walls go paler and greyer,
    so the cottages recede into the snowfield instead of standing out in
    terracotta and ochre. Same geometry and draw calls; only the
    per-instance tint pair changes.
67. **2026-10-31 — Houses sit level, nothing grows through them.** Each
    house is placed at the height of its highest slab corner (corners
    rotated with the house, 6.6 × 5.1 m footprint) so no corner floats, and
    the slab became a 1.4 m deep foundation that is buried on level ground
    and shows as a stone base downhill; the allowed rise across the
    footprint dropped to 1.0 m × scale so the foundation always reaches the
    ground. After houses are placed, trees, bushes and rocks within 5 m ×
    scale of a house centre are removed. A test checks all four corners and
    the clearance on three seeds.
68. **2026-10-31 — Level pads under houses.** Seating a house on its highest
    corner still left the entrance hanging over falling ground, so the
    terrain is now shaped to the house: `TerrainField.setPads` registers
    level pads (height, radius 4.6 m × scale, 3 m blend) applied as the last
    step of `heightAt` / `sample`, after the road blend, so a pad near the
    corridor's outer edge is not tilted by it; `scatterScenery` sets
    each house's origin so the slab top (`HOUSE_SLAB_TOP`, shared with the
    geometry) lands at the footprint's mean ground height and registers a
    pad there, so slab, door sill and step meet level ground and the
    foundation covers the blend. The terrain worker runs `scatterScenery`
    on its own field so its chunks carry the same pads; wheels use the same
    field. `scatterScenery` clears the pads first so a re-run on the same
    field is identical. The test now checks every corner is within 2 cm of
    the slab top.
69. **2026-10-31 — Denser, non-overlapping trees.** Forest tree density went
    80 → 110 per 100 m (broadleaf 18 → 26) and alpine 55 → 78 (6), and the
    scatter now keeps canopies apart: a `CanopyGrid` spatial hash (6 m
    cells) of placed trees rejects a candidate whose canopy (pine 1.4 m,
    broadleaf 2.2 m, × scale) would overlap one already placed. Rejected
    spots are skipped rather than retried, so the higher densities are what
    survive the check. Bushes and rocks are unaffected. A test checks every
    tree pair on a stage.
70. **2026-10-31 — Trunks cast shadows.** The trunk kit had `castShadow:
false` (an early draw-cost saving), so a tree's shadow was a floating
    canopy with no stem. Trunks now cast when shadows are on, like the
    foliage; one more instanced mesh per chunk in the shadow pass. That
    alone changed nothing visible: the pine's lower cone began 0.9 m up, so
    the trunk's shadow lay entirely inside the canopy's. The foliage cones
    now start at 1.3 m (tree top 4.85) and the trunk is 1.6 m, so pines show
    a trunk and their shadows a stem.
71. **2026-11-01 — Stage list: four by default, full-width rows on touch.**
    The Game panel lists the newest four stages (was six) before the "Show
    more" link, and on coarse-pointer devices each stage button spans the
    panel width as its own row with the label left-aligned (the hover
    overlay layout is desktop-only), with the link centred beneath.
72. **2026-11-01 — Handbrake on the right, drawn as a pedal pad.** On touch
    devices the handbrake button moved from above the steer pad to above
    the brake/gas pedals on the right, so all three pedals sit under one
    thumb and the left is steering only, and its glyph changed from a "P"
    to a pedal pad with grip ridges. `PixelIcon` now sizes its viewBox from
    the glyph, so the pedal is a 12×14 glyph in two-pixel strokes
    (bevelled pad, two ridges, arm and foot) while the rest stay 8×8.
73. **2026-11-01 — Touch pause menu.** On coarse-pointer devices the
    top-right toolbar collapses to one Pause button (new `pause` glyph)
    that opens a `menu` panel (`HudPanel` gained the value): a `HudDialog`
    titled "Paused" listing Game, Garage and Settings as full-width buttons,
    each swapping in its panel, with a "Resume" close button. Desktop keeps
    Settings and Game in the toolbar and the Garage button beside Money;
    the earlier touch-only Garage toolbar button (decision 54) is replaced
    by the menu. Esc still toggles the Game panel directly. The Pause button
    is a 56 px square with a 24 px glyph, matching the touch pedals
    (`ToolbarButton` `pad` mode), and the stage timer box is the same 56 px
    tall on touch devices so the top strip lines up, with the digits at the
    desktop 24 px size so they fill it.
74. **2026-11-01 — No "paused" subtitle anywhere.** The Game dialog lost its
    "Paused while this panel is open" line (Settings lost it in decision 57) and the string was removed from all locales; the Garage keeps its
    money balance and "changes apply right away" hint as its subtitle.
75. **2026-11-01 — Touch controls in Settings; C only; Esc everywhere.** The
    Settings controls table now has a touch variant (`controlsTouch`:
    steer pads, pedals, pedal button for the handbrake, Pause menu, camera
    via Settings) shown on coarse-pointer devices, with the keyboard table
    hidden there. The V key no longer cycles the camera (C only). Esc was
    already wired to close any open panel, but the keyboard handler dropped
    every key while a form control had focus, so after touching a Settings
    select Esc did nothing; Escape is now handled before that check.
76. **2026-11-01 — Sochaux T16 (205 T16-style Group B hatch).** New `t16` car
    at 6 500, between the coupé and the saloon. Proportions from the
    reference model's silhouette (3.82 m, 1.7 m over the arches, roof 1.33):
    a short three-door cabin set forward with a steep screen, a
    rear window sloping from the roof straight to the tail face with no
    deck at all (by request, after a short-deck pass: tail at z −1.62,
    wheelbase 2.42, rear overhang 0.47; the black-and-blue intake scoops
    that stood proud of the rear flares were removed by request), box
    flares (0.86 front, 0.88 rear) over a 0.78 body, and a roof-mounted
    black wing (`Prism` blade on two struts, white end plates) over the
    deck. Livery from the photos, colour-blocked: white, the red / yellow /
    blue stripe set low on the doors (hull band) and stepping up the left
    bonnet corner (deck decals), bonnet vent grid, blue sill skirts, blue
    scoops on the rear flares' leading faces, rectangular headlamps and
    amber indicators, a black tail panel with a striped centre grille and
    red/amber lamp pairs, blue lower bumper, red mud flaps, twin exhausts,
    white wheels. Spec: 940 kg mid-engined rear-biased 4WD with a short
    turbo, between the coupé and saloon in power.
77. **2026-11-01 — Tricolore Coupé rebuilt as a Stratos-shaped Group 4 wedge.**
    The reference GLB holds only 565 control vertices, so the hull follows
    the photos and the car's known dimensions (3.71 × 1.75 × 1.11 m): a
    wide low nose dipping to the splitter, a wraparound screen far forward
    onto a short 1.0 m-wide roof, a long rear clamshell with four louvres
    falling to a flat tail, and haunches at 0.88 half-width over both axles
    with a 0.78 body between. Airline-style livery, colour-blocked: white
    shell, green / white / red 4 cm bands under the belt crease, a green /
    white / red band across the left bonnet corner, green / red diagonals
    on the clamshell, red roof with a white centre stripe and a green
    trailing-edge lip, a three-hoop spoiler over the clamshell with red and
    green blade panels, pop-up lamp lids as dark deck decals over the
    headlamp slots, a four-lamp pod on the lip, round tail lamps in dark
    bezels, intakes on the haunches, white door plates and a green band on
    the tail panel. Spec unchanged (rear-drive, 2.16 m wheelbase). From the
    user's projection sheet: no rear glass — the panel behind the roof is a
    painted engine cover (station unflagged) carrying the red centre band
    with white pinstripes and green flanks that also runs down the bonnet,
    nine dark louvre slats and two vertical rib strips between the hoops;
    the roof is green with a red centre and white pinstripes; the nose pod
    carries four smaller centre fog lamps and a larger main beam at each
    end. The green band between the tail lamps was then removed by request;
    the tail panel is plain white over the black bumper. Then, by request,
    the dark pop-up lid decals left the bonnet and a small white ducktail
    (1.6 m wide, 0.22 deep, tilted up 0.18 rad) sits on the tail's top edge
    with green / white / red bands across its upper face. The black intake
    boxes on the haunches' leading faces were removed as not part of the
    body.
78. **2026-11-01 — Boreal Saloon rebuilt on the Impreza S6 WRC.** Hull from
    the reference GLB's body-panel silhouette (scene transforms applied,
    scaled to 4.34 m): 1.86 m over the arches (0.93 half) with a 0.86/0.88
    shouldered body between, roof 1.2 flat from z −0.8 to −0.2, fast screen
    to a 0.9 cowl at z 0.43, long low bonnet to a 0.56 nose, fast rear glass
    onto a 0.9 boot deck. Livery from the photos, colour-blocked: blue with
    the yellow swoosh built as seven stepped flank boxes rising from the
    front arch, over the star disc and onto the rear quarter (the last on
    the flare face), a yellow disc on the rear door ahead of the arch with
    six blue star squares, a white door plate, and a yellow swoosh across the boot (deck
    decals). Lamps as photographed: four round pod lamps on the bonnet lip
    above the grille and two round lamps low in the bumper. Also a big
    central bonnet scoop, two vent slots, roof vent, twin antennas, a tall
    blue wing on uprights with end plates, yellow number plates. The gold
    pinstripes and roundel of the previous design are gone. Follow-up: the
    nose stations were widened to the model's 0.86–0.9 half-width right to
    the tip with a 0.6 m nose face (it had tapered to 0.84 / 0.56 and read
    thin), and the yellow disc was dropped so the six stars sit as yellow
    squares directly on the blue door. Then, by request, the nose went
    taller rather than wider: the bonnet now falls only 0.14 from the cowl
    to a 0.72 m nose face (was 0.6), with the scoop, lamp pod, headlamps and
    bumper raised to suit. Then the cabin moved forward: the roof now runs to
    z 0.25 and the cowl sits at z 0.85 (was 0.43), so the bonnet is 1.3 m
    and the nose face 0.8 m, with scoop, vents, pod, mirrors and door plate
    moved to match. Finally the whole body was narrowed about 6 %: 0.8 /
    0.82 / 0.88 half-widths (1.76 m over the arches, roof panel 0.54), with
    mirrors, wing, bumpers and lamps brought in to suit; the 1.5 m track is
    unchanged so the wheels still sit under the arches. The flank vinyls
    then floated below the belt (the shouldered side leans inward toward
    the sill), so each box's x is now computed from the flank slope at its
    height (`flankAt`), and the six-star cluster is repeated on the tail
    panel between the brake lights.
79. **2026-11-01 — Per-car rally interiors.** The single shared cabin is
    replaced by a data-driven one: `interior/interiorSpecs.ts` holds an
    `InteriorSpec` per `CarId` (cabin envelope derived from each hull's roof,
    width, cowl and rear-glass stations in the interior frame, where the
    first-person eye is always at (0.34, 1.1, −0.33); dash style; lever
    style; cage extent; co-driver kit; palette). `InteriorParts.tsx` builds
    the kit — a `Tube` helper for the welded roll cage (A-bars, roof rails,
    main hoop at the B-pillar, front bar; full cages add crossed door bars,
    a roof diagonal and rear stays), bucket seats with shoulder slots and a
    six-point harness in the team colour, a round or flat-bottom wheel with
    a top marker, an H-pattern lever that moves to the gate of the current
    gear or a tall sequential stick, an upright hydraulic handbrake, the
    co-driver's open pace-note book, trip meter, intercom amp and footrest,
    and a fire extinguisher. `InteriorDash.tsx` builds the cluster in three
    styles (period: three chrome dials and one shift light; analogue: two
    dials and a five-lamp shift pod; digital: a display with a ten-segment
    rev bar, shift pod and two small dials) plus a switch panel with a kill
    switch and a turbo lamp. `VehiclePose` gained `gear` and `turboActive`
    so the lever, shift lights, rev bar and turbo lamp work from the pose at
    frame rate without touching stores. Each car differs in envelope,
    colours and kit: grey-caged converted hatch; white-caged tan-lined
    Stratos with period dials; white-caged blue T16; blue-caged digital
    Impreza with a sequential stick; navy-caged red-seated WRC; bare
    grey-caged Group B; white-caged grey-and-yellow S1; blue-caged lime
    Focus; and an orange-caged truck cab with the co-driver 0.76 m out and a
    big wheel. A test pins every envelope around the eye and that the
    cabins actually vary. By request the interior eye then moved from
    (0.34, 1.2, −0.33) to (0.34, 1.24, −0.15) with the downward tilt cut
    from 0.07 to 0.02 rad, so the driver sits high and close to the rim
    and the road fills the frame; the saloon and T16 cabins dropped
    (`cabinDrop` −0.22 / −0.12) to keep headroom over the raised eye; every
    wheel is a full torus (the flat-bottom option was removed); and the
    levers moved forward on the tunnel so the gear knob no longer looms at
    the frame's edge. With the eye raised, the Impreza's nose-pod lamps
    showed as white blocks over the bonnet, so `Lamp` became a short lens in
    a dark housing: lamps now read as lamps from behind and from the cabin.
    The truck's cabin and eye then moved forward (`cabinForward` 1.6 →
    2.1, so the eye sits 0.8 m behind the screen like a real cab-over, with
    the interior envelope re-derived) with a lower dash (0.9) so the big
    flat-raked wheel stays under the eye line; the wheel placement rule
    gained a floor of 0.3 m ahead of the eye. Each spec also records the
    hull's screen-base height (`cowlY`): where it sits above the dash top a
    scuttle ledge closes the gap, because the shell is back-face culled and
    the Impreza's nose lamps and grille were showing through it from the
    seat. The binnacle can be lifted (`clusterRise`) or pushed toward the
    cowl (`clusterForward`). Roof antennas now start above the roof skin so
    their feet can't poke into the cabin. The wheel hub is then placed
    explicitly per car (`wheelZ`/`wheelY`, default 0.22 m and 9 cm under the
    dash top) after the rim was found passing through the binnacle hood in
    the Stratos and the truck: the Stratos wheel comes back to 0.23 m from
    the eye with the binnacle sunk 3 cm so the rim arcs above the hood, and
    the truck cab becomes a real cab-over layout: floor 0.74 m under the eye
    with the seats on pedestals, dash top at 0.8, the big flat wheel 0.4 m
    ahead with its hub level with the dash top, and the binnacle 0.28 m
    forward on a tall hood so the display reads through the upper half of
    the rim. Unit tests pin both: rim clear of the hood in 3D for every car,
    and the rim arcing above the hood top on screen in those two cockpits.
    The centre stack moved 10 cm toward the co-driver and is
    set into the dash face rather than floating ahead of it, the turbo lamp
    joined the shift-light row on the hood, and the digital hood is wider so
    its small dials sit inside it. A reference cab-over cockpit then reshaped
    the truck: its mid-grey dash read as a box, so the dash, hood and lining
    went dark like the cars', the dash top rose to 0.84 with the hub level
    with it, and a rally-raid kit (`raidKit`, `RaidConsole.tsx`) adds a
    centre console with a toggle bank, push buttons, a GPS repeater and
    knobs, a round gauge pod beside the binnacle and a rocker row across the
    binnacle top. Two wiper arms parked diagonally across the screen just
    outside the culled glass, later removed by request as they cut across
    the driver's view. Rim thickness and hub now scale with the
    rim radius so the truck's wheel reads heavier. A second pass filled the
    remaining slab: the console grew taller so nothing sits below the dash
    top (its knobs had been cropped by it) and moved inboard with the gauge
    pod mounted on it, a switch tray with rockers, warning lamps, start
    button and key sits between the wheel and the binnacle, a tyre-pressure
    block with gauges and toggles plus a radio handset sits outboard, and a
    demister slot runs along the cowl. The switch tray and the rocker row
    ahead of the wheel were then removed by request, and the truck wheel
    moved forward to 0.45 m so its rim meets the binnacle face and the hub
    sits at the dash top right in front of it, closing the bare stretch of
    dash between the two. The dash depth is then per car (`dashDepth`,
    default 0.4): the truck's is 0.16 so, from its high seat, the dash face
    with the centre-stack switches and knobs comes into frame under the
    console and the wheel's hub no longer floats on a dark shelf. The
    steering column now runs from the hub into the dash face along the
    wheel's axis instead of a fixed stub. Because the first-person camera
    glances into corners, the lower shell is now closed everywhere: door
    cards run from the cowl to the rear bulkhead and a front wall stands
    below the dash from floor to dash top, so no cabin shows the outside
    through the footwell or door when the view swings.

80. **2026-11-01 — Dakar truck exterior detail pass.** From two reference
    photos of the MAN Repsol rally-raid truck. The cab is navy from the floor
    to the belt (the band wraps the nose as the grille surround) and orange
    above, under an orange tubular roof frame on short uprights carrying
    four lamps, with an orange sun strip and a white sponsor bar laid on the
    screen top, orange mirror arms and housings with a wide-angle glass
    below, orange door-edge strips, handles, two steps a side and front
    mudguards, a door number plate and a small sponsor plate. The nose gets
    a grille recess with three steel bars, a badge plate and a lion disc, a
    bar of six chrome spot lamps at the screen base, and the orange bumper
    gets rectangular headlamps at its ends, a dark mesh with two fog lamps,
    a number plate and red tow hooks. Behind the cab the exhaust wears a
    heat shield and chrome cap with a snorkel opposite; the box carries six
    red letter blocks for the big REPSOL on its white band, sponsor plates
    on the orange and navy bands, a rear plate, a ladder beside the spare
    wheel. `Tube` moved from the interior parts to `CarParts` so bodies can
    use it; the interior re-exports it.

81. **2026-11-01 — Town sections.** Exactly one stage in every trio of a
    region's run carries a town (`hasTown(gameSeed, index)`: never a trio's
    first stage, so never index 0, which the splash demo and the random-seed
    smoke tests drive, nor index 3, which the alpine curvature test compares;
    never two in a row; which of the other two varies per game and loop).
    A 35% per-stage hash was used first and dropped: it gave back-to-back
    towns and town-less runs. The brief knows the flag without an RNG draw
    and adds 12 s to par. `TownPlan` draws the route as legs from the town's
    own sub-seed: an entry straight (60 or 80 m), two to four middle legs that
    are straights ending in a 60°, 90° or 105° corner or tight circular
    curves (14–19 m radius, 60°–100° sweep), and an exit straight; half the
    towns narrow the middle legs to a 3.2 m half width. Every corner is
    followed by a straight long enough to carry its arc tangents, the last
    corner is adjusted so the turns sum to near zero, and the plan is kept
    only if, sampled every 2 m with 80 m of run-in and run-out, no two points
    196 m apart come within 54 m (the stage's self-approach rule), with a
    plain L-R fallback after 24 draws. `Centreline.ts` (the walk, extracted
    from the generator) steers back onto the stage axis over 100 m, runs
    60 m dead straight, lays straights on its 20 m polygon and every corner
    as an explicit arc of 12 m (10 m over 95°) in 5 m chords, then resumes
    the walk; the generator rebuilds with the plan mirrored if the finished
    road still breaks the self-approach rule around the town, and without a
    town if that fails too, so stage invariants never depend on luck. An
    earlier pass let the interpolating spline pass through the polygon
    corners: the review measured a 3–5 m apex radius that folded the ribbon's
    inner edge and pavement at every corner, not the ~11 m assumed. Side
    streets are 32 m stubs from the polygon corners (straight on and the far
    side at every corner, a crossroads halfway along 80 m entry and exit
    legs), each with a rally barrier row 14 m in that spans to the building
    line, a stop line and an end building closing the dead end; the first
    corner's blocked straight ends in the town hall, the landmark the driver
    brakes toward, and a yellow direction board stands ahead of that barrier.
    Buildings (townhouse 8×7, shop 10×8, tower 6×6, hall 12×9) line straights
    and arcs with fronts 3 m beyond the kerb, start 18 m (24 m on sharp
    corners) from any junction, and are settled: every footprint corner
    2.5 m clear of every street, neighbours apart by 95% of their diagonals,
    the hall first. Lamp posts alternate sides every 30 m along the route.
    Terrain: towns sit on hills. Inside the footprint the hills keep enough
    relief to swing 8 m (capped at 40% of the region's amplitude), blending
    back over 40 m; the road bed is cut into that ground by the existing
    smoothing, trench and verge rules, so streets climb and dip and the bed
    tests hold through town. Side streets follow the route's deck through
    the junction zone (half width + 6 m, the junction plate's reach) so
    plates and ribbon meet without a step, then climb at most 8%; every
    building stands on an oriented terrace pad (footprint + 0.3 m, 0.5 m
    blend) at the mean ground height of its corners, with a 1.75 m
    foundation under the walls kit. A flat plateau was built first and
    dropped on request; a pad applied last under the whole town was rejected
    earlier because it would override the trench. The carriageway width is
    per sample (`widths`, `halfWidthAt`) so narrow streets taper in over
    24 m; every town street is tarmac for grip whatever the stage surface,
    and the ribbon paints the town interval tarmac with pavement-coloured
    kerbed verges that drop to road level across side-street mouths (found
    by projecting the verge onto the stub's line, since the arc cuts the
    corner the stub starts from), where the edge line also stops.
    `TownStreetBuilder` lays junction plates on a 2 m grid 2 cm under the
    deck and side-street plates with pavements, all on the field's heights.
    Collisions gained oriented boxes (walls and barrier rows) beside the
    circle grid; circle rows were rejected for scalloped walls and the
    64-candidate cap. Checkpoint boards keep 40 m clear of the town, marker
    posts skip it, wild scenery stays 10 m off the footprint and farmhouses
    40 m. Building kits (`BuildingGeometry.ts`, civic styles in
    `CivicGeometry.ts`) and street furniture (`StreetFurnitureGeometry.ts`:
    barrier element, left/right arrow boards, lamp post) follow the house
    kit's vertex-coloured, tintable-white pattern; their winding tests check
    each welded part against its own centroid, since a whole-geometry
    centroid test fails even the correct house kit. Tests pin the cadence,
    byte-identity of open-road stages against a fixture, no heading step
    over 0.3 rad per sample through town, the self-approach rule, buildings
    on level terraces, and both car circles clearing every collider along
    the route. The alpine-vs-forest curvature test still skips town stages
    (none can occur there now). A dev-only `?spawn=` flag places the car
    along the road, `?spawn=town` just before the town.

82. **2026-11-01 — Villages: unbroken facades, kerbed junctions, trees in
    the gaps.** The town pass is reworked so a stage's town reads as a
    lived-in village rather than houses scattered round a grid. Facades:
    `layoutTown` lays every street and junction first, then builds a facade
    polyline per side of the route (`routeFacade`) a pavement's width
    (`FRONT_SETBACK`, 2 m) beyond the carriageway's actual, tapered edge at
    every path vertex (offset along the vertex heading, which bisects its two
    segments), simplified by Ramer–Douglas–Peucker. `TownTerraces.row` walks
    a facade placing houses a party wall (0.4 m) apart, each front a chord of
    the facade with its corners on the line (on an outer bend a front may
    stand over the pavement by 0.8 m; inside bends it recesses), accepted
    only when every footprint corner is clear of every carriageway (the
    route by its real width) and a separating-axis test keeps 0.4 m from
    every other building; wherever no house fits, a garden wall (`Wall`,
    0.3 m thick, an oriented box collider) runs along the facade, trimmed
    where another street crosses it. Blocked side streets get terraces both
    sides from 16 m, an end building facing the junction (the first corner's
    straight-on street still ends in the hall) and walls closing the end
    corners. Junction wedges (`TownJunctions.wedges`: arms sorted by heading,
    each with a `role` of in, out or blocked) get an L of wall from one arm's
    row start to the facade corner and on to the next; where a wedge meets
    the route, its corner is where the side street's facade line crosses the
    route facade (`Facade.cross`) and the route's terrace is interrupted
    between the two crossings. The inner corner of a turn has no side
    streets, so its facade simply follows the arc. Terrace pads are levelled
    at the pavement by the door (`buildingBaseHeight` is the mean front
    corner height) and start 0.2 m behind the facade with a 0.1 m margin and
    0.2 m blend, so no pad reaches the pavement and no neighbour tilts
    another. Rejected: facades at each leg's nominal width (the 24 m width
    taper put them up to 1.3 m into the real pavement) and mean-of-corners
    base heights (doors floated or sank beside the kerb). Junctions:
    `TownJunctionBuilder` cuts each junction's surface from a signed-distance
    field, the union of the route's carriageway (`path.nearest` and
    `halfWidthAt`), each blocked arm's half-strip and a core disc, rounded at
    every concave corner into a `FILLET` 3 m kerb return
    (f = r − √Σ max(0, r − dᵢ)²), on a 0.5 m grid: tarmac fills f ≤ 0 (2 cm
    under the ribbon), the pavement is the band 0..2 m and the edge line the
    band −0.57..−0.35 m, both 5 mm under the ribbon's own so they show only
    where the ribbon opens. Cells are clipped as polygons (`Isobands`), and
    each blocked arm's cut (`stubCut`: past its kerb returns, at least
    `JUNCTION_REACH`, now 8 m) hands over to the straight plates of
    `TownStreetBuilder`, which gained edge lines and a pavement across the
    end. The ribbon opens its verge and line across a mouth out to the
    stub's half width plus 3 (1 + cos φ) m, φ being the angle the street
    meets the route at. Rejected: analytic fillets between straight arm
    lines (at a corner the route is an arc, so that model put the kerb in
    the wrong place against the ribbon). Vegetation: `SceneryScatter` no
    longer clears the footprint; `townBlocks` keeps wild scenery only off
    streets (half width + 5 m), buildings (+ 2 m) and walls (+ 1.5 m), so
    trees fill yards and corners and run up to the village edge; farmhouses
    still keep 40 m. Spline: the uniform Catmull-Rom kinked by about 25°
    where a corner's 3.7 m arc chords met the 20 m straight controls;
    `Centreline` now evaluates uneven spans in the centripetal form
    (Barry–Goldman), which equals the uniform spline on even spans, so
    open-road stages stay byte-identical. Walls render as one merged box
    mesh (`TownWallBuilder`). Tests cover wedges and cuts, facade placement
    and bulge, isoband clipping, every building and wall end behind the real
    pavement, terraces level at the back and at the kerb in front, and wild
    scenery inside the footprint but never on a street or a building.

83. **2026-11-01 — Village kerbs traced exactly; cones, corner greenery and
    flower boxes.** The grid-cut junction bands and the ribbon's lowered
    mouths produced a doubled, wobbly edge line at every junction, pavements
    that overlapped 5 mm apart and shimmered, and tarmac that the terrain
    poked through where the fill sat 2 cm under the verge level. Kerbs are
    now geometry, not fields: `TownKerbs.junctionKerbs` builds one kerb
    outline per wedge between a junction's arms, from the blocked arm's cut
    round a `FILLET` kerb return to the route's edge and along it to a cut
    one metre past the return's tangent. The return between a straight arm
    edge and the route's (curved) edge is found by walking a line a radius
    off the arm until the route's edge is a radius away, taking the first
    crossing whose tangent falls on the wedge's own arm of the route (a
    sharp corner's line brushes the other arm first); two straight edges
    take the classic fillet. At a corner each blocked arm continues one of
    the route's arms straight through, so their edges share a line and the
    bend's arc only leaves it at its tangent: the apron between is that
    arm's mouth, the kerb return is the classic fillet against the shared
    line (taken from the ribbon's own edge beyond the tangent, so a width
    taper cannot offset it), and the kerb follows the apron's edge back to
    where the ribbon takes over. The spline used to bow into a
    corner over the whole control step before it, and the width taper of a
    narrow leg ran through the corner, so no straight line matched the
    ribbon's edge there and the straight-on street's kerb sat a few
    decimetres beside the apron's. Now a spline control a metre inside each
    end of a straight that meets a corner pins the straight to its line
    right up to the arc; a corner, and the side streets leaving it, take
    the narrower of the two straights it joins, and `buildWidths` holds
    that width out to where the junction's kerbs hand over to the ribbon on
    either side (`junctionReach`: past the arc's tangent, or past an acute
    wedge's kerb return, which can lie far down the arm) before tapering,
    so the ribbon's edge lies on the street's own edge line where it hands
    over. The apron's edge is that line, and
    the terrace row on that side ends where a wall along it begins, so
    pavement, kerb line and facades agree.
    Every kerb, on the ribbon in town, round the junctions and along the
    side streets, is a raised shape: the pavement stands 10 cm above the
    carriageway behind a vertical kerb face, and the physics surface
    (`heightAt`) climbs it over 30 cm so a wheel mounts it as a bump, while
    tarmac, kerb faces and pavements are built on `deckAt`, the same surface
    without that lift, each vertex at its own position. A side street's deck
    takes the route's deck exactly through the junction zone; beyond it the
    street carries on from the route's deck sampled across the zone's end
    (seven samples over its width, interpolated by offset) and ramps from
    that to its own end level, so the surface is continuous wherever the
    nearest street changes and the route past the zone has no say in it
    (ramping from the route's deck under each point had stepped 0.4 m
    where the route bent out of reach or another stretch of it came within
    reach near a street's end; easing toward the street's own level inside
    the zone had put a crease across every kerb return). The ribbon
    eases into a town over 40 m (`townFade`): the surface colour toward
    tarmac, the verges up into pavements, the kerb faces growing with them,
    instead of switching at the town's first sample. Every kerb point carries its exact normal, so
    the pavement band and the edge line are offset strips that meet the
    ribbon's and the side-street plates' sections vertex for vertex: the
    route edge is sampled with the ribbon's own convention (`routeEdge`,
    vertex headings at samples), and `RoadBuilder` now cuts its verge and
    line strips exactly at each opening's ends (`routeOpenings`) and draws
    nothing across the mouth instead of lowering it. Tarmac fills each
    blocked arm's mouth (a strip from where its edges leave the ribbon to its
    cut) and each kerb return's crescent (a fan from the corner where the two
    edges meet), from the same geometry as the kerbs, flush with the ribbon;
    `TerrainField` trenches the ground under those same polygons so no
    terrain reaches the fill, and the pavement starts 5 cm over the tarmac.
    Fill polygons overlap their neighbours by a 6 cm seam along shared
    edges and the junction and side-street surfaces carry the ribbon's
    depth offset, so neither a hairline between polygons nor a coplanar
    terrain triangle can show through; the junction mesh is welded so its
    normals smooth across the fans and strips instead of faceting the
    tarmac.
    A rounded-union distance field was tried first for the fill and trench;
    it is only a true fillet at right angles and left crescents of ground
    showing at skewed wedges. Side streets lost their stop line. The
    rally barriers are gone: each closed street gets a row of small traffic
    cones (`coneGeometry`, four stacked boxes) across the carriageway only,
    1.5 m apart, with no collider, so they read as a closed road without
    stopping a car that strays; the arrow boards stay. Every walled corner
    gets greenery once the houses stand (`plantCorners`): spots fan into the
    wedge from its facade corner, the deepest open one takes a low tree, up
    to three nearer the walls take bushes, each needing room off both walls,
    off every pavement and building, and from each other; trees take the
    region's canopy kind. `PlanterGeometry` hangs a terracotta flower box
    with leaves and three blooms under the front and upper flank windows of
    the townhouse, shop and tower (the hall stays civic), instanced untinted
    beside the walls kit. Tests cover kerb continuity and clearance, that
    every opening end lies on a kerb outline, the ribbon-edge convention,
    cone rows on the carriageway with no collider, and greenery clear of
    streets and floors.

84. **2026-11-02 — Side streets fitted among each other; edge lines on the
    deck; Esc belongs to the HUD.** Every blocked side street was laid at
    the full `STUB_LENGTH` from its junction, so in about one village in ten
    the end of one ran into the side of another junction's street, or two
    corners' streets met head-on (pavement over carriageway, a 0.7 m cliff
    in the deck where the nearest street changed). Streets are now planned
    before they are laid: `planStub` fits each new one against every street
    already planned, and where their ground (carriageway, pavements and the
    pavement across the end, as exact boxes) would come within 0.5 m,
    whichever of the two keeps more street is cut down, never below
    `MIN_STUB_LENGTH` (20 m); streets that can only clear each other by
    both giving way split the room between them. The corners' streets are
    planned first and cannot be dropped (a corner's junction has four arms),
    so one that still cannot fit is forced down to what clears the other at
    the minimum, never shorter than its junction's cut plus 2 m; a
    crossroads is optional and is left out altogether when its streets
    cannot fit without cutting anything below the minimum. Over 150
    villages, 19 of 1192 side streets are shortened and one is forced
    (15.5 m); none overlap. Every consumer of a street's length (plates,
    cones at `coneDistance`, direction boards, end buildings, terraces,
    the terrain's stub deck) now takes it from the street itself. The stub
    deck beyond the junction zone carries on from the route's deck sampled
    across the zone's end rather than under each point, so a route bending
    out of reach or looping back within it no longer steps the deck. The
    junction and side-street builders lifted their white edge lines by the
    ribbon's `LINE_LIFT` on top of a deck that already carries `ROAD_LIFT`,
    8 cm above the ribbon's own lines: invisible from above, a floating,
    disconnected line in the chase camera. The line now stands
    `LINE_ABOVE_DECK` (2 cm) over the carriageway everywhere. Esc moved from
    the driving controls (attached when the drive rig mounts, after the
    world is built) to the HUD toolbar, so it closes a panel from the
    moment the HUD shows; the camera e2e test pressed it in that window and
    failed once stage building grew heavier. Tests: side streets of
    different junctions keep their ground apart (0.4 m unless forced), some
    are shortened, cones stay on their shortened street.

85. **2026-11-02 — Prize per kilometre raised from 120 to 800.** Stages run
    1.5–2 km with a par around two minutes, so at par a stage paid about
    $240 and a player at 1.3–1.5× par, with the odd tree to pay for, netted
    $130–190: the first dealership car ($4500) was twenty-odd stages away
    and even the average level-1 upgrade ($557) took four or five. A first
    pass to 200 aimed at an upgrade level every three or four stages; the
    intent was a new car on that cadence, so the constant is 800: a stage
    pays about $1500 at par, $1200 at 1.3× par and $1000 at 1.5× par, the
    coupé ($4500) comes after three stages at par or four at a middling
    pace, and the dearer cars ($6500–26000) follow every four to seven
    stages as the +25%-per-loop bonus grows, the whole dealership in about
    forty stages. Upgrade levels ($350–1600) become small change bought
    between cars, which suits an incremental shop; their prices, the pace
    curve (+25% for beating par by a fifth, sliding to a 0.3 floor at
    double par) and the surface factors are unchanged. The prize test reads
    the constant instead of repeating it.

86. **2026-11-02 — A town on every third stage.** `hasTown` drew the town's
    slot per trio from the game seed (index 1 or 2 of each region's run),
    so a player met a town in either the second or the third stage of a
    region, never knowing which. It now takes no seed: the last stage of
    every region's run carries the town (indices 2, 5, 8, …, stages 3, 6,
    9, … to the player), the same in every game. Index 0 (splash demo, smoke
    tests) and index 3 (the alpine curvature comparison) stay open road, no
    two towns run back to back, and the open-road fixtures (all at indices
    divisible by three) are untouched. The town tests now sample index 2 of
    sixty game seeds instead of whichever slot each seed drew; that reached
    game seed 57's stage 3, where a corner's side street is forced down to
    15.5 m, the one forced street decision 84 counted. The stub test's floor
    for a forced street was two metres stricter than the generator's
    documented one (junction cut plus 2 m, now `FORCED_STUB_MARGIN`), so it
    rejected a street the generator allows; both now share the constant. The
    cones of that street stand a metre inside its junction zone, on the
    junction's plate at the route's deck, which renders cleanly (checked in
    the dev server).

87. **2026-11-02 — Cinematic camera.** A fourth view, _cinematic_ (`C` cycles
    chase → interior → isometric → cinematic; Settings lists it too), covers
    the car the way a rally broadcast does. `CinematicShots` (pure TS) is
    the director and shot library; `CinematicCameraRig` runs each shot on
    the three.js camera. Five shots. A **trackside** TV camera fixed on the
    verge 40–110 m ahead (further with speed), 1.2–2.8 m off the road edge
    (inside the 3 m the scenery keeps clear of trees, so no trunk stands
    between it and the road; a first cut at 3–9 m put one camera among the
    pines, which hid the car), on a 1.6–3.2 m tripod or, three times in ten,
    7–12 m up a bank; it pans with the car with a quarter second of lead
    room, zooms with its distance between 14° and 50° (a 12 m frame height)
    and cuts once the car is 10 m past it, 170 m away or hidden behind
    terrain for half a second. A **helicopter** 10–18 m up and 12–24 m out,
    trailing lazily (λ 2.5) and circling at 0.08–0.14 rad/s for 7–10 s. A **low chase** car at bumper
    height 6–8 m behind and 1.6–3 m beside, aimed 12 m up the road past the
    car, with a speed kick on its 60° lens. A **camera car** alongside
    (5.5–8 m out, level with the car) with the car in the near third of the
    frame and the road ahead beyond it. A **reverse** tracking shot backing
    away 7–10 m ahead, on the car's nose. Tracking cameras are damped (λ 6,
    height 4) with the velocity fed forward, so the composition holds at
    speed instead of trailing by v/λ; the aim is damped at λ 8 and the
    travel heading at λ 4, leaning half way into a slide. Cuts are hard and
    follow two editing rules: the 180° rule (every camera in a scene stands
    on one side of the car's line of travel; the side may flip only across a
    shot on the line or high above it, the reverse or the helicopter) and
    the 30° rule (a cut moves the camera at least 30° round or above the car
    as it stands at the cut; a candidate that would not is dropped and
    another kind drawn). Trackside carries weight 4 against 1.5 for the
    helicopter, chase car and camera car and 1 for the reverse; at most two
    tracksides in a row, no other kind twice running, the helicopter at most
    once in three shots, and below 5 m/s trackside is weighted down to a
    third because the car reaches no camera. A fixed camera is lifted at
    placement until its sight lines to the car and to the point it will pass
    clear the terrain by 0.6 m. The director is seeded from the car's
    position at snap, so the sequence is reproducible in tests and differs
    between stages. Under reduced motion the trackside lens is fixed at 38°,
    the helicopter does not circle, the chase car has no speed kick, the
    operator wobble is off and shots hold 1.4× longer. The wheel scales the
    tracking offsets and the trackside frame height (0.6–2×). The rig gets
    the stage through `createCameraRig` so trackside cameras stand beside
    the road; on the test track they stand straight ahead. Design drawn from
    online sources: the Game Developer article on event-driven cinematic
    cameras (line of action as the first rule, cuts as the default,
    alternative shots when one fails; gamedeveloper.com/programming/
    creating-an-event-driven-cinematic-camera-part-one); DiRT Rally, Assetto
    Corsa and Gran Turismo replay threads (trackside cameras as the
    backbone, helicopter sparingly, too many onboard cuts disliked, each TV
    camera owning a stretch of road; steamcommunity.com/app/310560/
    discussions/0/611704730328080635, overtake.gg/threads/
    replay-cam-mod-no-onboards.115943, gtplanet.net/forum/threads/
    camera-controls-in-replays.415707); iRacing's camera-editor primer (zoom
    only on fixed cameras, clamp the zoom range, hand off by distance window;
    iracing.com/camera-editing-primer); a three.js F1 project's framing fix
    (trackside lens 18°–50°, helicopter lower and closer, low camera aimed up
    the road, side camera looking ahead; github.com/brycejmurrin/f1-game/
    pull/770); Unity Cinemachine's composer docs (look-ahead and damping;
    docs.unity3d.com/Packages/com.unity.cinemachine@3.1/manual/
    CinematicPositionComposer.html); and the three.js `MathUtils.damp`
    discussion on frame-rate independent exponential smoothing
    (github.com/mrdoob/three.js/pull/21102), which `dampFactor` follows.

88. **2026-11-02 — Lamp lenses painted into the hull.** The Albion RS Hatch's
    tail lamps were 6 cm boxes lying on the C-pillars. That surface is a
    twisted quad (horizontal along the tail's top edge, slanting up to the
    roof at the pillar station), so no flat box can sit flush on it and the
    lamps stood proud as red bars. The hull builder now paints lenses into
    its own faces: `sideDecals` split the pillar band across its width (as
    fractions from the belt edge to the roof edge) and `capDecals` split the
    nose and tail panels along x, like the existing deck decals, so a patch is
    made of hull faces and follows the surface exactly. A patch marked
    `glow` is emitted after the lit faces and `CarHullMesh` draws that tail of
    the buffer as a second group with an unlit vertex-colour material, so it
    reads as a lit lens whatever the sun does (per-face emissive is not
    possible with one standard material). The Focus carries a lens up the
    outer 45 % of each C-pillar from the tail to the pillar station, wrapping
    down onto the tail panel's white band at the corners (|x| > 0.62,
    y 0.84–0.99); the old box and its basis maths are gone. Decal types and
    the interval helpers moved to `CarHullDecals.ts`; `CarHull.ts` still grew
    to ~450 lines with the two new splits, a little over the file guideline,
    accepted rather than splitting the builder's single loop.

89. **2026-11-02 — Replay after the finish.** The result panel gains a
    "Watch replay" button between Retry and Next. `ReplayTrack`
    (`game/replay/`, pure TS) records the run as one sample per fixed sim
    step (18 floats: position, ground height, yaw/pitch/roll, velocity,
    speed, yaw rate, lateral g, steer and wheel angle, rpm, gear, grounded,
    turbo) from the start signal until three seconds past the finish line,
    in a flat buffer that doubles when full (a few MB for a long run, no
    per-step allocation once grown); `sampleAt` blends the two samples
    either side of a time (angles the short way round), so playback is as
    smooth as the render interpolation. The replay is a UI state
    (`uiStore.replay`) the session reads imperatively each frame, like the
    camera mode: while it is on, `DrivingSession.tick` stops stepping the sim,
    advances a replay clock (paused with the panels like the sim), writes the
    recorded pose into the same `pose` the car model and camera rigs read,
    and publishes the clock, checkpoints passed (by progress along the stage)
    and the progress bar from the recording. When the recording runs out the
    session leaves the replay by itself, so the result panel comes straight
    back (a first cut looped the replay; the player asked for the results). Driving keys do nothing because the
    sim is not stepped; R is already ignored after the finish; C and the
    Settings dropdown still switch camera, so the new cinematic view can be
    watched; Esc leaves the replay before it would open the Game panel, and
    the HUD shows a Replay tag with an Exit button under the clock. Leaving
    restores the pose from the sim and the final time on the HUD, and the
    result panel comes back. `DriveRig` skips tyre marks while replaying,
    since the sim's frozen slip would otherwise paint under the moving car.
    A new session resets the flag. For testing, the `?spawn=` dev aid now
    also counts the checkpoints behind the spawn as passed
    (`StageRun.skipGatesBefore`), so a car spawned near the finish can finish.

90. **2026-11-02 — H hides the HUD.** A clean view for watching the cinematic
    camera or a replay: `H` toggles `uiStore.hudHidden`, routed like the
    other action keys through `KeyboardControls` (so typing in a form field
    never triggers it) and the session. Hidden means the chrome goes: clock,
    checkpoint and penalty tags, money and Garage button, the toolbar
    buttons, the progress bar, the speed readout, the debug overlay and the
    replay bar. What the player must see stays: the countdown and GO, the
    result panel, any open dialog, and the touch controls (they are the
    controls, and touch devices have no H). Esc still works as before, so a
    player who forgets the key can open the Game panel from a hidden HUD,
    and the controls table lists H. Nothing is persisted; a new game shows
    the HUD. An e2e test hides and shows the chrome and opens a dialog over
    the hidden HUD.

91. **2026-11-02 — Changelog and context documents.** The repository gains a
    `CHANGELOG.md` and three documents in `docs/`: `GAMEPLAY.md` (what the
    player meets, with the constants behind it), `CONTENT.md` (stages,
    towns, regions, cars, surfaces) and `TESTING.md` (suites, e2e setup and
    the Playwright screenshot pattern that until now lived only in session
    notes). The changelog is grouped by day rather than version: there are
    no version tags and `main` deploys continuously, so a date is the
    truthful unit, with the decision numbers in brackets for the reasoning.
    The brief stays as written and points to GAMEPLAY for where the game has
    moved past it; PLAN gains a "where things stand" paragraph. The README
    now states that the Vercel deployment uses Vercel Web Analytics
    (cookie-free); the in-app privacy page still says "no analytics" and
    should be reconciled by the owner.

92. **2026-11-02 — Nightcity: a hidden cyberpunk re-skin on the N key.** By
    request, `N` (unbound until now, and left out of the controls table on
    purpose) turns the stage into a neon night city and the car into a
    futuristic wedge, mid-run and in place; `N` again restores the day.
    Nothing in the sim changes: same road, same colliders, same clock, so a
    Nightcity run is an ordinary run and records stay comparable. The flag is
    `uiStore.nightcity`, routed like `H` through `KeyboardControls` and the
    session, session-only and never saved; the HUD shows a "Nightcity" tag
    that hides with the rest of the chrome. Design choices, in order of
    weight. **(a) Look as data.** `render/theme/WorldTheme.ts` (pure TS)
    describes everything the stage renderer needs to know about colour and
    light: sky, fog range, hemisphere and sun, terrain mode, road colours,
    gates, walls, which scenery kit set, tyre-mark ink. `dayTheme(region)`
    reproduces the daytime look exactly (pinned by a test against the old
    constants, which moved to `road/roadColors.ts`); `NIGHTCITY_THEME` is a
    constant. `SceneLights`, `RoadBuilder`, the town builders, `GateBuilder`
    and `SkidMarks` take their colours from it. **(b) Re-dress in place.**
    `StageRenderer.setTheme` swaps the terrain's one shared material (the
    worker's baked per-face colours are simply ignored by a flat dark
    material: no re-mesh, no worker round trip), disposes and rebuilds the
    road, gates and town meshes in the new colours (about a thousand samples,
    cheap), and rebuilds the `SceneryChunkManager` with the theme's kits,
    reloading the chunks around the car in the same call so there is no empty
    frame. The builders dispose their GPU resources but not their place in
    the scene graph, so the renderer removes each group before rebuilding.
    `StageDrive` stays keyed on seed, index and attempt: the toggle must never
    remount the run. **(c) Neon as HDR vertex colours.** A `ThemeColor` may
    carry a `glow`; above one, `themeColor` bakes the hex that many times
    over into the colour attribute, and `patchNeon` (an `onBeforeCompile`
    patch on the merged surfaces' standard materials) draws any face whose
    vertex colour exceeds one as emission instead of lit surface. So the road
    and town builders paint neon lines and kerbs by colour alone, with no
    extra material groups, and a bloom pass with a luminance threshold of one
    lifts exactly those faces. Instanced glow kits need no patch: an unlit
    `MeshBasicMaterial` with vertex colours passes the HDR per-instance tint
    straight through. Verified against three r186: the standard fragment
    shader declares `totalEmissiveRadiance` before `color_fragment`, `vColor`
    is a vec4 under `USE_COLOR || USE_COLOR_ALPHA` (also defined for
    `setColorAt` kits), and `Color` never clamps (a test pins the chunk
    order). **(d) Kits as data.** The inline kit list left
    `SceneryChunkManager` for `scenery/kits/RallyKits.ts`, unchanged in
    output (the trunk stretch and rock sink became `place` hooks); `KindKit`
    gained `accept`, `place` and `colorAt`, and the manager takes a kit list
    and owns it. `NightcityKits.ts` dresses the same props: trees become
    **stilt towers** (a core inside the 0.45 m tree collider up to 3.4 m, the
    truck's roof height, then a cantilevered block, so the car passes under
    the overhang and nothing it can drive through is drawn) in three tiers by
    distance from the road (kiosk within 12 m, mid to 30 m, tall beyond) so
    the isometric and cinematic cameras keep their view, or **masts**, or
    nothing: three towers and two masts in ten tree slots, because 110 trees
    per 100 m is far too dense for buildings; bushes become neon sign boards
    (turned to face the road through the renderer's cached nearest-road
    query) and bollards; rocks cargo pods; farmhouses mid-rise blocks on the
    same pads; town buildings keep their geometry under dark tints with a
    neon roofline trim per style (planters dropped); lamp heads are relit by
    a glow box that encloses the day head; cones and boards stay. Glow parts
    stand 1-3 cm proud of the body they light so nothing z-fights. Four hues
    by hash (cyan, magenta, amber, violet). **(e) One car.** Rather than nine
    cyberpunk liveries, `render/car/NightcityHull.ts` cuts one hull from the
    active spec's axles, track, tyre radius and cabin offsets, so the wheels
    sit in their wells on every catalogue car, the truck included, and the
    canopy clears the first-person eye (pinned per car by a test). After a
    first plain wedge the shape was pushed toward the cyberpunk games' street
    machines by request: `sideAt(z)` gives the flank half-width along the
    car, box flares (+10 cm) over each axle running to the bumpers and
    blending into a pinched waist under the canopy, with a taper to a blunt
    nose face; every station and every flank-mounted part reads its x from
    it, so vents, intakes and arch lips seat on the surface on any car. Flat
    detail on the top faces is painted as deck decals (bonnet centre panel,
    vents with amber slits, a dark engine cover with magenta slits, the roof
    strip) because a box laid on a sloping bonnet floats; the kit adds a
    segmented light bar with angled fangs, slatted grille, side intakes with
    lit edges, splitter and canards, side skirts with a lit underline, fender
    vents, rear intakes, louvres along the rear-glass slope, a sensor pod and
    antennas, a spoiler on swept prism uprights with end plates and a shark
    fin, a strake diffuser and quad hexagonal thrusters (`Lamp` gained
    `sides`).
    The hull's `CABIN_MIN_HEIGHT` is 5 cm, so deck and bonnet stations keep
    the roof 4 cm over the belt and the glass lands on the canopy alone; the
    nose and tail light bars are glow boxes rather than cap decals for the
    same reason. `CarHullMesh` gained a `glow` multiplier for the unlit faces
    (`CarHull.ts` is untouched, already over the file guideline). Dark rims
    with lit rings and an additive vertex-alpha underglow plane in the wheels
    group finish it. The cabin follows by request: `InteriorPalette` gained
    an optional `glow` (emissive intensity for the accent-coloured parts:
    accent, harness, seat stripe, cage tubes, dial rings and needles), every
    car's `InteriorSpec` is reused with `NIGHTCITY_INTERIOR_PALETTE` swapped
    in (near-black trim, a violet cage kept just under the bloom threshold,
    cyan and magenta accents above it), `Dial` has a `neon` face, and
    `NightcityCabin` lays light lines along the dash lip, door cards and roof
    edges plus a translucent heads-up pane with lit data bars at eye level,
    all sized from the car's envelope; the kit and dimensions are the real
    car's, so the interior tests still hold. The Garage preview and the
    splash demo pass nothing and stay daytime. **(f) Bloom
    only in the mode.** `NightcityEffects` mounts `@react-three/postprocessing`
    (installed since the scaffold, unused until now) with a mipmap bloom at
    threshold one and an ACES tone-mapping effect, because the composer forces
    the renderer's tone mapping off while mounted and the car's shading would
    otherwise change contrast on the toggle. Rule 4 is honoured in that the
    mode is itself the switch and the day pays nothing; a Settings flag is
    deferred to the quality tiers of milestone 7, since a setting that only
    matters in a hidden mode would give the mode away. Nothing in the mode
    animates (no flicker, no pulsing underglow), so reduced motion needs no
    variant. The toggle rebuilds in one frame on purpose: a half-themed world
    would read as a bug.

93. **2026-11-03 — Regions in pairs; towns and the difficulty loop no longer
    derived from the block size.** The progression ran each region for three
    stages, and by request the same scenery must never show more than twice
    in a row, so `STAGES_PER_REGION` is 2 (Forest ×2, Alpine ×2, round
    again). The order stays fixed rather than seeded: stage N is then the
    same region in every game, index 0 stays Forest for the splash demo and
    the smoke tests, and index 3 stays Alpine for the curvature test; with
    more regions in the loop later the pairs give the variety on their own.
    Two things had been derived from the block size and are now their own
    constants so it could shrink without side effects. `hasTown` keeps its
    own `TOWN_EVERY` of three (towns on stages 3, 6, 9, …, as before, now in
    whichever region falls there; doubling the town frequency was not asked
    for and index 3 must stay town-free), and the difficulty `loop` steps
    every `STAGES_PER_LOOP` = 6 stages instead of once per region cycle,
    which would have shortened the 25 % length step from six stages to four.
    Keeping both cadences also keeps every stage whose region did not move
    (indices 0, 1, 3, 8, 10, 11, 12, …) identical, since the seed is hashed
    from region and index; records on the others were set on a road that no
    longer sits at that number and are left in place rather than wiped.

94. **2026-11-03 — Autumn trees on Forest mud stages.** By request the mud
    stages read as autumn. `RegionDef` gained an optional `surfacePalettes`
    map and `stagePalette(stage)` resolves the palette a stage is drawn in
    (its region's, or the one its surface swaps in), so a surface can
    re-dress a region without a new region, theme or scenery kit:
    `sceneryKitsFor` now takes the stage rather than the region and hands the
    resolved palette to `rallyKits`. Only the four tree fields change (every
    other pine a golden larch, the broadleaves orange and rust; the bushes
    share the pine tints, so some turn gold too). Sky, fog, grass, shoulder,
    rock and trunk keep the summer values and the terrain worker still reads
    the region palette, so the ground, the lighting and the `dayTheme` memo
    are untouched. The override is a full palette built once at module load
    rather than a partial merged per call, so it compares by identity like
    the region's. Nightcity ignores it (its own kit); the Forest clones
    (Coast, Desert, Night placeholders) inherit it until milestone 8 gives
    them palettes of their own.

95. **2026-11-03 — Coast: a cliff road laid out from the road itself, and a
    nine-stage region cycle.** By request: a tarmac region along a stone
    cliff, mountain on one side, a human-made stone retainer most of the way
    on the other with a beach and the sea below, tight curves, the road
    tracing the coastline. **(a) The coast is derived from the road, not the
    road from a coast.** The open-road walk caps its heading at 72° from the
    stage axis (`MAX_DEVIATION`), so every open road is a single-valued
    curve over that axis. `Coastline` tabulates the road's offset across the
    axis per metre of axis and measures everything from it: a point's
    seaward distance is the road's offset at its axis coordinate minus its
    own, so the sea is always to the right of travel and a jog inland never
    leaves one strip of ground sea on both sides, which a nearest-road rule
    would do. Features are a little compressed on the legs that cut across
    the axis (a cliff reads steeper there); accepted for the robustness. The
    road's own height is a function of the axis coordinate (5–22 m above the
    sea), so `buildRoadHeights` smooths an already smooth line and the
    ground under the carriageway matches the deck. **(b) Profile.** Seaward:
    a 2.5 m ledge, then a slope that is a 61° cliff where the road is 9 m
    up or more and a 24° sand bank where it is low (so leaving the road
    there is a drive down to the beach and back, not a fall), a beach a
    metre above the water up to 60 m wide and absent at headlands, then the
    seabed to −9 m. Inland: a face 11–21 m wide whose slope swings along the road
    between a scrubby 39° bank and a sheer 66° wall, with ledges and rubble
    on it, then hills with the region's relief; a constant slope rendered as
    one smooth ramp, which no cliff is. Both verges blend from the deck over
    8–10 m instead of 16 so neither side is softened into a hillside. **(c) The retainer** stands
    2.1 m beyond the edge (marker posts at 1.4 m stay in front) wherever the
    road is at least 9 m up, broken 10 m either side of the start and every
    gate so the arches and boards never pierce it, short runs dropped and
    short gaps closed. It is built as overlapping box runs in one merged mesh
    (like the garden walls) and filed as oriented box colliders, so the car
    bounces off it rather than driving over the drop; where there is no wall
    there is no drop to speak of. Rendered in its own grey (`seawall` on the
    theme) since the garden walls' sandstone read as plaster. **(d) The sea**
    is one flat plane at sea level that follows the car; the mesher paints
    faces under a metre above it sand and under it wet sand, and turns faces
    to rock from 32° of tilt instead of 44° so the cliff and the sheer face
    read as limestone rather than khaki once the verge blend has softened
    their facets, and the sea colour sits on the theme (region's by day,
    near-black in Nightcity). Nothing animates, so reduced motion needs no
    variant, and the plane is part of the region rather than a toggleable
    extra. **(e) Scenery.** Seaward only rocks (cliff, beach, shallows down
    to −0.6 m); inland nothing but rocks and bushes on the face, the pines
    and broadleaves above it; no farms, since their level pads would cut
    terraces into the face. **(f) The cycle.** With three regions in pairs,
    towns on every third stage would have fallen on the same two regions for
    ever (3 divides 2 × 3) and Forest would have lost its villages. Rather
    than change the town cadence (decision 86) or the pairs rule (decision
    93), `REGION_CYCLE` is a hand-laid nine-stage sequence, Forest ×2,
    Alpine ×2, Coast, Forest, Coast ×2, Alpine: no three alike (ones are
    allowed, the rule was "two at most"), three of each per nine, stage 1
    still Forest and stage 4 still Alpine (the splash demo and the curvature
    test), and the town indices on Forest and Alpine only, so the coast
    needs no town plateau cut into a cliff. The two later-loop open-road
    fixtures were re-recorded again at indices that are still open road.

96. **2026-11-03 — Coast: a hillside inland, not a wall.** The first cut
    (decision 95) put a face 11–21 m high straight above the inland verge;
    played, it read as a step beside the road rather than a mountain, and
    the reference the request pointed to (a Garraf-style corniche) has a low
    road cut, then a 30°–40° hillside of scrub and pines over pale limestone
    with outcrops, bushes right down to the tarmac and scrub even on the
    seaward rock. `Coastline.mountain` is now a cut bank up to 2 m high that
    comes and goes along the road, then a hillside whose slope swings
    between 24° and 37°, with outcrops and the region's relief fading in
    well off the verge. The inland verge blends over 10 m: a short blend
    compresses the cut and the first metres of hill into one steep bank,
    which was most of the step. Trees start 5 m beyond the inland edge
    instead of 18 m, bushes and rocks anywhere; seaward, bushes are allowed
    on the cliff above the beach. The coast turns to rock from 37° of tilt
    instead of 32° so the hillside stays green, its rock goes paler and its
    scrub greener, and the prop densities roughly triple, since half of
    every draw lands seaward and is mostly dropped.
    The probe that followed showed the step was mostly a measuring error:
    the across-axis offset of decision 95 runs 1/cos θ long beside a leg that
    cuts across the axis at angle θ, so on a 60° leg a 30° hill rendered at
    49° and near the 72° cap almost vertical, cliff and hill alike. The
    offset is now multiplied by the cosine of the road's local angle (from
    the tabulated road's slope across the axis), which is the true
    perpendicular distance beside a straight leg and only an approximation
    far out, where it merely shifts the shoreline a little.

97. **2026-11-03 — Coast: the land first, then the road, with hairpin
    stacks and low-poly cliffs.** Two more requests landed on the coast:
    cliff walls like a low-poly cliff pack (big flat facets, steps and
    ledges, ochre rock) and stretches of road like a mountain corniche, with
    stacked hairpins. The second cannot be had under decisions 95–96: a
    terrain derived from a single-valued road cannot put a leg above another
    leg, and the heading cap that made the road single-valued forbids the
    U-turns. So the coast is now built the way the other regions are, land
    first. `CoastShape` is the lie of the land in axis coordinates, seeded
    from the stage: a meandering water line, a beach, a rock band whose
    height and grade vary along the shore (62° terraced rock where tall, a
    sandy bank where low), a scrub hillside with terraced outcrops where a
    noise mask says rock, and the region's relief further in. `CoastRoad`
    draws the road on it: along the shore a shelf back from the cliff top,
    and once a stage (twice past 2.2 km) a stack of two hairpins, left then
    right so the road keeps its direction, legs 140–180 m, radii 20–24 m,
    then a long diagonal back down at 10 %; the climb between stacked legs is
    their spacing times the hill's slope spread over a hairpin and a leg, so
    the 12 % limiter is honoured and the deck rarely leaves the ground.
    `Coastline` keeps only what the stage needs of that: the ground and the
    rock mask in world space, the shore distance and slope for the scatter,
    and the retaining walls, now per side, standing wherever the ground 10 m
    beyond an edge lies 3 m or more below the road's, which puts them on the
    seaward edge of the shore road and the outer edge of every hairpin leg
    without a rule saying so. The self-approach rule of 52 m does not apply to
    coast stages (stacked legs are 40–48 m apart; the corridors do not meet).
    The low-poly cliff look is a terrace function on the horizontal run
    (flat treads, steep risers, the same average slope) under the 2 m mesh,
    its ledges broken by noise, and a rock mask carried in `TerrainSample`
    so the mesher paints the band and the outcrops rock whatever their tilt
    and the scrub slopes green; the coast's rock goes ochre. Scenery is placed
    by terrain rather than by side: rocks above the water, scrub from the dry
    sand on anything under 54°, trees 3 m up on anything under 42° off the
    outcrops.

98. **2026-11-03 — Coast: long bends on the shore road, one strip of
    parapet.** Played, the shore road zigzagged: the water line carried a
    5 m ripple with a 33 m period, which the road inherited as a bend every
    few car lengths, and the parapet made it worse because every 3 m box had
    its own level top, so the wall stepped along every grade and bend. By
    request the shore now meanders in two octaves only (60 m bays on a 285 m
    period, 18 m bends on 110 m), nothing tighter than about 100 m of
    radius; the hairpin stacks keep the tight turns. `SeaWallBuilder` lays
    each run as one continuous flat-shaded strip (outer and inner faces, top,
    coping and end faces) through stations every 3 m whose across-wall
    direction averages the segments either side, so the coping follows the
    deck without steps or slits. The colliders stay 4 m boxes.

99. **2026-11-03 — Coast barriers: block walls and guardrails in turn.** The
    parapet of decision 98 read from the car as a thin, broken sheet: one
    0.5 m slab whose only visible part at eye level is its top band, ending
    abruptly at every gap. By request, with a dry-stone wall and a W-beam
    guardrail as references, the walls are now built as runs of two kinds in
    turn, 36–72 m each from the stage seed (`Coastline.barrierRuns`), over
    the same wall intervals and the same box colliders. A block wall is two
    staggered courses of concrete blocks, each box its own length, height,
    thickness, set, yaw and tint between the theme's two greys, so it reads
    as laid blocks rather than a slab. A guardrail is a strip extruded along
    the run with a six-point W profile whose two ridges face the traffic,
    rendered double-sided and a little metallic, on posts every 2 m; at an
    end nothing continues from it turns down to the ground and flares away
    from the road over 2.2 m, as the real terminals do, and where a block
    wall follows it keeps full height to the joint, which is the transition.
    Three meshes (blocks with vertex colours, posts, beams) replace the one
    strip. The theme gains `guardrail` colours; `seawall` goes concrete grey.

100. **2026-11-03 — Coast wall: fewer, rounder stones.** The knocked-about
     blocks and lumps of decision 100 read as busy brickwork from the car. By
     request the wall is now two courses of big stones, 0.6–1.1 m long, every
     one a 2×2×2-facet box whose vertices are drawn 45 % of the way toward the
     sphere (corners and edges move, face centres stay), with 5 % jitter,
     so each stone is a rounded, flat-shaded pebble rather than a brick; the
     tint range narrows and the tilts halve, so the wall reads as one calm
     rounded line of stone.

101. **2026-11-03 — Desert: dunes, oases and two sand surfaces.** By
     request, a desert of dunes with oases whose road is sand yet still
     reads. **(a) Two surfaces, not a recolour.** The piste is a new `sand`
     surface (grip 0.66, drag 0.06, between gravel and grass; par 0.9, prize
     ×1.2) and the ground off it a new `dune` surface (grip 0.5, drag 0.2,
     like mud), because a sand road the player can see should say "Sand" in
     the panel and be felt as sand, and soft dunes must be slower than the
     piste or every bend is cut across them. The `Surface` union carries both
     through physics, par, prize, road colour, tyre ink, the stage-list glyph
     (sand ripples, shared by both) and the three dictionaries; the typed
     records made the compiler list every site. The piste's colour is a shade
     darker and redder than the dune sand; by request it carries no painted
     edge lines (a piste has none), so the colour alone makes it legible, and
     it went a touch darker for that. **(b) Dunes** are a terrain kind on the
     region (`terrain.dunes`): ridged noise (one minus the absolute value,
     squared) stretched four to one downwind over a rolling floor, 11 m of
     relief, so crests are sharp and ridges long; the road bed's smoothing
     and 12 % limiter grade the piste through them as cuttings and banks
     without special handling. **(c) Oases** are planned from the stage seed
     along the road (`Oases.ts`), 30–65 m off it, clear of every part of the
     road, of a town and of each other, trying five spots a step and keeping
     the first whose rim's eight sample points lie within 4 m of one another;
     each is a level pad 1.4 m under the lowest rim point with a 9 m blend, so
     the water (0.45 m over the floor) stands below the sand all round, which
     a mean-height floor did not guarantee on a dune slope. The pools are
     flat discs reaching under the slope; the palms (a new prop kind: a
     leaning tapered trunk, seven drooping fronds and a knot of dates, covered
     by the night kit's masts) ring the rim once the pads are set so they
     stand at the right height, and the wild scatter keeps out of the pools.
     **(d) The cycle** grows to twelve (Forest ×2, Alpine ×2, Coast, Forest,
     Desert, Coast, Alpine, Coast, Desert ×2): no three alike, three of each,
     towns on Forest, Alpine and Desert, never Coast, and stages 1–6 exactly
     as before, so the coast tests and the kerb fixtures hold; the two
     later-loop open-road fixtures were re-recorded at indices 15 (Alpine) and
     12 (Forest).

102. **2026-11-03 — Replays lay their own tyre marks.** The replay drove the
     car from the recording while the mark renderer was told to stay idle
     (the sim's frozen slip would otherwise have drawn a smear), so a replay
     showed only the fading leftovers of the live run, and a braking lock-up
     near the finish was gone by the time the replay reached it. By request
     the marks replay too. The intensity maths moved out of `wheelContacts`
     into `axleMarkIntensities` (per axle, from slip, spin, handbrake, speed
     and grounding) and `placeWheelContacts` (the four patches for a pose),
     so the session can record the two intensities and the surface with each
     sample (three more floats, 21 in all) and the rig can place marks from
     them without a sim state. Entering and leaving the replay wipes the
     buffer (`SkidMarks.clear`), and marks laid during playback are stamped
     with the replay clock, so they hold and fade on the same schedule they
     did live. Recording intensities rather than raw slips keeps the replay
     faithful to the car's tuning at the time and the track ignorant of specs.

103. **2026-11-03 — Towns are a regional property.** The twelve-stage cycle
     put a desert stage on a town index (the twelfth), so the desert grew a
     village; by request it must not. Reshuffling the cycle again would have
     moved the early stages or starved a region (every third index must be
     a town-building region, and Forest and Alpine have six slots between
     them for four town indices, two of which must also stay open road for
     the tests and the fixtures). Instead each region says whether it builds
     villages (`towns`), and `stageHasTown` is the town rule everywhere the
     brief and the generator need it: every third stage, except in regions
     that build none, the coast and the desert. The cycle, the fixtures and
     stages 1–11 are unchanged; the desert's stages stay open road whatever
     index they land on, and so would any future region that opts out.

104. **2026-11-03 — Toro Dakar Buggy, a second special; free-standing fender
     shells.** By request, a rally-raid buggy after the truck, from six
     reference photos of the 2014 SMG two-wheel-drive buggy: navy over a
     yellow sun with a red charging bull on each door, four lamps in two nose
     pods under white lettering, a wide roof intake box, separate mudguards
     standing over 37-inch tyres, exposed front suspension. The `buggy` spec
     is 1.45 t on a 3.0 m wheelbase and 1.8 m track with 0.47 m tyres, a
     520 N·m naturally aspirated V8 on the rear axle alone (rear-drive like
     the coupé), six gears, soft long-travel springs (240/20) and plenty of
     drag (1.4), with the shared dealership grip; the cabin sits 0.11 m above
     and 0.1 m behind the hatchback's and `bodyScale` is 1.25. Price 32 000,
     after the truck, tagged `special`, so the two raid machines close the
     list. The lofted hull can cut an arch into a flank but cannot stand a
     mudguard above a narrow tub, so `render/car/FenderShell.ts` lofts a
     thick half-ring shell around an axle from an outer outline of
     [angle, radius] pairs: a flat-topped ring piece with a chamfered outer
     edge, mirrored both sides, arch underside in trim, wound outward (a test
     checks the enclosed volume against the ring area) and emitted as a
     `HullMesh`; `CarHullMesh` split into `VertexColorMesh` with hull and
     fender wrappers over it, and `fenderPoint` seats parts on the dome. The
     tub cuts wells at the rear axle only; the nose sits inboard of the front
     tyres with wishbones and red coil-overs in the gap. The stripe band
     carries no colour on this car but still shapes the nose and tail panels,
     so the cap decals (lamp pods, tail lamps, rear mesh) land on bands of
     the right height; the hull builder's bands are the only way to place a
     cap decal vertically. The bull is two convex prisms (torso, lowered
     head) and six tubes (legs, horn, tail) proud of the door over a yellow
     disc, an original mark rather than the trade one. The cabin shares the
     truck's raid console (the test now allows the two raid machines) under a
     navy cage with red harnesses; its floor sits at 0.3 in the cabin frame,
     sill height, and its dash top 5 cm over the screen base so the door
     cards reach the hull's belt, because at first the sun disc and the
     bull's horn showed over the cards through the back-face-culled shell
     from the driver's seat. The rear was then reworked by request from a photo of the car's tail, in two passes: the engine deck behind the cabin rises to 1.34 m (the belt climbs along the rear window as a haunch) and the hull closes at −1.9 m in a dark bay wall; two full-size spares stand in that wall upright like the road wheels, tread to the rear, side by side on a carrier tube with the plate in the slot between them and their tops up under the wing (a first pass had them facing backward, lower, under a deck slab, and was corrected: the photo shows their treads); wedge uprights carry the wing with the tail lamps on its trailing edge, and by request the white plates first put on the uprights became white work lights lying low on the back of each rear fender (seated with `fenderPoint`); the centre fin's leading edge lies a centimetre inside the rear window from the deck to the roof's rear corner (a first pass left a wedge of air between a vertical edge and the glass), its top runs down to the wing's underside and it stands in the slot between the spares; the rear fender's lip is cut back to −70° so it ends beside them. The whole body also stands 0.1 m higher over its wheels (`BUGGY_LIFT`: the body group is lifted, the wishbone and damper ends on the hubs are lowered to match, and `cabinDrop` 0.11 → 0.21 lifts the cabin and the eye with it; cg 0.72 m), the long-travel stance of the real car. Its mud flaps are bolted to the spare carrier's tube inside the body group (`CarModel` skips its chassis-hung pair for bodies that hang their own, `OWN_FLAPS`), so by request they ride and lean with the body instead of staying put with the wheels. The spares and wing are what the chase camera sees all stage. Two more requests followed. The bull of two wedges and six tubes read as ridiculous, so it is now the supplied side-view icon: `render/car/SvgSilhouette.ts` reads the SVG path subset icons use (M L H V C S Z, absolute and relative), flattens each cubic into four chords, triangulates each closed subpath with three's `ShapeUtils` and extrudes it 2 cm along x with outward-wound caps and walls (SVG right is +z, so the right-facing bull charges toward the nose on both doors without mirroring; a first pass mapped SVG left forward, having taken the icon's raised tail curl for its head, and put the tail in the sun); `BullSilhouette.ts` holds the path data, credited in CREDITS.md, and builds the slab once per size. And the exhausts, two stubs floating under the spares, now run under the floor from the engine bay to just past the carrier tube, tucked up against it in the slot between the spares, with a belly pan, the differential and driveshafts, trailing arms and a cross tube added under the bay so the open rear reads as a frame rather than empty air.

105. **2026-11-03 — The splash demo car turns smoothly.** `RoadPath.sample`
     reports the heading of the 2 m segment under the point, so the
     attract-mode `RoadFollower` set the car's yaw in steps, several a second
     at 17 m/s, and its yaw rate (a per-frame difference) spiked at every
     sample and sat at zero between: the steering, the body lean (from
     `latAccel`) and the chase camera's roll and heading all stuttered
     through every bend. The follower now blends the path's per-sample
     central-difference headings along the segment, so the heading turns
     continuously, points the velocity (which the chase camera leans toward)
     the same way, and eases its yaw rate toward the measured one at 5/s, so
     a curvature step between samples becomes a short ramp in lean and
     steering rather than a kick. `sample()` itself is unchanged: gates,
     boards, towns and the fixtures read the segment heading as before. A
     test drives 40 s and pins the per-frame yaw step under 0.03 rad, the
     per-frame lateral-g step under 1.5 m/s² and the heading within 0.1 rad
     of the road's own direction under the car, so it does not crab.

106. **2026-11-03 — A random car behind the splash.** The attract-mode drive
     always showed the starter hatch; by request it now draws a dealership
     car at random with each lap's stage (`randomDraw` in `DemoDrive`, from
     `CATALOG_IDS`, so the two specials appear too), re-mounting the
     `CarModel` by id and building the follower and the chase rig for that
     car's wheelbase, tyres and `bodyScale`, so the truck and the buggy are
     framed as they are in the game. The splash stays daytime.

107. **2026-11-03 — Splash performance: a still backdrop without a GPU, the
     font preloaded, the logo prioritised.** A PageSpeed run of the deployed
     start page scored 60 with a Total Blocking Time of 29 s: Lighthouse's
     headless Chrome renders WebGL in software (SwiftShader), and the
     attract-mode drive cost it hundreds of milliseconds per frame for as
     long as the trace ran (32 s of "Other" main-thread work in the three.js
     chunk), while the paint metrics were fine (FCP 0.2 s, LCP 0.4 s). The
     drive is decoration, so `lib/gpu.ts` now probes WebGL once after
     hydration (a throwaway context, the unmasked renderer name) and the
     splash keeps a painted sky-and-ground backdrop, with no canvas and no
     three.js chunk fetched, where WebGL is missing or the renderer is a
     software rasteriser (SwiftShader, llvmpipe, the Microsoft Basic Render
     Driver and kin); elsewhere the live drive mounts over that same
     backdrop, which now also shows from the first paint while the scene
     loads. The game's own canvas is never gated. The e2e smoke test, whose
     Chromium runs on SwiftShader, expects the still backdrop. Two smaller
     items from the same report: the pixel font moves from the fontsource
     stylesheet to `next/font/local` (the same woff2, the latin subset
     only), so it is preloaded from the HTML with its `@font-face` inlined
     instead of sitting at the end of an HTML → CSS → font chain, and
     `--font-pixel` reads next/font's variable; and the logo, already
     `priority`, also asks `fetchPriority="high"`, which Next 16 does not add
     by itself. Left alone: the 14 KiB of "legacy JavaScript" is Next's own
     polyfill module, imported unconditionally by its client runtime whatever
     the browser targets (the defaults are already Chrome 111 and Safari
     16.4); the "document request latency" is the host's; and the unused
     share of the three.js chunk is what tree-shaking leaves.

108. **2026-11-04 — Install prompt for phone browsers, free rotation, and
     launcher icons that survive masking.** Three related changes to how the
     game lives on a phone. (1) `splash/InstallPrompt` is a strip under the
     splash card, shown only on coarse pointers and never when the page
     already runs standalone (`display-mode: standalone` or Safari's
     `navigator.standalone`). On Android it keeps Chromium's deferred
     `beforeinstallprompt` event and opens the install sheet from its own
     Install button; iOS has no such event, so there the strip spells out
     Share → Add to Home Screen. "Not now" writes a timestamp to local
     storage and the strip stays away for 14 days (`lib/installPrompt.ts`
     holds the pure platform detection, including iPadOS reporting as a Mac,
     and the cool-down; both unit-tested). No service worker was added:
     Chromium no longer requires one for installability, and offline play is
     out of scope for now. (2) The manifest's `orientation` goes from
     `landscape` to `any`: the lock only applied once installed, it made the
     splash and menus unusable upright, and the HUD already lays out in
     portrait (screenshot-checked on a Pixel 7 profile). (3) Launcher icons:
     the favicon is a rounded tile with transparent corners, which Android
     treats as artwork to shrink onto a white disc, the "small square inside
     a circle", and iOS paints transparent pixels black. `pnpm brand` now
     renders full-bleed squares as well: `public/icons/maskable-{192,512}.png`
     with the gradient edge to edge and the mark scaled to 72 % so it sits
     inside the 80 % safe circle, listed in the manifest with
     `purpose: 'maskable'` beside the transparent `any` icons; and
     `apple-icon.png` the same way at 84 %, opaque, since iOS only rounds the
     corners. `install.spec.ts` covers the Android, iPhone, installed and
     desktop cases by dispatching the event or faking `navigator.standalone`.

109. **2026-11-04 — Edge to edge on Android.** Installed with
     `display: 'standalone'`, the app kept Android's status bar (painted in
     the paper theme colour) and its navigation bar. The manifest now asks
     for `fullscreen` with a `display_override` of fullscreen then
     standalone, so Chrome launches the installed game immersive: both bars
     hidden, the panel filled to the notch (`viewport-fit=cover` and the
     HUD's safe-area padding were already in place), bars back on an edge
     swipe. For a plain browser tab, and as a fallback where the installed
     mode lands on standalone, `lib/fullscreen.ts` calls
     `requestFullscreen({ navigationUI: 'hide' })` from the Drive tap (the
     API needs a gesture) on coarse-pointer devices only, and `GameShell`
     exits fullscreen when it unmounts back to the splash. Desktop windows
     are left alone. iOS is unchanged: home-screen web apps there always
     show the status bar and iPhone Safari has no element fullscreen, so the
     guard on the method skips it. The mobile e2e test asserts
     `document.fullscreenElement` is set after Drive on the Pixel profile. Reverted by decision 123.

110. **2026-11-04 — Albion RS Hatch tail after the Mk2 Focus.** By request
     the rear was reworked to read as the road car it is drawn from. The
     Mk2 Focus's tail lamps are tall vertical units at the body corners
     that run from the bumper line up the C-pillar alongside the hatch
     glass, tapering as they climb, with a clear reverse-light band set
     low in each; the old lens sat only on the outer 45 % of the pillar
     band plus a 15 cm block at the panel's top corners, so from behind it
     was two small red squares. Now the pillar lens covers the inner 65 %
     of the band (the part beside the glass) for the glass's full height
     and the whole band over the last 20 cm, which needs a new station at
     z −1.8 so the decal can change width; on the tail panel the lens drops
     from the glass corner to the bumper line (y 0.58–0.99), narrower above
     0.8, and a small `head`-coloured glowing patch at y 0.66–0.72 is the
     reverse light (later cap decals win, so it paints over the red). The
     tail stations gain a shoulder (`xBelt` 0.95 at the end, the flare
     width at −1.8) so the lamps wrap a real corner, and a dark lower
     bumper sits under the blue one. Checked from the chase camera at two
     distances.

111. **2026-11-04 — Albion RS Hatch relofted from a low-poly Focus
     reference.** By request the whole hull was rebuilt from the
     `ford_focus_low_poly` model (Sketchfab, CC BY-ND; it lives in the
     git-ignored `context/` folder, nothing from it ships, and it is a
     first-generation "New Edge" Focus rather than the Mk2 that decision 110
     drew from, which this supersedes). The reference was measured rather
     than imported: a scratch page rendered it with three.js in flat class
     colours from four orthographic cameras and read the silhouettes back
     per centimetre (side: roof, floor and glass heights along the length;
     rear and front: half-width per height, lamp and glass spans; top:
     plan half-width), which is more reliable than binning a sparse
     low-poly mesh. Lengths were mapped at the real wheelbase onto the
     spec's axles (2.64 m; tail at z −2.0, nose at 2.09) and heights
     squashed by 12 % so the roof (1.475 in the hull frame) sits with the
     other hatches at 1.43–1.46; widths are 1:1 (0.92 flank, 0.84 belt
     shoulder, 0.60 roof: the car's strong tumblehome). What the stations
     now carry: a rounded tail in plan with a short white hatch lip; the
     hatch glass leaning ~50° from the lip to the roof with the whole
     C-pillar band painted as the tall triangular tail lamp beside it (one
     `sideDecal`, u 0–1, replacing the Mk2 lamps and the tail-panel lenses,
     which are gone since the reference's tail face is plain); a thick
     C-pillar, two door windows about a B-pillar, a fast 0.76 m windscreen
     to a low cowl, a sloping bonnet and a nose that rounds off over its
     last 30 cm with the triangular headlamps painted as glowing deck
     decals wrapping from the nose onto the wing tops, plus grille slot,
     white band and dark air dam as nose cap decals. No box flares (the
     reference has none; the blue arch lips stay). The rally dressing is
     unchanged in kind and re-seated on the new surfaces: the works livery
     through the same stripe band and roof colour, the four-lamp pod on the
     nose slope, the black wing on the hatch glass, mirrors at the door
     front, number plate, splitter, tow strap, lime fog lamps and diffuser.
     The interior spec moves its cowl, screen top, roof and rear wall to
     the new stations. Checked in chase, cinematic side and three-quarter,
     isometric and interior views.

112. **2026-11-04 — Mulsanne LM Prototype, a 1970 Le Mans coupé.** By
     request, a car between the truck and the buggy modelled on a 917K from
     the `porsche-917K` references (a Sketchfab model, CC BY, in the
     git-ignored `context/` folder, plus five photos; nothing from them
     ships, the geometry is lofted from measurements). The model was read
     the same way as the Focus (decision 111): three.js renders in flat
     class colours from four orthographic cameras, silhouettes read back
     per centimetre; the plan scan had to be re-run with the length axis
     vertical after a first pass measured the frame. Lengths and widths are
     1:1 (4.2 × 2.1 m, 2.3 m wheelbase, 0.31 m tyres); heights are real too
     since the car is only 0.92 m tall, so its body group stands at the
     ground plane instead of the −0.1 the other bodies use. One loft cannot
     carry a narrow bubble on a wide deck (its top is flat across), so the
     body is two hulls: the shell (thin nose lip, fender tops, a cowl that
     dips to 0.58 m under the cockpit, a long 0.82 m tail deck ending in a
     Kamm lip, the floor sweeping up from 0.1 to 0.72 m behind the rear
     axle so the engine bay shows under the overhang) and the canopy (floor
     2 cm under the shell's top so it grows out of it; windscreen from the
     0.54 m screen base over 0.7 m to a 1.02 m roof, side glass over the doors, a painted
     fastback fairing down to the deck). The cowl dip is also what makes
     the interior work: the shell's top is solid, so the cabin floor sits on
     it (`floorY` 0.88 in the cabin frame) and the cabin frame rises so the
     eye is 0.86 m up and the dash top 0.74 m, both above the 0.58 m deck; a
     first pass with a 0.7 m deck under the cockpit showed the deck's
     outside filling the driver's view with the dash buried beneath it.
     The flank bulges to its widest at the 0.5 m belt; the stripe band
     `[0.4, 0]` split blue over orange paints the orange sill stripe along
     the bottom 20 cm, the nose face and nose top are orange cap and deck
     decals, and the orange centre stripe is a deck decal over both lofts.
     Tail fins are `Prism` wedges on the deck edges with trimmed flaps
     between, lamps in housings under the lip, a dark bay wall with the
     gearbox lump, two frame diagonals a side and twin exhausts; headlamp
     covers are glowing deck decals on the fender fronts with the radiator
     slot between; louvres behind each wheel; the fan on the deck; mirrors
     on the fender tops; white roundels on the doors (with a seven-segment
     "2" of thin boxes), nose and rear deck; an orange chin splitter. Spec:
     800 kg, cg 0.38 m, 1.6 m track, 560 N·m on the rear axle through five
     gears, drag 0.45, springs 520/26, shared grip; `cabinDrop` −0.28,
     `cabinForward` 0.45. Price 29 000, tagged `special`, so three one-offs
     now close the list (the garage test's last-two check became last
     three). Period dash, sequential lever, blue cage and lining, orange
     harnesses. Checked in chase, cinematic, isometric, showroom and
     interior views.

113. **2026-11-04 — Le Mans coupé: finer arches, a tinted screen, a shallow
     dash.** Three requests against the 917K references. The loft cut every
     arch with the same nine-station table, which left the big open arches
     of a wide, low body visibly eight-faceted; `WheelWells` gains
     `segments`, and when it is set the well stations are cosine-spaced
     (`−cos(kπ/n)`), which keeps the facets even along the arc the way the
     old table did by hand; the coupé asks for sixteen, every other car
     keeps the default. The photographs show a pale, almost clear
     windscreen over dark blue door windows, and the hull had one glass
     colour; `HullColors.screen` now paints the glazed top faces (screen and
     rear window) separately from the side glass, defaulting to `glass`, so
     nothing else changes. In the cabin the dials were inside the dash
     slab: with the binnacle pushed 0.34 m forward to clear the small
     wheel, the dash's 0.3 m depth put its face 20 cm behind the dial
     faces, which were buried in it beside the steering column; the dash is
     now 0.145 m deep so the dials stand 4 cm proud of its face as on the
     other cars, and the hub rises to 1.0 (cabin frame) so the rim no longer
     dips under the deck the cockpit floor sits on. Two hull tests cover the
     new fields.
     A follow-up pass by request, against three pieces of reference art of
     the car (front, top and side): the door roundel is a single "2" on a
     smaller disc mid-door toward the rear wheel, in a group at the flank's
     width, centred on the upper flank plane and tipped 0.2 rad inward with it so it neither stands
     proud at the top nor sinks at the bottom (the first one, at the door
     front, rose above the low body); the screen is a dark blue tint like
     the door windows (`#1f3b52`), since the pale first try read as no glass
     at all; and the binnacle moves back from 0.34 to 0.25 m forward with
     the wheel rake eased to 0.3, because with the dash face at
     cowl − depth the dial faces were still 4 cm inside the slab (the
     hood-to-face test allows a hood anywhere ahead of the face, so it had
     not caught it); they now stand 5 cm ahead of it.
     Then, against two photographs and a side illustration: the arch
     openings read as slots because the skirt's bottom edge (0.1 m) was far
     below the axle (0.31 m), so each semicircle ended in a 0.2 m vertical
     drop; the skirt now ends at 0.2 m (the stripe band `[0.3, 0]` keeps the
     orange on its bottom 15 cm) and the wells are centred on that edge
     with a 0.43 m radius, so the opening is one semicircle from sill to
     sill with 10 cm round the tyre, in sixteen facets. The roundel moves to
     the middle of the door (z −0.05) as in the photographs. The headlamps
     are no longer cream rectangles: each cover is three dark-glass deck
     patches stepping narrower toward the nose, a teardrop in plan, with two
     round cream lamps in dark bezels lying on the nose slope inside it,
     the upper one outboard and the lower inboard.

114. **2026-11-04 — Le Mans coupé relofted from cross-sections, with a
     shoulder crease.** By request the whole body was rebuilt closer to the
     reference model (the linked Sketchfab 917K cannot be downloaded here;
     the GLB already in `context/porsche-917K` is the same car) with more
     faces. Silhouettes were not enough: the loft's accuracy depends on
     per-station widths at several heights, so a scratch script now slices
     the reference's shell triangles (vertices, edge points and centroids)
     into 10 cm length bins and 5 cm height bands and prints the outer
     half-width of each, plus the same for the glass. The sections show a
     flank that stands near vertical from a 0.1 m skirt to 0.6–0.75 m and
     then rolls over a rounded shoulder into the deck, which one plane
     between belt and roof edge cannot carry; `HullStation` gains an
     optional `shoulder`/`xShoulder` crease between them (once any station
     names one, every station gets the point, interpolated or at the
     midpoint of belt and roof; not for hulls with `sideDecals`, whose
     across-the-band fractions assume one band), and a test checks the
     named crease is a hull vertex. The shell now has 27 stations read
     straight off the sections (thin nose lip; fender tops at 0.74 m over
     the front wheels with the bonnet dipping between them; the belt at
     0.35 m where the doors are widest, 1.0–1.03 m across; the deck
     climbing from 0.65 m at the doors to 0.9 m over the rear fenders; the
     lower body narrowing and lifting behind the rear axle over the open
     bay) and the canopy nine, as a dome (base 0.52 wide, shoulder 0.45 at
     0.82 m, top 0.27 at 1 m) whose windscreen spans five stations: since
     the loft glazes a top face only where the roof meets the belt, the
     canopy's roof colour is the dark screen tint and deck decals paint the
     real roof blue (with the orange stripe) from the screen top rearward.
     Arches are semicircles centred on the skirt's edge (0.2 m, radius
     0.45 m, sixteen facets) so no vertical drop remains; the door roundel
     sits mid-door at 0.42 m on the near-vertical lower flank; the round
     lamps lie on the shoulder plane of the nose, tilted in two axes. The door tops run 7 cm under the measured 0.65 m: at full height the deck's outside rose into the driver's view again (decision 112), and with the eye a hand under the 1 m canopy roof the lining dropped into it, so the cockpit deck is 0.58 m and the cabin frame sits with the eye 0.84 m up, the floor on the deck, the dash top 0.72 m and 16 cm of headroom under the 1 m roof. Checked in chase, cinematic, isometric, showroom and interior
     views.
     A further pass against a front photograph: the nose is nine stations
     spaced 5–10 cm apart whose shoulder runs a few centimetres under the
     top, so lip, bonnet and fender fronts read as one curve instead of
     facets; each headlamp pair sits in a single dark cover with two flush
     round lamps and no bezels; the side roundels are plain discs (the
     seven-segment digit is gone); and the rear-deck roundel moves forward
     to z −0.65 beside the cockpit, where it no longer sits over the
     gearbox lump seen from the chase camera, the fuel caps moving back to
     z −1.2 to make room.
     And the orange band now reaches the skirt everywhere: it was a stripe
     band 0.2 m under a belt that climbs over the rear fenders, so blue
     showed between the sill and the stripe behind the doors; the band's
     bottom offset now overshoots the sill (it is clamped there) and the
     rear stations hold the belt at door height, with no band at all on
     the tail stations where the lower body is the open bay.
     Front end against the museum photograph: the nose is now ten
     stations whose plan widths follow an ellipse (0.3 m across at the tip,
     0.52 a centimetre back, 0.88 at 15 cm) over a bullnose lip; the orange
     chin covers the nose top and climbs the fender fronts outboard in two
     steps toward the lamps; a wide dark radiator mouth sits low on the chin
     with a brake-duct slot either side; a white number plate lies on the
     bonnet between the lamps over the stripe (the nose roundel is gone);
     each lamp cover is three stepped dark patches, an oval in plan, with
     two cream lamps in chrome torus rings, the upper inboard and the lower
     outboard, lying on the slope in two axes; a small orange-white-orange
     roundel sits on each fender top; the slab splitter under the nose is
     removed, the lip itself being the chin.
     Two more requests: the headlamps are now just the dark covers, five
     stepped trim patches forming a tall oval on each fender front like the
     reference's recesses, with no lamps or rings; and the driver's view
     showed the deck and its orange stripe inside the cabin, because the
     cabin walls (half-width 0.62) stood outside the canopy's 0.52 m base,
     whose back-face-culled sides let the deck show through, and the cabin
     floor lay in the deck's plane. The canopy base is now the measured
     0.62 m door-sill width with the walls at 0.6 inside it, and the
     cockpit deck sits 2 cm under the floor (0.56 m).
     The bonnet still showed past the dash's end: the dash stood at the
     fender-top station (0.74 m, above the 0.72 m dash top), so the cowl
     moves back to the 0.6 m deck (`cowlZ` 0.5) and the fender tops ease to
     0.68 m.
     And the deck is held at 0.56 m all the way from the seats to the dash
     bulkhead (it had risen to 0.62 m just ahead of the seats, poking
     through the 0.58 m cabin floor as a blue patch in the footwell).
     Then by request the number plate went (it read as a grey block on
     the shaded bonnet) and the lamp covers became true ovals: a decal can
     only step along the loft's faces, so each cover is now a thin
     elliptical disc (a 28-sided cylinder scaled 0.15 × 0.24 m) lying on
     the fender front, tilted with the slope in two axes.
     Last, by request, the dark radiator mouth and duct slots are gone so
     the chin is solid orange, and the white bonnet roundel is back on the
     nose slope.
     The two deck roundels are then seated properly: the bonnet disc is
     smaller (0.2 m), tilted to the slope at its centre and sunk a
     centimetre so its ends lie flush on the convex top instead of standing
     off it, and the rear-deck disc is tilted 0.25 rad to the deck's climb
     toward the tail, which had been cropping its rear half. (Sinking the
     bonnet disc let the stripe decal show through it, so it sits flush at
     its centre instead, at 0.18 m so the convex top barely leaves its ends.)
     The small orange-and-white roundels on the fender tops are removed by
     request.
     The arches then went back to the axle: centred on the skirt's edge
     with a 0.45 m radius they left 14 cm of air beside each tyre and read
     as long straight runs, so they are now centred on the axle at
     0.35 m (4 cm round the tyre) in twenty facets, and the skirt's edge
     rises from 0.12 to 0.18 m so the drop from each arch end to the sill
     is 13 cm rather than 19; the loft cannot wrap the body under the axle
     beside the tyre, which is what a 917's skirt really does.
     By request the arches now follow the saloon's recipe rather than a
     free-standing fender: the loft's well (tyre + 7 cm, twenty facets)
     under a rounded half-torus `ArchLip` in the body colour, whose 5 cm
     tube sits on the cut edge and reads as a curved fender rather than a
     faceted hole. The front stations also gained real fender humps: there
     the shoulder crease stands above the roof edge (0.7 m at x 0.9 against
     a 0.56–0.64 m bonnet between), which is the car's own shape and keeps
     the 0.66 m arch top under the fender instead of breaking through the
     low cowl the cabin needs.
     The fender humps were a mistake: with the shoulder above the roof
     edge the well's inner wall rose through the bonnet beside each mirror
     and the well showed from above. They are gone; the front stations
     carry the fender tops at 0.7 m again, clear of the 0.69 m arch, and
     the cockpit's sightline problem is solved the other way, with a dark
     toe-board (a box 0.5–0.63 m high across the footwell under the screen
     base) that hides the wells and the rising bonnet from the driver's
     seat while the shell and canopy hide it from outside. The nose
     stations' belts rise to 0.29–0.42 m so the orange band covers the
     whole lower nose up to the lamp line again, as asked.
     Two more: the nose-side stations' belts rise to the shoulder
     (0.49–0.58 m at z 1.48–1.68) so the blue triangle between the orange
     chin line and the front fender is orange; and the deck ahead of the
     cockpit climbs from 0.6 to 0.66 m over the toe-board (itself narrowed
     to 1.08 m and shortened to end under the screen) because the board
     had shown as a dark block beside each mirror from above.
     The toe-board's corners still rose outside the canopy's narrowing
     base as black triangles at the screen's foot, so it is 0.88 m wide
     (inside the canopy's shoulder line) and the deck beside the screen
     comes up to 0.62–0.64 m; and the orange on the nose top reaches back
     to z 1.85, with its outboard steps to 1.6, so no blue is left under
     the lamp line.
     The toe-board kept showing one way or another (too wide and it rose
     outside the canopy's narrowing base; narrow enough to fit and the
     deck showed beside it in the footwell), so the cabin floor now sits
     6 cm over the deck instead of on it: the cabin frame rises 4 cm (eye
     0.88 m), the canopy roof 3 cm (1.03 m) to keep 15 cm of headroom, the
     deck beside the screen runs at 0.6–0.62 m under a 0.62 m floor, and
     only a short board at the foot of the screen (z 0.8–0.94, 0.88 m wide,
     inside the canopy's shoulder line) hides the last rise to the cowl.
     Blue wedges remained on the lip between the orange band and the
     orange top: the loft's side bands above the belt. On the lip stations
     (z ≥ 1.95) belt, shoulder and roof edge now coincide at the top
     corner, so the flank is a single orange band to the edge and the top
     decal takes over from there.
     With the lip raised, the orange clipped the forward-outboard edge of
     each lamp disc; the discs sit 2.5 cm higher, 2 cm further inboard,
     a little shorter and tipped 0.3 rad with the fender roll.
     Raised clear of the orange, the thin discs then stood off the fender,
     since a flat face cannot lie on a doubly curved surface without
     floating at one edge or clipping at another. Each cover is now a 5 cm
     deep pod sunk into the fender: its face sits a hair above the crest
     and its dark wall fills the gap where the surface falls away, so it
     reads as a recessed lamp flush with the body.
     Both of those were then reverted by request (the lip geometry and
     the pods), and the blue wedges are handled as paint instead:
     `HullStation.sidePaint` colours a station's side bands (belt to roof
     edge, where not glass) toward the next station, and the lip stations
     name orange, so the chin is one colour with the shape untouched. A
     hull test covers the field.

115. **2026-11-05 — Le Mans coupé nose rebuilt from the reference, with
     surface-following patches.** By request the nose was recreated from
     the 917K GLB in `context/porsche_917-3d` (the same file as the
     earlier folder). A scratch script sampled the shell's triangles on a
     5 cm grid ahead of the front wheels and printed top height, bottom
     height and lamp-cover height per cell. The sections show each fender
     carrying a crown at x ≈ 0.68 m about 10 cm above the bonnet centre,
     fading into a flat lip at the tip, with the lamp covers lying on the
     crowns' forward slope. The thirteen nose stations now carry that
     crown as their shoulder crease (above the roof edge, which bounds a
     lower centre plateau), and the lip stations plus the crowns ahead of
     the lamps are painted orange through `sidePaint`. Flat discs could
     never sit on the doubly curved crown, so `render/car/HullSurface.ts`
     (pure TS, tested) reads the loft's upper surface height at any (x, z)
     and builds an ellipse patch whose every vertex is lifted onto it; the
     lamp covers and the bonnet roundel are such patches, drawn with a
     polygon offset so they never fight the hull. Two loft fixes came out
     of this: `buildCarHull` now sorts its stations, because the coupé
     lists them nose to tail and interpolated stations (wells, decal
     edges) had been sampling the wrong segment, and a test pins that both
     orders give the same mesh.
     The cooling-fan disc on the engine cover is the same kind of patch
     now: as a flat cylinder it was cut by the deck's climb toward the
     tail, and laid onto the surface it sits flush, centred on the cover.

116. **2026-11-05 — Door-card height per cabin.** In the Le Mans coupé
     the driver saw the shell's deck and fender tops through the left
     window, reading as body poking into the cockpit: door cards stop 6 cm
     under the dash top, and this car's dash is low, so its sides were
     only 8 cm tall. `InteriorSpec.doorTopY` now sets the card height
     (omitted keeps the old rule, so no other car changes) and the coupé
     uses 1.06 in the cabin frame, 8 cm under the eye, a high-sided
     cockpit like the real car's. The cards are drawn in the interior view
     only, so standing outside the canopy above it costs nothing. The door
     pull strap is held at least 5 cm over the floor (it had been sitting
     under it on low cabins), and the interior test checks every cabin's
     doors clear the floor and stay under the eye.
     The glitch the request meant was a thin blue line on the cabin floor
     beside the wheel. Its colour was the canopy's side glass: the
     canopy's lower wall leans inboard of the door cards just above the
     floor and, seen almost edge-on from the seat, some of its faces turn
     toward the eye. The canopy now rides in the cabin group, which the
     interior view hides (from the seat its glass is culled anyway and the
     cabin's own lining and pillars stand in for it). On the way, the
     shell's deck was found climbing to 0.65 m behind the seats, above
     the 0.62 m floor; it is now held at 0.59–0.6 m back to the seats'
     bulkhead (a new station at z −0.32), and the toe-board reaches 5 cm
     further back over the last rise. The taller door cards stay: they
     also stop the deck showing through the side window.

117. **2026-11-05 — Circuit races: procedural closed tracks with kerbs and
     guardrails.** By request, a new stage type inspired by the
     Nürburgring, Le Mans and Monza; with the user it was settled to put
     circuits in the normal rotation, race fixed laps on total time, and
     generate layouts rather than copy three. The pipeline assumed a
     one-way road throughout (the heading clamp, clamped sampling, a single
     finish, one pass through the gates, a non-cyclic road profile), so the
     approach keeps one lap of geometry and unrolls only the race:
     `RoadPath` gains `closed` (the last sample is the first, `sample` and
     `wrap` go round the lap, seam headings look across it) and
     `fromClosedPolyline`; terrain, road mesh, scenery and nearest-point
     queries then work on one lap unchanged, and the gates repeat per lap
     (three sector checkpoints and a `lap` gate on the line, the last
     crossing a `finish`) with distances that keep counting, so the tracker,
     the progress bar and the splits behave as on a long open stage.
     `StageRun` unwraps a lap position against the last gate passed, counts
     laps from the lap and finish gates, records the driving time at each
     gate so a replay knows which lap it is on, and offsets lap timing by
     the gates a `?spawn=` start skips. The generator (`CircuitGenerator`):
     a style (Ring, Sarthe, Park) and a target lap from the seed, a
     star-shaped polygon (monotonic angles round a centre, so it cannot
     cross itself) with jitter, inward dents and a stretch, each vertex
     filleted into an arc whose radius follows its sharpness and the style
     (set pieces: the Sarthe's slow hairpin after its long straight, the
     Park's long sweeper onto the main straight), chicanes as smooth
     S-offsets on long straights (kept to the main straight's far half, off
     the grid), resampled closed from the start of the longest straight;
     validated on length, a 12 m minimum radius and 90 m between stretches
     more than 200 m apart round the lap (60 m let two stretches' flattened
     corridors overlap and step the ground between them), with retries and
     a rounded-rectangle fallback; 300 seeds needed no fallback, at about
     1.3 ms a layout. Stages: `isCircuitStage` (index ≥ 7, index % 6 = 1)
     gives the `circuit` region in `stageRegion` without touching
     `REGION_CYCLE`, clear of every index the tests and the open-road
     fixture pin and of the town stages; the brief keeps its five draws in
     order (fixture untouched) and draws the layout after them, so the
     stage list knows a circuit's length (three laps) and par (race length
     at 20 m/s × the tarmac factor, plus 4 s for the standing start). The
     trackside (`CircuitTrackside`, memoised per stage, pure) comes from
     the lap's curvature: kerbs under 150 m radius, gravel traps on the
     outside of 40–150 m corners, barrier offsets per side (wider runoff on
     outsides, held inside 0.7 × the radius on insides so the line never
     folds), catch-fence flags, the grandstand's footprint; `TerrainField`
     multiplies the relief by the style's, flattens out past the outermost
     barrier, smooths the road profile cyclically (`RoadProfile.ts`), lifts
     wheels 3 cm over kerbs and reports tarmac, gravel or grass;
     `SceneryScatter` keeps props past the barriers and off the stand;
     `StageWorld` adds 4 m barrier boxes as colliders (hits use the
     existing penalty). Rendering: `KerbBuilder` (chamfered kerb bands
     striped per sample, gravel bands), `BarrierBuilder` (a two-part W-beam
     on posts, catch fence wires and posts, no transparency),
     `CircuitDressingBuilder` (chequered line, grid slots, stepped
     grandstand seated on the ground), all over a small `TrackMesh` soup,
     each behind a `StageRenderOptions` flag (`kerbs`, `barriers`,
     `catchFences`), coloured by a new `CircuitTheme` (Nightcity has its
     own); `GateBuilder` draws one chequered gantry and the first lap's
     boards; verge posts are skipped. The HUD shows "Lap n/3" and the best
     lap, the result panel lists the laps, the Game panel reads "3 laps ·
     1.9 km", the stage list gets a circuit glyph; a circuit pays 0.6 of its
     distance's worth (`CIRCUIT_PRIZE_FACTOR`). Saves go to version 3, which
     drops records set at circuit indices (they were for a different road).
     Verified with two new unit suites, a live drive across the line
     (Lap 1/3 → 2/3, the bar carrying on across the seam) and screenshots of
     the grid, a hairpin's kerbs and gravel, the fences and the stand.

118. **2026-11-05 — Race asphalt: more grip and a planted rear on
     circuits.** By request, circuits now slide less. They get their own
     surface, `track` (appended to `SURFACE_LIST` so the surface indices
     stored in replays keep their meaning), with grip 1.25 against
     tarmac's 1.0 and a new optional `SurfaceProps.rearGrip` of 1.5 that
     multiplies the rear axle's grip cap on top of the built-in understeer
     bias (the skid-mark thresholds read it too). Grip alone was measured
     first and was not enough: with the vehicle harness, braking at 0.6
     into a full-lock corner from 90 km/h still swung every car's tail out
     to a 75° peak drift angle on both surfaces, because that rotation
     comes from braking load moving forward and the rear brakes spending
     the rear tyres' grip, not from the friction limit. A sweep of the
     rear factor showed a threshold: 1.2 barely helped, 1.35 calmed the
     Focus and the Le Mans coupé but not the starter hatch, 1.5 held all
     three (peaks of 21°, 7° and 7°, from 77°, 75° and 75°). It costs no
     turning: at that setting hairpin radii at 12 m/s shrink by 3–17 % and
     peak sweeper grip rises 10–26 % (1.19 → 1.50 g on the hatch). Kerbs
     stay plain tarmac, so riding one is a touch looser than the track.
     Par on the new surface uses a pace factor of 1.2 (tarmac's is 1.12),
     the prize difficulty stays at tarmac's 1, the road shade is a hair
     darker than tarmac's, and the surface reads "Race asphalt" in the
     Game panel. A sim test pins it: on race asphalt every car corners
     over 15 % harder and peaks under 40 % of its road-tarmac drift angle
     braking into the corner.

119. **2026-11-05 — Circuits every tenth stage.** By request the circuits
     are rarer and always alone in the rotation: `isCircuitStage` is now
     `index % 10 === 9` (stage 10, 20, 30, …; `CIRCUIT_EVERY`) instead of
     every sixth from the eighth, so there are nine rally stages between
     one circuit and the next. Every tenth stage is still clear of every
     index the tests and the open-road fixture pin; it does land on some
     town stages (index 29, 59, …), which simply become circuits, since a
     circuit's region builds no town. The v2 → v3 save migration drops
     records at the new circuit indices. Decision 117's rule and its
     index-7 examples are superseded; the tests moved to seed 6, index 9
     and assert one circuit per ten stages, never two in a row, never with
     a town.

120. **2026-11-05 — Coast stages draw their own character.** Playing them
     felt repetitive, and a probe of 88 stages over four seeds showed why:
     every coast had the same road signature (16–28 % of its length on
     bends under 50 m, 26–37 % on 50–120 m sweepers, 8–11.5 corners/km),
     where Forest, Alpine and Desert spread from 25 % to 51 % tight and 19 %
     to 57 % near-straight. `CoastShape` always put the land on the left of
     travel (the stage heading only rotated the map), its shore used one
     pair of fixed meander amplitudes and wavelengths, and the difficulty
     loop's twistiness never reached `buildCoastRoad`. Now `CoastShape`
     draws, after the axis and the noise so those keep their streams, a
     `side` (the left axis flips, so `v` always runs toward the land and the
     whole stage mirrors; `CoastRoad`'s inland normal follows `side`, which
     turns the stacks right then left), a bay wave of 0.75–1.7× the
     reference wavelength with an amplitude of wave^1.5 (so the long bays
     are deeper but gentler, capped at 120 m), and a headland "chop" that
     sets the short meander's frequency (0.8–1.7×) and holds its curvature,
     amplitude × frequency², at 0.5–1.5× the reference. The loop (0 to 1
     over loops 0–4, as `reliefAmplitude` caps) raises that curvature by up
     to half again, biases the chop jagged and takes up to 4 m off the
     hairpin radius. Both `CoastShape` callers (the road in `generateStage`,
     the ground in `TerrainField`) pass the stage's loop, so they still
     agree. Result over 70 coasts on seven seeds: 7.9–19.4 corners/km and
     9–33 % tight, the sea on either hand, later loops twistier; the
     existing grade, kink, wall, beach and scenery tests pass unchanged, and
     new ones pin the mirroring, the spread and late-loop grades. Every
     Coast stage's road changed, so the v3 → v4 save migration drops their
     records, as v2 → v3 did for the circuits. Road-shape set pieces (a
     beach-level stretch, a cut across a headland, a coast harbour village)
     and coast weather remain options for later.

121. **2026-11-05 — Coast terrain detail: limestone cliffs and a grassy,
     gullied hillside.** By request the coast's land should read as rock at
     the cliff and as hilly grass with rock faces and gravel inland. It was
     a regular staircase of 4 m terraces coloured one tan, and with the
     tilt threshold at 37° the road cuttings and terrace risers made broad
     brown faces. Shape (`CoastShape.ground`): the cliff's terraces get a
     per-stretch period (0.75–1.25×) and a phase that wander along the shore
     (`strata`, which starts at 0 so the foot stays continuous), a rib term
     that steepens buttresses and slackens gullies by ±35 % of the grade, a
     ridged crag term faded to nothing at the foot and the lip, and a
     boulder apron over the beach's landward 45 % carried 3 m onto the
     lowest ledge so the foot has no step; mid-beach is untouched, which
     the sand test pins. The hillside gets hummocks (1.3 m, plus a 0.25 m
     octave: a 0.5 m one made a third of the 2 m faces steeper than 40°),
     downhill gullies ((1 − |noise|)⁴, 2.2 m, deepening inland), outcrop
     scarps with a wandering step phase and crags, and a domain-warped
     two-octave outcrop mask tightened from about 26 % of the slope to about
     13 %. Colour: `CoastShape.surface` returns rock, scree (apron, fans 7 m
     below outcrops, gully beds, patches) and dry-grass masks in one pass,
     carried on `TerrainSample` to the mesher, and `coastFaceColor` (its
     own module, no per-face allocation) mixes dry grass and scrub dots into
     the grass, scree from 46° of tilt and rock from 60° (lower thresholds
     turned 40–50 % of the gullied hillside grey), then limestone strata by
     height with sine warps, lit ledges and ledge plants. Per-face tone
     jitter stays at ±6 % and stones at 10 % of gravel faces: wider ranges
     read as triangle confetti. New `CoastDef` tones carry the strata,
     scree, dry grass and scrub; the coast palette's rock moves from tan
     (#b8906f) to a limestone body (#ad9e89). A test meshes hillside and
     cliff chunks and pins 55–90 % green inland, over 3 % gravel and over
     85 % bare cliff faces; measured 65 %, 10 % and 91 %.

122. **2026-11-05 — Grey coast limestone and a cooler coast sky light.** By
     request, with a reference of pale grey sea cliffs over bright grass,
     the coast's rock moves from tan and ochre to greys: body #c4c6c3,
     light #e4e5e0, a cool dark #949ba2, a faint warm bed #d9d2c0 (the
     `ochre` tone renamed `rockWarm`), scree #cdccc4 and boulders #bcbfbd;
     dark and warm beds drop to 14 % and 12 % of the strata, and the cliff
     ledges take tufts of the palette's bright grass instead of dark scrub.
     The albedo alone was not enough: sampled in game, the shaded faces of
     the grey cliff came out olive (about rgb 110,108,74) because the day
     hemisphere light is a warm sky (#fff6e0) over green ground (#7fa05f),
     and a face turned from the sun is lit almost only by it. Coast stages
     now override it (`COAST_HEMI`: sky #e6eef5, ground #a3aa94, same
     intensity), so shadows on the rock read blue-grey as in the
     reference; the other regions keep the shared day lighting, and the
     theme test pins both.

123. **2026-11-05 — Back to the system bars on mobile (revert of 109).** By
     request the game no longer takes over the phone's screen: the native
     status and navigation bars stay visible, as with any app. The manifest
     is `display: 'standalone'` again (no `display_override`), the Drive tap
     no longer calls `requestFullscreen`, `GameShell` no longer exits it,
     `lib/fullscreen.ts` is gone, and the mobile e2e test no longer expects
     `document.fullscreenElement`. `viewport-fit=cover` and the HUD's
     safe-area padding stay, so the layout still clears notches and bars.

124. **2026-11-05 — Urban stages: a city as a whole-stage town.** By request,
     a new stage type: a procedural big city with streets of more than two
     lanes, right-angle corners, irregular streets, changes in elevation,
     roundabouts and tram tracks. The village machinery already had the
     hard parts (plan legs laid as explicit arcs by the centreline builder,
     junctions with blocked side streets and exact kerbs, facades, terraces
     stepping down hills, per-sample widths, pavements the wheels feel), so
     a city is a `TownDef` that spans the stage rather than a new pipeline:
     `planUrban` (`UrbanPlan.ts`) draws a `TownPlan` from the first control
     step to past the run-out (blocks of 60–160 m ending in right angles,
     60°–120° skews or 15°–35° kinks, avenue arcs, per-block lane widths,
     roundabouts), so `buildCentreline` lays it with `twist` 0 and the
     open-road walk never resumes; `layoutTown` takes the region's
     `UrbanDef` and adds the city's pieces through hooks in
     `UrbanGenerator.ts`. Choices along the way: a `TownLeg`/`Junction` may
     carry its own corner `radius` (`cornerRadius(turn, radius)`), since the
     fixed 10/12 m village arcs fold a 14 m boulevard; kinks under 45° bend
     the route without a junction, because a 20° wedge sends the kerb
     fillet maths to infinity; the stage's base half width is the boulevard
     (7 m) and every narrower street a narrowing, because `buildWidths` only
     narrows and `surfaceAt` searches the base width; a wide street's cones
     stand beyond its junction's surface (`coneDistance` ≥ `hw + 9`);
     crossroads go in every ~75 m on blocks of 110 m and over; checkpoints
     on a whole-stage town are nudged ≥ 25 m off every junction and ring and
     sized to the street under them (`halfWidthAt`), since the village rule
     would have pushed every board out of the town. Roundabouts are three
     consecutive curve legs (28° right deflection on 20 m, a left circulation
     of 56° for straight on or 146° for a left turn round an 8–11 m island,
     28° right off), the circulation tagged so the layout can find the
     island: the undriven ring is laid as chord streets shorter than
     `hw + JUNCTION_REACH` (so the terrain decks them at the route's level
     and `TownStreetBuilder` draws nothing for them), exits are ordinary
     stubs from the ring's outer edge (their plates start at the ring,
     `cutOf` → 0), the island is a `TerrainPad` a kerb up with a tight blend,
     the inner facade skips the arc (`islandGap`) and `site.clear` keeps
     houses off the ring, and `UrbanField.tame` levels the ground to the
     centre's height for 30 m beyond the ring (blending over 40 m) inside
     `groundHeight`, where the road profile is built from, so ring, chords
     and island share one height (a pad could not do it: pads are applied
     after the profile). The ribbon hands its island-side verge over where
     the undriven ring joins (`roundaboutOpenings`, merged into
     `RoadBuilder`'s openings) and `RoundaboutBuilder` draws the ring's
     tarmac under the ribbon, the kerbs, lines and the grass disc. Trams
     (`Tram.ts`) are straight lines from stub end to stub end through a
     crossroads, or down a boulevard's middle and on into the side street
     that continues it, drawn by `TramTrackBuilder` and felt through
     `UrbanField.lift` in `heightAt` only (2 cm, felt 15 cm wide so a 120 Hz
     step cannot skip a rail; the mesher samples `sample`, so nothing is
     meshed), grip untouched, as agreed with the user. Lane markings live
     in their own `LaneMarkings` builder (RoadBuilder's continuous strips
     cannot dash). Two building styles, `block` and `office`
     (`UrbanGeometry.ts`), with per-`Site` style weights. Relief: a city
     keeps 16 m of the hills (`TownDef.relief`, bypassing the village's 40 %
     cap). Six seeds build in 60–140 ms with 15–25 junctions, 320–390
     buildings, one roundabout and 2–5 tram lines, at 12–17 m of relief on
     the 12 % grade limit, verified by the `urban` suite and screenshots of
     a boulevard, a roundabout, a tram crossing and Nightcity.

125. **2026-11-05 — A fifteen-stage cycle with three cities, saves at v5.**
     With the user it was settled to grow `REGION_CYCLE` from twelve to
     fifteen with Urban ×3 rather than a cadence or a swap. The order
     (Forest ×2, Alpine ×2, Coast, Forest, Urban, Desert, Alpine, Desert,
     Urban, Coast, Urban, Coast, Desert) keeps stage 1 Forest, stage 4
     Alpine and stage 5 the first Coast as before, gives every region three
     of fifteen, never three alike, puts villages on Alpine, Forest, Alpine
     at cycle indices 2, 5, 8 (three of the five town slots, against two of
     four before), and keeps the cities off cycle indices 4, 9 and 14, which
     the circuits (every tenth stage) overwrite on alternate passes; the
     plan's first order put two of three cities there and would have shown
     one city in thirty stages. From stage 7 on many indices are another
     region's road, so `migrateV4` embeds the old twelve-cycle and drops
     records at every non-circuit index whose region differs (the earlier
     Coast migration now compares against that constant too). The
     open-road fixture's two later-loop keys moved to `5/16` and `13/18`
     (forest and alpine in the new cycle), the Desert tests to index 7 and
     the town-index desert to 14.

126. **2026-11-06 — City streets of one width, boulevard medians, longer
     side streets, roundabouts joined cleanly.** By request after playing
     the first cities: streets changed lane count along their length (the
     village `buildWidths` holds a junction's narrower width through it and
     tapers over 24 m beyond, right for a hill town, wrong for a grid), the
     boulevards had no divider, the 32 m side streets closed by a building
     read as a wall a few metres off the route, and the roundabout's outer
     kerb and pavement were drawn across the roads joining it (the band ran
     round the whole undriven sector while the deflection arcs cross it for
     ~20 m either side of the route's arc). Now `traceWidths` gives a city
     its per-sample widths from the traced legs (`TownDef.widths`, used by
     `StageGenerator` in place of `buildWidths`): each straight its own
     width, each corner or curve a smoothstep from the previous leg's to the
     next's, so a lane count changes only through a junction arc or a
     roundabout's deflections; villages keep `buildWidths`. `cityMedians`
     lays a `Median` (new `Median.ts`: 1.8 m, kerb high, `medianLift` felt
     like a pavement through `UrbanField.lift`) along every four-lane
     straight from 6 m in to 6 m out, broken round each crossroads by its
     `junctionReach` + 3 m and never in the first 70 m of road (the spawn and
     the start gantry stand on tarmac); `MedianBuilder` draws grass between
     two 35 cm sidewalk strips with kerb faces all round, `LaneMarkings`
     skips the centre line on a median, and `TramTrackBuilder` now sets each
     section on `heightAt` along the track's axis with a 4 mm bed (no painted
     line ever runs under a tram). The tram lines that ran down a boulevard's
     middle are gone: a 2.6 m tram bed cannot share a 1.8 m median, so trams
     only cross the route now, at up to five crossroads.
     `StubSite.full` replaces the fixed `STUB_LENGTH` in the side-street
     fitting (`clearLength`, `splitLengths`), with a distance pre-check so
     80 m city streets (`CITY_STUB_LENGTH`, via `Site.stubLength`) across
     ~60 stubs fit in tens of milliseconds; a city now has 550–770
     buildings. Roundabouts: `roundaboutOpenings` walks the route back and
     forward from the arc to find exactly where the ribbon's island-side
     verge lies over the ring, and `routeCuts` walks it to find where the
     route crosses the outer band, which `RoundaboutBuilder` breaks there as
     it does round every exit; the ring's tarmac stays one annulus under
     everything.

127. **2026-11-06 — Wider pavements that are concrete to the tyres; lawn
     between a city's streets.** By request after a screenshot of a
     roundabout whose surroundings read as one huge faceted pavement. The
     cause was the Urban palette's `shoulder` (the colour the terrain mesh
     paints inside the road corridor's flat margin), set to pale concrete:
     between a ring, its exits and the route the flat margins merge into one
     patch and the terrain's 2 m triangles showed as a pale plaza beside the
     real 2 m pavement band. The shoulder is a lawn green now (`#93ae63`),
     so the ground between a city's streets is grass and only the built
     pavements are concrete. Pavements are a metre wider everywhere:
     `PAVEMENT_WIDTH`, `FRONT_SETBACK` and the ribbon's `VERGE_WIDTH` go from
     2 to 3 m together (facades stand right behind the pavement, the ribbon's
     verge strips are the pavements in town, and the strips must still cover
     the trench ramp), which the village suites absorb unchanged since they
     read the constants. And `TerrainField.surfaceAt` reports `tarmac` on a
     pavement (`onPavement`: within `PAVEMENT_WIDTH` outside a street's
     carriageway or a junction's surface, where the town has faded in),
     where it reported the region's off-road surface before, so a wheel that
     mounts the kerb keeps tarmac grip and leaves black rubber rather than
     green grass marks and heavy drag; the medians' grass strips lie inside
     the carriageway and were tarmac already. The ring's outer kerb, pavement
     and line now break only for a crossing road's carriageway plus 30 cm
     (`CUT_MARGIN`), not its pavement as well: the road's own pavement lies
     over the band and carries the sidewalk round the corner, where the
     wider cut left grass wedges and stranded fragments of band.

128. **2026-11-06 — A city street's width changes only after a junction
     corner.** By request after two screenshots of a boulevard narrowing
     part-way along what reads as one straight. Decision 126 moved width
     changes off the streets and onto the arcs between them, but the planner
     drew a fresh width for every block, so a 15°–35° kink or a 40–90 m
     avenue curve, which look like a straight road, could join a four-lane
     street to a two-lane one. `drawCity` now keeps one width until the
     previous block ended in a junction corner (45° or more, the same rule
     that gives a corner its side streets), carries it through kinks,
     avenue curves and roundabouts (whose ring still takes the narrower of
     the approach and three lanes, on the curved deflections), and puts a
     right-angle block before the finish boulevard when the road is not at a
     junction, so the last street is a boulevard off a corner, not a
     narrowing. The medians follow, running the whole straight.

129. **2026-11-06 — Width changes in the middle of the junction; bushes on
     the medians.** By request after a screenshot of a street widening over
     its first 25 m out of a corner: `traceWidths` eased a corner's width
     change over the whole arc, and the arc's second half reads as the new
     street. A corner now changes width over the middle 40 % of its arc
     (`CORNER_CHANGE`), centred on the junction, inside the mouths and kerb
     returns, so both streets reach the junction at their own widths; a
     roundabout's deflection curves still ease over their length. The kerb
     returns traced against the ribbon take a slightly steeper taper for it
     (about 2.5 m over 9 m on a boulevard-to-lane corner), which the kerb's
     own curvature hides. `cityMedians` plants a small bush (scale under
     0.7, so it fits the 1.1 m grass strip) every 7 m along each median,
     through the village planting list, so the kits, the terrain query and
     Nightcity's dressing all apply unchanged; bushes have no collider.

130. **2026-11-06 — Rounded median ends.** By request. A median is a
     capsule now: `medianLift` measures the distance to the segment rather
     than the lateral offset within it, so the kerb the wheels feel wraps
     round each end, and `MedianBuilder.cap` draws each end as a half disc
     of grass inside a sidewalk ring behind a curved kerb face, in eight
     facets, wound by a normal check like the roundabout's bands.

131. **2026-11-06 — A roundabout's pavements from a distance field.** By
     request after screenshots of grass slivers where the exits and the
     route meet the ring's outer pavement. The band had been stitched by
     hand: an annulus cut into sectors round every road, each road's own
     pavement strip butting against it, and the concave corner between the
     two left bare, with a long thin wedge wherever the route leaves
     tangentially. A first attempt filled each corner with a hand-drawn kerb
     return and still left slivers. Now `RoundaboutPavement` builds every
     pavement of a roundabout (the island's band, the outer band and the
     kerb returns round each road) from one signed distance field to the
     union of the carriageways in reach (the ring annulus, the blocked exits,
     the route): marching squares on a 0.5 m grid traces the contour at
     `PAVEMENT_WIDTH`, and each contour vertex is projected back along the
     field's gradient onto the carriageway edge; quads between the two are
     the pavement, with a kerb face along each. The offset of a union rounds
     every concave corner by the offset, so the kerb sweeps from one road
     into the next by construction and nothing is cut or stitched; the
     roads' own pavement strips lie over this band along their lengths (a
     3 mm step keeps them on top). The edge lines keep their sector cuts.
     Render only: the wheels still feel pavements through `heightAt`'s own
     band, which this construction shadows well enough in a corner the car
     has no business in.

132. **2026-11-06 — Side streets stop short of other roads; lamps off the
     mouths; tram beds above the lines.** By request after a screenshot of
     lamp posts standing in a crossroads and a tram bed fighting the tarmac.
     The lamps were placed every 30 m along a street at its pavement line
     with no regard for junctions part-way along it (a village had none),
     and a probe for lamps without a kerb under them found the deeper fault:
     an 80 m city side street fitted only against the other side streets
     could run up to, or across, a neighbouring leg of the route (grid
     blocks are 60–160 m). `clipStubsToRoads` now walks each city side
     street out from past its own junction and cuts it (end building
     included, `STUB_END_REACH`) a metre short of the route's pavements and
     of every ring, never under `MIN_STUB_LENGTH`; a test walks every side
     street against the route. Lamps skip any spot within a junction's
     `junctionReach` plus the street's half width plus 4 m, or within a
     metre of another street's pavement, and a test checks every lamp
     stands a kerb up. The tram bed sits `LINE_ABOVE_DECK` + 5 mm over the
     surface it crosses rather than 4 mm, above the painted lines and clear
     of the junction plates' depth fighting.

133. **2026-11-06 — Roundabouts: one surface for every road's connection.**
     By request, so that every road meeting a ring joins it with continuous
     tarmac, sidewalks and white lines. Decision 131's distance-field
     pavement still left the roads' own strips (the ribbon's verges and
     lines, the side streets' plates) meeting the ring's piecemeal, the
     carriageway corners sharp and the ring's lines cut in sectors. Now the
     roads hand over: inside `handoffRadius` (the outer pavement plus 6 m)
     the ribbon's openings cover both sides for the stretch the route spends
     within it (`ringHandoff`, walked along the route), and a ring exit's
     pavements, kerbs and lines start at its `kerbCutOf` (the hand-off,
     along the street) while its tarmac plate still starts at the ring. The
     ring's surface (`RoundaboutSurface`) fills everything inside from one
     field on a 0.25 m grid: `d`, the distance to the carriageway union;
     its dilation by the pavement width as a mask; an exact Euclidean
     distance transform (Felzenszwalb) of that mask back from its edge, whose
     level at the pavement width is the closing of the union, the kerb line
     with every mouth rounded by a kerb return. Three bands follow, each a
     marching-squares contour with an offset: tarmac fillets between the kerb
     line and the raw union edge (empty except in the corners), the pavement
     between the dilated edge and the kerb line (with kerb faces along
     both), and the edge line as the contour `LINE_INSET` inside the kerb
     line. Every band is clipped at the hand-offs with an interpolated end
     vertex, so it meets the road's own strips edge to edge. Quads are laid
     as two independently wound triangles, since a band whose edges cross at
     a tight corner otherwise leaves a culled hole. The ring's tarmac disc
     and the island's grass stay as they were; the sector-cut line annuli are
     gone.

134. **2026-11-06 — Roundabout surface: exact edges, no slivers.** Follow-up
     to 133 after frames still showed grass triangles at the exits' mouths
     and a break in the white line at a hand-off. A diagnostic render of the
     computed geometry (an SVG of the bands over the carriageways) showed
     three causes. The surface's grid had been sampling the distance back
     from the dilation's edge against grid nodes, which offset the kerb line
     by part of a cell and made its contours wobble: it is now measured
     against the dilation's own traced contour, the kerb line is traced
     once, resampled to 0.4 m and relaxed, and every band is an exact
     offset of it; the fillet's inner edge is the exact nearest point on a
     carriageway edge (ring, street or route), with the raw corner between a
     street and the ring inserted where the nearest piece changes so the
     fillet fills the notch to its apex. A ring exit's tarmac plate now
     starts inside the ring (its square end stood proud of the round edge at
     its corners, where the circle curves back, leaving two slivers the
     fillet did not reach). The surface's edge lines lie 4 mm over the
     roads' own lines, which they overlap at the hand-offs, so the two no
     longer fight. The surface is confined to the hand-off disc, so a
     neighbouring junction inside the grid is left alone. And the contour
     walker now closes a loop it comes back round to: the island's kerb line
     is one, and without its closing segment every band on it, pavement and
     line, had a cut a cell wide with the ground showing through.

135. **2026-11-06 — Level ground past the pavements; junction plateaus.** By
     request after a frame of a hilly city corner: the terrain mesh (2 m
     cells) climbed straight from the pavement's edge, so its first sloping
     triangle poked up through the pavement's outer half metre as a jagged
     line, and the wedge between two side streets rose into a mound that
     buried the corner's garden walls. `TerrainField` now keeps the ground
     level `PAVEMENT_WIDTH + 2` beyond a carriageway wherever a town's
     pavements run (`TOWN_FLAT_MARGIN`, chosen per street hit so the open
     road keeps its 3 m shoulder), which puts the mesh's first slope a whole
     cell past the pavement; and `UrbanField.tame` levels the ground round
     every city junction (14 m, blending over 22 m) to the hills' height at
     its centre, as it does round a ring, so intersections sit on small
     plateaus between the climbs, the way a hilly city's do, and the corner
     wedges stay gentle. The road profile is built from the tamed ground, so
     the route flattens through each junction too; the grade limit between
     them is unchanged.

136. **2026-11-06 — Roundabout fillets over the deck.** The last patch of
     grass in a ring's tarmac: the fillet bands were laid 2 mm under the
     deck like the ring's disc, but the ground beside a carriageway sits at
     deck level (only under the carriageway is the bed trenched), so the
     terrain hid them and showed its shoulder colour in every mouth corner.
     They now lie 4 mm over the deck, under the painted lines and over the
     plates they meet.

137. **2026-11-06 — Walled corners round a ring.** The pale patch that
     stayed at a ring exit's mouth after decision 136 turned out to be the
     ground itself: the wedge between the ring's pavement and the exit's lay
     open and level, in the terrain's shoulder colour, with no wall, where a
     junction's wedges are walled and planted by `junctionWalls`. A ring's
     exits make no `Junction`, so `ringWalls` now runs garden walls along
     the ring's facade in 3 m chords (broken at every exit and the route's
     mouths, and wherever the route's own pavement runs beside the facade on
     its way in and out) and down each exit's facade lines from the ring to
     `ROW_SETBACK`, where the terrace rows begin, with a bush in each
     corner; walls collide like every other. The pavement fan at each mouth
     corner now also projects exactly onto the dilation's own contour
     (`SegmentIndex.nearest`) rather than along a grid gradient, so the fan
     meets the facade corner without a notch.

138. **2026-11-06 — The last roundabout patch: the pinch between the route
     and the ring.** Painting the terrain's shoulder magenta for one frame
     proved the remaining pale triangle at a ring was ground, and a scan of
     the hand-off disc for points inside the field's pavement band that no
     band covered found it: where the route's deflection leaves (and joins)
     the ring, the two carriageways run side by side with a gap that opens
     slowly, the closing makes that gap tarmac while it is under two
     pavements wide, but the kerb line runs round the outside of both roads
     there, so no fillet band built off it reached in. `roundaboutSurface`
     now lays a web of quads between the route's ring-side edge and the
     ring's edge along each deflection while the gap is under 6 m. Two more
     things the scan and the frames turned up on the way: for the field each
     exit street now runs on back inside the ring (a street starting at the
     ring's edge carried its rounded end cap into the mouth, and the field
     took that cap for the edge), and the pavement's outer edge snaps to the
     exact dilation contour only when that lies within a metre of the
     gradient estimate, since at a narrow gap the nearest contour point is
     the other road's. Every deck inside a ring's hand-off disc is now the
     ring's level (`UrbanField.ringLevel`) and the route profile is pinned
     across the whole disc, so the terrain mesh, the ribbon, the plates and
     the surface agree in height there. The scan (0.25 m, four seeds) finds
     no uncovered pavement-band point beyond cell-edge tolerance.

139. **2026-11-06 — Tram beds ride clear; no catenary; the island pad
     shrinks to the grass.** By request. Tram beds crossing a junction sat
     4 mm plus the line height over the deck sampled on their axis, and
     where the mouth plates and the ribbon step by a few millimetres, or a
     bed's edge crossed a kerb, the tarmac cut through them: the bed now sits
     2 cm over the painted lines and takes, at each 2 m station, the highest
     surface under its axis and both edges. The catenary poles (`tramPole`
     prop kind, its geometry and kits) are removed throughout. And the
     island pad under a roundabout, which had stood at kerb height out to
     half a metre short of the island's edge (3 mm above the island's
     pavement band, so the ground poked through it as a pale sliver and a
     crease), now covers only the grass core inside the band.

140. **2026-11-06 — A round island: the ring arc keeps the ring's width.**
     By request after the island's kerb still showed a notch at the route's
     join. A trace of the route's inner edge against the island radius found
     the cause in `traceWidths`: a curve leg eases between its neighbours'
     widths, and the arc round the island is a curve leg whose neighbours
     are the deflections, which carry the approach's width, so a boulevard
     feeding a ring put a 7 m carriageway on a 5.5 m ring lane and the
     route's inner edge bit 1.5 m into the island, which the closing then
     followed. The ring arc now holds its own width like a straight, and the
     deflections change width over their 40 % away from the ring
     (`DEFLECTION_CHANGE`), so right before the join the carriageway is
     already the ring's. A test walks the route 30 m either side of every
     arc and checks its inner edge never comes inside the island radius.

141. **2026-11-06 — City detail: four building kits in four renders, with
     shared façade and rooftop parts.** By request (a low-poly city set as
     the visual reference; every piece is built here from boxes, nothing is
     imported). The `block` and `office` kits are reworked and a brick
     `tenement` and an arcaded `arcade` join them, all assembled from two
     part libraries, `FacadeGeometry` (casements with lintel and sill,
     stepped arches, cornices, quoins, awnings, a fire escape) and
     `RooftopGeometry` (parapets, bulkheads, water towers, AC units, roof
     gardens, pergolas, masts), so the four read as one city. A `KindKit`'s
     tint is now an array indexed by `variant % length` (pairs still
     type-check), and a city's terraces draw variants from four, so the
     façades come in brick, sandstone, white render and ochre; villages keep
     two. `BuildingCatalog.ts` takes the footprints, door offsets and style
     mixes out of `TownTerraces` (which was over the file-size rule).

142. **2026-11-06 — Crossings, bays, furniture and cars are pure functions
     of the town and the route, not generator output.** `UrbanGenerator`,
     `TownTerraces`, `TownKerbs` and `RoundaboutSurface` were already over
     the ~400-line rule, and storing more on `TownDef` would have meant
     generator churn in the worker too. `Crossings.ts`, `ParkingBays.ts` and
     `StreetFurniture.ts` work everything out from `(town, stage)` when a
     builder or a test asks, the `junctionKerbs` pattern. Their reference
     for "where a junction's paving ends along the route" is the span of the
     ribbon's openings from `junctionKerbs`, not `junctionReach`, which
     undercounts a straight crossroads (its kerb returns reach well past
     `FILLET + 1`); the boulevard medians now break round the same span, as
     a test of the crossings showed stop lines landing on a median.

143. **2026-11-06 — The marking lift ladder.** Crossings lie at
     `deck + 0.023`, bay lines at `+0.022`: over the ribbon's lines (+0.02)
     and the lane dashes (+0.021), under a ring's lines (+0.024) and the
     tram beds (+0.04). Nothing is laid on a ring. One `MarkingMesh`
     accumulator lays both builders' rectangles in 2 m pieces on the deck.

144. **2026-11-06 — Furniture by a slot walk with door clearance.** The
     lamp loop became a slot every 10 m along every route street,
     alternating sides, every third slot a lamp (the 30 m rhythm kept) and
     the rest drawn from trees in pits, benches, bins, hydrants and
     bollards; nothing but a lamp or a bollard within 2 m of a door, nothing
     in a junction's mouth, beside another street or inside a ring's
     hand-off. Villages keep their own lamp loop in `townProps`. Render-only
     toggles (`crossings`, `parkingBays`, `streetFurniture`,
     `pavementDetail`, `hedges`) leave the colliders standing, as the tram
     and median flags do; with furniture off its kits are simply not built.
     Only traffic lights, shelters and cars cast shadows.

145. **2026-11-06 — Parked cars pitch with the street.** By request. A
     `Prop` may carry a `pitch` about its own x axis after its heading
     (`YXZ` order in the chunk manager); a parked car's is the deck's rise
     from its tail to its nose, so it lies along a climbing street instead
     of floating level over it. Cars collide as two circles along their
     length (`CAR_COLLIDER`), like a farmhouse's three.

146. **2026-11-06 — No green under a city's streets.** By request (a green
     wedge along buildings on slopes, a grass triangle in a junction). The
     wedge was the terrain mesh: a terrace pad lifts the vertex nearest the
     building and the 3 m face between it and the kerb tilts up through the
     pavement. Under a city's pavements (`TerrainSample.paved`) the pads are
     not applied, and terrain faces wholly under a carriageway or a
     junction's paving are coloured tarmac, under a pavement paving, so a
     seam between fill polygons shows asphalt. The roundabout island's pad
     sits 3 cm under the island's own grass and pavement meshes, so the
     terrain's facets no longer show through their round edges.

147. **2026-11-06 — Side streets run on to the roads they meet.** By
     request (the grid ended abruptly in coned paths). City side streets run
     150 m; one that would reach the route or another side street now runs
     on to that road's pavement and stops there open-ended (`Street.open`:
     no end building or pavement, its deck taking the other road's level at
     the end), two that face each other down one line meet in the middle,
     and only a ring stops a street short with a building (`UrbanStreets.ts`,
     out of `UrbanGenerator`). The garden walls are closed by
     `TownWallGaps.ts` (loose ends joined within 6 m where the join stays
     off the pavements), the ring walls run exactly to each road's facade
     lines, and the corners take up to two trees and five bushes.

148. **2026-11-06 — Parked cars are the drivable hulls.** By request (more
     detail, round wheels, the Riviera WRC and Tempesta Group B shapes
     without their wings). The two bodies' station lists moved from their
     React components into `render/car/HullShapes.ts`, pure data both the
     drivable bodies and `CityVehicleGeometry` loft with `buildCarHull`; the
     parked car paints the body white (the instance tint), keeps glass and
     trim, and adds the same 12-facet tyres and 8-facet rims the drivable
     wheels use, mirrors, plates and lights. One body kit per hull takes the
     even or odd variants (ten variants: two hulls × five colours, each
     colour listed twice so a variant's colour is the same on either hull).
     Bus shelters were removed by request, and the benches and bins now
     face the carriageway (the yaw sign was mirrored).

149. **2026-11-06 — Side streets join the roads they meet for real; the
     ground is coloured by its middle; the island is clamped; the cars'
     pitch is signed for a +z nose.** By request, four fixes. (1) A city
     side street that reaches the route now ends in a T junction on the
     route's axis (`UrbanStreets.clipStubsToRoads` finds where the street's
     axis crosses the centreline from the hit's lateral sign and pushes a
     junction with the route's two arms and the street as its one blocked
     arm): the junction machinery then gives it a mouth, kerb returns and an
     opening in the ribbon, the street's plate stops at the junction's cut
     at both ends (`TownStreetBuilder.endOf`), its deck takes the route's
     through the far junction zone (`StubDeck.farZone`) and its terraces
     stop clear of the route's pavement. No T within 60 m of the start or
     finish. A street that reaches another side street runs to that
     street's carriageway edge through a square tarmac mouth cut in the
     other's pavement, kerb and line (`mouthsOf`); its own pavements stop at
     the other's pavement. Joins never cross the route. Gates nudge forward
     off a junction once more after the spacing rule. (2) The terrain face
     colour under a city reads the paving at the face's middle: a 3 m face
     at a junction corner can have every corner on a carriageway while it
     spans the pavement and the green, and so painted asphalt over the
     sidewalk. (3) The roundabout's distance field never goes inside the
     island: an exit's extension (its round end cap) reached a metre into
     it and dented the kerb line. (4) A positive rotation about x drops +z,
     and the parked cars' noses point +z, so their pitch is negated; before,
     a car on a slope tilted the wrong way and its downhill wheels floated.

150. **2026-11-06 — Tree pits on both sides of every street.** By request.
     The furniture slot walk (one slot every 10 m, alternating sides, a
     random kind) gave a street a tree here and there; now every street,
     route or side street, carries the same rhythm on both pavements: a
     tree pit every 15 m a side, lamps every 30 m alternating sides on the
     marks between the trees, and a small piece (bench, bin, hydrant or
     bollard) opposite each lamp. A tree whose spot is in a mouth or at a
     door tries shifts of ±2 and ±3.5 m before the row goes without it, so
     the rows read unbroken. A test counts the pits per side per street.

151. **2026-11-06 — Trams run the lines, as scenery.** By request. A
     timetable per line from the stage seed (`TramService.ts`: headway
     55–95 s, a run alternating direction, the tram fading in and out over
     10 m at the line's ends, where it would otherwise appear from nowhere
     in front of the end building) and one mesh per line over a shared
     `TramGeometry` (`TramFleet.ts`), posed from the wall clock in the
     renderer's per-frame update and pitched by the deck under its bogies.
     The simulation does not see the trams: a moving obstacle would need
     per-step collider updates and a tram crossing at 29 km/h would be a
     wall the driver cannot read; the car passes through, as through the
     scenery it cannot hit. Toggle `tramService`.

152. **2026-11-06 — An overhead line without poles.** By request: the
     catenary poles went in 139, but the user wants the wire the tram's
     pantograph rides. `TramTrackBuilder` lays one contact wire
     (`TRAM_WIRE_HEIGHT`, 5.15 m over the rail heads, its underside on the
     pantograph's strips) along every line as two crossed 5 cm ribbons drawn
     from both sides so it reads from any angle, following the track's
     height and stopping 2 m short of the ends where the trams fade; a
     messenger wire with droppers was tried and dropped by request. The
     pantograph is a single-arm frame after the reference (a flat base
     plate, a pivot, two close-set tubes and a guide rod up to the knee, two
     wide-set tubes converging on the head, a bow with two strips and
     down-turned horns) whose arm angles are solved so the strips meet the
     wire exactly; a test pins the tram's top to the wire height.

153. **2026-11-06 — The tram has a hitbox.** By request, reversing 151's
     "scenery only". `tramBoxes` turns the timetable's poses at a clock into
     oriented boxes (the faint ends left out), and the session resolves the
     car against them every physics step with `resolveBoxCollisions`, the
     grid's box routine applied to boxes given outright, since they move.
     The clock is the run's own simulated time, and the renderer now poses
     the fleet from that same clock (handed down the pose callback, the
     replay's clock while one plays) instead of the wall clock, so what the
     driver sees is what the car hits, and a paused game holds its trams. A
     tram rolling into a standing car pushes it by penetration resolution
     step by step, which reads as a shove.

154. **2026-11-06 — The Boreal Saloon reshaped after its reference.** By
     request (the late-nineties world-rally saloon, from five reference
     views). The hull's cowl moves back from 0.92 to 0.6 ahead of centre
     and the bonnet falls to a lower nose (belt 0.68 at the face), the roof
     rises to 1.22 and runs from 0.05 ahead of centre to 0.75 behind, the
     rear glass drops onto a 0.6 m boot deck, the flares widen to 0.89 over
     a shouldered body (the cabin stations take a `shoulder` crease, so the
     greenhouse rounds in two planes) and the box flares now sit on both the
     front and the rear stations. The dressing gains wrap-round head and
     tail lamps with amber indicators, a grille slot, bonnet pins and a
     rally plate decal, a boot lip, a third brake light, a taller swept wing
     with a gurney and end plates, side skirts, a door handle, mirror
     glass, and red mud flaps of its own (`OWN_FLAPS`). The bumper's two
     round fog lamps stay where they were, as asked.

155. **2026-11-07 — The saloon measured off its reference.** By request
     (the first pass still read flat and square). The proportions now come
     from the reference views as fractions of length and height: the door
     belt at 0.64 of the height (0.78 m, so the glasshouse is a third of the
     car rather than a quarter), the cowl 0.63 of the length from the tail
     at 0.71 of the height, the roof flat over the middle 0.22 of the
     length, the rear screen onto a deck at 0.66 of the height, the nose
     face at 0.5, floor and sills lowered, and a stronger tumblehome to a
     1.2 m roof with the shoulder crease. The livery gains the sun strip,
     sponsor blocks on the bumper corners and rear quarter, name bars on the
     rear window, a sill stripe and plate stripes. The fog lamps stay.

156. **2026-11-07 — Saloon: flaps hung from the sill, a taller nose and
     tail, a level bonnet, the livery off the arches.** By request. The mud
     flaps hang from a bracket at the sill inside the flares (they stood off
     the body and proud of the arches); the nose rises to 0.77 at the face
     with the bonnet nearly level from the cowl (0.88), as the reference's
     is, and the tail to 0.86 with the deck at 0.88; the stars, the last
     swoosh piece and the rear quarter block move off the rear wheel well.

157. **2026-11-07 — Saloon: the four-lamp pod returns to the bonnet's
     leading edge; the rally plate, the wing's plate and the floating brake
     light go.** By request. The pod of four round lamps on a dark bar sits
     on the bonnet's front edge over the headlamps, the rally plate decal is
     off the bonnet, the white plate is off the wing, and the third brake
     light sits on the boot deck under the wing instead of a hair above it.

158. **2026-11-07 — Saloon: the window line up to the door plate.** By
     request. The cabin belt rises from 0.78 to 0.86 so the side glass is
     shorter from the bottom and its lower edge meets the top of the door
     plate, and the two white name bars on the rear window are gone.

159. **2026-11-07 — City stages load in a fraction of the time: spatial
     hashes in the layout and the terrain, and the street builders spread
     over the countdown.** By request (a city took seconds to appear and
     froze the page). Profiling a city (seed 12345, index 12) put ~0.6 s in
     `generateStage` and ~0.95 s in the `StageRenderer` constructor, both
     on the main thread, and nearly all of it in linear scans: every house
     stood was checked against every house so far (`TownTerraces.place`,
     corners recomputed each time), every garden-wall end against every
     other end (`TownWallGaps`), every furniture candidate against every
     door and street, and every terrain height query walked all ~3 000
     terrace pads (`TerrainField.applyPads`) and all side streets
     (`stubHit`). A small `SpatialHash` (`game/stage/SpatialHash.ts`) now
     files items by cell: `BuildingIndex` keeps the buildings with cached
     corners and is shared by placement, open-ground checks and the wall
     closer; the pads are filed in every cell their reach touches so a
     query reads only its own cell's few, in list order so the sequential
     blend is unchanged; the side streets are filed along their length and
     searched in rings outward until no unvisited street can beat the
     best, so the result is still the exact nearest. Generation fell to
     ~0.16 s and the renderer to ~0.44 s in Node, with every stage still
     bit-identical (the checks are pure predicates, so the order they run
     in cannot change the outcome). The remaining renderer cost is spread
     over a dozen street builders, so a new city builds its road, gates,
     terrain and scenery at once and queues the town builders (streets and
     junction plates first, then walls and rings, then markings, trams and
     bays) to run a few per frame from `update`, ~6 ms a frame and at
     least one, during the three-second countdown; a theme change still
     rebuilds everything in one frame. `createStageWorld` also keeps the
     last world, so a retry (the scene is keyed on the attempt) no longer
     regenerates it. In headless Chromium on the M-series GPU the longest
     main-thread block on loading a city went from ~0.8–0.9 s (after the
     hashes; roughly double that before) to ~0.45–0.5 s, against ~0.14 s
     for a forest stage; the rest arrives as 50–150 ms tasks in the first
     second of the countdown.

160. **2026-11-07 — City junctions take the narrower street's width; the
     wider street drops its lanes before them.** By request: at a 60°
     corner between a four-lane boulevard and a two-lane street the width
     eased over the middle of the corner arc, so the outer kerb wobbled
     through an S inside the junction and jogged where the pavement met
     it, the four lanes ran straight into two, and the zebra sat in the
     flare. Now `traceWidths` takes the junctions: a corner between
     different widths holds the narrower from `JUNCTION_HOLD` (6 m) beyond
     `junctionReach` either side of the arc's middle, and the wider street
     tapers to it over `LANE_TAPER` (30 m) outside that, clamped to the
     next junction's hold when it comes sooner, only ever narrowing (as
     the village's `buildWidths` does), so overlapping constraints settle
     on the narrowest. `cornerStreets` gives every arm of such a junction
     the narrower width, so its kerbs, cones and traffic lights meet a
     ribbon of one width (the kerbs follow `halfWidthAt`, so they needed
     no change). Lane markings skip any segment whose width changes,
     medians stop where their boulevard begins to narrow, and route
     furniture stands off the ribbon's actual edge rather than the street's
     nominal width, so lamps and tree pits follow the taper. Crossings
     were already laid past the junction's reach, so they now land on the
     held stretch ahead of the junction. Layout needs the junctions before
     the final widths, so `layoutTown` lays the roundabouts on a rough
     width pass and computes the real one once the corners and crossroads
     are in. Verified at seed 1 stage 12 (2014 m, four to two lanes) and
     seed 3 stage 12 (491 m, four lanes to one). In the same pass, by
     request, `townProps` leaves out any cone within `TRAM_BED_HALF` + 0.3 m
     of a tram line: the rows across the tram streets had two cones on the
     rails, which the trams drove through.

161. **2026-11-08 — Arctic: a Finnish winter region as Alpine's flat
     cousin; the cycle grows to eighteen stages and saves to v6.** By
     request, from six reference photographs of Rally Sweden and Finland
     (snow-walled roads through tall spruce forest, cars on snow-dusted
     tarmac, pale skies). Rather than a new land model, the region reuses
     the hill generator with low relief (amplitude 9, long waves) and the
     Alpine's surface mix, and adds two small, generic hooks: a
     `terrain.banks` ridge heaped along both verges in `TerrainField`
     (applied to the mesh sample and to `deckAt`, so the wheels ride up the
     bank, with `townFade` and side streets excepted), and a `spruces`
     scenery density feeding a new `spruce` prop kind placed by the ordinary
     scatter. The spruce is three instanced parts so each takes the right
     colour: the trunk in the palette's trunk colour, the foliage tiers
     white for the pine tint, the snow its own white (one tinted part
     turned the trunk black and the caps green). On request the shape then
     followed the low-poly snowy pine GLB kept in `context/environment`
     (a reference only, not shipped): six stacked octagonal truncated
     cones with a snow ring on every shoulder, a snowed tip and a drift at
     the foot, and only the even variants wear the snow, so the wall mixes
     snowy and bare trees; then the whorls became irregular (own width,
     depth and offset, gaps showing the trunk, two silhouettes) and start
     just above the snow. Three more requests the same day: `handling`
     on the region (grip, steering rate and a new `steerLock` multiplier
     in `SimEnv`, read by `DrivingSession`), so the Arctic's snow drives
     like studded tyres rather than the Alpine's dusting; `terrain.crests`,
     humps on straight, level stretches that `TerrainField.addCrests` adds
     to the smoothed profile for the car to jump (the hump's own grade is
     π·h/L, under 10 %, and it only goes where the road is near level, so
     the sum stays under 17 %); and the banks' snow spilling onto the road
     as per-side tongue strips in `RoadBuilder`, whose strip extents now
     take the station index, with patches and tongues on cleared tarmac
     too wherever a region heaps banks. Twistiness dropped to 0.65 for the
     straights. Nightcity treats
     spruces as trees, so its towers and masts stand in their slots. The
     cycle is eighteen stages with Arctic at indices 3, 13 and 17 (the
     placement the user chose for a new region: the first at stage 4, where
     the second Alpine was; Alpine moves to 9), still never three alike,
     every region three times, villages on 2, 5, 8 and now 17 (an Arctic
     village under snow), cities on even indices where no circuit lands;
     `SAVE_VERSION` is 6 with the v5 cycle frozen and the v4 migration
     pinned to it, as decision 125 did. The open-road fixture's index-3
     keys moved to 27 (Alpine, loop 4), and the Alpine curvature test
     measures stage 2 outside its village, since no early Alpine is open
     road any more. A Nippon river-valley region was built the day before
     on the same cycle change and scrapped before commit at the user's
     request.

162. **2026-11-08 — Coconut palms after the reference model.** By request,
     from the low-poly coconut palm GLB kept in `context/palm-tree` (a
     reference only, not shipped, like the pine): the trunk is seven
     tapered cylinder segments along a parabola leaning 2.3 m off the
     vertical over 6.75 m, each with a collar ring at its foot (a rotation
     about z by θ tips a cylinder's axis to (−sin θ, cos θ), so the tilt is
     atan2(−dx, dy); the first draft had the sign wrong and scattered the
     segments); the crown is eight fronds of three flat segments drooping
     further the further out, with a knot hiding their roots; the coconuts
     are a third instanced part in their own brown. The palm's canopy
     spacing grew to 2.6 m for the wider crown.

163. **2026-11-08 — City side streets keep clear of the corners.** By
     request: at a corner of seed 989380427 stage 31 a 125 m side street
     from the next corner ran back and opened onto the first corner's
     straight-on street only a few metres past that junction, so its plate
     and pavements landed among the corner's kerb wedges and read as a pale
     diagonal road cutting into the carriageway. `joinStubs` now opens a
     street onto another only 16 m or more past that street's junction
     (`JOIN_PAST_JUNCTION`) and never within 8 m of the route's pavement
     beyond the usual corridor (`JOIN_ROUTE_CLEAR`); `clipStubsToRoads`
     makes a T on the route only where the street arrives within 22° of
     square (`T_MAX_SKEW`), since an oblique T's kerb returns stretch into
     aprons along the road. Streets that fail these stop short with their
     end building, as the user asked, and the route's terraces continue
     past them.

164. **2026-11-08 — Lane markings end at the junction's crossing.** By
     request: the dashes and centre line were blanked within
     `junctionReach` of a junction's centre, which left them running under
     the zebra and up to the pavement's flare at wide junctions. They now
     use the same spans the crossings do (the ribbon's hand-over to the
     junction's kerbs, `junctionKerbs(...).openings`) plus the crossing
     and stop line laid beyond them (`CROSSING_EXTENT`) and 1.5 m, so a
     line always stops at the stop line; junctions without openings keep
     the reach-based fallback with the same extent added.

165. **2026-11-08 — Arctic spectators.** By request: a `spectator` prop
     kind (a vertex-coloured low-poly figure, the jacket white for a
     six-colour tint) placed by `scatterSpectators` in groups of two to
     five a stride apart, about four groups per 100 m over both sides,
     just behind the banks and facing the road, clear of gates, the start
     and villages, seeded from the stage; wild props within 2.2 m are
     dropped so the groups read. No colliders: a crowd of 1.75 m figures
     as obstacles would punish leaving the road more than the banks
     already do. The density is a `SceneryDensity` field, so other
     regions can take spectators later.

166. **2026-11-08 — Detailed, posed spectators and crowds at the key
     spots.** By request, after the faceted crowd in
     `context/low-poly-people` (screenshots and a `.blend`, a reference
     only: there is no Blender here to export it and `context/` is not
     shipped). Each figure is built from tapered, open-ended five- and
     six-sided prisms between posed joints with icosahedron joints and a
     faceted head, about 600 triangles, in six poses that each carry their
     own headwear, skin, trousers and boots. The figure is now two
     instanced parts per pose, a fixed-colour body and a white jacket,
     because an instance colour multiplies every vertex colour: the first
     single-mesh version tinted faces and hats with the jacket. The
     variant packs jacket and pose (`variant % 6`, then the pose).
     Placement moved to `game/stage/Spectators.ts` (SceneryScatter was
     past 400 lines) and gained crowds lining both sides round the start,
     every checkpoint, each crest's run-up and landing and the finish,
     with a 4 m gap at boards and arches and a check against other
     stretches of road; the groups between rose from 1.4 to 2.2 per
     100 m. That is about 1,000–1,400 figures a stage; the jump crowds
     were thinned (one row, a quarter with someone behind) after a first
     cut gave 1,600, and the wild-prop clearance uses a spatial hash
     rather than testing every prop against every spectator. Scenery
     streaming keeps only nearby chunks, so low tiers draw fewer.

167. **2026-11-08 — Lighter crowds, fuller groups, no repeated outfits.**
     By request: the start, checkpoint and jump crowds are halved by
     setting their front row two strides apart (`Crowd.spacing`), leaving
     the finish as it was; a stage now carries about 700–900 figures. The
     groups between are five or six people (were two to five), and each
     group shuffles the six poses and the six jackets and pairs them off,
     so no two members share a pose (which also fixes their headwear,
     boots and trousers) or a jacket. Crowds deal from a shuffled deck of
     all 36 pairings that skips any of the last six dealt when a fresh
     deck starts, so neighbours never match across the reshuffle either.

168. **2026-11-08 — Snow tongues in the road plane; texel-stepped sun.**
     By request (flickering grey shadows and jagged edges where the
     Arctic's snow met the tarmac). The banks' tongues were a second
     ribbon 6 mm over the carriageway and 0.3 m over the verge; at
     distance and from the overhead cameras the two depths fought, so
     tarmac showed through the snow in flickering grey patches and saw-
     toothed seams. `RoadBuilder` now cuts the carriageway across into a
     snowy band at each edge and the bare middle, all at `ROAD_LIFT` with
     shared edges (the middle closes to nothing where the tongues cross;
     zero-width bands are skipped; junction mouths stay bare). Separately,
     `followSun` moved the shadow camera with the car by fractions of a
     texel, resampling every shadow edge each frame; `ShadowSnap` now
     steps the sun's target in whole texels (60 m / 2048) across the plane
     facing the light, on the shadow camera's own axes.

169. **2026-11-08 — Spruce snow stacked, not laid over.** By request, the
     same depth fight as #168 on the snowy spruces: each snow sleeve's top
     cap shared the whorl's top plane, the top whorl's foot sat on the one
     below (12.6 m), and the snowed tip wrapped the green tip within a
     couple of centimetres. On snowy trees each green whorl now stops
     where its sleeve starts and the sleeve (still a hair proud, for the
     lip) carries on above, so the only shared planes are back-to-back
     caps that are always hidden; the green tip is dropped under the snow
     cone, and the top whorl starts at 12.7 m. Bare trees are unchanged.

170. **2026-11-08 — Pace notes from the road's geometry.** By request, a
     HUD call for the next corner after rally co-drivers' books and the
     DiRT/WRC icon cards the user supplied (redrawn as original pixel art).
     Following the convention that a grade is read off a corner's tightest
     sustained radius and its total turn (as Tornante publishes its notes),
     `PaceNotes` smooths the path's curvature over 10 m, groups same-side
     stretches tighter than 120 m (merging gaps under 8 m), drops those
     turning under 14°, and grades the rest: hairpin (≥150°, ≤26 m), acute
     (≥115°, ≤16 m), square (70–110°, ≤12 m), else 1–6 by radius (13, 20,
     30, 48, 75, 120 m); numbered corners turning ≥100° are long, and a
     corner starting within 20 m of the last is linked (into when tighter).
     Calibrated over 72 stages: about 13 calls/km on rally stages, mostly
     3s and 4s as on real stages, coast switchbacks as hairpins, village
     junctions as squares, about 2/km on circuits. First cut: a 16 m
     hairpin limit graded the switchbacks "2 long", and a 14 m square
     limit swallowed every 1 into squares. The HUD gets the notes once and
     the race distance at 10 Hz (`StageRun.along`, unwrapped per lap), so
     the callout re-renders at most ten times a second. The first cards
     were smooth vector arrows; by request they became 20 × 20 pixel art
     (two-pixel frame, notched corners, 45°-only strokes) drawn at whole
     multiples (60 px, 40 px for a linked corner) and centred under the
     clock in the HUD's column. The number keeps the grade readable
     without colour; screen readers get the call, not the countdown.

171. **2026-11-08 — Compact touch HUD and a turbo pad.** By request. On
     coarse pointers the words "Checkpoint" and "Money" give way to 8 × 8
     pixel glyphs (a chequered flag, a dollar bill; drawn at 2×, 16 px) with the words kept as
     `sr-only` text, and the two tags share a row under the clock. Money
     stays one element (`data-testid="money"`, which the tests read): it
     lives in the row and is `absolute bottom-left` on desktop beside the
     Garage button, `static` in the row on touch. The pace note follows the
     row; on touch it is left-aligned, since centred on a short landscape
     phone it ran into the countdown. The turbo already existed (Shift,
     once fitted or on turbo cars) with no touch input: a pad over
     steer-left now sets `TOUCH_INPUT.turbo`, shown only when the car as
     upgraded has `turboForce > 0`. Its 16 × 16 glyph (a turbocharger:
     housing, pinwheel, outlet and flange, speed lines) was hand-drawn
     after a generated draft read as noise at that size, and draws at 2×
     (32 px) so its pixels stay square; the 8 × 8 pad glyphs stay at 3×.
     Follow-up, by request: the coin became a dollar bill, and the
     penalties tag moved above the pace note (one order for desktop and
     touch), so on touch the stack reads clock, checkpoints and money,
     penalties, then the call, left-aligned.
     A later pass redrew the turbo in two-pixel strokes with fewer parts
     (ring, hub, outlet and flange, two speed lines; the pinwheel's blades
     went), since its one-pixel lines read thin and busy on the pad.

172. **2026-11-08 — Unit tests fit the CI runner.** CI on `main` had been
     failing on and off since 2026-11-07 with timeouts in the city tests, a
     runner being about five times slower than a laptop. `streetFurniture`
     ran an `expect` per furniture piece per building collider (about five
     million calls a seed, 28 s locally): it now collects offenders and
     asserts once (1.1 s, same checks). The tests that build cities for
     the rest of their file (`urban`'s first) or read 36 stages
     (`paceNotes`) get a 30 s budget instead of the 5 s default.

173. **2026-11-08 — Terrain never waits on its worker.** By request: the
     splash showed road and trees over bare sky colour. Terrain was the one
     layer meshed only in a Web Worker, which first loads its script (in
     `next dev`, compiled on demand) and rebuilds the stage from the seed;
     chunk requests sent meanwhile were queued, and if the worker failed to
     load or threw, they were dropped silently with no fallback. The worker
     now posts `ready` after its init; until then the manager meshes the
     nearest chunks itself within a 4 ms budget a frame (a chunk takes
     0.6–2.7 ms), then hands the rest of its queue over; `onerror` drops the
     worker and re-queues every loaded chunk without a mesh on the main
     thread. Tested with a stand-in worker: no worker, slow worker, failing
     worker.

174. **2026-11-08 — Shadows lead the car and fade at their edge.** By
     request ("popping" shadows). The sun's 60 m shadow frustum sat centred
     on the car, so half of it covered road behind while shadows ahead
     switched on at a hard line about 30 m out; the sun stood only 17 m
     from its target with a 60 m far plane, so tall spruces and hillsides
     near the edge could fall outside its depth range. Now: the frustum is
     80 m across on the same 2048 map (3.9 cm texels, still stepped whole
     by `ShadowSnap`) and centred 22 m ahead of the car along the camera's
     horizontal view (none from the isometric view, which looks down);
     the sun stands 120 m back along the same direction with a 240 m far
     plane (bias −0.0002 plus a 0.02 normal bias for the longer depth
     range); and `ShadowEdgeFade` patches three's shared `getShadow` so
     directional shadows fade over the outer 15 % of the map instead of
     ending on a line. Cascaded shadow maps would reach further still but
     need every material patched and several shadow passes; this keeps one
     pass.

175. **2026-11-08 — Group B's straight engine deck.** By request: the hull
     dropped from the 0.94 m belt to 0.76 m at z −1.7 behind the rear wheel
     and rose again to 0.95 m at the tail, so the side stripes (laid at a
     fixed offset below the belt) dipped in a V and the tail read as a
     notch. The deck now holds 0.94 m from the cabin to z −1.88, then two
     short stations round it off: at −1.96 the corners pull in to 0.835 m
     half-width and the edge drops to 0.925 m, and at −2.0 to 0.78 m and
     0.9 m, so the tail has rounded corners and a softened top edge rather
     than a square box. The tail spoiler sits 5 cm lower and a touch
     narrower to stay on it, and the rear bumper narrows to 1.6 m to match.
     The city's parked Group Bs share the stations and change with it.

176. **2026-11-08 — Spectators at the Forest mud rally; sitting and
     photographing poses.** By request. Regions gain `surfaceScenery`
     (beside `surfacePalettes`; `stageScenery` merges it over the region's
     density), and the Forest takes 2.2 spectator groups per 100 m on mud
     only, so the autumn stages get a crowd and the summer ones stay quiet.
     The pose data moved to `SpectatorWardrobe` (the geometry file would
     have passed 400 lines): each pose is a figure plus winter clothes, and
     `lookFor(pose, outfit)` dresses it for the snow or, by a per-pose
     casual table, for a mild day (a slimmer top with a crew neck and short
     or long sleeves, bare forearms and hands, jeans, chinos or shorts with
     bare shins, low trainers, caps, bare heads, ponytails). The outfit is
     chosen per stage from the region's off-road surface (`spectatorOutfit`:
     snow regions wear winter) and handed to the kits, so the props and
     their variants are the same either way. Three poses were added (nine
     in all): sitting with knees up and hands on them, sitting with a
     camera, and standing with a camera. Seated figures are built standing
     and lowered 0.78 m onto the ground above the hips, with the legs
     re-jointed (hip at 0.15 m, knee up and forward, foot flat), so arm
     poses keep one frame. The camera is a dark body, grey lens and
     viewfinder bump in the body's fixed colours. Groups still deal
     distinct poses and jackets; with nine poses a group of six draws from
     a wider set.

177. **2026-11-08 — Crowd berms on mud, and small bumps everywhere.** By
     request. `TerrainDetail` (pure, beside `TerrainField`, which was
     already long) holds both. Bumps: a second seeded noise, 0.26 m at
     1/10 m⁻¹ plus 0.1 m at 1/4.5 m⁻¹, scaled by the road blend so the
     road, the verge strip (flat at deck height) and the flat margin never
     move, and skipped on coast, dunes, circuits and cities, whose ground is
     shaped on purpose; applied before the level pads, so houses and
     terraces stay flat. Berms: capsules (a straight spine, a rounded
     profile across, round ends; the highest wins where runs overlap) set
     by `scatterSpectators` on mud stages and registered on the field with
     `setMounds` before anything else stands on the ground, so the terrain
     worker meshes them and the wheels ride them. They start 3.4 m past
     the carriageway, clear of the 3 m verge strip that would otherwise
     cut through them, so their crowds stand 7.4 m out; not along a
     village's pavements, nor where another stretch of road passes under.
     A first cut at 0.6 m × 3.2 m in grass colour barely showed on the 2 m
     terrain grid, so they grew to 0.7 m × 3.6 m and the sample carries an
     `earth` mask the mesher paints in the mud road's soil colour, fading
     back to grass at the foot. Wild props within 0.5 m of a berm are
     dropped. No colliders, as for the spectators: the car climbs a berm
     as terrain.

178. **2026-11-08 — Berms at the checkpoints too, and grassed over.** By
     request: the checkpoint crowds on mud stand behind berms like the
     start's and the finish's (jump crowds keep the open line, so the
     crests stay clear), and every berm is painted grass rather than the
     mud road's soil: the mesher's `berm` colour is the palette's low grass
     at 82 % brightness, so a berm still reads against the field from its
     shade and its flat-shaded slopes.

179. **2026-11-08 — A fixed schedule: city every ninth, circuit every
     tenth, a seven-stage rally mix.** By request, replacing the
     eighteen-stage `REGION_CYCLE`. `stageSlot(index)`: a city where
     `index % 9 === 8`, a circuit where `index % 10 === 9` except where the
     city holds that stage (index 89, 179…; the user chose the city), whose
     circuit moves to the next index; every other stage takes
     `RALLY_CYCLE[rallyIndex % 7]` (Forest gravel, Alpine, Forest tarmac,
     Coast, Arctic, Forest mud, Desert), counting rally stages only so a
     city or circuit never skips a slot. Forest's surface is fixed per slot
     (the user asked for gravel, tarmac and mud as their own slots);
     `drawBrief` still makes its surface draw and ignores it, so a fixed
     slot leaves the rest of the RNG stream as it was. Villages had been on
     every third index, which against the new mix would only ever hit
     Forest; they now fall on every third rally stage (`hasTown` reads
     `rallyIndex`), which comes round every Forest surface, Alpine and
     Arctic. Save version 7 drops records where the region changed or the
     slot now fixes a Forest surface (circuits and same-region stages
     keep theirs); the old cycle and the plain tenth-stage circuit rule
     live on in `SaveFile.ts` for the older migrations. Two generator edge
     cases surfaced on stages the tests now land on: a forced corner side
     street could still touch another when that one stopped at the 20 m
     minimum (`planStub` now cuts the other down to its own junction's
     floor too), and a manhole could sit on the first millimetre of a
     junction corner's kerb ramp (skipped now). Tests find stages with
     `tests/unit/stageIndex.ts`; the open-road fixture lost its two entries
     whose regions moved.

180. **2026-11-08 — An autopilot and a held cinematic shot, for recording
     videos.** By request (a new walkthrough and story with the new stages
     and cars). The old recordings' scripts were temporary and lost, so the
     capture is rebuilt in `my-video/scripts/record.mjs` (outside the repo,
     like the rest of `my-video`): headless Chromium on the dev server, the
     page's clock and animation frames stepped by exactly 1/30 s and one
     screenshot per frame piped to Remotion's bundled ffmpeg, so no frame
     is dropped. The game gains two dev-only flags it needs. `?autopilot`:
     `game/vehicle/Autopilot` (pure, unit-tested on every region, a city
     and a circuit lap) steers by pure pursuit toward a point 0.55 s ahead
     on the centreline and picks its speed from the tightest bend within
     3 s, allowing the braking distance to each, scaled by the surface's
     and the region's grip (without the surface it slid off the Alpine's
     snow); `DrivingSession` feeds its input in place of the keyboard's.
     `?shot=<kind>`: `forceShotKind` makes the director call that kind for
     good, aimed at the car rather than ahead of it so a 9:16 frame keeps
     it centred. Both are read only outside production builds, like
     `?spawn=`.

181. **2026-11-09 — Coast stacks keep clear of the road below.** Played, the
     coast's hairpins showed a sheer wall at the lower road's edge with the
     road above on top of it. Decision 97 spaced stacked legs two radii
     apart across the stage axis, which holds only while the shore runs
     along the axis: where it bends the contours close up (by the cosine of
     the bend), and the long way down, leaving the top after a fixed 50 m,
     passed over the first hairpin's apex. Measured over sixteen stages,
     other stretches of road came within 25 m centre to centre (under 8 m
     on two late-loop stages), 15–22 m above, so the terrain's nearest-road
     rule switched to the upper deck inside the lower road's blend, or on
     its verge. `CoastRoad` now holds every part of a stack 36 m from the
     road below it (two half widths, flat margins and coast blends, so the
     corridors never meet): each leg's lift grows in 2 m steps until its
     contour clears the leg below, and the top leg runs on in 10 m steps
     until the descent clears legs 1–2 and the first hairpin. Blending the
     terrain between two decks where corridors overlap was considered and
     dropped: with 20 m between decks over 8 m of ground it only trades a
     step for a 70° wall. Coast roads change on some seeds (longer by up
     to a few hundred metres); the save version is unchanged, so a best
     time set before this may be on a slightly shorter road. A unit test
     probes 14.5 m out from every sample of six early and late coast
     stages for another stretch of road.

182. **2026-11-09 — A sunk bed under the circuits' gravel traps.** Grass
     showed through the corners' gravel in triangular patches. `KerbBuilder`
     draws each trap as a flat band 1.5 cm over the runoff, whose terrain
     sits at the deck's level; but the terrain's 2 m grid and the band's
     per-sample quads are different straight-line cuts of the same curved
     road profile, and across a grade change the grid's triangles bowed up
     to 4.5 cm through the band (on 2–5 % of the points under it, over three
     circuits). Lifting the band further was considered and dropped: the
     error grows with the profile's curvature, and a raised band shows an
     edge from the low cameras. The terrain mesh now sinks 15 cm under the
     band, ramping back to the runoff's level over the half metre inside
     its edges (`gravelDepth`, from the trap's lateral edges and the ends
     of its run along the lap), the same answer as the trench under the
     road (`ROAD_BED_DROP`). Only `sample` (the mesh) sinks; the wheels
     still ride `deckAt`, so the gravel drives as before. A unit test
     checks the mesh, triangle by triangle on the chunks' grid, stays under
     the band at every point 0.25 m or more inside its edges.

183. **2026-11-09 — Coast ground banked between stacked legs.** Decision
     181 kept every leg 36 m from the road below, but stage 39 of a played
     game still showed a sheer wall at a hairpin's outside edge. The cause
     was the deck, not the plan: a hairpin climbs two contours (about 18 m
     at the hill's slope) in 60–70 m of road, and the 12 % limiter lets the
     deck rise about 8 m of that, so the apex runs 13–16 m below the
     hillside it crosses and the 9 m coast blend stood that cut as a wall;
     the leg above, 31 m higher at 36 m, sat on top of it. Widening the
     clearance until the decks fitted a 1.2 bank between them was tried and
     dropped: nearly every stage needed 52–60 m, which widened the hairpins
     past the pace notes' 26 m hairpin radius and lost the coast test's two
     hairpins. Instead `TerrainField` shapes the coast's ground before the
     road blends into it (`shapedGround`): from every stretch of road within
     30 m of its flat margin (`RoadPath.visitNear`) the ground stands no more
     than 1.2 per metre above the deck (a cut opens out instead of rising at
     the verge), and inland of the shore road's line, fading in over 8 m so
     the sea cliffs keep their 62°, no more than 1.2 per metre below it;
     where a lower road's cut and an upper road's fill cross, the ground
     ramps straight between their flat margins, weighted by distance, so
     the bank meets each verge level. On the reported hairpin the ground
     6 m past the margin drops from 16 m above the deck to 6 m, and the
     31 m to the leg above is one even bank rather than a wall and a shelf.
     A unit test holds that 6 m point under 7.5 m above the deck along
     seven coast stages, the reported one among them.

184. **2026-11-09 — A feedback page, emailed through Resend.** By request, a
     "Share your feedback" button at the bottom of the Game panel opens
     `/feedback` (in a new tab, so the stage in progress survives), styled
     as the privacy page: optional name and email, a message of 10–4000
     characters. `/api/feedback` validates it (`lib/feedback.ts`, shared with
     the form's limits) and sends a plain-text email to luis@luigiht.com
     through Resend's HTTP API with `fetch`, so no new dependency; the reply
     address is the player's email when given. A `mailto:` link was dropped
     (it needs a mail client on the device, and most phones playing in a
     browser have none set up); SMTP was dropped as heavier to configure on
     Vercel. Abuse guards: control characters stripped from the name and
     email so nothing can break into a header, the email held to a strict
     one-line shape, a hidden honeypot field answered as a success, and a
     per-instance limit of five sends per address per ten minutes (a brake,
     not a quota: serverless instances do not share it). Without
     `RESEND_API_KEY` the route answers 503 and the form says to try again
     later. The privacy page gains a Feedback section saying what is sent
     and to whom. As a captcha the form asks which carmaker builds the Focus
     and the Mustang; the answer (Ford, any case, trailing punctuation
     aside) is checked only in the route (`api/feedback/answer.ts`), so the
     page never carries it, and a wrong one is a 400 the form shows beside
     the field. Cloudflare Turnstile was considered and dropped: its script
     would break the privacy page's "no third-party scripts".

185. **2026-11-09 — The Arctic at dusk, with the car's lamps.** By request,
     Arctic stages run just past sunset with working head and brake lamps.
     A region opts in with `dusk` (only the Arctic), and `dayTheme` gives it
     `DUSK_LIGHTING` in place of the day constants, keeping the day kits,
     road and gates: an indigo background, a violet fog closing in at
     45–230 m, a cool hemisphere fill at 0.55 (1.9 by day) and the sun as a
     faint warm glow at 0.3 (2.6), still casting the shadow map so the
     sun-follow and its texel snapping are unchanged. The sky is a gradient
     dome (`SkyDome`, a 420 m back-faced sphere on the camera, no fog, no
     depth writes, tone-mapped like the scene): indigo overhead, the fog's
     colour at the horizon so distant ground melts into it, and a pink band
     with an orange core low toward the sun's bearing. The flat background
     was kept for every other theme. The lamps are `render/car/CarLamps`, an
     imperative group of lights the car model hangs on its sprung body (so
     the beams lean and pitch with it) when the theme sets `carLamps`: a
     spotlight per side of the nose (480 cd each, 90 m, 0.5 rad, aimed 26 m
     ahead and 1.6 m down, no shadow map; one central beam read as a single
     lamp). A red point light on the snow behind while braking was tried
     and dropped by request: braking shows on the car, and its wash tinted
     the tail panel unevenly with the view, so the Focus's two lamps read
     as mismatched.
     The visible lamps are the ones each body already carries. Added lamp
     lenses were tried first, fitted to the body's bounds and later over its
     red faces, and dropped: on sloped noses and tails they floated clear of
     the body. Instead `CarLamps` finds the body's tail lamps by colour in
     the rear quarter (a hull's glowing decal faces, lit lamp parts, or,
     when a body has neither, small painted red parts such as the coupé's
     discs; a red livery never counts) and brightens them 2.6× while
     braking: the red channel of their vertex colours rewritten in place
     (all three tone-mapped them pink), emissive intensity raised,
     the painted ones given a faint red glow after dark. It keeps their
     original colours and gives them back when it is disposed (a theme
     change or a garage swap). The brake
     level is the session's last physics-step brake input (`braking`), off
     in replays. Braking only rewrites colours and material settings, so it
     never changes the light count and recompiles shaders. No bloom: the day
     scene has no composer. Nightcity's toggle
     still swaps in its own theme on Arctic stages. The tyre marks are drawn
     unlit, so the snow's pale ink glowed after dark: dusk sets the theme's
     `skidInk` to a faint dark violet (0.3 opacity) on every surface. And
     the time-control boards, set on the ground at their centre, hung clear
     of the Arctic's snow banks at one end: each now stands on the highest
     of the ground under its two ends and middle and runs down past the
     lowest, in every region.

186. **2026-11-09 — Pace notes always on.** By request the Settings toggle
     for the pace notes is gone (with its store field and strings): the
     call shows on every stage from the start line, as the co-driver's
     voice is part of the game rather than an option.

187. **2026-11-09 — The Arctic road snowed over.** By request the Arctic
     drops its cleared-tarmac stages and its road is snow from edge to edge
     instead of asphalt with patches and tongues from the banks: the region
     draws `snow` only (a one-entry draw still takes the brief's random
     number, so every other stage keeps its stream), and where a region
     heaps banks `RoadBuilder` lays the carriageway in the snow colour with
     no cover noise and no tongues, which only existed to cover bare
     asphalt. The road keeps its per-sample shade jitter, so it reads as
     packed snow against the banks. Nightcity's own dark surface still gets
     the patches and tongues. Arctic stages that were tarmac now drive as
     snow, with snow's grip and prize; their best times stay (the save
     version is unchanged).

188. **2026-11-09 — Dusk on every third Arctic stage.** By request the Arctic
     stays in daylight and only every third of its stages runs at dusk.
     `RegionDef.dusk` now means "some stages run after sunset", and
     `stageAtDusk(index)` (in `StageGenerator`) picks them: the region's
     third, sixth… stage in the schedule, counted from index 0, so the
     first Arctic stage (index 4) is by day and the first at dusk is index 22. The brief carries it as `dusk: true` (absent otherwise, so no other
     brief changes), and `dayTheme(region, dusk)` returns the dusk theme
     (`DUSK_LIGHTING`, faint tyre marks, the car's lamps) for it, memoised
     per region and time of day. Counting by schedule rather than drawing
     from the seed keeps the cadence even and the same in every game.

189. **2026-11-09 — Wheel ruts in the Arctic snow, and lower boards.** By
     request the snowed-over road carries subtle tyre tracks with some
     relief: on a banked region's snow road `RoadBuilder` cuts the
     carriageway into bands that dip into two grooves 1.55 m apart (a car's
     track), each about 0.8 m across with sloped walls and a floor 4.5 cm
     down, shaded 10 % darker on the walls and 20 % on the floor where the
     snow is packed (half that was lost against the pale road by day); the pair wanders up to 0.3 m off the centre line over
     about eleven metres, and each groove strays up to 0.12 m on its own,
     swells and narrows by a third every few metres and has uneven walls
     (its floor's edges anywhere from 15 to 35 % of its width off its
     middle), all from the road's own noise, so the tracks read as trodden
     rather than ruled. The dips are drawn only
     (`Strip.dip`, `Strip.tone`); the wheels still ride the terrain's deck,
     4.5 cm being below anything the car could feel. The time-control boards
     are a metre tall (1.15 before) and now stand on the ground at their
     middle rather than the highest point under them, still running down
     past the lowest, so on a bank's slope the snow may bury the foot of
     their high end instead of the board towering over it.

190. **2026-11-09 — No villages on Arctic stages.** By request the Arctic is
     open country only: `towns` is false for the region, so a town slot
     (every third rally stage, `hasTown`) that falls on an Arctic stage
     stays open road, as on the Coast and in the Desert. Villages now come
     round on Forest (every surface) and the Alpine. The Arctic stages
     that had a village drive a different road now; their best times stay
     (the save version is unchanged).

191. **2026-11-09 — The Arctic's crowd on Alpine stages too.** By request
     the Alpine gets the Arctic's spectators: `scenery.spectators` 2.2 on
     the region, so `scatterSpectators` stands the same groups at the start,
     the checkpoints and along the verges. Their clothes follow the region's
     off-road ground (`spectatorOutfit`), which is snow in the Alpine, so
     they come in the same winter jackets, hats and boots. The Arctic keeps
     its crowd.

192. **2026-11-09 — Alpine crowds behind berms.** The mud stages' earth
     berms in front of the crowds became a region scenery flag,
     `scenery.berms`, set on the Forest's mud override and on the Alpine, in
     place of the `surface === 'mud'` test in `SceneryScatter`. On the Alpine
     the berm takes the field's own tint (`grassLow` darkened), so it reads
     as a low heap of grey snow with the winter crowd standing behind it.

193. **2026-11-10 — Remove Nightcity.** Removed the hidden `N` action,
     session state, alternate world theme, scenery and car variants, neon
     material patching, bloom effect and HUD tag. The stage renderer now builds
     its region's day or dusk theme once instead of supporting in-place theme
     swaps. Ordinary dusk lighting remains. The original implementation
     decision stays in this log as historical context; current gameplay,
     architecture and testing docs describe only the supported game.

194. **2026-11-10 — Spectators on open-road stages, none on the coast or
     circuits.** `stageScenery` supplies a modest spectator density to the
     Forest, Alpine, Desert, Urban and Arctic stages. Desert crowds are
     event-only (start, checkpoints and finish); other crowds also gather at
     crests and along the road. Small terrain mounds sit between roadside
     crowds and the road, except where a building blocks a segment or another
     road passes beneath. Coast and circuit densities are zero, per follow-up
     request. Circuit corner grandstands remain as empty structures; seated
     spectator props were removed with the circuit crowd.

195. **2026-11-10 — Nine explicit stage types, one fixed surface each.** The
     region/surface pair model made Pinewood, Autumnal and tarmac Forest
     stages look like one type with weighted surfaces, and let Alpine draw
     between snow and tarmac. The catalog is now nine stage types with one
     fixed surface each; Pinewood and Autumnal name the former Forest gravel
     and mud variants. The seven rally slots reference type IDs directly;
     cities and circuits keep their existing cadence. `seedKey` preserves
     procedural world seeds, while a reserved RNG draw preserves the other
     brief draws. Save version 8 drops v7 Alpine records because some were
     made on tarmac; legacy cycle IDs remain local to the save migrator.

196. **2026-11-10 — Autumnal inherits the Arctic's wheel ruts, recoloured for
     mud.** The Arctic's `RoadBuilder` bands already form two wandering,
     irregular grooves. Reuse that geometry on `mud`, but make the grooves
     deeper (7.5 cm) and shade the packed track darker than the `#6b4d33`
     road base. Both rut depth and tint fade with the town's tarmac transition.
     The existing per-surface skid ink remains responsible for live tyre marks.

197. **2026-11-10 — Faded lines and puddles on Autumnal.** Its edge line uses
     a light-brown theme colour instead of white. Mud puddles are deterministic
     glossy road meshes: scattered along open road and clustered after each
     jump crest. Autumnal gets low 0.75 m crests (30 m long, about every 220 m)
     so those landing puddles exist in the type. The puddle meshes are owned
     and disposed by `RoadBuilder`, as part of the road.

198. **2026-11-10 — Remove Autumnal puddles; fade the edge lines further.** By
     request, the procedural puddle meshes and ripple textures are removed;
     the Autumnal jumps and mud ruts remain. Its edge line changes to a paler
     tan (`#c0a682`) and uses the road's per-sample shade variation so it reads
     worn into the muddy surface instead of freshly painted.

199. **2026-11-11 — Cut Autumnal edge tracks into the road ribbon.** Appending
     recessed edge grooves underneath full-width road bands hid their dark
     floors and sloped walls. The edge and centre tracks now share boundaries
     in a single non-overlapping ribbon. Edge floors use the same 0.68 mud
     tone and 7.5 cm recess as the centre tracks. A downward-ray test checks
     that both dark edge floors are exposed, not merely present in the mesh.

200. **2026-11-11 — Blend Autumnal mud into the grassy verge.** Subdivide
     the existing verge ribbon and blend its vertex colours from the road's
     mud colour to the usual verge colour over 1.3 m. The outer verge keeps
     its terrain-matching colour, and the existing town fade still turns it
     into pavement. No overlay, texture allocation or physics change is needed.

201. **2026-11-11 — Faceted Autumnal verges replace the soft blend.** By
     request, the shoulder now uses irregular triangular patches in three
     earthy tones rather than interpolating mud and grass colours across
     vertices. Each triangle has one flat colour, with slight seeded shade
     variation; the outer band keeps the existing verge palette and town
     transitions still meet the pavement. The tyre grooves are unchanged.

202. **2026-11-11 — Slightly faster mud driving.** Lower mud's extra
     speed-proportional drag from 0.22 to 0.18 while retaining its 0.55 grip.
     This reduces resistance without changing cornering or adding engine
     boosts. Catalogue-wide fixed-gear comparisons verify the pace benefit
     independently of automatic gearbox shift thresholds; mud remains slower
     than grass in the existing full-throttle surface test.
