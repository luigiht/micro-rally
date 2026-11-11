# Changelog

All notable changes to Micro Rally, newest first. The project has no version
tags yet: `main` is deployed continuously, so entries are grouped by the day
they landed. The numbered entries in [docs/DECISIONS.md](docs/DECISIONS.md)
hold the reasoning behind each change; the numbers in brackets point there.

## 2026-11-11

### Added

- **Real rally start and finish lines.** Every start and finish now has a
  chequered gantry. On rally stages a red-disc board stands on each side of
  the road, with a stopwatch at the start and a chequered flag at the
  finish. A circuit's start/finish line has no boards, as it is crossed
  every lap. [205, 206, 207, 208]
- **Back-to-checkpoint button on touch devices.** An undo-arrow button next
  to Pause returns the car to the last checkpoint, like `R` on a keyboard.
  The touch toolbar now matches the pedals' size and spacing, and the clock
  and the speed/gear readout match the height of the pad faces beside them.
  [203, 204]
- **Low-poly Autumnal verges.** Irregular flat-coloured patches join the mud
  road to its grassy shoulder, replacing the soft gradient. [201]
- **About page brought up to date.** The Gameplay tab covers the current
  stage types, surfaces and grip, the start and finish gates and the touch
  back-to-checkpoint button. The Changelog tab gains 11 November and a fuller
  10 November, and a new FAQ explains how to get back on the road.

### Fixed

- **Faster climbs on Alpine and Autumnal stages.** Winter tyres on the
  Alpine and mud tyres on the Autumnal give the cars more grip, so they spin
  their wheels far less and climb hills faster. [209]
- **Faster mud driving.** Reduced rolling resistance on mud while keeping
  its loose grip and sliding character. [202]
- **Autumnal edge tracks.** Removed overlapping road faces that hid the
  grooves, making their dark brown floors and recessed walls visible. [199]

## 2026-11-10

### Added

- **Crowds and corner stands.** Small protective mounds now line spectator
  groups across stages; deserts gather fans only at the start,
  checkpoints and finish. Coastal and circuit stages remain spectator-free.
  Circuits gain empty grandstands at their tight corners. [194]
- **Nine fixed stage types.** Pinewood, Mirewood, Forest, Alpine, Arctic,
  Coastal, Desert, Urban and Circuit each have one fixed road surface instead
  of sharing region definitions with weighted surface variants. [195]
- **Autumnal replaces Mirewood.** The muddy stage type now has a name that
  reflects its autumn palette.
- **Mud tyre ruts.** Autumnal roads now carry two wandering tracks like the
  Arctic's snow ruts, pressed deeper into the mud and shaded in dark umber.
  [196]
- **Faded Autumnal edge lines.** Edge stripes are lighter brown and shaded to
  blend with the muddy tyre tracks.
- **About page.** Gameplay notes, recent changes, common questions and contact
  details now live together behind four tabs.

### Removed

- **Autumnal puddles.** Removed the temporary puddle meshes and water maps;
  Autumnal's jumps and mud ruts remain.
- **Nightcity mode.** Removed the hidden `N` toggle, alternate stage and car
  styling, scenery kits, neon effects and HUD indicator. Day and dusk stages
  remain unchanged.

## 2026-11-09

### Added

- **Spectators on Alpine stages.** The winter crowd from the Arctic now
  lines the Alpine stages too, at the start, the checkpoints and along the
  road. [191]
- **Alpine crowds behind snow berms.** Like the mud stages, the Alpine
  spectators stand behind low mounds heaped along the road. [192]
- **No villages in the Arctic.** Arctic stages are open country only;
  villages stay in the Forest and the Alpine. [190]
- **Arctic stages at dusk.** Every third Arctic stage now runs just after
  sunset (the rest stay in daylight): an
  indigo sky with a pink and orange afterglow on the horizon, little light
  left on the snow, and your car's headlamps lighting the road ahead in two
  beams, with each car's own tail lamps glowing brighter red when you
  brake. [185]
