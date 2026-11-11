# World and content

What the generators make and what the car catalogue holds. Everything is
procedural: no model, texture or sound file ships with the game. Reference
photos and GLBs under `context/` are measuring aids only and are not
committed. How the pieces connect is in [ARCHITECTURE.md](ARCHITECTURE.md);
how they play is in [GAMEPLAY.md](GAMEPLAY.md).

## Stages

A stage is deterministic from `(game seed, stage type, stage index)`, so it is
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
  gantries; checkpoints are pairs of time-control boards. Every gantry
  carries a two-row chequer. On an open stage a board with a black pictogram on a red disc stands on each verge
  1 m before the start and finish lines: a stopwatch at the start and a
  chequered flag at the finish. A circuit's start/finish gantry, crossed
  every lap, has none.
- **Terrain.** Simplex fBm per stage type, the road bed smoothed and
  grade-limited to 12 %, sunk under the carriageway, the corridor blended
  flat; a level plateau under each town. Chunks of 64 m are meshed in a Web
  Worker from the seed alone and streamed around the car.
- **Scenery.** Instanced, chunked and collidable: two tree species (pines and
  broadleaves, frosted and bare in the Alps), bushes, rocks and farmhouses on
  level pads well back from the road. Trees keep 3 m clear of the carriageway
  and their canopies apart; houses keep 14 m clear and never stand on steep
  ground.

## Towns

Every third stage (stages 3, 6, 9, …, in whichever stage type falls there,
except Coastal, Desert and Urban, which build none: a city
is a town from start to finish, see below)
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
  traced exactly against the ribbon, 3 m pavements stand 10 cm above the deck
  behind vertical kerb faces (concrete to the tyres: tarmac grip and black
  marks), and white edge lines run 2 cm over the tarmac.
- **Buildings.** Four styles (townhouse, shop, tower, hall) stand a party
  wall apart along every facade line, a pavement beyond the real road edge,
  with garden walls over every gap, flower boxes under the windows, lamp
  posts along the route and trees and bushes in the walled corners. Each
  building sits on a terrace levelled at its door. Buildings and walls
  collide as oriented boxes.
- **Fade.** The route turns from stage surface to tarmac and verges to
  pavements over 40 m either side of the town; the wild scenery keeps off the
  streets, buildings and walls but the yards stay green.

## Stage types

Each stage type has one fixed surface. The type selects the world, palette,
scenery and handling; the surface remains the vehicle and road-rendering
input.

| Stage type | Surface | Character                                                |
| ---------- | ------- | -------------------------------------------------------- |
| Arctic     | snow    | near-white snow, spruce walls, bare birches, dusk stages |
| Circuit    | track   | parkland racing, kerbs and gravel traps                  |
| Autumnal   | mud     | autumn trees, roadside crowds, mud ruts and jumps        |
| Pinewood   | gravel  | wooded gravel rally                                      |
| Alpine     | snow    | frosted pines and sharper mountain bends                 |
| Forest     | tarmac  | green woodland on asphalt                                |
| Urban      | tarmac  | a city from start to finish                              |
| Coastal    | tarmac  | limestone cliffs, beach and sea                          |
| Desert     | sand    | dunes, palms and oases                                   |

