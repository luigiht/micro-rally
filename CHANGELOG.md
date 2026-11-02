# Changelog

All notable changes to Micro Rally, newest first. The project has no version
tags yet: `main` is deployed continuously, so entries are grouped by the day
they landed. The numbered entries in [docs/DECISIONS.md](docs/DECISIONS.md)
hold the reasoning behind each change; the numbers in brackets point there.

## Unreleased

### Added

- `H` hides and shows the HUD chrome (clock, tags, money, toolbar, progress
  bar, speed readout, debug overlay, replay bar). Dialogs, the countdown and
  the touch controls stay; Esc still works. Listed in the controls table.
  [90]
- End-to-end test for the HUD toggle.

### Changed

- The replay no longer loops: when the recording runs out it leaves the
  replay by itself and the "Stage complete" panel comes straight back. [89]

## 2026-11-02

### Added

- **Cinematic camera**, a fourth view after Chase, Interior and Isometric.
  A pure-TS director draws trackside TV cameras on the verge ahead (pan,
  14°–50° zoom with distance, cut once passed), a helicopter, a low chase
  car, a camera car alongside and a reverse tracking shot, under the 180° and
  30° editing rules; the rig pans, follows and zooms each shot with
  frame-rate-independent damping and hard-cuts between them. Reduced motion
  fixes the lens, grounds the helicopter and holds shots longer. [87]
- **Replay after the finish.** The run is recorded one sample per fixed step
  until three seconds past the finish line; the result panel offers "Watch
  replay", during which the sim stands still, the car follows the recording,
  input is ignored and C or Settings still switch camera. Esc or "Exit
  replay" returns to the results. The `?spawn=` dev aid now counts the
  checkpoints behind the spawn as passed. [89]
- Hull lamp lenses: side decals across the twisted C-pillar band and cap
  decals on the nose and tail panels, drawn unlit as a second material group.
  [88]
- Village kerbs traced exactly against the ribbon; cone rows across blocked
  side streets, corner greenery and flower boxes under the windows. [83]

### Changed

- A town on every third stage, the last of each region's run, whatever the
  seed (previously a random slot in each trio). [86]
- Prize per kilometre raised from 120 to 200 and then to 800: an upgrade
  every three or four stages, a new car every four to seven. [85]
- Side streets are fitted among each other before they are laid (cut down,
  never below 20 m); edge lines sit 2 cm over the deck; the town fade is 40 m.
  [84]
- Raised kerbs with vertical faces; corner aprons start where the ribbon
  leaves its line; straights pinned to their line at corners; one width
  through each junction, held out to every kerb hand-off.
- Junction tarmac sealed: seams between fill polygons, depth offset, welded
  normals.

### Fixed

- The Albion RS Hatch's tail lamps stood proud of the pillars as red bars;
  they are now painted into the shell. [88]

## 2026-11-01

### Added

- **Town sections**: a level plateau carrying a street grid the route threads
  with right-angle turns, blocked side streets closed by cones, direction
  boards, low-poly buildings, pavements and lamp posts. Built up over the day
  from foundations (box colliders, plateau terrain, paved interval), through
  the generator and plates, hill towns with tamed relief and terraces,
  irregular corners and tight narrow curves, building and street-furniture
  kits, 12 m corner arcs with steer-in and verified self-approach, to
  villages with unbroken facades, garden walls behind every pavement,
  kerb-return junctions and trees in the gaps. [81, 82]
- Per-car rally interiors: cabin envelope, kit and palette per car, working
  speedo and tacho, turning wheel, gear lever and turbo lamp. [79]
- Sochaux T16 (205 T16-style Group B hatch). [76]
- Stage list in the Game panel: four stages by default, "Show more", full
  width rows on touch. [71]
- Touch pause menu opening Game, Garage and Settings; touch controls listed
  in Settings. [73, 75]

### Changed

- Tricolore Coupé rebuilt as a Stratos-shaped Group 4 wedge; Boreal Saloon
  rebuilt on the Impreza S6 WRC; Dakar truck exterior detail pass. [77, 78,
  80]