- **Pace notes are always on.** The Settings toggle is gone. [186]
- **Arctic roads are snowed over.** Every Arctic stage now runs on snow, and
  the road is snow from bank to bank instead of asphalt with patches, with
  two faint wheel ruts pressed into it. [187, 189]
- **Checkpoint boards stand in the snow.** The boards are a little shorter
  and stand on the ground at their middle, running down into the lowest
  ground, so no edge hangs in the air and a snow bank may cover their foot. At dusk the tyre marks are a faint shadow
  rather than pale streaks. [185]
- **The Focus's tail.** The white reverse lamps on the tail are gone, so the
  tail panel runs on in the body's colours; its only rear lamps are the red
  ones up each side of the rear window.
- **Share your feedback.** A button at the bottom of the Game panel opens a
  feedback page in a new tab: write a message, optionally with your name
  and an email for a reply, and it is emailed to the author. A one-word
  question keeps the robots out. The privacy
  page says how feedback is handled. [184]

### Fixed

- **No more cliff walls on the coast's hairpins.** A hairpin climbs faster
  than the road may, so it runs cut into the hillside, and that cut stood
  as a sheer wall at the verge with the road above on top of it. The
  ground now slopes back from the road at no more than about 50°, and
  between a hairpin and the leg above it forms one even bank. [183]
- **Circuit gravel traps no longer show grass through them.** On the
  corners' gravel, patches of grass broke through the band where the
  ground's mesh bowed a centimetre or two over it; the ground now sinks a
  little under the gravel, as it does under the road. [182]
- **Coast hairpin stacks no longer sit on the road below.** Where the shore
  bent, a stacked leg or the long way down could pass 25 m or less from the
  road beneath it, so its cutting rose as a sheer wall at the lower road's
  edge (and on late loops stepped onto the verge). Stacked legs now move
  apart where needed and the top leg runs on until the descent is clear of
  the first hairpin. Some Coast stages are a little longer. [181]

## 2026-11-08

### Changed

- **A fixed stage schedule.** Every ninth stage is a city (9, 18, 27…) and
  every tenth a circuit (10, 20, 30…); where they would meet the city keeps
  the stage and the circuit follows. The stages between run in turn through
  Forest on gravel, Alpine, Forest on tarmac, Coast, Arctic, Forest on mud
  and Desert, so Forest mud's crowds come round every seven rally stages.
  Villages fall on every third of those. Best times on stages that changed
  are cleared (saves move to version 7). [179]

### Fixed

- **Tempesta Group B's tail.** The rear deck no longer dips behind the
  rear wheel: it runs level at the belt line to the tail, so the side
  stripes stay straight, and the tail's corners and top edge are rounded
  off. [175]
- **Shadows no longer pop in.** The sun's shadows now cover the road ahead
  of the car, where the camera looks, reach further (80 m across), and fade
  out toward their edge instead of stopping on a hard line, so tree and
  building shadows grow in as you approach. Tall trees and hillsides at the
  edge keep their shadows. [174]
- **Ground on the splash and at the start.** The terrain no longer goes
  missing for the first seconds (or for good) while its background worker
  starts up: the nearest ground is laid straight away, and the worker takes
  over once ready, or not at all if it fails. [173]

### Added

- **Berms at the mud rally, and bumpier ground.** On Forest mud stages the
  roadside groups and the start, checkpoint and finish crowds stand behind
  low grassy berms heaped between them and the road, which the car can
  drive over. Away from the road, the ground everywhere now has small
  bumps and hollows instead of perfectly smooth hills; the road and its
  verges stay level. [177, 178]
- **Spectators sit and take pictures.** Some spectators now sit on the
  ground with their knees up, and some hold a camera to the eye, sitting
  or standing. [176]
- **A crowd at the Forest mud rally.** Forest stages on mud get the
  roadside crowds too, in everyday clothes: T-shirts, long sleeves, jeans
  and shorts, trainers, caps and ponytails. [176]
- **Pace notes.** A co-driver's call for the next corner, centred under the
  stage clock: a pixel-art card graded like a real rally book, 1 (tightest)
  to 6 (barely a bend) with square, acute and hairpin for sharper ones,
  coloured red to green, with the distance to the corner and "long" where
  it holds its turn. Corners with no road between are called together
  ("4 into 2"). The call shows from the start line, holds through the
  corner and moves to the next once the car is out of it; on circuits it
  repeats every lap. Settings can turn it off. [170]
