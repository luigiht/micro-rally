# World and content

What the generators make and what the car catalogue holds. Everything is
procedural: no model, texture or sound file ships with the game. Reference
photos and GLBs under `context/` are measuring aids only and are not
committed. How the pieces connect is in [ARCHITECTURE.md](ARCHITECTURE.md);
how they play is in [GAMEPLAY.md](GAMEPLAY.md).

## Stages

A stage is deterministic from `(game seed, region, stage index)`, so it is
identical every time it is driven and records are fair.

- **Brief.** `stageBrief` draws the name, surface, weather, length and par
  from the first draws of the stage's RNG stream, without building the road,
  so lists stay cheap. Names are procedural proper nouns: a head (Pine,
  Moss, Birch, Fen, Ash, Holl, Alder, …) plus a tail (wood, ley, dale, ford,
  moor, brook, holt, wick, ridge, combe, …).
- **Road.** A centreline laid in 20 m control steps with a bend sequencer and
  a heading clamped to a main axis, so the road never self-crosses; checked
  against a self-approach rule (points 196 m apart along the road stay 50 m
  apart in space). The ribbon is 4 m half width on loose surfaces and 4.5 m
  on tarmac, narrowing through old-town streets. 30 m of run-in before the
  start gantry and 140 m of run-out after the finish.
- **Gates.** `min(6, max(2, round(length / 450)))` checkpoints evenly spaced,
  kept out of towns and in order, plus the finish. Start and finish are
  gantries; checkpoints are pairs of time-control boards.
- **Terrain.** Simplex fBm per region, the road bed smoothed and
  grade-limited to 12 %, sunk under the carriageway, the corridor blended
  flat; a level plateau under each town. Chunks of 64 m are meshed in a Web
  Worker from the seed alone and streamed around the car.
- **Scenery.** Instanced, chunked and collidable: two tree species (pines and
  broadleaves, frosted and bare in the Alps), bushes, rocks and farmhouses on
  level pads well back from the road. Trees keep 3 m clear of the carriageway
  and their canopies apart; houses keep 14 m clear and never stand on steep
  ground.

## Towns

Every third stage (stages 3, 6, 9, …, in whichever region falls there)
carries a town between 30 % and 55 % of the way along.

- **Plan.** An entry straight of 60 or 80 m, two to four middle legs
  (straights ending in 60°, 90° or 105° corners laid as 12 m arcs, or tight
  14–19 m curves), an exit straight; half the towns narrow the middle legs to
  3.2 m half width. The turns are balanced so the route leaves close to the
  heading it arrived on, and every plan is checked against the self-approach
  rule with 80 m of run-in and run-out. Longer stages get longer towns.
- **Streets and junctions.** Every corner is a junction with blocked side
  streets (32 m stubs, cut down to clear each other, never below 20 m) closed
  by rows of cones, with direction boards before the cones. Kerb returns are
  traced exactly against the ribbon, pavements stand 10 cm above the deck
  behind vertical kerb faces, and white edge lines run 2 cm over the tarmac.
- **Buildings.** Four styles (townhouse, shop, tower, hall) stand a party
  wall apart along every facade line, a pavement beyond the real road edge,
  with garden walls over every gap, flower boxes under the windows, lamp
  posts along the route and trees and bushes in the walled corners. Each
  building sits on a terrace levelled at its door. Buildings and walls
  collide as oriented boxes.
- **Fade.** The route turns from stage surface to tarmac and verges to
  pavements over 40 m either side of the town; the wild scenery keeps off the
  streets, buildings and walls but the yards stay green.

## Regions

| Region | Palette                                                                                                     | Surfaces                      | Weather         |
| ------ | ----------------------------------------------------------------------------------------------------------- | ----------------------------- | --------------- |
| Forest | pale sky, two greens, brown trunks; on mud the trees turn autumn (golden larches, orange and rust canopies) | gravel, tarmac, mud           | clear           |
| Alpine | pale grey sky, near-white ground, frosted pines                                                             | snow (dusted asphalt), tarmac | overcast, clear |
| Coast  | pale blue sky, dry scrub and limestone, maritime pines, sand and a teal sea                                 | tarmac                        | clear           |
| Desert | pale sky, warm haze, pale to golden sand, sandstone, date palms and dry scrub, teal pools                   | sand                          | clear           |

Night is a placeholder cloned from Forest and not yet in the progression
loop.

## Coast

