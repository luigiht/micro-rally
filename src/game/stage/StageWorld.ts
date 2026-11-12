import { ObstacleGrid } from '../vehicle/Collisions';
import { barrierObstacles } from './CircuitTrackside';
import { seaWallObstacles } from './Coastline';
import { propObstacles, scatterScenery, type Prop } from './SceneryScatter';
import { calendarSlot, generateStage, type StageDef, type StageSlot } from './StageGenerator';
import { TerrainField } from './TerrainField';
import { townObstacles } from './Town';
import { loopFleet, tramSchedule, type TramTraffic } from './TramService';

/** Everything deterministic about one stage: road, terrain, scenery, colliders. */
export interface StageWorld {
  gameSeed: number;
  /** What runs at this index: the calendar's slot, or a session's. */
  slot: StageSlot;
  stage: StageDef;
  field: TerrainField;
  props: Prop[];
  obstacles: ObstacleGrid;
  /** A city's tram lines and their timetable; absent elsewhere. */
  trams?: TramTraffic;
}

/**
 * The last world built, so retrying a stage (or re-mounting its scene)
 * reuses it rather than generating again: a city takes a good fraction of a
 * second to lay out. Worlds are never mutated after construction.
 */
let last: StageWorld | null = null;

function sameSlot(a: StageSlot, b: StageSlot): boolean {
  return a.stageType === b.stageType && a.loop === b.loop && a.town === b.town && a.dusk === b.dusk;
}

/** The world at `index` in `slot` (the career calendar's unless a session gives its own). */
export function createStageWorld(
  gameSeed: number,
  index: number,
  slot: StageSlot = calendarSlot(index),
): StageWorld {
  if (last && last.gameSeed === gameSeed && last.stage.index === index && sameSlot(last.slot, slot))
    return last;
  last = buildStageWorld(gameSeed, index, slot);
  return last;
}

function buildStageWorld(gameSeed: number, index: number, slot: StageSlot): StageWorld {
  const stage = generateStage(gameSeed, index, slot);
  const field = new TerrainField(stage);
  const props = scatterScenery(field);
  const boxes = [
    ...(stage.town ? townObstacles(stage.town) : []),
    ...(field.coast ? seaWallObstacles(field.coast) : []),
    ...barrierObstacles(stage),
  ];
  return {
    gameSeed,
    slot,
    stage,
    field,
    props,
    obstacles: new ObstacleGrid(propObstacles(props), boxes),
    ...(stage.town?.tramLoop
      ? {
          trams: {
            lines: stage.town.trams ?? [],
            runs: [],
            loop: loopFleet(stage.town.tramLoop, stage.seed),
          },
        }
      : stage.town?.trams?.length
        ? { trams: { lines: stage.town.trams, runs: tramSchedule(stage.town.trams, stage.seed) } }
        : {}),
  };
}