Three types grip harder than their surface alone (`handling.grip`, read
into the sim's `gripScale`): the Arctic's studded tyres 1.45×, the
Alpine's winter tyres 1.35× and the Autumnal's mud tyres 1.3×. That lets
the cars climb the snow and mud hills instead of spinning their wheels.
Only the Arctic also quickens the steering.

All open ground (not the coast, the dunes, circuits or cities, which shape
their own) carries small bumps and hollows over the broad hills: two
octaves of noise about 10 m and 5 m across, up to about 35 cm, faded in
with the road blend so the carriageway, the verge strip and the flat
margin beside it stay level (`TerrainDetail`).

## Arctic

A Finnish winter rally stage, Alpine's flat cousin, but a snowed-over road
with no villages, on frozen,
nearly flat country (relief 9 m, long waves) with long flowing bends.

- **At dusk.** Every third Arctic stage (the third, sixth… of the region;
  `stageAtDusk`, `StageBrief.dusk`) runs just after sunset, the rest by
  day (`DUSK_LIGHTING`): a gradient sky dome, indigo overhead and violet at the
  horizon where the fog meets it, with a pink and orange afterglow low
  toward where the sun went down; a dim cool sky fill and a faint warm
  glow, so the snow reads blue-violet. The car runs its lamps
  (`CarLamps`): two spotlight beams down the road from the nose, and the
  body's own red tail lamps brightened while braking. No lamp parts are
  added: the body's own lamps are lit.

- **Unmarked road.** No edge lines: the winter road carries only its snow,
  the banks and, every 20 m, snow poles in place of the marker posts: a
  2.4 m thin orange rod with a white band near the top, standing clear of
  the drifts.
- **Snow banks.** A rounded ridge of snow 0.9 m high is heaped along both
  verges, from 0.6 m beyond the carriageway out over 3.2 m
  (`terrain.banks`): the terrain mesh heaps it and the wheels climb it, so
  leaving the road means riding up the bank. None through a village, where
  the pavements run, and none beside a side street.
- **Forest wall.** Tall spruces (`spruce`: a thin trunk the whole height
  carrying eight or nine irregular whorls of foliage from just above the snow, each an octagonal
  truncated cone of its own width and depth set a little off the axis, with
  gaps between them where the trunk shows, to a tip near 14 m, after the
  low-poly snowy pine kept as a reference in `context/environment` and the
  photographs; 0.7–1.5× scale) stand about 230 per 100 m right behind the
  banks, with a few ordinary pines, bare pale birches, bushes and rocks
  between. Two silhouettes: every other one (the even variants) carries
  snow, a white sleeve round each whorl's top, a snowed tip and a drift
  round the foot; the odd ones are bare and shaped differently.
- **Crests.** About every 190 m, where the road runs straight and level
  for 36 m and no gate, start or village is near, a raised cosine hump
  1.1 m high over 36 m is added to the road profile (`terrain.crests`,
  `TerrainField.addCrests`): the car jumps it at speed, and its steepest
  grade with the road's own stays under 17 %.
- **Drifts.** Snow lies on the road whatever the surface, even cleared
  tarmac: long drifts across the full width, tens of metres each over
  about a third of the road, with a sharp core and ragged ends (each side's
  snow runs out to the centre on its own, shifted a few metres by its own
  noise, so a drift starts and ends unevenly), and small blobs from each
  bank onto the carriageway between them, two to six metres long and up to
  45 % of the half width (`RoadBuilder`, where the region heaps banks).
  Visual only: grip is the surface's.
- **Handling.** Studded tyres: the sim's grip is 1.45× the surface's, the
  steering rate 1.25× and the lock 1.2× (`handling`, read into the
  `SimEnv` by the driving session), so snow here is far less slidy than the
  Alpine's dusting and the car turns in harder.
- **Spectators.** Faceted low-poly people after the reference crowd in
  `context/low-poly-people` (tapered limbs between posed joints, a faceted
  head; `spectator`), in nine poses: six standing and cheering (fist pump,
  clapping, both arms up, hands on the head, arms crossed, waving), one
  sitting on the ground with knees up and hands on them, and one sitting and
  one standing taking a picture with a camera up to the eye. Each has its
  own headwear, skin, trousers and boots, in one of six jacket colours. On
  Autumnal stages the same crowd comes out in
  everyday clothes (`SpectatorWardrobe`): T-shirts or long sleeves in six
  colours, jeans, chinos or shorts, trainers, caps, bare heads and
  ponytails, bare hands; snow stage types keep the padded jackets. On
  Autumnal, groups and the start, checkpoint and finish crowds stand about
  6 m past the carriageway's edge, behind a grassy berm (0.35 m high, 2.2 m
  deep, its foot 3.4 m out, clear of the verge) heaped in 8 m runs along the
  crowd and a metre past each end of a group, grassed in a lusher shade
  of the field's green; jump crowds keep the open line. Wild scenery keeps off the berms, and the car rides
  over them like any ground. The finish draws
  the thickest crowd (45 m before to 25 m after, two rows, a stride
  apart); the start (25 m before to 35 m after), every checkpoint (22 m
  before to 18 m after) and each crest's run-up and landing are lined half
  as thickly (two strides apart). Crowds leave a 4 m gap at each board or
  arch and deal from a shuffled deck of the 36 pose-and-jacket pairings,
  so no pairing repeats within six people. Between them stand about two
  groups per 100 m (`scenery.spectators`) of five or six people, no two in
  a group sharing a pose or a jacket. All stand just behind the snow banks
  facing the road, never in a building nor where another stretch of road
  passes; the wild scatter keeps 2.2 m clear of them.
  Decoration only, no colliders.
