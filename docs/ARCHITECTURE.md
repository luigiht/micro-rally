# Architecture

## Layers

```mermaid
flowchart TD
  UI[components/hud — React + Tailwind] -->|reads ≤10 Hz| Store[state — Zustand]
  Scene[components/game — R3F] -->|imperative getState| Store
  Scene --> Render[render — three.js builders + workers]
  Scene -->|fixed 120 Hz step| Sim[game — pure TS sim]
  Store --> Sim
  Store --> Save[game/save — serialise + migrate]
  Save -->|fetch| API[app/api/games/:id]
  API --> Files[.data/games/*.json\ndev / self-hosted]
  API --> Supabase[(Supabase Postgres\nproduction)]
```

- **`src/game`, `src/lib`** — pure TypeScript. No `three`, no React. Vehicle
  physics, stage generation (splines, checkpoints, timing), economy, save
  format. Everything here is deterministic and unit-tested.
- **`src/render`** — three.js geometry/material builders, terrain chunk
  workers, particles, skid marks. Each builder returns disposables.
- **Car models** — `components/game/CarModel` builds every car from
  primitives (`bodies/*Body.tsx`) around shared wheels, interior and an
  imperative handle; the lofted hulls (`render/car/CarHull.ts`) and the
  buggy's free-standing mudguards (`render/car/FenderShell.ts`) are pure TS
  builders. The GLBs in `assets/` are measurement references only.
- **`src/components/game`** — R3F `<Canvas>`, scene graph, camera rigs. The
  frame loop accumulates time and steps the sim at a fixed 120 Hz, then
  interpolates transforms for rendering.
- **`src/components/hud`** — menus, HUD, garage, settings. Subscribes to
  throttled store slices; never re-renders per frame.
- **`src/state`** — Zustand stores (game/meta state, settings).
- **`src/i18n`** — typed dictionaries; `en` is the source of truth for keys.

## Frame loop (from milestone 2)

1. `useFrame` reads input refs.
2. Accumulator steps `VehicleSim` at `1/120 s`, keeping previous + current
   state.
3. Render transforms = lerp/slerp(previous, current, alpha) into reused
   temp objects.
4. Active `CameraRig.update(dt)` positions the camera.
   `wheelContacts` (pure) turns the pose + slip into four contact patches and
   `SkidMarks` (render) appends quads to its ring buffer when a tyre scrubs.
5. HUD snapshot is pushed to the store at ≤ 10 Hz.

## Stage pipeline (milestone 3)

```mermaid
flowchart LR
  Seed[gameSeed + index] --> Gen[StageGenerator\nroad, gates, par]
  Gen --> Town[TownGenerator\nstreets, junctions, terraces, walls]
  Gen & Town --> Field[TerrainField\nheights, plateau, surfaces]
  Field --> Scatter[SceneryScatter\nprops + colliders]
  Gen & Field & Scatter --> World[StageWorld]
  World --> Session[DrivingSession\nVehicleSim + StageRun]
  World --> Renderer[StageRenderer]
  Renderer --> Terrain[TerrainChunkManager] -->|seed| Worker[terrain.worker]
  Renderer --> Scenery[SceneryChunkManager]
  Renderer --> Road[RoadBuilder + GateBuilder]
  Renderer --> Streets[TownStreetBuilder\nTownJunctionBuilder, TownWallBuilder]
```

- Coast (`game/stage/CoastShape.ts`, `CoastRoad.ts`, `Coastline.ts`): the
  shape is the lie of the land in stage-axis coordinates (water line, beach,
  terraced cliff band, hillside), the road is drawn on it with hairpin
  stacks, and the coastline reads the ground in world space and lays the
  retaining walls on whichever side falls away; `TerrainField.baseHeight`
  delegates to it and carries its rock mask in every sample, `SceneryScatter`
  reads its shore distance and slope, `StageWorld` adds its wall boxes as
  colliders, the mesher paints the mask rock and the shore sand, and the
  renderer draws the walls (`render/road/SeaWallBuilder.ts` over
  `StoneWallGeometry.ts`) and the sea (`render/terrain/SeaPlane.ts`).
