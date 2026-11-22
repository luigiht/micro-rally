# Upcoming stages

Ideas for new stage types and ways to race, drawn from real-world rallying
and from what the game already has. Nothing here is built yet; this is a
shortlist to pick from. When one is picked, build it as a stage type in
`src/game/stage/regions.ts` (see [How a new stage type lands](#how-a-new-stage-type-lands))
and log the choices in [DECISIONS.md](DECISIONS.md).

Names in the game stay generic, as with Greenvale and Lakeland: places and
landscapes are fine, but no event names, sponsors, logos or real liveries
(project rule 9).

## What the game has today

| Stage type | Surface             | Real-world feel            | Signature features                                   |
| ---------- | ------------------- | -------------------------- | ---------------------------------------------------- |
| Greenvale  | tarmac              | Monte Carlo mountain roads | hairpin stacks, rock cuttings, groves, jumps, crowds |
| Pinewood   | gravel              | fast forest gravel         | dense tall pines, loose stones, wheel tracks         |
| Autumnal   | mud                 | wet autumn forest          | narrow raised lanes, leaf litter, mixed woods        |
| Alpine     | snow                | Alpine passes              | snow banks, rivers and stone bridges, villages       |
| Arctic     | snow                | Scandinavian winter        | spruce walls, snow banks                             |
| Coastal    | tarmac              | Mediterranean shore        | sea on one side, dry-stone walls, headlands          |
| Desert     | sand                | rally-raid desert          | dune sea off-road, oases                             |
| Urban      | tarmac              | city street stage          | street map, roundabouts, trams, parking bays         |
| Lakeland   | tarmac, mud patches | Swedish summer             | lakes, long bridges, surface changes mid-stage       |
| Circuit    | race track          | circuit races              | figure-eight lap with a bridge and tunnel, kerbs     |

Surfaces in `src/game/vehicle/surfaces.ts`: tarmac, track, gravel, grass,
mud, snow, sand, dune. Weather is already chosen per stage
(`StageTypeDef.weathers`: clear, overcast, rain, night) and `VehicleSim`
takes a weather grip multiplier, but rain is not drawn yet.

**What is missing:** hot open landscapes, rough rocky gravel, wet weather you
can see, big jumps on gravel, water crossings, and night on rally roads.
The picks below aim at those gaps rather than at new scenery on the same
driving.

## Recommended order

1. **Safari** — the most different look and the water crossings.
2. **Wales** — brings visible rain and fog, which every other type can then
   use as a weather variant.
3. **Finland** — quick, because it reuses the jumps and lakes already built.

## Top picks

### Safari (Kenya) — built as Savanna (decision 293)

- **Look:** red earth across open savannah, flat-topped acacias, distant
  hills and escarpments, giraffes and zebras well off the road, dusty haze.
- **Driving:** long, fast, rutted tracks that open up far more than any
  forest stage; river and water crossings that throw spray and slow the car;
  patches of very fine powdery dust ("fech-fech") with less grip that hide
  the road for a moment.
- **New to build:** water splash (a shallow ford: drag, spray particles,
  a darker wet surface after it), a powdery-dust surface, savannah scatter
  (acacias, termite mounds, tall dry grass), animals as static or slowly
  wandering scenery away from the road.
- **Reuse:** `Rivers.ts` already finds road low points for crossings (today
  with bridges); Desert's palette and dust; `TallGrass`; Lakeland's surface
  stretches (`SurfaceSpans`) for the dust patches.
- **Watch:** keep animals off the road and out of the racing line; keep it
  readable from the chase camera on a wide-open landscape.

### Acropolis (Greece)

- **Look:** rocky mountain gravel through dry hills, olive groves, cypress,
  white stone villages, hot hazy light, thick dust trails.
- **Driving:** slow and technical: rough, rocky road with loose stones,
  tight hairpins up and down the hillsides. A rhythm stage rather than a
  speed stage, unlike Pinewood.
- **New to build:** a rough-gravel surface (lower grip than gravel, more
  bump from the suspension), rocks along the verges and in the road edges,
  whitewashed village style.
- **Reuse:** Greenvale's lacets (hairpin stacks) and rock cuttings, town
  generation with a new building style, Desert's dust.
- **Watch:** "rough" must not mean frustrating; bumps should unsettle the
  car, not stop it.

### Wales (Great Britain) — built as Moorland (decision 291)

- **Look:** wet forest gravel under dark spruce, open moorland between the
  woods, slate quarries and spoil heaps, dry-stone walls, sheep, low mist.
- **Driving:** puddles that tug at the car and splash, slippery wet gravel,
  fog that cuts how far ahead you can see.
- **New to build:** visible rain (falling streaks, wet sheen on the road,
  spray from the wheels) wired to the existing `rain` weather and grip
  multiplier; fog density per weather; puddles as small low-grip patches.
- **Reuse:** Pinewood's forest gravel and trees, Coastal's dry-stone walls,
  `StageTypeDef.weathers` and `VehicleSim`'s weather grip.
- **Why it pays twice:** once rain and fog exist, Pinewood, Autumnal,
  Greenvale and Urban can roll rainy or foggy variants too. Every visual
  extra must stay toggleable per quality tier and calm under reduced
  motion (project rules 4 and 5).

## Also strong

### Finland (lakes and crests)

- **Look:** birch and pine forest between lakes, red barns, fast open
  gravel.
- **Driving:** very fast gravel over blind crests with long jumps; the
  famous "flying" stages.
- **Different from Lakeland:** Lakeland is summer tarmac with mud patches;
  this is gravel at speed with big air.
- **Reuse:** `TerrainField` crests (built for Greenvale's jumps), `Lakes.ts`,
  Pinewood's gravel. Probably the cheapest of all to build.

### Portugal

- **Look:** eucalyptus forest, terraced hills, granite villages, crowds on
  every bank.
- **Driving:** fast gravel with one big signature jump packed with fans.
- **Reuse:** Greenvale's crowd benches and jumps; a new eucalyptus tree.

### Corsica (France)

- **Look:** narrow twisty tarmac on sea cliffs, scrubland, stone walls,
  villages clinging to hillsides.
- **Driving:** endless corners, no straights to rest on.
- **Watch:** it overlaps Coastal and Greenvale. Only worth it with a feature
  of its own, such as sheer drops with low walls, or a road narrow enough to
  change how you drive.

### Argentina or Chile

- **Look:** Argentina: high mountain gravel, rocky passes, condors, water
  splashes. Chile: pine and eucalyptus forest by the Pacific.
- **Reuse:** the Safari water splash, Coastal's sea, Pinewood's forest.

### Australia

- **Look:** red outback gravel, gum trees, kangaroos, wide horizons.
- **Driving:** loose gravel lying on hard ground ("marbles"): the racing line
  grips, the edges are slippery, so running wide costs time.
- **New to build:** grip that varies across the road's width.

### Iceland

- **Look:** black volcanic sand, mossy lava fields, glaciers on the skyline.
- **Driving:** deep river crossings.
- **Watch:** mostly a visual twist on Desert plus the Safari water splash.

## New ways to race

These change the format or conditions rather than the place.

- **Hillclimb:** one long climb against the clock, gravel at the foot and
  tarmac near the top, ending above the clouds. Could be a special event like
  the circuits (every Nth stage).
- **Rallycross:** a short loop with mixed tarmac and gravel and a "joker"
  alternative route each car must take once per race. Suits multiplayer;
  reuses much of the circuit code (`CircuitGenerator`, kerbs, barriers).
- **Night stages:** headlights only, on rally roads, not just in the city.
  The `night` weather and the car lamps (`CarLamps`) already exist.
- **Monte Carlo ice patches:** Greenvale tarmac with sudden icy or snowy
  stretches, using Lakeland's surface stretches with snow instead of mud.

## Not on the list

- **Japan:** a Japanese river valley (rivers, rice paddies, farmhouses) was
  built on 2026-11-07 and dropped at the user's request before any commit.
  Revisit only with a clearly different angle and the user's go-ahead.

## How a new stage type lands

Following how Lakeland was added (decision 279):

1. **Definition:** a `StageTypeDef` in `src/game/stage/regions.ts` (surface,
   off-road surface, weathers, palette, terrain, towns, scenery), its id
   added to `StageTypeId` and `STAGE_TYPES`, and a name in every locale
   (`src/i18n/messages/{en,es,it}.ts`, `stageTypes`).
2. **Rotation:** append it to `RALLY_CYCLE` so the existing stages keep their
   types, and bump the save version (`SAVE_VERSION` in
   `src/game/save/SaveFile.ts`) with a migration that drops records only
   where a stage's type changed.
3. **New surfaces or features:** a surface in `surfaces.ts` (grip, drag),
   pure generators in `src/game/stage/` (like `Lakes.ts`, `Rivers.ts`), their
   meshes in `src/render/`, each visual extra toggleable per quality tier.
4. **Balance:** par and prize factors for the surface; check climbing and
   cornering with the sim tests (`tests/unit/climbGrip.test.ts`,
   `vehicleSim.test.ts`); tune `handling` per stage type if cars struggle.
5. **Check it:** unit tests for the generators, screenshots of a few seeds
   (the stage screenshot recipe in [TESTING.md](TESTING.md)), and entries in
   [CONTENT.md](CONTENT.md), [GAMEPLAY.md](GAMEPLAY.md),
   [DECISIONS.md](DECISIONS.md) and [CHANGELOG.md](../CHANGELOG.md).
