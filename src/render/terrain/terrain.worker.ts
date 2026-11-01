/// <reference lib="webworker" />
import { REGIONS } from '@/game/stage/regions';
import { scatterScenery } from '@/game/stage/SceneryScatter';
import { generateStage } from '@/game/stage/StageGenerator';
import { TerrainField } from '@/game/stage/TerrainField';
import { meshTerrainChunk, terrainColors, type TerrainColors } from './meshTerrainChunk';

export type TerrainWorkerRequest =
  | { type: 'init'; gameSeed: number; stageIndex: number }
  | { type: 'chunk'; cx: number; cz: number; size: number; res: number };

let field: TerrainField | null = null;
let colors: TerrainColors | null = null;
let amplitude = 1;

self.onmessage = (e: MessageEvent<TerrainWorkerRequest>) => {
  const msg = e.data;
  if (msg.type === 'init') {
    // Regenerating from the seed is cheaper than serialising the stage, and identical by construction.
    const stage = generateStage(msg.gameSeed, msg.stageIndex);
    const region = REGIONS[stage.region];
    field = new TerrainField(stage);
    // Scenery placement registers the level pads under houses on the field; the props themselves are not needed here.
    scatterScenery(field);
    colors = terrainColors(region.palette);
    amplitude = region.terrain.amplitude;
    return;
  }
  if (!field || !colors) return;
  const data = meshTerrainChunk(field, colors, amplitude, msg.cx, msg.cz, msg.size, msg.res);
  self.postMessage(data, {
    transfer: [data.positions.buffer, data.normals.buffer, data.colors.buffer],
  });
};