- Arctic: no modules of its own. The region's `terrain.banks` heaps the
  snow ridges in `TerrainField.bankLift` (both the mesh sample and the
  wheels' deck), `SceneryDensity.spruces` feeds the `spruce` prop kind
  through the ordinary scatter, and `RallyKits` dresses it in three parts
  (trunk, tinted foliage, snow caps); Nightcity treats spruces as trees.
- Circuits (`game/stage/CircuitGenerator.ts`, `CircuitStage.ts`,
  `CircuitTrackside.ts`): every tenth stage is a closed race
  circuit. The generator draws a lap as a closed `RoadPath` (`closed`: the
  last sample sits on the first, `sample` wraps), and one lap of geometry is
  all the rest of the pipeline sees: terrain (`RoadProfile.ts` smooths the
  road profile cyclically), road mesh, scenery and nearest-point queries work
  unchanged. Only timing knows about laps: the gates are unrolled over every
  lap with distances that keep counting, and `StageRun` unwraps the lap
  position against the last gate passed. The trackside (kerbs, gravel
  traps, barrier lines, catch-fence flags, the grandstand's footprint) is
  derived from the lap's curvature, memoised per stage; `TerrainField`
  reads it for the flat runoff, kerb bumps and surfaces, `SceneryScatter`
  for clearance, `StageWorld` for the barrier colliders, and the renderer
  draws it (`render/road/KerbBuilder.ts`, `BarrierBuilder.ts`,
  `CircuitDressingBuilder.ts` over `TrackMesh.ts`), each behind its own
  `StageRenderOptions` flag.
- Desert (`game/stage/Oases.ts`): `TerrainField.duneHeight` is the dune sea;
  `planOases` picks level hollows off the road from the stage seed,
  `scatterScenery` sinks them as pads and rings them with palms, and the
  renderer draws the pools (`render/terrain/OasisBuilder.ts`); the palm is a
  prop kind with its own kit.
- Towns (`game/stage/Town.ts`, `TownPlan.ts`, `TownGenerator.ts`): every
  third stage (3, 6, 9, …), whatever its region, carries one; `planTown` draws
  the route through a hill town as legs (straights with 60°–105° corners laid
  as 12 m arcs, tight curves, a narrow old-town section), validated against
  the self-approach rule; the centreline builder (`Centreline.ts`) steers
  onto the stage axis, lays them and resumes on the arrival heading, and
  `layoutTown` derives streets, junctions (`TownJunctions.ts`: arms, wedges,
  side-street cuts), blocked side streets with cone rows and end buildings
  (`TownSideStreets.ts`), direction boards, and then the village itself:
  facade polylines a pavement beyond the route's real edge and along every
  side street, walked by `TownTerraces.row` to stand houses a party wall
  apart with garden walls over every gap, L-walls round each junction wedge
  with a tree and bushes planted behind them, and the footprint.
  `TownKerbs.ts` traces each junction's kerbs exactly (kerb returns between
  side streets and the route's curved edge, with normals) and the stretches
  where the ribbon hands its verge and line over. `TerrainField` tames the hills inside the
  footprint (streets still climb and dip), cuts side streets into the slope,
  levels a terrace under each building at its door and treats every town
  street as paved; `SceneryScatter` keeps wild scenery only off streets,
  buildings and walls (`townBlocks`) and emits the town's props; buildings,
  walls and barriers collide as oriented boxes (`vehicle/Collisions.ts`).
  Render side: `RoadBuilder` paves the route through town at its per-sample
  width with kerbed pavements cut exactly at each junction opening,
  `TownJunctionBuilder` lays the pavement band and edge line as offset strips
  along the kerb outlines and fills the mouths with tarmac cut from the
  junction's distance field (`Isobands.ts`), `TownStreetBuilder` lays the
  side-street plates, lines and pavements beyond each cut, `TownWallBuilder`
  merges the garden walls, and `SceneryChunkManager` instances the building,
  flower-box and street-furniture kits (`render/scenery/BuildingGeometry.ts`,
  `CivicGeometry.ts`, `PlanterGeometry.ts`, `StreetFurnitureGeometry.ts`).

- Urban (`game/stage/UrbanPlan.ts`, `UrbanGenerator.ts`, `UrbanField.ts`,
  `Roundabout.ts`, `Tram.ts`): the city is a town that spans the stage.
  `planUrban` draws a `TownPlan` whose legs run from the first control step
  past the run-out (blocks with right-angle, skewed and kinked corners, each
  with its own corner radius, avenue curves, lane widths per block, and
  roundabouts as a deflection–circulation–deflection run of curve legs tagged
  with their island), so `buildCentreline` lays it and the open-road walk
  never resumes; `layoutTown` takes the region's `UrbanDef` and adds
  crossroads every block, the roundabouts (ring chords, blocked exits, island
  greenery, facade gaps), the trams and the building mix, and stamps the
  relief; `TerrainField` delegates to `UrbanField` for the per-town relief
  share, the roundabout levelling in `groundHeight` and the tram ridge in
  `heightAt`; `StageGenerator` uses the boulevard as the base width, lays
  the gates between junctions and sizes each to its street. Render side:
  `RoundaboutBuilder` (ring tarmac, island and outer kerbs, lines, grass),
  `TramTrackBuilder` (sett bed and rails), `TramFleet` (the trams on the
  lines, posed each frame from `TramService`'s timetable), `LaneMarkings` (dashed dividers
  and centre lines from the per-sample width, two lanes along a parking
  stretch), `CrossingBuilder` and `ParkingBayBuilder` over the shared
  `MarkingMesh`, and the building kits: `UrbanGeometry` (block, office),
  `TenementGeometry`, `ArcadeGeometry` on the shared `FacadeGeometry` and
  `RooftopGeometry` part libraries, `CityFurnitureGeometry` and
  `CityVehicleGeometry` (the parked cars, on the hull stations the drivable
  bodies share through `render/car/HullShapes.ts`) for the props. The city's street detail is pure data
  worked out from the town and the route when asked, never stored on
  `TownDef`: `Crossings.ts`, `ParkingBays.ts`, `StreetFurniture.ts`;
  `UrbanStreets.ts` fits the side streets to the roads they meet,
  `TownWallGaps.ts` closes the garden walls, `BuildingCatalog.ts` holds the
  footprints, doors and style mixes. Anything that asks "what stands near
  here" goes through `SpatialHash.ts` (a cell grid; `BuildingIndex.ts`
  keeps the buildings with their corners cached) rather than a scan: house
  placement, the wall closer, furniture clearance, and `TerrainField`'s
  terrace pads and side-street decks, so a city of thousands of buildings
  lays out in well under a second. `StageRenderer` builds a new city's
  town meshes a few per frame from `update` during the countdown, roads,
  gates, terrain and scenery first.
- **Themes (Nightcity).** `render/theme/WorldTheme.ts` is the look as data:
  sky, fog, lights, terrain mode, road, gate and wall colours, scenery kit
  set and tyre-mark ink. `dayTheme(region)` is today's look; `NIGHTCITY_THEME`
  the hidden cyberpunk one that `N` toggles through `uiStore.nightcity`.
  `StageRenderer.setTheme` re-dresses a stage in place: terrain material
  swap, road/gates/town rebuilt in the theme's colours, scenery rebuilt with
  the theme's kits (`scenery/kits/RallyKits.ts`, `NightcityKits.ts`, chosen
  by `sceneryKits.ts`, which tints the rally props in `stagePalette(stage)`:
  the region's palette, or the one its surface swaps in, autumn on Forest
  mud). Neon is HDR vertex colour: `themeColor` bakes a
  glowing colour above one and `theme/NeonMaterial.ts` patches the merged
  surfaces' materials to draw such faces as emission; glow kits use an unlit
  material. `DriveRig` passes the theme to `SceneLights`, the tyre marks, the
  car (`bodies/NightcityBody.tsx` over `render/car/NightcityHull.ts`, one
  parametric hull for every spec) and mounts `NightcityEffects` (bloom +
  ACES tone mapping) only while the mode is on.