- **Look.** Pale sky and fog, near-white ground, dark blue-green spruce,
  dark trunks; houses under snow like the Alpine's.

## Coastal

A Coastal stage is a cliff road with the sea to seaward and a hairpin stack or
two. The lie of the land comes first (`CoastShape.ts`): along the stage axis
the water line meanders in bays and headlands, and from it the ground climbs
across a beach, a terraced rock band (the cliff) and a scrub hillside with
outcrops, with the stage type's relief further in. The road is then drawn on that
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
  and a leg). Every leg, and the way down, keeps 36 m (centre to centre) from
  the road below it: where the shore bends the contours close up, the legs
  move further apart and the top leg runs on until the descent clears the
  first hairpin (decision 181). A hairpin climbs faster than the 12 %
  deck can, so it runs cut into the hillside; the ground is banked back
  from every stretch of road at no more than 1.2 per metre, and between a
  lower road's cut and an upper road's fill it ramps straight from one
  verge to the other (decision 183).
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
  wet sand under it.

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
  of water standing 0.45 m over its floor, a ring of six to ten coconut palms (a leaning, ringed trunk curving 2.3 m off the vertical over 6.75 m, eight drooping fronds and a cluster of coconuts, after the low-poly model kept as a reference in `context/palm-tree`) on
  the rim and a few scrub bushes at the water. The wild scatter keeps out of
  the pools. No villages: a town index that falls on a desert stage stays
  open road.
- **Scenery.** Dry scrub and sandstone boulders, sparse; no pines, no farms.

## Urban

An Urban stage is a big city from the start line to the finish: the whole
route is one town (`UrbanPlan.ts` draws it, `TownGenerator.layoutTown` lays
it with the city hooks in `UrbanGenerator.ts`, `UrbanField.ts` shapes the
ground), so everything the villages have, junctions, blocked side streets
with cones and boards, kerbed pavements, terraces and garden walls, is here
too, at a city's scale.

- **Plan.** Blocks of 60–160 m end in corners: mostly right angles, some
  skewed to 60°, 75°, 105° or 120°, some gentle kinks of 15°–35° (irregular
  streets, which bend without a junction). Now and then a block ends in a
  sweeping avenue arc of 40–90 m radius instead. Corners round `8 m + half
width`, so a boulevard turns on a 15 m arc and a lane on an 11 m one. The
  route keeps within 100° of the stage axis and is checked whole against the
  self-approach rule (up to 40 draws, then a staircase of right angles).