- **Turbo on touch.** Phones and tablets get a turbo pad, a pixel-art
  turbocharger over steer-left, once the car has a turbo. [171]

### Changed

- **Compact HUD on touch.** The checkpoint and money labels become a flag
  and a dollar bill beside their values, side by side in one row, with the pace
  note below them. [171]

## 2026-11-07

### Added

- **Arctic.** A new region: a Finnish winter rally stage on snow-dusted
  asphalt through flat frozen country, the road running between thick snow
  banks the car rides up if it leaves the tarmac, walled in by tall
  snow-capped spruces with bare birches between, under a pale sky. Snow
  tongues spill from the banks onto the road and patches cross it, crests
  on the straights launch the car, and studded-tyre grip with quicker,
  deeper steering makes the snow far less slidy than the Alpine's. Villages
  where the cycle puts them, under snow. The region cycle grows to eighteen
  stages (stage 4 is the first Arctic); saves move to version 6 and keep
  money, cars and upgrades, dropping best times only at the stages whose
  region moved. [161]

### Changed

- **Coconut palms.** The desert's palms are coconut palms now: a leaning,
  curving, ringed trunk, eight drooping fronds and a cluster of coconuts,
  in place of the straight date palm.
- **Stage icons.** The stage list marks Coast stages with a sun over a palm
  tree and waves instead of the winding-road glyph, circuits with a
  chequered flag instead of a track outline, Alpine stages with two
  snow-capped mountains instead of the surface glyph, and the new Arctic
  with two spruces.

### Fixed

- **Snow on the road no longer flickers.** The banks' snow tongues are
  now painted into the road surface itself instead of floating a few
  millimetres above it, so the tarmac no longer shows through in grey
  flickering patches or jagged seams; and the sun's shadow follows the car
  in whole shadow-map steps, so shadow edges hold still while driving.
  [168]
- **Snowy spruce tops are clean.** The snow on each whorl of a snowy
  spruce now sits on top of its green rather than over it, and the
  highest whorls no longer touch, so their tops no longer show striped,
  flickering patches from above. [169]
- **Spectators.** Faceted low-poly spectators in coloured jackets line the
  Arctic stages behind the snow banks: a big crowd down the run-in to the
  finish, lighter ones round the start, at every checkpoint and along the
  run-up to each jump, and groups of five or six between, each member in a
  different pose and jacket. Six poses (fist pump, clapping, arms
  up, hands on the head, arms crossed, waving) with beanies, caps, hoods
  and earmuffs and bright boots. [166, 167]
- **Snow poles.** Arctic roads are marked by tall thin orange snow poles
  with a white band near the top, in place of the short white posts.
- **Lane lines end at the stop line.** A city's lane dashes and centre line
  now stop before each junction's crossing instead of running under the
  zebra and into the mouth. [164]
- **Side streets stay off the corners.** A city side street no longer opens
  onto another street right beside the main road's junction, nor forms a T
  on the main road at an oblique angle; such streets stop short with their
  end building, so pavements and kerbs run continuously round every corner.
  [163]
- **Trams clear the cones.** The cone row across a side street that carries a
  tram line leaves the tram bed clear, so a tram no longer drives through two
  cones. [160]
- **Clean city junctions.** Where a wider street meets a narrower one at a
  corner, the junction is the narrower width from kerb to kerb and the
  wider street drops its lanes over 30 m before it, so kerbs no longer
  wobble or step inside the junction; lane dashes and medians stop at the
  lane drop, and the zebra and stop line sit on the approach ahead of the
  junction. [160]
- **City stages load faster.** Selecting or advancing to a city no longer
  freezes the page for seconds: the city layout and the terrain under it
  look up nearby buildings, walls and terraces through a spatial grid
  instead of scanning them all, the street meshes build over the first
  frames of the countdown instead of all at once, and retrying a stage
  reuses the generated world. [159]

## 2026-11-06

### Added

