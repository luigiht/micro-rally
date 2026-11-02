# How Micro Rally plays

What the player meets today, with the numbers behind it. The original intent
is in [BRIEF.md](BRIEF.md); where the game has grown past the brief, this
document is the one to trust. Constants live in `src/game` and are quoted
here as of 2 November 2026.

## Starting and continuing

- The start screen asks for a driver name and, optionally, a Game ID. An
  empty ID starts a new game with a fresh random seed; a pasted ID loads
  that game. Returning players on the same device get a Continue button.
- A Game ID is eight characters of Crockford base32 (no I, L, O or U). It is
  the only key to a game: anyone who has it can play it, and the UI says so.
  It also sits in the URL as `?game=…`, so a bookmark resumes the game.
- Progress is saved on the device first and then online under the ID.
  Autosave runs on start, 2.5 s after progress changes, every minute, when
  the tab is hidden or closed, and on leaving. If the server is unreachable
  the save stays local and the Game panel says so; the next save retries.

## A stage

1. **Countdown.** Three seconds, then GO. The car cannot move before GO.
2. **Checkpoints.** Two to six gates, evenly spaced, plus the finish; they
   must be crossed in order and inside their width. Each is marked by a pair
   of rally time-control boards and a tick on the progress bar.
3. **Penalties.** Hitting a tree, rock, house or wall at 3 m/s or more costs
   2 s and a $25 repair fee, at most once a second. Off the road the car
   drags through grass (or snow in the Alps).
4. **Reset.** `R` respawns 6 m past the last checkpoint passed (or at the
   start), facing down the road.
5. **Finish.** The result panel shows the time, par, previous best, prize
   money and repairs, with Drive it again, Watch replay and Next stage.
6. **Replay.** The run is recorded every physics step from GO until three
   seconds past the finish. During the replay the car follows the recording,
   the clock, checkpoints and progress bar replay with it, driving keys do
   nothing, `C` and Settings still switch camera, and `H` still hides the
   HUD. Esc, "Exit replay" or the end of the recording returns to the
   result panel.

## Par and prize money

- **Par time** is the stage length divided by the region's par speed (15 m/s
  Forest, 14 m/s Alpine) times a surface factor (tarmac 1.12, gravel 1,
  mud 0.85, snow 0.82), plus 12 s when the stage has a town.
- **Prize** = $800 per kilometre × surface difficulty (tarmac 1, grass 1.1,
  gravel 1.15, mud 1.3, snow 1.35) × pace factor × (1 + 0.25 per loop).
  The pace factor rises to +25 % for beating par by 20 % and falls to a 0.3
  floor at double par. Repair fees are deducted at the finish. A stage of
  the usual 1.5–2 km pays about $1500 at par.
- **Records.** The best time and splits per stage are kept in the save; a new
  record is called out on the result panel.

## Progression

- Stages run in a loop of regions, three per region: Forest ×3, then
  Alpine ×3, then round again. Each loop lengthens stages by 25 % and
  tightens the bends a little, so there is always a next stage.
- Stage 3 of every region, that is stages 3, 6, 9 and so on, carries a town:
  the route leaves the open road, threads a village of right-angle corners,
  narrow streets and blocked side streets, and rejoins the stage.
- Any stage up to the first unfinished one can be driven again from the
  Game panel's stage list.

## Regions

| Region | Surfaces (weight)                 | Off road | Terrain                     | Base length | Par speed |
| ------ | --------------------------------- | -------- | --------------------------- | ----------- | --------- |
| Forest | gravel 3, tarmac 1, mud 1         | grass    | amplitude 22, soft          | 1800 m      | 15 m/s    |
| Alpine | snow 3 (dusted asphalt), tarmac 1 | snow     | amplitude 34, sharper bends | 1500 m      | 14 m/s    |

Coast, Desert and Night exist as names only (Forest clones) and are not yet
in the loop. Each stage also rolls a weather (clear or overcast) into its
brief; rendering does not react to it yet.

## Cameras

`C` cycles Chase → Interior → Isometric → Cinematic; Settings has the same
choice. The mouse wheel zooms the chase, isometric and cinematic views.

- **Chase.** Behind and above the car, trailing its motion, pulling back
  with speed, leaning a little toward where the car is sliding; level
  horizon over jumps.
- **Interior.** Behind the wheel inside each car's own modelled cabin:
  working speedo and tacho, a wheel that turns, gear lever and turbo lamp,
  a small glance into the steering.
- **Isometric.** A long lens from high above and behind the stage's axis;
  only the car turns on screen.
