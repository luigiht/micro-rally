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
