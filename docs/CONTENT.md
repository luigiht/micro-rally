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

Every third stage (stages 3, 6, 9, …, in whichever region falls there,
except the Coast and the Desert, which build none)
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
hillside in a stack of two hairpins, toward the land then away so it keeps
its direction, before a long diagonal back down to the shelf. The terrain
(`Coastline.ts`) cuts the road in with the usual corridor and stands the
retainer wherever the ground falls away beside it.

- **Character.** Each stage draws its own (decision 120). Half the stages are
  mirrored, with the sea on the left of travel and the stacks climbing right
  then left. The bays run from short (about 1.4 km between them, 50–60 m
  deep) to a lazy corniche (about 3 km, up to 120 m deep), and the sharper
  headlands on them from barely there to a jagged run, their curvature half
  to one and a half times the reference. The difficulty loop sharpens the
  headlands (up to 2.25× by loop 4) and tightens the hairpins by up to 4 m,
  so a late coast is twistier as well as longer.
- **Road.** Tarmac 11 m wide (a lane more than the other tarmac roads, whose
  dark deck between pale verges reads narrower than gravel), 5–35 m above
  the sea, sweeping with the shore; hairpins of 18–26 m radius joining contour legs
  36–52 m apart up the slope, each arc fitted to leave one leg and land on the
  next tangentially, every leg under the 12 % grade limit (the climb between
  stacked legs is their spacing times the hill's slope, spread over a hairpin
  and a leg).
- **Shore.** The water line, a dry-sand beach up to 30 m wide a metre above
  the sea (a couple of metres at a headland), then the cliff band:
  4–24 m tall; where tall it stands at 62° and is terraced into 3–5 m runs of
  flat tread and steep riser whose ledge line wanders along the shore,
  steepened on buttresses and slackened in the gullies between them (7–16 m
  apart), with knobbly crags standing out of the face and a boulder apron up
  to about 1.7 m heaped against its foot over the beach's landward half. It
  is coloured as pale grey limestone strata: beds about 1.7 m thick in
  near-white, light grey, faintly warm and cool blue-grey tones that tilt and
  wander a little across the face, the flatter ledges lit paler and now and
  then holding a tuft of bright grass. Where low the
  band is a sandy bank the car can climb.
  Beyond the water the seabed falls to 9 m under a flat sea plane that
  follows the car.
