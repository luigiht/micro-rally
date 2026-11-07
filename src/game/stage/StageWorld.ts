import { ObstacleGrid } from '../vehicle/Collisions';
import { barrierObstacles } from './CircuitTrackside';
import { seaWallObstacles } from './Coastline';
import { propObstacles, scatterScenery, type Prop } from './SceneryScatter';
import { generateStage, type StageDef } from './StageGenerator';
import { TerrainField } from './TerrainField';
import { townObstacles } from './Town';
import { tramSchedule, type TramTraffic } from './TramService';

/** Everything deterministic about one stage: road, terrain, scenery, colliders. */
export interface StageWorld {
  gameSeed: number;
  stage: StageDef;
  field: TerrainField;
  props: Prop[];
  obstacles: ObstacleGrid;
  /** A city's tram lines and their timetable; absent elsewhere. */
  trams?: TramTraffic;
}

export function createStageWorld(gameSeed: number, index: number): StageWorld {
  const stage = generateStage(gameSeed, index);
  const field = new TerrainField(stage);
  const props = scatterScenery(field);
  const boxes = [
    ...(stage.town ? townObstacles(stage.town) : []),
    ...(field.coast ? seaWallObstacles(field.coast) : []),
    ...barrierObstacles(stage),
  ];
  return {
    gameSeed,
    stage,
    field,
    props,
    obstacles: new ObstacleGrid(propObstacles(props), boxes),
    ...(stage.town?.trams?.length
      ? { trams: { lines: stage.town.trams, runs: tramSchedule(stage.town.trams, stage.seed) } }
      : {}),
  };
}