- Handbrake on the right, drawn as a pedal pad. [72]
- `C` alone cycles cameras (`V` dropped); Esc closes any panel from the moment
  the HUD shows. [75]
- No "paused" subtitle anywhere. [74]

### Fixed

- Canopy overlap test made cheap enough for CI; Garage e2e updated for the
  catalogue order.

## 2026-10-31

### Added

- **Alpine region** in the loop (forest ×3 → alpine ×3): asphalt under snow
  or cleared tarmac, snowfields, frosted pines, bigger hills, sharper bends.
  [58]
- Houses in the landscape, level pads under them, snow-covered on snow
  stages; checkpoints marked by rally time-control boards. [59, 66, 67, 68]
- Boreal Saloon (Impreza-shaped) and Sirocco Dakar Truck (a "Special" in the
  dealership); Albion RS Hatch (Castrol-Focus-style WRC); Edelweiss S1
  rebuilt on the Sport Quattro S1 E2. [61, 63, 64]
- Stage history in the Game panel; any stage up to the frontier can be
  driven again. [56]

### Changed

- Three cameras: the Cab (bonnet) view is gone; tyre marks are always on;
  Settings quieter. [57]
- Terrain sunk under the carriageway so the ribbon never floats. [60]
- Launch revs scale with the rev range; truck retuned. [62]
- Dealership card shows names only, with a "Special" tag. [65]
- Denser, non-overlapping trees; trunks cast shadows. [69, 70]

## 2026-10-30

### Added

- **Garage**: seven upgrades with per-level pricing applied to the live sim,
  and a dealership carousel with a spinning 3D preview. [41, 43]
- Four procedural cars on **lofted hulls** (cross-section stations joined
  into a flat-shaded shell) instead of box stacks. [44]
- Riviera WRC hatch and Edelweiss S1 coupé, with hull deck decals. [52]
- Fading **tyre marks** in a one-mesh ring buffer, per-surface ink. [49]
- New Open Graph art, web manifest and richer SEO metadata. [55]
- Vercel Web Analytics.

### Changed

- Online saves on Supabase Postgres instead of Upstash Redis. [45]
- Garage changes apply immediately, even mid-stage. [46]
- Grip rework: steering assist, friction ellipse, rear grip bias; one grip
  setup for every car. [47, 48]
- Wheels rest on the road ribbon; the body rides the springs. [53]
- Dealership preview centred; garage modal responsive; Garage button joins
  the toolbar on touch devices. [50, 51, 54]
- Asset tidy-up.

## 2026-10-29

### Added

- **Scaffold**: Next.js App Router, React 19, TypeScript strict, Tailwind
  CSS 4, React Three Fiber and drei, Zustand, Vitest, Playwright, ESLint
  (zero warnings), Prettier, CI workflow, docs. [1–11]
- **Vehicle simulation** in pure TypeScript: bicycle model, friction circle,
  weight transfer, surfaces, torque curve, 5-speed automatic, turbo,
  handbrake, suspension over terrain, airtime; fixed 120 Hz stepper with
  render interpolation; flat test track; chase camera; keyboard driving.
  [12–17]
- **Procedural stages**: seeded road through simplex terrain, terrain chunks
  meshed in Web Workers, road ribbon, checkpoint gates in order, countdown,
  timing, penalties and repair fees, prize money against par, Forest region.
  [18–24]
- Pines and broadleaf trees, a detailed rally hatchback, the Press Start 2P
  pixel font for HUD numbers. [25, 26]
- Curvier roads from a bend sequencer; Game panel with controls and stage
  facts; retro pixel-art HUD containers and buttons. [27–30]
- **Splash screen with Game IDs and online saves**: driver name, Continue,
  `?game=` deep links, autosave, a versioned save file, the
  `/api/games/[id]` route. [31, 37–40, 42]
- Four cameras at the time (chase, cab, interior with a modelled cabin,
  isometric), the stage progress bar, an attract-mode drive behind the
  splash, brand assets and metadata, a privacy page. [32–36, 38]

### Fixed

- CI: static image imports typed without the generated `next-env.d.ts`; the
  e2e progress test polls while throttling so slow renderers pass.
