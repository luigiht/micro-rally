# Changelog

All notable changes to Micro Rally, newest first. The project has no version
tags yet: `main` is deployed continuously, so entries are grouped by the day
they landed. The numbered entries in [docs/DECISIONS.md](docs/DECISIONS.md)
hold the reasoning behind each change; the numbers in brackets point there.

## 2026-11-03

### Added

- **Toro Dakar Buggy**, a second "Special" after the truck at $32,000: a
  two-wheel-drive rally-raid buggy with a navy tub under a narrow mid-car
  cabin, free-standing mudguards over 0.47 m tyres, a yellow sun with a red
  charging bull on each door, white lettering and twin lamp pods on the
  nose, a roof intake box, exposed front suspension, a tall stance over its wheels and two upright spare wheels across the tail under a rear wing. A naturally aspirated V8 drives the rear axle through six gears on soft long-travel springs; its cabin shares the truck's raid console. [104]
- **Desert**, a fourth region: a piste of packed sand (a new `sand` surface,
  a little looser than gravel, with soft `dune` sand off it that the car
  wallows in) graded through a dune sea of long sharp-crested ridges, and
  oases along the way: level hollows with a pool, a ring of date palms and
  scrub. The piste is only a touch darker than the dunes and has neither painted
  edge lines nor verge posts, so it reads from the car by that small
  difference alone. The region cycle grows to twelve stages (Forest
  ×2, Alpine ×2, Coast, Forest, Desert, Coast, Alpine, Coast, Desert ×2);
  stage 7 is the first desert, and stage numbers from 7 on are new roads.
  [101]
- **Coast**, a third region in the rotation: a tarmac corniche along a
  terraced low-poly rock cliff, a sandy beach and a flat teal sea to seaward,
  a scrub-and-pine hillside with ochre outcrops above, and once or twice a
  stage a stack of two hairpins climbing that hillside before a long run
  back down. The road is a lane wider than the other tarmac roads, bends no
  tighter than about 50 m on the shore and turns its hairpins without a
  kink. Along whichever edge the ground falls away, the outer side of every
  hairpin leg, runs a dry-stone wall of big rounded stones; the car bounces
  off it. Where the cliff is low the bank is sand the car can drive down and
  back up. Regions now run through a nine-stage cycle (Forest ×2, Alpine ×2,
  Coast, Forest, Coast ×2, Alpine) that keeps the no-three-in-a-row rule and
  puts every third stage's town on Forest and Alpine; stage numbers from 5
  on were new roads. [95–100]
- A dev tool exports any car as a binary STL in metres
  (`CAR_STL=<carId> pnpm exec vitest run tests/unit/exportCarStl.test.ts`),
  rendering its model headlessly; see [docs/TESTING.md](docs/TESTING.md).
- Autumn on the mud: Forest stages on mud dress their trees in autumn
  colours, with evergreen pines beside golden larches, orange and rust
  broadleaf canopies and gold among the bushes. Sky, ground, road and trunks
  stay as they were. [94]

### Fixed

- The car driving behind the splash turns smoothly through bends: its heading,
  steering and lean used to step at every 2 m road sample. [105]
- The replay now lays the run's tyre marks as it plays, braking lock-ups
  included: each sample records the scrub per axle and the surface, and the
  marks are wiped and laid again from the recording while the car follows it.
  Before, the replay showed whatever marks were left over from the live run.
  [102]

### Changed

- The drive behind the splash picks a random dealership car with each lap's
  stage, the truck and the buggy included, instead of always the starter
  hatch. [106]
- Desert stages build no villages: a town index that falls on one (stage 12,
  for one) stays open road, as on the Coast. [103]
- The Tricolore Coupé loses the white pinstripes on its bonnet and the cream
  headlamp slots behind its lamp pod; the roof and engine cover keep theirs.
- Coast stages show a road glyph of their own in the Game panel's stage
  list, a road running away and bending, instead of the tarmac glyph every
  one of them would share.
- The same region never shows for three stages running (it used to run in
  threes); the cycle is described under Coast above. Towns stay on every
  third stage (3, 6, 9, …) and the 25 % length step still comes every six
  stages. Stages whose region moved are new roads at that number, so an
  existing record there was set on a different road. [93, 95]

## 2026-11-02

### Added

- **Nightcity**, a hidden mode on `N` (not in the controls table): the stage
  is re-dressed in place as a cyberpunk night city, with the run, the clock
  and the records untouched. Pitch-black sky, a cold moon, dark ground and
  asphalt, neon edge lines, kerbs and marker caps, stilt towers and masts
  where the trees stood, neon signs and bollards for the bushes, cargo pods
  for the rocks, mid-rise blocks on the farmhouse pads, dark town buildings
  under a neon roofline, lit lamp heads, neon gantries and cyan tyre trails.
  The car becomes one cyberpunk street machine cut to its own axles and
  track: box flares over both axles with a pinched waist, a blunt wide nose
  under a long bonnet, a Kamm tail with a ducktail, a segmented light bar
  with angled fangs over a slatted grille and side intakes, a splitter with
  canards, bonnet and engine-cover vents with lit slits, fender vents, rear
  intakes, louvres over the rear glass, a sensor pod and antennas, a spoiler
  on swept uprights with end plates and a shark fin, a strake diffuser, quad
  hexagonal thrusters, lit wheel rings and underglow. The cabin follows in the interior view: near-black trim, a lit
  violet cage, neon harnesses and seat stripes, dark dials in lit cyan rings
  with magenta needles, light lines along the dash lip, door cards and roof,
  and a translucent heads-up display over the binnacle. A bloom pass runs
  only while the mode is on. `N` again restores the day. Session-only, never
  saved. [92]
- `LICENSE`: all rights reserved. The repository is public for viewing; no
  licence to use, copy, modify or redistribute is granted.
- `H` hides and shows the HUD chrome (clock, tags, money, toolbar, progress
  bar, speed readout, debug overlay, replay bar). Dialogs, the countdown and
  the touch controls stay; Esc still works. Listed in the controls table,
  with an end-to-end test. [90]
- `CHANGELOG.md` and the context documents `docs/GAMEPLAY.md`,
  `docs/CONTENT.md` and `docs/TESTING.md`; README rewritten for the current
  game. [91]
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

- The replay no longer loops: when the recording runs out it leaves the
  replay by itself and the "Stage complete" panel comes straight back. [89]
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