A Coast stage is a cliff road with the sea to seaward and a hairpin stack or
two. The lie of the land comes first (`CoastShape.ts`): along the stage axis
the water line meanders in bays and headlands, and from it the ground climbs
across a beach, a terraced rock band (the cliff) and a scrub hillside with
outcrops, with the region's relief further in. The road is then drawn on that
ground (`CoastRoad.ts`): it follows the shore a shelf back from the cliff
top, and once a stage (twice on a long one) turns inland and climbs the
hillside in a stack of two hairpins, left then right so it keeps its
direction, before a long diagonal back down to the shelf. The terrain
(`Coastline.ts`) cuts the road in with the usual corridor and stands the
retainer wherever the ground falls away beside it.

- **Road.** Tarmac 11 m wide (a lane more than the other tarmac roads, whose
  dark deck between pale verges reads narrower than gravel), 5–35 m above
  the sea, sweeping with the shore in bends no tighter than about 50 m; hairpins of about 20 m radius joining contour legs
  44–52 m apart up the slope, each arc fitted to leave one leg and land on the
  next tangentially, every leg under the 12 % grade limit (the climb between
  stacked legs is their spacing times the hill's slope, spread over a hairpin
  and a leg).
- **Shore.** The water line, a dry-sand beach up to 30 m wide a metre above
  the sea (a couple of metres at a headland), then the cliff band:
  4–24 m tall; where tall it stands at 62° and is terraced into 4 m runs of
  flat tread and steep riser, their ledges broken up by noise, so the facets
  read as low-poly rock; where low it is a sandy bank the car can climb.
  Beyond the water the seabed falls to 9 m under a flat sea plane that
  follows the car.
- **Hillside.** 22°–27° above the cliff, terraced into 6 m steps where a
  noise mask says rock, scrub elsewhere, with the region's relief from 60 m
  in.
- **Walls.** Along whichever road edge the ground lies 3 m or more lower
  10 m out (both edges on a spur, the outer edge of every hairpin leg), broken
  10 m either side of the start and every gate, runs under 12 m dropped and
  gaps under 6 m closed, stands a dry-stone wall about 1.2 m high: two
  staggered courses of big rounded stones, each a box with its corners and
  edges drawn in toward a sphere, 0.6–1.1 m long with its own height,
  thickness, set, tilt and grey, the upper course bedded into the lower so
  the uneven top opens no holes. It collides: the car bounces off it. The
  marker posts stand in front of it.
- **Scenery.** Rocks anywhere above the water; scrub from 2 m inland on
  slopes under 54°; pines and broadleaves 3 m above the sea on slopes under
  42° and off the outcrops; no farms.
- **Colours.** The cliff band and the outcrops are ochre rock whatever their
  tilt, faces past 37° of tilt elsewhere; sand under a metre above the sea,
  wet sand under it. Nightcity keeps the layout and darkens the sea and the
  wall.

## Desert

A Desert stage is a piste of packed sand through a dune sea, with oases.

- **Dunes.** The ground is ridged noise stretched downwind: long dune ridges
  with sharp crests over a rolling sand floor, about 11 m of relief, pale on
  the floor and golden on the crests, sandstone where a cut is steep. The
  road bed is graded through them like any other, so the piste runs in
  cuttings and on banks.
- **Road.** The `sand` surface: packed sand only a touch darker and warmer
  than the dunes, with no painted edge lines and no verge posts (a piste has
  neither), so it reads from the car by that small difference alone; a
  little looser than gravel. Off the piste the ground is `dune`, soft
  sand the car wallows in.
- **Oases.** Along the road every 180–340 m, 30–65 m off it on either side,
  where the dunes are level enough: a hollow 11 m across (give or take) sunk
  1.4 m under the lowest point of its rim and blending back over 9 m, a pool
  of water standing 0.45 m over its floor, a ring of six to ten date palms on
  the rim and a few scrub bushes at the water. The wild scatter keeps out of
  the pools. Villages, where the cycle puts them, plant palms in their yards.
- **Scenery.** Dry scrub and sandstone boulders, sparse; no pines, no farms.

## Hidden mode: Nightcity