- **Lanes.** A street's width is drawn afresh only after a junction corner
  (kinks, avenue curves and roundabouts carry it through): a narrow one-way lane (3.2 m half
  width, at most once a stage, square corners and short blocks), two lanes
  (4.5 m), three (5.5 m) or a four-lane boulevard (7 m, always at the start
  and the finish). The stage's base width is the boulevard's. A junction
  between two streets of different widths is the narrower one wide from
  kerb to kerb: the ribbon holds that width from 6 m beyond where the
  junction's kerbs hand over on either side (room for the zebra and its
  stop line), and the wider street drops its lanes over the 30 m before
  that (shorter where the next junction's hold comes first), so no kerb
  steps or wobbles inside a junction and a boulevard reads as a boulevard
  until the lane drop. A roundabout's deflections ease the width along
  their arcs. Streets with two or more 3.3 m lanes carry dashed white lane
  dividers and, when the count is even, a solid centre line, left off
  through junctions (from the stop line before each crossing to the one
  after, so no line runs under a zebra or into the pavement's flare), lane
  drops and roundabouts. Every boulevard carries a kerbed green median down its middle
  (1.8 m: a 35 cm sidewalk strip each side of a grass strip, a kerb high, rounded at both ends, the
  wheels feel it; small bushes every 7 m along the grass) from 6 m after its start to 6 m before its end, broken
  round every crossroads and never before the first 70 m of road, where the
  start gantry stands.
- **Junctions.** Every corner of 45° or more is a junction with two blocked
  side streets; blocks of 110 m and over get a crossroads about every 75 m.
  A city's side streets run 150 m from their junction (a village's run
  32 m), lined with terraces, so the city reads on past the route instead of
  ending at a wall a few metres in. One that would run into the route runs
  on to the route's axis and ends in a T junction there, with a mouth, kerb
  returns and an opening in the ribbon like any crossroads
  (`UrbanStreets.ts`; none within 60 m of the start or finish); one that
  would run into another side street runs to that street's carriageway
  through a square mouth cut in its pavement, open-ended (no end building,
  its deck taking the other road's level); two that face each other down
  one line meet in the middle; only one that would reach a roundabout stops
  short with a building across its end, never below 20 m. A wide street's cones stand beyond its junction's
  own surface, and a row across a side street that carries a tram line leaves the tram bed
  clear (no cone within 1.6 m of the line), so the tram passes between the cones. A side
  street ends in a T on the route only where it meets it within 22° of square (an oblique T's
  kerb returns stretch into aprons along the road); it opens onto another side street only
  16 m or more past that street's junction, clear of its kerb returns and wedge walls, and
  never within 8 m of the route's pavement; otherwise it stops short with its end building
  and the route's terraces run on past it. The garden walls round the junction greens are closed: any
  wall end that meets neither another wall nor a building is joined to the
  nearest such end within 6 m (`TownWallGaps.ts`), the ring walls run
  exactly up to each road's facade lines, and every walled corner takes up
  to two trees and five bushes.
- **Roundabouts.** One a stage, two from the third difficulty loop, three
  from the fifth: the route deflects right through 28° on a 20 m arc onto a
  ring round an island of 8–11 m radius, circulates left through 56° (straight
  on) or 146° (a left turn) and deflects right off it. The ring's carriageway
  is the ring lane's width (the approach's, at most three lanes); the part
  the route does not drive is laid as short chord streets, so it is tarmac at
  deck level, and the hills are levelled to the island's height for 18 m
  beyond the ring, blending back over 40 m, so the ring lies flat. The
  island stands a kerb above the ring with a tree and a few bushes; blocked
  exits leave the ring every quarter turn from the entry where they clear
  the route's own arms, closed by cones like any side street. The ring's
  tarmac is one full annulus under the route and the exits, and its outer
  kerb, pavement and edge line are broken wherever the route's deflections
  and the exits cross the band (found by walking the route), as the ribbon's
  Inside a hand-off radius (6 m beyond the ring's outer pavement) the roads
  paint only their carriageways, and the ring's surface (`RoundaboutSurface.ts`)
  paints everything else from one distance field of the ring, its exits and
  the route: the carriageway union is closed by the pavement width, which
  rounds every road's mouth into a kerb return, and the tarmac fillets, the
  pavement with its kerb faces and the white edge line are each one contour
  of that field with an offset, so tarmac, sidewalk and line run from every
  road onto the ring in one piece and meet the roads' own strips edge to
  edge at the hand-off. Garden walls run behind the ring's outer pavement
  in 3 m chords, broken for every road, and down each exit's facades to its
  terraces, with a bush in every corner, as a junction's wedges have.
- **Trams.** Up to five lines cross the route square on at crossroads, from
  the end of one side street through the junction to the end of the other;
  none within 45 m of a roundabout, none along the route itself. A
  line is two rails a standard gauge (1.435 m) apart set in a 2.6 m strip of
  sett paving that rides over whatever it crosses, under a single overhead
  contact wire 5.15 m over the rails, following them up and down and
  stopping 2 m short of the line's ends; no poles. The rails
  stand 2 cm proud and the wheels feel them as a double ridge (felt 15 cm
  wide so a 120 Hz step cannot miss one); grip is tarmac's throughout.
  Now and then a tram runs the line (`TramService.ts`, `TramFleet.ts`): a
  24 m low-floor tram in three sections joined by ribbed bellows, white
  over a blue lower band, framed windows and double doors, slatted roof
  pods and a raised single-arm pantograph whose strips ride the contact
  wire, and cabs with chamfered corners, a raked screen,
  destination band, wiper, mirrors, bumper and lights, at 29 km/h every 55–95 s per line on a timetable
  from the stage seed, alternating direction, riding the rails with the
  street's slope and fading in and out at the line's ends. It is solid:
  the session poses the same timetable's hitbox (24 × 2.65 m, once the tram
  has half faded in) from the run's clock every physics step, so the car is
  stopped by a tram exactly where it sees one, and a tram rolling into a
  standing car shoves it along.
- **Buildings.** Four city styles join the village ones, all in the game's
  flat-shaded box style with cornices, lintels and sills on every casement
  and stone details in fixed colours, and each in four façade renders
  (brick, sandstone, white render, ochre; the office pale to slate): an
  apartment `block` (14 × 11 m, five storeys, balconies across the front, an
  entrance awning, a roof with a water tower, plant and a planter garden), a
  glass `office` (12 × 12 m, eight storeys of glass bands between stone
  piers, a cantilevered canopy, a railed set-back crown, AC plant and a
  mast), a brick `tenement` (12 × 10 m, five storeys: arched ground-floor
  bays, quoins, a fire escape down one flank, a water tower and planters on
  the roof) and an `arcade` (10 × 10 m, three storeys over a stone colonnade
  of four arches with shop windows in the recess, balconettes, a roof garden
  under a pergola). The city mixes blocks 4, tenements 4, offices 2, arcades
  2, shops 2, townhouses 1 along every facade (`BuildingCatalog.ts` holds
  the footprints and door positions).
- **Markings and furniture.** Every junction arm carries a zebra crossing
  just past the junction's paving with a stop line beyond it
  (`Crossings.ts`), except where a tram runs down the arm. Three-lane
  streets are parked along: the kerb lane each side is painted as 5.5 m
  bays between the junctions (`ParkingBays.ts`), two driving lanes with a
  centre line run between them, and about a third of the bays hold a parked
  car: the Riviera WRC's or the Tempesta Group B's own lofted hull without
  its wing or livery (`HullShapes.ts`), in one of five colours on round
  wheels, pitched to the street's slope, which the car hits like any
  obstacle. Every street, route and side street alike, carries the same
  rhythm on both pavements (`StreetFurniture.ts`): a street tree in a
  kerbed pit every 15 m a side (shifted up to 3.5 m where a door or a mouth
  is in the way, so the rows stay unbroken), a lamp every 30 m alternating
  sides between the trees, and a bench, a litter bin, a hydrant or a
  bollard on the pavement opposite each lamp; nothing but a lamp or
  bollard stands within 2 m of a door, and nothing in a junction's mouth,
  beside another street or inside a ring's hand-off; benches and bins face
  the road. Every junction gets a traffic light on each corner, and manhole covers dot the carriageway every
  40 m. The garden walls are hedges. The ground under a city's streets is
  coloured tarmac under the carriageways and paving under the pavements, and
  the terraces' pads stop short of the pavements, so no grass shows through
  a seam or along a building on a slope.
- **Elevation.** The city keeps 16 m of the hills' relief (a village keeps
  8 m) around its mean height, so streets climb and dip up to the 12 %
  grade limit and the terraces step with them; side streets climb at up to
  8 %. Every junction sits on a small plateau (level for 14 m round its
  centre, blending back over 22 m), as a hilly city's intersections do, and
  in any town the ground stays level a terrain cell beyond the pavements
  before it climbs.
