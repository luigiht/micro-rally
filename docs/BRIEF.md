# Micro Rally — design brief

This is the original design brief. Project rules live in
[../CLAUDE.md](../CLAUDE.md).

## Concept

Micro Rally is a small, cozy, flat-shaded low-poly rally game that runs in the
browser (and later as iOS/Android apps). The player drives point-to-point
rally stages through procedurally generated countryside, earns prize money
for finishing, and spends it on car upgrades and new cars. No real-money
mechanics, no ads, no dark patterns, no analytics. Everything (terrain,
trees, cars, UI sounds, engine note) is generated procedurally — zero
external art or audio assets.

Tone: relaxed and charming rather than hardcore sim. Think "tabletop diorama
rally": a chunky car, faceted hills, cone trees, gravel kicking up as little
cubes, soft shadows and a touch of bloom. Short, readable UI copy with a bit
of dry humour in upgrade descriptions. Use the name "Micro Rally" in the
page title, start screen logo (an inline SVG wordmark), Open Graph metadata
and the Capacitor app names; package name `micro-rally`.

## Stack (non-negotiable)

- Next.js (latest stable, App Router), React 19, TypeScript `strict`
- three.js via `@react-three/fiber` + `@react-three/drei`
- `postprocessing` + `@react-three/postprocessing` (bloom, SSAO, SMAA,
  vignette, tone mapping), all behind quality tiers
- `simplex-noise` for terrain; chunk meshing in Web Workers
- Zustand for state; Tailwind CSS 4 for HUD/menus
- Typed message dictionaries in `src/i18n` (English, Spanish, Italian) — no
  i18n library, no hard-coded player-facing strings in components
- Web Audio API for synthesised SFX and engine sound
- Vitest (unit), Playwright (e2e + screenshots), ESLint (zero warnings),
  Prettier; pnpm as package manager, version pinned in `package.json`
- One API route `/api/games/[id]` for online saves: local JSON files in
  `.data/games/` by default, Supabase when `SUPABASE_URL` /
  `SUPABASE_SECRET_KEY` are set (`GAME_STORE=local` forces files)
- Capacitor 8 shells for iOS/Android around a static export
  (`pnpm mobile:build`, `pnpm mobile:ios`, `pnpm mobile:android`)

## Layout

- `src/game/**`, `src/lib/**` — pure TS: `vehicle/` (physics), `stage/`
  (track generation, checkpoints, timing), `economy/` (money, upgrades,
  cars), `save/` (serialisation + migrations)
- `src/render/**` — three.js: terrain chunks + workers, road mesh builder,
  car models, trees/rocks/scenery, particles, skid marks, effects
- `src/components/game/**` — R3F canvas, scene, camera rigs
- `src/components/hud/**` — React HUD, menus, garage, settings
- `src/i18n/messages/{en,es,it}.ts`
- `src/app/api/games/[id]/route.ts`
- `tests/unit`, `tests/e2e`

## Core loop

1. **Start screen.** Micro Rally wordmark, enter a driver name and press
   Play, or paste a Game ID to continue a game. Returning players get a
   Continue button. The Game ID is also in the URL so a bookmark resumes the
   game. Anyone with the ID can play it; say so in the UI.
2. **Service park (hub).** Shows money, the current car, the next stage card
   (name, length, surface, weather) and buttons: Drive, Garage, Settings.
3. **Drive a stage.** Countdown 3-2-1-GO, then drive from start to finish
   through gated checkpoints. A live split against your best time and a
   simple co-driver pace-note strip ("left 3 into right 5 tightens") are on
   the HUD. Finishing pays prize money scaled by stage length, surface
   difficulty and how close you got to the par time; stage records are kept.
   Going off-road slows you (grass/mud drag); hitting a tree costs time and a
   small repair fee; a Reset-to-track key (R) respawns at the last checkpoint.
4. **Garage.** Two tabs mirroring an incremental-game shop:
   - **Upgrades** (repeatable, price rises ~1.15× per level): Engine (+top
     speed/accel), Gearbox (+accel), Tyres (+grip on current surface class),
     Suspension (+stability on bumps/jumps), Brakes, Turbo (short boost
     charge), Aero (+high-speed grip), Sponsor Deal (+% prize money), Lucky
     Charm (+2% chance a stage pays 5×).
   - **Cars** (one-off purchases, free to switch once owned): e.g. Hatchback
     (free, balanced), Classic Coupé (fast, twitchy), 4×4 Pickup (grippy,
     slow), Group-B-style Monster (expensive, everything up). Each car is a
     distinct procedural low-poly model built from primitives.
5. **Progression.** Stages unlock in a loop of regions (Forest, Coast,
   Desert, Alpine, Night), each with its own palette, surface mix
   (gravel/tarmac/snow/mud), scenery set and par times. After the last stage
   the loop continues with harder, longer variants, so there's always a next
   stage.

