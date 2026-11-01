import { Group } from 'three';
import { REGIONS } from '@/game/stage/regions';
import type { StageWorld } from '@/game/stage/StageWorld';
import { RoadBuilder } from '../road/RoadBuilder';
import { SceneryChunkManager } from '../scenery/SceneryChunkManager';
import { terrainColors } from '../terrain/meshTerrainChunk';
import { TerrainChunkManager } from '../terrain/TerrainChunkManager';
import { TownJunctionBuilder } from '../town/TownJunctionBuilder';
import { TownStreetBuilder } from '../town/TownStreetBuilder';
import { TownWallBuilder } from '../town/TownWallBuilder';
import { GateBuilder } from './GateBuilder';

export interface StageRenderOptions {
  terrainRadius: number;
  terrainResolution: number;
  sceneryRadius: number;
  shadows: boolean;
}

export const DEFAULT_STAGE_RENDER: StageRenderOptions = {
  terrainRadius: 300,
  terrainResolution: 32,
  sceneryRadius: 220,
  shadows: true,
};

/** Owns every three.js object for a stage; `dispose` frees them all. */
export class StageRenderer {
  readonly group = new Group();
  private readonly terrain: TerrainChunkManager;
  private readonly scenery: SceneryChunkManager;
  private readonly road: RoadBuilder;
  private readonly gates: GateBuilder;
  private readonly town: TownStreetBuilder | null;
  private readonly junctions: TownJunctionBuilder | null;
  private readonly walls: TownWallBuilder | null;

  constructor(world: StageWorld, opts: StageRenderOptions = DEFAULT_STAGE_RENDER) {
    const region = REGIONS[world.stage.region];
    this.terrain = new TerrainChunkManager(
      world.gameSeed,
      world.stage.index,
      world.field,
      terrainColors(region.palette),
      region.terrain.amplitude,
      { size: 64, resolution: opts.terrainResolution, radius: opts.terrainRadius },
    );
    this.scenery = new SceneryChunkManager(
      world.props,
      region.palette,
      96,
      opts.sceneryRadius,
      opts.shadows,
      region.offroad === 'snow',
    );
    this.road = new RoadBuilder(world.stage, world.field, region.palette.shoulder);
    this.gates = new GateBuilder(world.stage, world.field);
    const town = world.stage.town;
    this.town = town ? new TownStreetBuilder(town, world.field, world.stage.halfWidth) : null;
    this.junctions = town ? new TownJunctionBuilder(world.stage, world.field) : null;
    this.walls = town ? new TownWallBuilder(town, world.field) : null;
    this.group.add(this.terrain.group, this.scenery.group, this.road.group, this.gates.group);
    if (this.town) this.group.add(this.town.group);
    if (this.junctions) this.group.add(this.junctions.group);
    if (this.walls) this.group.add(this.walls.group);
  }

  update(x: number, z: number): void {
    this.terrain.update(x, z);
    this.scenery.update(x, z);
  }

  dispose(): void {
    this.group.removeFromParent();
    this.terrain.dispose();
    this.scenery.dispose();
    this.road.dispose();
    this.gates.dispose();
    this.town?.dispose();
    this.junctions?.dispose();
    this.walls?.dispose();
  }
}
