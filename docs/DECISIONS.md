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

81. **2026-11-01 — Town sections.** About a third of stages after the first
    (`hasTown(seed, index)`, a hash of the stage seed; never index 0, which
    the splash demo and the random-seed smoke tests drive) route through a
    small town. The town draws from its own sub-seed so the brief and the
    open-road walk keep their RNG streams and existing plain stages are
    untouched. The centreline builder straightens for 60 m, then lays the
    grid on its 20 m control polygon: one block (60 or 80 m) in, a 90° turn
    at each corner (patterns L-R, R-L, L-R-L-R, R-L-R-L, L-R-R-L, R-L-L-R,
    all summing to zero so the route leaves on its arrival heading, two-turn
    patterns only under 1.5 km), one block out; Catmull-Rom rounds each
    corner to a ~11 m radius, which the ribbon and its 2 m verges survive
    without folding and which keeps the self-approach rule (legs ≥ 60 m
    apart). Side streets are 32 m dead-end stubs: straight on and the far
    side at every corner, plus a crossroads halfway along the entry and exit
    legs on 80 m blocks (on 60 m blocks its building rows would meet the
    corner stubs' rows). A barrier row stands 14 m down each stub, a yellow
    direction board 2.2 m beyond the corner on the blocked straight. Buildings
    (four footprints: townhouse 8×7, shop 10×8, tower 6×6, hall 12×9) line
    every street on both sides with fronts 3 m beyond the edge, starting
    18 m from any intersection so facades on crossing streets never meet.
    Terrain: a level plateau is the ground the road bed is cut into
    (`groundHeight` blends the hills to the footprint's mean height over
    40 m, under the smoothing, trench and verge rules, so the bed tests hold
    through town), with the route pinned dead level inside the town interval
    and the grade clamps ramping the approaches; a pad applied last (the
    house mechanism) was rejected because it would override the trench and
    make the ribbon and ground disagree. Side streets are paved plates at
    deck height and every town street counts as tarmac for grip whatever the
    stage surface. Collisions gained oriented boxes (walls and barrier rows)
    beside the circle grid; rows of circles were rejected for scalloped
    walls and the 64-candidate cap. Checkpoint boards keep 40 m clear of the
    town interval, marker posts skip it, wild scenery stays 10 m off the
    plateau and farmhouses 40 m. The alpine-vs-forest curvature test now
    skips town stages (its 15% margin on six seeds flipped on one town's
    different post-town draw). A dev-only `?spawn=` flag places the car along
    the road for inspection.