- `DrivingSession` (components/game) is a plain class held in a ref. It owns
  the sim, the stepper, input, the camera rig and the `StageRun`, and
  publishes telemetry/HUD snapshots to Zustand at 10 Hz. It also records the
  run into a `ReplayTrack` (`game/replay/`, pure TS: one sample per fixed
  step, blended on playback) and, when the HUD asks after the finish, plays it
  back in place of the sim: the car follows the recording, input is ignored,
  the camera rigs keep working, and Esc, the HUD's button or the end of the
  recording leaves it with the result panel back on screen.
- Camera rigs (`components/game/cameras/`): `ChaseCameraRig`,
  `FirstPersonCameraRig` (interior), `IsometricCameraRig` and
  `CinematicCameraRig`, built by `createCameraRig` and swapped by
  `DrivingSession` when the setting changes. The cinematic rig's director,
  `CinematicShots.ts`, is pure TS: it draws trackside, helicopter,
  chase-car, camera-car and reverse tracking shots, stands trackside cameras
  beside the stage road ahead (lifted clear of the terrain between them and
  the car) and cuts under the 180° and 30° rules; the rig pans, follows and
  zooms each shot with frame-rate-independent damping and hard-cuts between
  them.
- `StageRenderer` owns every three.js object for a stage and disposes them
  together; chunk managers stream around the car via `ChunkStreamer`.
  `CarInterior` (components/game) assembles the first-person cabin from
  `interior/interiorSpecs.ts` (per-car envelope, kit and palette) using
  `interior/InteriorParts.tsx` and `interior/InteriorDash.tsx`; the pose
  carries gear and turbo state so levers and lamps animate per frame.
  `SceneryScatter` also dots houses (kind `house`, three-circle colliders)
  well back from the road; `HouseGeometry` builds the two vertex-coloured
  instanced parts. `GateBuilder` draws start/finish gantries and, at
  checkpoints, a pair of rally time-control boards.
