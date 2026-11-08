/// <reference lib="webworker" />
import { REGIONS } from '@/game/stage/regions';
import { scatterScenery } from '@/game/stage/SceneryScatter';
import { generateStage } from '@/game/stage/StageGenerator';
import { TerrainField } from '@/game/stage/TerrainField';
import {
  meshTerrainChunk,
  terrainColors,
  type ChunkMeshData,
  type TerrainColors,
} from './meshTerrainChunk';

export type TerrainWorkerRequest =
  | { type: 'init'; gameSeed: number; stageIndex: number }
  | { type: 'chunk'; cx: number; cz: number; size: number; res: number };

/** `ready` once the stage is rebuilt here; until then the main thread meshes the chunks itself. */
export type TerrainWorkerReply = { type: 'ready' } | ({ type: 'chunk' } & ChunkMeshData);

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
    colors = terrainColors(region.palette, region.coast);
    amplitude = region.terrain.amplitude;
    self.postMessage({ type: 'ready' } satisfies TerrainWorkerReply);
    return;
  }
  if (!field || !colors) return;
  const data: TerrainWorkerReply = {
    type: 'chunk',
    ...meshTerrainChunk(field, colors, amplitude, msg.cx, msg.cz, msg.size, msg.res),
  };
  self.postMessage(data, {
    transfer: [data.positions.buffer, data.normals.buffer, data.colors.buffer],
  });
};