- **Trams.** A low-poly modern tram runs each city tram line now and then,
  crossing the route at 29 km/h on a timetable from the stage seed, its
  single-arm pantograph on an overhead contact wire that follows every
  line; it is solid, so mind the crossings. [151, 152, 153]
- **City detail.** Urban stages get a detail pass in the game's low-poly
  style: four city building kits in four façade renders (brick tenements
  with fire escapes and arched ground floors, arcaded mansion blocks with
  roof gardens, apartment blocks with cornices, balconies and water towers,
  offices with stone piers and a set-back crown), zebra crossings and stop
  lines at every junction arm, parking bays along the three-lane streets
  with parked cars in them (the Riviera and Tempesta hulls in plain paint,
  solid, and pitched to the slope), street trees in kerbed pits every 15 m
  on both sides of every street with lamps, benches, bins, hydrants and
  bollards between them, traffic lights and manhole covers, and hedges in place of the garden
  walls. [141–145]

- **Boreal Saloon reshaped.** The rally saloon's body follows its
  reference more closely: a longer, lower bonnet, a taller rounded
  greenhouse set further back, a proper boot deck under a taller wing,
  squared flares over both axles, wrap-round lamps, side skirts, a boot
  lip and red mud flaps, with the proportions measured off the reference
  and a fuller livery; the flaps hang from the sills, the nose and tail
  stand taller under a level bonnet, and four pod lamps ride the bonnet's
  front edge. The fog lamps stay put. [154–158]

### Fixed

- No grass shows along a city's buildings on a slope or through a seam in a
  junction's tarmac, and the roundabout island's grass is a true circle.
  [146]
- A city's side streets run 150 m and join the roads they meet instead of
  ending in a wall a few metres in: one that reaches the route ends in a
  T junction with a proper mouth, one that reaches another side street
  runs through a mouth in its pavement; the garden walls round the junction
  greens are closed and the greens hold more trees and bushes. [147, 149]
- No asphalt-coloured ground over a city's sidewalks at junction corners,
  the roundabout island's kerb is a true circle, and parked cars sit on
  their wheels on slopes. [149]

## 2026-11-05

### Added

- **Urban stages.** A new region: a big city from the start line to the
  finish. Streets of one to four lanes with dashed lane markings turn
  mostly right-angle corners, with skewed blocks, gentle kinks and sweeping
  avenues between; every corner is a junction with coned-off side streets
  and there is a crossroads every block; the route circles a roundabout (two
  or three on later loops) with a kerbed, planted island and blocked exits;
  tram tracks cross the route at crossroads and run down boulevards, and the
  car feels the rails; apartment blocks and glass offices line streets that
  climb and dip twice as much as a village's. Cities sit at stages 7, 11
  and 13 of every fifteen. [124, 125] Every street keeps its lane count from
  end to end (widths change across the junction arcs), boulevards carry a
  kerbed green median with narrow sidewalks, side streets run 80 m into the
  city, and roundabouts are joined to their roads in one piece of asphalt
  with the kerbs broken where the roads cross them. [126] Pavements are a
  metre wider everywhere (3 m), count as concrete under the tyres (tarmac
  grip, black marks instead of green), and the ground between a city's
  streets is lawn rather than pale concrete. [127] A street's lane count
  changes only after a junction corner, never across a kink or a sweeping
  avenue, and the change sits in the middle of the junction so the new
  street starts at its full width; bushes line the boulevard medians, whose
  ends are rounded; roundabouts join every road with continuous tarmac, sidewalks and edge
  lines; lamp posts keep out of junction mouths, tram beds sit clear of the
  tarmac they cross, city junctions sit on level plateaus and the ground
  stays level past every town pavement; tram beds ride clear of the tarmac
  and the catenary poles are gone. [128, 129, 130, 131, 135, 139]
- **Circuit races.** Every tenth stage (10, 20, 30, …) is now a closed race
  circuit in parkland: three laps from a standing start on total time, with
  a lap counter, the best lap on the HUD and every lap in the result panel.
  Layouts are generated from the stage seed in the manner of the
  Nürburgring (twisty and hilly), Le Mans (a huge straight with chicanes)
  or Monza (fast straights, tight chicanes, a long sweeper). Red-and-white
  kerbs on the corners, gravel traps, Armco and catch fencing, a chequered
  start line with a grid and gantry, and a grandstand. [117]