- **Cinematic.** Broadcast-style coverage that cuts between trackside TV
  cameras on the verge ahead (panning and zooming with the car until it
  passes), a helicopter, a low chase car, a camera car alongside and a
  reverse tracking shot, keeping to the 180° and 30° editing rules.

Under `prefers-reduced-motion` the chase camera drops its roll and speed
zoom, the interior keeps a level head, and the cinematic camera fixes its
lens, grounds the helicopter and holds shots longer.

## HUD and controls

The HUD shows the stage clock, checkpoints passed, penalties, money, a
progress bar down the left edge with checkpoint ticks and a finish flag, and
speed and gear bottom right. The toolbar carries Settings and Game (on touch
devices a single Pause button opens a menu of Game, Garage and Settings).
`H` hides all of that for a clean view; dialogs, the countdown and the touch
controls stay. The backtick opens a debug overlay (fps, draw calls, physics
state).

| Key                   | Action                                                  |
| --------------------- | ------------------------------------------------------- |
| `W` / `S` · `↑` / `↓` | Throttle / brake; hold brake to reverse                 |
| `A` / `D` · `←` / `→` | Steer (speed-sensitive lock)                            |
| `Space`               | Handbrake                                               |
| `Shift`               | Turbo, once fitted in the Garage                        |
| `R`                   | Back to the last checkpoint                             |
| `C`                   | Switch camera                                           |
| `H`                   | Hide or show the HUD                                    |
| Mouse wheel           | Zoom the camera                                         |
| `` ` ``               | Debug overlay                                           |
| `Esc`                 | Close any panel, leave a replay, or open the Game panel |

Touch devices get steer pads bottom left, brake and gas pads bottom right
(hold brake to reverse), a pedal-shaped handbrake button and the Pause
button. Keyboard and touch input merge, so a laptop with a touchscreen can
use both.

## Garage

Open from the HUD (or the pause menu). Changes apply at once, even
mid-stage.

### Upgrades

Each level costs the previous price times the growth factor, rounded to $10.

| Upgrade    | Levels | Level 1 | Growth | Effect per level                                                 |
| ---------- | ------ | ------- | ------ | ---------------------------------------------------------------- |
| Engine     | 3      | $600    | 1.6×   | +10 % peak torque                                                |
| Turbo      | 2      | $900    | 1.8×   | Fits a turbo (`Shift`): +25 % drive force, +15 % more at level 2 |
| Tyres      | 3      | $400    | 1.6×   | +6 % grip, +5 % cornering stiffness                              |
| Suspension | 3      | $450    | 1.6×   | +8 % spring, +10 % damping, more stability over bumps            |
| Brakes     | 2      | $350    | 1.7×   | +12 % braking                                                    |
| Gearbox    | 2      | $500    | 1.7×   | 30 % quicker shifts, +2 % drivetrain efficiency                  |
| Weight     | 2      | $700    | 1.9×   | −5 % mass                                                        |

### Dealership

Nine cars in showroom order, each a distinct procedural body (see
[CONTENT.md](CONTENT.md)). Buying is one-off; switching between owned cars
is free. Showroom bars for power, grip and agility are derived from the
physics so they cannot drift from the truth.

| Car                 | Price   | Note                             |
| ------------------- | ------- | -------------------------------- |
| Rally Hatch         | free    | The starter                      |
| Tricolore Coupé     | $4,500  | Group 4 wedge, light and twitchy |
| Sochaux T16         | $6,500  | Group B hatch                    |
| Boreal Saloon       | $8,000  | Four-door WRC saloon             |
| Riviera WRC         | $11,000 | WRC hatch                        |
| Tempesta Group B    | $14,000 | Group B monster                  |
| Edelweiss S1        | $18,000 | Short-wheelbase Group B coupé    |
| Albion RS Hatch     | $21,000 | Three-door WRC hatch             |
| Sirocco Dakar Truck | $26,000 | "Special": a rally-raid truck    |

## Settings

Language (English, Spanish, Italian), camera, and the full controls table
for keyboard and touch. Sound, graphics quality tiers and steering options
from the brief are not built yet.

## Accessibility

Keyboard-only play, visible focus rings, labelled controls and dialogs,
`prefers-reduced-motion` handling as above, and a colour-blind-safe HUD
palette (ink on paper, with the rally orange for emphasis only).

## Development aids

- `/?track=test` opens the flat proving ground (tarmac ring, gravel, snow and
  mud pads, a jump ramp) with no stage or timing.
- `/?spawn=<metres>` starts a stage that far along its road, with the
  checkpoints behind the spawn counted as passed, so a finish can be reached
  quickly; `/?spawn=town` starts 120 m before the stage's town. Both are
  ignored in production builds.