- **Hillside.** 22°–27° above the cliff, rolling (hummocks of about 1.3 m)
  and cut by gullies up to 2.2 m deep that run down it and deepen inland,
  with the region's relief from 60 m in. About two thirds of it is grass,
  green and sun-dried in broad patches and dotted with dark maquis; rock
  scarps (uneven 6 m steps with crags) stand where a warped noise mask says
  outcrop, about a tenth of the slope; gravel lies in fans below them, on
  the gully beds and in loose patches. Ground steeper than about 46° (the
  road cuttings, the scarps' risers) goes to scree, and past 60° to bare
  rock. `coastFaceColor` does the colouring from `CoastShape.surface`'s
  rock, scree and dry masks.
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
- **Colours.** The cliff band and the outcrops are grey limestone whatever
  their tilt, ground past 46° of tilt elsewhere scree and past 60° rock (see
  Hillside); boulders the same pale grey; sand under a metre above the sea,
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
  the pools. No villages: a town index that falls on a desert stage stays
  open road.
- **Scenery.** Dry scrub and sandstone boulders, sparse; no pines, no farms.

## Circuits

Every tenth stage (index 9, 19, 29, …; never two in a row) is a closed race
circuit in parkland (`circuit` region, not in the twelve-stage cycle: the
cycle's region at those indices simply gives way). A layout is drawn by
`CircuitGenerator` from the stage seed in one of three styles, mixing the
traits of three famous tracks without copying any of them:

- **Ring** (after the Nürburgring): 12–15 corners, medium radii, inward
  dents, a chicane now and then, and 1.6× the region's hill relief, so the
  lap climbs and dips.
- **Sarthe** (after Le Mans): a long, thin loop whose main straight carries
  two chicanes, fast open kinks, and a slow hairpin at the straight's end.
- **Park** (after Monza): six to eight corners on a stretched loop, chicanes
  on the two longest straights, one long sweeper onto the main straight,
  almost flat.

The lap is a star-shaped polygon round a centre (which cannot cross itself),
every vertex rounded into an arc of a radius set by its sharpness and the
style, chicanes dropped onto long straights as smooth S-offsets of 6–9 m
over about 55 m, and resampled as a closed path starting at the beginning of
its longest straight. It must be 1.5–2.8 km long (1.7–2.4 km targeted), have
no corner under 12 m radius and keep stretches more than 200 m apart round
the lap at least 90 m apart in space (room for runoff and barriers, and for
each stretch's flattened corridor to blend back to the hills before the
next); a few attempts, then a rounded-rectangle fallback, guarantee one.

The track is 12 m wide race asphalt (the `track` surface, see Surfaces) with white edge lines. The trackside comes from the
lap's curvature: kerbs where the radius is under 150 m (the inside of the
whole corner and the outside from the apex over the exit), raised 3 cm and
striped red and white every sample; gravel traps on the outside of corners
of 40–150 m radius; Armco 6 m beyond the edge on straights and up to 16 m on
a corner's outside, held inside 0.7 × the radius on the inside; catch
fencing behind it on the outsides and along the main straight; a chequered
line, eight staggered grid slots and a gantry at the start; a blue
grandstand behind the barrier on the outside of the lap facing the line.
Trees and bushes stand only beyond the outermost barrier and off the
grandstand. Names are an Italian autodromo, a French circuit or a German
ring with an invented place name.

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

| id          | Name                  | Shape (measured from reference)         | Mass    | Body file            |
| ----------- | --------------------- | --------------------------------------- | ------- | -------------------- |
| `hatchback` | Rally Hatch           | Chunky 1990s hatch, orange over cream   | 1000 kg | `HatchbackBody.tsx`  |
| `coupe`     | Tricolore Coupé       | Stratos-shaped Group 4 wedge            | 980 kg  | `CoupeBody.tsx`      |
| `t16`       | Sochaux T16           | 205 T16-style Group B hatch             | 940 kg  | `T16HatchBody.tsx`   |
| `saloon`    | Boreal Saloon         | Impreza S6 WRC-shaped saloon            | 1230 kg | `SaloonBody.tsx`     |
| `wrc`       | Riviera WRC           | Mid-2000s WRC hatch                     | 1230 kg | `WrcHatchBody.tsx`   |
| `groupb`    | Tempesta Group B      | Group B monster with box flares         | 960 kg  | `GroupBBody.tsx`     |
| `s1`        | Edelweiss S1          | Sport Quattro S1 E2-shaped coupé        | 1090 kg | `S1CoupeBody.tsx`    |
| `focus`     | Albion RS Hatch       | First-gen Focus hatch in works WRC trim | 1230 kg | `FocusHatchBody.tsx` |
| `dakar`     | Sirocco Dakar Truck   | Rally-raid truck, twice a car's size    | 2600 kg | `DakarTruckBody.tsx` |
| `lemans`    | Mulsanne LM Prototype | 917K-shaped 1970 Le Mans coupé          | 800 kg  | `LeMansBody.tsx`     |
| `buggy`     | Toro Dakar Buggy      | SMG-style two-wheel-drive raid buggy    | 1450 kg | `BuggyBody.tsx`      |

The buggy's mudguards are not part of its hull: `render/car/FenderShell.ts`
lofts a thick half-ring shell around each axle from an outline of
[angle, radius] pairs (a flat-topped ring piece with a chamfered outer edge,
mirrored both sides, the arch underside in trim), so they stand proud of a
narrow tub the way a raid buggy's do, and `fenderPoint` seats sponsor discs
on the dome. The tub cuts wells at the rear axle only; the nose sits inboard
of the front tyres with wishbones and coil-overs in the gap. Behind the cabin a tall engine deck closes in a dark bay wall, and two full-size spares stand in it upright like the road wheels, tread to the rear, side by side on a carrier tube with the plate in the slot between them, up under a rear wing on wedge uprights (tail lamps on its trailing edge, white work lights low on the back of each rear fender); a centre fin runs from the rear window down to the wing, and the mud flaps hang from the carrier tube so they move with the body, not the wheels. The exhausts run under the floor from the engine bay out past that tube, and the underside carries a belly pan, the differential with its driveshafts, trailing arms and a cross tube, so the open rear reads as a frame. The whole body stands 0.1 m higher over its wheels than its heights say, the stance of long-travel springs at full droop. The livery is a yellow sun with a red charging bull on each door (a side-view icon silhouette extruded 2 cm from SVG path data by `render/car/SvgSilhouette.ts`, credited in CREDITS.md), white letter blocks across the bonnet and painted lamp pods on
the nose.

The Le Mans coupé is two lofts: a wide flat shell (thin nose lip, fender
tops, a cowl that dips to 0.58 m, a long tail deck ending in a Kamm lip, the
underside sweeping up behind the rear axle over an open engine bay with the
gearbox, frame tubes and twin exhausts) and a narrow cockpit bubble standing
on it with a long windscreen, two door windows and a fastback fairing. Tail
fins are prisms on the deck edges with trimmed flaps between them; the
headlamp covers are dark oval discs lying on the fender fronts, over a solid orange
chin, with a white roundel on the bonnet. Powder blue
with an orange sill band (the stripe band split blue over orange), an orange
nose by cap and deck decals, an orange centre stripe over both lofts, white
a plain roundel on each door.

Two further specs, `pickup` and `monster`, exist in `CarSpec.ts` for tuning
tests but are not on sale.

Physics per car: mass and centre of gravity, yaw inertia, steering lock and
speed falloff, torque curve, five gear ratios and final drive, front/rear
drive split, tyre grip and cornering stiffness, braking, handbrake rear grip,
drag and rolling resistance, suspension rates and stability, turbo force and
timing, aero grip. Visual-only fields move the cabin and scale the body for
the cameras.

## Surfaces

| Surface | Where                                                   | Feel                                                                                         |
| ------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| track   | every circuit                                           | race asphalt: a quarter more grip than tarmac and a planted rear, so the car slides far less |
| tarmac  | some Forest and Alpine stages, every Coast stage, towns | most grip, highest par speed                                                                 |
| gravel  | most Forest stages                                      | the reference surface                                                                        |
| mud     | some Forest stages                                      | slow and slippery                                                                            |
| snow    | most Alpine stages, and off road there                  | least grip, dusted asphalt look                                                              |
| sand    | every Desert stage                                      | packed piste, a little looser than gravel                                                    |
| dune    | off the road in the Desert                              | soft sand, the car wallows                                                                   |
| grass   | off the road everywhere else                            | heavy drag                                                                                   |

Tyre marks are drawn per surface into a single fading ring-buffer mesh.

## Not yet built

Sound and engine note, post-processing and quality tiers, weather effects
and night, pace notes and live splits, gamepad
input, and the Capacitor mobile shells. See [PLAN.md](PLAN.md).
