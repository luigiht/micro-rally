import { ObstacleGrid } from '../vehicle/Collisions';
import { propObstacles, scatterScenery, type Prop } from './SceneryScatter';
import { generateStage, type StageDef } from './StageGenerator';
import { TerrainField } from './TerrainField';

/** Everything deterministic about one stage: road, terrain, scenery, colliders. */
export interface StageWorld {
  gameSeed: number;
  stage: StageDef;
  field: TerrainField;
  props: Prop[];
  obstacles: ObstacleGrid;
}

export function createStageWorld(gameSeed: number, index: number): StageWorld {
  const stage = generateStage(gameSeed, index);
  const field = new TerrainField(stage);
  const props = scatterScenery(field);
  return { gameSeed, stage, field, props, obstacles: new ObstacleGrid(propObstacles(props)) };
}