- **Race asphalt** on every circuit: a quarter more grip than road tarmac
  and a planted rear, so cars corner harder and no longer swing the tail
  out when braking into a bend. [118]

### Changed

- **Fifteen-stage cycle.** The region rotation is now Forest ×2, Alpine ×2,
  Coast, Forest, Urban, Desert, Alpine, Desert, Urban, Coast, Urban, Coast,
  Desert. Stages 1–6 are what they were; from stage 7 on many stages are
  another region's road, so best times at every index whose region changed
  are dropped when a save is loaded (saves move to version 5). [125]
- On phones the game no longer goes fullscreen: the installed app and the
  browser tab keep the native status and navigation bars, as before
  2026-11-04. [123]
- **Richer coast terrain.** The cliffs are now pale grey layered limestone
  with cool blue-grey shadows (the coast's sky light is cooler), with
  buttresses, gullies, crags, grassy ledges, and fallen boulders
  at their foot. The hillside above the road rolls and is cut by gullies:
  mostly green and sun-dried grass dotted with scrub, with rock scarps,
  scree fans below them, gravel in the gully beds, and gravel-and-rock road
  cuttings. [121, 122]
- **Coast stages vary.** Each one now draws its own shoreline: the sea on
  the left about half the time (with the hairpin stacks mirrored), bays from
  short coves to long lazy sweeps, and anything from a smooth corniche to a
  jagged run of headlands. Later difficulty loops sharpen the headlands and
  tighten the hairpins. Best times set on Coast stages are dropped, since
  the roads changed (saves move to version 4). [120]
- Saves move to version 3. Best times set on stages that are circuits now
  are dropped, since they were for a different road. [117]

## 2026-11-04

### Added

- **Mulsanne LM Prototype**, a third "Special" between the truck and the
  buggy at $29,000: a 917K-shaped 1970 Le Mans coupé measured from a
  reference model. 800 kg on a 2.3 m wheelbase, a big flat engine on the
  rear axle, stiff springs and almost no drag. Powder blue over an orange
  sill band and centre stripe, a low cockpit bubble on a wide flat body,
  tail fins and flaps over an open engine bay, white roundels, dark
  tinted glass and wheel arches that follow the tyres; the body is lofted
  from cross-sections of the reference with a rounded shoulder. The nose
  follows the reference's crowned fenders with lamp covers lying on them.
  Its cabin is a tight bubble with a blue cage and orange harnesses.
  [112–115]
- **Install the app** on phones and tablets: a strip under the start card
  offers to add Micro Rally to the home screen. Android opens the install
  sheet with one tap; iOS gets the Share → Add to Home Screen steps. "Not
  now" hides it for two weeks; it never shows once the game runs installed.
  [108]

### Changed

- **Albion RS Hatch** rebuilt from a low-poly reference of its road car:
  tall triangular tail lamps filling the C-pillars beside the hatch glass,
  a long roof with real tumblehome over two door windows, a fast
  windscreen and a rounded nose with swept triangular headlamps. The works
  livery, lamp pod, wing and fog lamps carry over. [110, 111]
- The installed app now rotates freely between portrait and landscape
  instead of being locked to landscape. [108]
- On Android the game fills the whole screen: the installed app launches
  with the status and navigation bars hidden, and in a browser tab Drive
  asks for fullscreen. Swipe in from an edge to bring the bars back. [109]
- Home-screen icons are rendered full-bleed, so Android launchers no longer
  show the mark as a small square on a white disc and iOS no longer paints
  the corners black. [108]

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

- The start page no longer runs its live drive where WebGL is missing or
  software-rendered (a headless browser, graphics acceleration switched off),
  where it cost seconds of main thread per frame; it keeps a painted backdrop
  there, which elsewhere also shows from the first paint while the scene loads.
  The pixel font is preloaded from the HTML and the logo is fetched at high
  priority. [107]
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