## Three camera views (V cycles; also a toggle on the HUD)

- **Cockpit (first person).** Behind the wheel: visible dashboard with a
  working speedo/rev gauge, a steering wheel that turns with input, bonnet
  and wing mirrors. Drag or arrow keys look around; C re-centres.
- **Chase (third person).** Classic rally cam behind and slightly above the
  car; springs/damps to the car's velocity, pulls back with speed, rolls a
  little in corners, and keeps the horizon stable over jumps.
- **Isometric (top-down from above).** Fixed-angle orthographic-feeling
  camera (true perspective with a long lens is fine) at ~45° yaw / ~55°
  pitch, following the car; mouse wheel / pinch zooms. Steering stays
  car-relative in all three views.

All rigs live in `src/components/game/cameras/` and share one `CameraRig`
interface so switching is instant and leak-free.

## Vehicle physics (pure TS, `src/game/vehicle`)

Arcade-leaning but satisfying: a simplified bicycle model with per-surface
grip, weight transfer approximation, handbrake for Scandinavian flicks,
engine torque curve and 5 gears with automatic shifting (manual optional in
Settings), terrain-height following with suspension spring/damper, airtime
and landing. Surfaces: tarmac, gravel, mud, snow, grass (off-track). Expose
tunable parameters per car and per upgrade level. Unit-test: top speed per
car, braking distance, grip ordering by surface, checkpoint order
enforcement, prize formula.

## World & stage generation

- Deterministic from a seed derived from (game seed, region, stage index),
  so a stage is identical every time you drive it and records are fair.
- Spline-based road laid over simplex terrain; the terrain is flattened
  along the road corridor; road mesh is a ribbon with a different
  colour/roughness per surface and painted edge markers; start/finish
  gantries and checkpoint arches built from primitives.
- Scenery scattered with density by region: cone trees, blob bushes, rocks,
  fences, hay bales, spectators as tiny capsules behind tape. Chunked and
  frustum-culled; instanced meshes for repeated props.
- Weather/time: clear, overcast, rain (wet grip multiplier + particles),
  night (headlights, lower ambient). Each is a quality-aware effect.

## Controls

| Input               | Action                                                        |
| ------------------- | ------------------------------------------------------------- |
| W/S or ↑/↓          | Throttle / brake-reverse                                      |
| A/D or ←/→          | Steer                                                         |
| Space               | Handbrake                                                     |
| Shift               | Turbo (when owned)                                            |
| R                   | Reset to last checkpoint                                      |
| V                   | Cycle Cockpit / Chase / Isometric                             |
| C                   | Re-centre look (cockpit)                                      |
| Mouse wheel / pinch | Zoom (isometric & chase)                                      |
| ` (backtick)        | Debug overlay (fps, draw calls, physics state)                |
| Esc                 | Pause / close panel                                           |
| Gamepad             | Left stick steer, RT/LT throttle/brake, A handbrake, Y camera |
| Touch               | On-screen steer + pedals, camera button, large tap targets    |

## Settings panel

Language (EN/ES/IT), sound on/off + volume, engine volume, graphics quality
(Auto/Low/Medium/High/Ultra with one-line descriptions of what each adds),
camera default, steering sensitivity, automatic/manual gearbox, reduced
motion override, and the full controls table above.

## Saving

Autosave to device and online: every minute, a few seconds after a purchase
or stage finish, and on page unload. If the server is unreachable, keep the
save locally and retry. Save format is versioned with migrations. The Game
panel shows the Game ID with Copy, "Delete this game", and a privacy policy
link. Never store anything beyond the driver name and game state.

## Milestones

1. Scaffold: Next.js + TS strict + Tailwind + R3F + Zustand + Vitest +
   Playwright + ESLint/Prettier; CLAUDE.md and docs created; CI scripts.
2. Pure-TS vehicle sim with unit tests; a flat test track; chase camera;
   keyboard driving feels good before anything else is built.
3. Procedural terrain chunks in workers + spline road + checkpoints +
   start/finish; stage timing and prize money; first region (Forest).
4. Cockpit and Isometric cameras; V cycling; reduced-motion handling.
5. HUD (speed, gear, split, pace notes), service park, Garage with Upgrades
   and Cars tabs, procedural car models; economy tests.
6. Save system (local + API route + Game ID in URL), start/continue screens.
7. i18n (EN/ES/IT), Settings, quality tiers, post-processing, audio.
8. Remaining regions, weather, night, polish, Playwright smoke tests and a
   `pnpm screenshot` script for `docs/screenshot.png`.
9. Capacitor iOS/Android projects and `docs/ANDROID.md`.
