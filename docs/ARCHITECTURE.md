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
  API --> Files[.data/games/*.json]
  API --> Supabase[(Supabase, optional)]
```

- **`src/game`, `src/lib`** — pure TypeScript. No `three`, no React. Vehicle
  physics, stage generation (splines, checkpoints, timing), economy, save
  format. Everything here is deterministic and unit-tested.
- **`src/render`** — three.js geometry/material builders, terrain chunk
  workers, particles, skid marks. Each builder returns disposables.
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
5. HUD snapshot is pushed to the store at ≤ 10 Hz.

## Stage pipeline (milestone 3)

```mermaid
flowchart LR
  Seed[gameSeed + index] --> Gen[StageGenerator\nroad, gates, par]
  Gen --> Field[TerrainField\nheights + surfaces]
  Field --> Scatter[SceneryScatter\nprops + colliders]
  Gen & Field & Scatter --> World[StageWorld]
  World --> Session[DrivingSession\nVehicleSim + StageRun]
  World --> Renderer[StageRenderer]
  Renderer --> Terrain[TerrainChunkManager] -->|seed| Worker[terrain.worker]
  Renderer --> Scenery[SceneryChunkManager]
  Renderer --> Road[RoadBuilder + GateBuilder]
```

- `DrivingSession` (components/game) is a plain class held in a ref. It owns
  the sim, the stepper, input, the camera rig and the `StageRun`, and
  publishes telemetry/HUD snapshots to Zustand at 10 Hz.
- `StageRenderer` owns every three.js object for a stage and disposes them
  together; chunk managers stream around the car via `ChunkStreamer`.