- `stageBrief` draws a stage's name, surface, length and par from the same
  RNG stream `generateStage` uses, without building the road; `StageHistory`
  derives the frontier (first unfinished stage) from `records` and picks the
  window the Game panel's `StageList` shows. `gameStore.driveStage` re-drives
  any stage up to the frontier.

## Save pipeline (milestone 6)

```mermaid
flowchart LR
  Splash[SplashScreen] -->|load id| Manager[SaveManager]
  Manager --> Local[LocalSaveBackend\nWeb Storage]
  Manager --> Remote[RemoteSaveBackend\nfetch]
  Remote --> Route[app/api/games/:id]
  Route --> Files[gameFileStore\n.data/games/*.json]
  Store[gameStore] -->|subscribe| Autosave[useAutosave] --> Manager
```

- `src/game/save` is pure: `GameId` (Crockford base32, normalize/format) and
  `SaveFile` (versioned schema, defensive `parseSaveFile`, `newestSave`).
- `SaveManager` (`src/lib/save`) writes locally first, then online; a failed
  upload flips `saveStore.status` to `offline` and the next save retries.
  Loads return the newest of the two copies.
- `useAutosave` reads the store imperatively and saves on start, 2.5 s after
  progress changes, every minute, on `visibilitychange`/`pagehide` (with
  `keepalive`) and on unmount.
- The route validates every body with `parseSaveFile`; IDs are checked before
  any key or filesystem path is built. `gameStore.ts` picks the backend from
  the environment: Supabase Postgres over its REST API when `SUPABASE_URL`
  and `SUPABASE_SERVICE_ROLE_KEY` are set, the file store otherwise, and none
  on Vercel without Supabase (the API answers 503 and saves stay on the
  device). See `docs/DEPLOY.md`.