Press `N` while driving (it is not in the controls table) and the stage is
re-dressed in place as a cyberpunk night city; `N` again brings the day back.
The road, timing, colliders and records are the daytime ones. Pitch-black sky,
a cold moon, dark ground and asphalt with neon cyan edge lines, magenta kerbs
and amber marker caps; stilt towers (a slim core up to 3.4 m, then a
cantilevered block, so the car passes under) and masts where the trees stood,
taller the further they are from the road; neon sign boards facing the road
and glow bollards for the bushes; cargo pods for the rocks; mid-rise blocks on
the farmhouse pads; town buildings dark under a neon roofline; lit lamp heads;
neon gantries; cyan tyre trails. The car becomes one cyberpunk street
machine cut to its own axles, track and tyres (the truck too): box flares over
both axles with a pinched waist between them, a blunt wide nose under a long
bonnet, a Kamm tail with a ducktail, a segmented light bar with angled fangs
over a slatted grille and side intakes, a splitter with canards, bonnet and
engine-cover vents with lit slits, fender vents and rear intakes, louvres over
the rear glass, a sensor pod and antennas, a spoiler on swept uprights with end
plates and a shark fin, a strake diffuser, quad hexagonal thrusters, a lit
shoulder line, lit wheel rings and underglow. Inside,
the real car's cabin keeps its envelope and kit but is dressed in near-black
trim with a lit violet cage, neon harnesses and seat stripes, dark dials in
lit cyan rings with magenta needles, light lines along the dash lip, door cards
and roof edges, and a translucent heads-up display over the binnacle. A bloom
pass runs only while the mode is on. Session-only; never saved; the Garage
preview and the splash stay daytime.

## Cars

Every car is a lofted low-poly hull: a list of cross-section stations along
the car (floor, sill, belt, roof heights and half widths) joined into a
flat-shaded shell with per-face colours, wheel wells cut around each axle,
deck decals on the top faces, side decals across the pillar bands and cap
decals on the nose and tail, plus primitives for lamps, wings, mirrors and
bumpers. Liveries are colour-blocked originals. Each car also has its own
interior (`components/game/interior/interiorSpecs.ts`): cabin envelope,
dashboard kit and palette.

| id          | Name                | Shape (measured from reference)       | Mass    | Body file            |
| ----------- | ------------------- | ------------------------------------- | ------- | -------------------- |
| `hatchback` | Rally Hatch         | Chunky 1990s hatch, orange over cream | 1000 kg | `HatchbackBody.tsx`  |
| `coupe`     | Tricolore Coupé     | Stratos-shaped Group 4 wedge          | 980 kg  | `CoupeBody.tsx`      |
| `t16`       | Sochaux T16         | 205 T16-style Group B hatch           | 940 kg  | `T16HatchBody.tsx`   |
| `saloon`    | Boreal Saloon       | Impreza S6 WRC-shaped saloon          | 1230 kg | `SaloonBody.tsx`     |
| `wrc`       | Riviera WRC         | Mid-2000s WRC hatch                   | 1230 kg | `WrcHatchBody.tsx`   |
| `groupb`    | Tempesta Group B    | Group B monster with box flares       | 960 kg  | `GroupBBody.tsx`     |
| `s1`        | Edelweiss S1        | Sport Quattro S1 E2-shaped coupé      | 1090 kg | `S1CoupeBody.tsx`    |
| `focus`     | Albion RS Hatch     | Castrol-Focus-style three-door WRC    | 1230 kg | `FocusHatchBody.tsx` |
| `dakar`     | Sirocco Dakar Truck | Rally-raid truck, twice a car's size  | 2600 kg | `DakarTruckBody.tsx` |

Two further specs, `pickup` and `monster`, exist in `CarSpec.ts` for tuning
tests but are not on sale.

Physics per car: mass and centre of gravity, yaw inertia, steering lock and
speed falloff, torque curve, five gear ratios and final drive, front/rear
drive split, tyre grip and cornering stiffness, braking, handbrake rear grip,
drag and rolling resistance, suspension rates and stability, turbo force and
timing, aero grip. Visual-only fields move the cabin and scale the body for
the cameras.

## Surfaces

| Surface | Where                                                   | Feel                                      |
| ------- | ------------------------------------------------------- | ----------------------------------------- |
| tarmac  | some Forest and Alpine stages, every Coast stage, towns | most grip, highest par speed              |
| gravel  | most Forest stages                                      | the reference surface                     |
| mud     | some Forest stages                                      | slow and slippery                         |
| snow    | most Alpine stages, and off road there                  | least grip, dusted asphalt look           |
| sand    | every Desert stage                                      | packed piste, a little looser than gravel |
| dune    | off the road in the Desert                              | soft sand, the car wallows                |
| grass   | off the road everywhere else                            | heavy drag                                |

Tyre marks are drawn per surface into a single fading ring-buffer mesh.

## Not yet built

Sound and engine note, post-processing and quality tiers, weather effects
and night, pace notes and live splits, gamepad
input, and the Capacitor mobile shells. See [PLAN.md](PLAN.md).