- **Gates.** With the town spanning the stage, checkpoints stand between
  junctions, at least 25 m along the road from any junction or roundabout
  ring, each as wide as the street it stands on; the start and finish
  gantries span the boulevard.
- **Scenery.** The wild scatter is the parks': a few trees and bushes off
  the streets, no farms, no rocks. Par speed is 13 m/s on tarmac.

## Circuits

Every tenth stage (index 9, 19, 29, …; never two in a row) is a closed race
circuit in parkland (`circuit` region, in its own slot of the schedule:
see `stageSlot`). A layout is drawn by
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

| Surface | Where                                                             | Feel                                                                                         |
| ------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| track   | every circuit                                                     | race asphalt: a quarter more grip than tarmac and a planted rear, so the car slides far less |
| tarmac  | some Forest and Alpine stages, every Coast and Urban stage, towns | most grip, highest par speed                                                                 |
| gravel  | most Forest stages                                                | the reference surface                                                                        |
| mud     | some Forest stages                                                | slow and slippery                                                                            |
| snow    | most Alpine stages, and off road there                            | least grip, dusted asphalt look                                                              |
| sand    | every Desert stage                                                | packed piste, a little looser than gravel                                                    |
| dune    | off the road in the Desert                                        | soft sand, the car wallows                                                                   |
| grass   | off the road everywhere else                                      | heavy drag                                                                                   |

Tyre marks are drawn per surface into a single fading ring-buffer mesh.

## Not yet built

Sound and engine note, post-processing and quality tiers, weather effects
and night, pace notes and live splits, gamepad
input, and the Capacitor mobile shells. See [PLAN.md](PLAN.md).
