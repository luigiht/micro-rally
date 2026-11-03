import { Group } from 'three';
import { REGIONS } from '@/game/stage/regions';
import { createRoadHit } from '@/game/stage/RoadPath';
import type { Prop } from '@/game/stage/SceneryScatter';
import type { StageWorld } from '@/game/stage/StageWorld';
import { RoadBuilder } from '../road/RoadBuilder';
import { SeaWallBuilder } from '../road/SeaWallBuilder';
import type { RoadNear } from '../scenery/kits/NightcityKits';
import { sceneryKitsFor } from '../scenery/kits/sceneryKits';
import { SceneryChunkManager } from '../scenery/SceneryChunkManager';
import { terrainColors } from '../terrain/meshTerrainChunk';
import { OasisBuilder } from '../terrain/OasisBuilder';
import { SeaPlane } from '../terrain/SeaPlane';
import { TerrainChunkManager } from '../terrain/TerrainChunkManager';
import { dayTheme, type WorldTheme } from '../theme/WorldTheme';
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

/** Props further than this from the road count as "far" for the kits that care. */
const NEAR_MAX = 60;

/** Everything a theme change rebuilds: surfaces are re-meshed in the new colours, props re-instanced in the new kits. */
interface Surfaces {
  road: RoadBuilder;
  gates: GateBuilder;
  town: TownStreetBuilder | null;
  junctions: TownJunctionBuilder | null;
  walls: TownWallBuilder | null;
  seawall: SeaWallBuilder | null;
  sea: SeaPlane | null;
  pools: OasisBuilder | null;
}

/**
 * Owns every three.js object for a stage; `dispose` frees them all. The look
 * comes from a `WorldTheme`: `setTheme` re-dresses the same stage in place
 * (Nightcity on the N key) without touching the terrain mesh or the sim.
 */
export class StageRenderer {
  readonly group = new Group();
  private readonly terrain: TerrainChunkManager;
  private scenery: SceneryChunkManager;
  private surfaces: Surfaces;
  private theme: WorldTheme;
  private lastX = Number.NaN;
  private lastZ = Number.NaN;
  private readonly nearCache = new WeakMap<Prop, RoadNear>();
  private readonly hit = createRoadHit();
  private readonly sample = { x: 0, z: 0, heading: 0 };

  constructor(
    private readonly world: StageWorld,
    private readonly opts: StageRenderOptions = DEFAULT_STAGE_RENDER,
    theme: WorldTheme = dayTheme(REGIONS[world.stage.region]),
  ) {
    this.theme = theme;
    const region = REGIONS[world.stage.region];
    this.terrain = new TerrainChunkManager(
      world.gameSeed,
      world.stage.index,
      world.field,
      terrainColors(region.palette, region.coast),
      region.terrain.amplitude,
      { size: 64, resolution: opts.terrainResolution, radius: opts.terrainRadius },
      theme.terrain,
    );
    this.group.add(this.terrain.group);
    this.scenery = this.buildScenery(theme);
    this.surfaces = this.buildSurfaces(theme);
  }

  update(x: number, z: number): void {
    this.lastX = x;
    this.lastZ = z;
    this.terrain.update(x, z);
    this.scenery.update(x, z);
    this.surfaces.sea?.update(x, z);
  }

  /** Re-dress the stage in another theme, in one frame: a half-themed world would read as a bug. */
  setTheme(theme: WorldTheme): void {
    if (theme.id === this.theme.id) return;
    this.theme = theme;
    this.terrain.setMaterial(theme.terrain);
    this.disposeSurfaces();
    this.surfaces = this.buildSurfaces(theme);
    this.group.remove(this.scenery.group);
    this.scenery.dispose();
    this.scenery = this.buildScenery(theme);
    if (Number.isFinite(this.lastX)) {
      this.scenery.update(this.lastX, this.lastZ);
      this.surfaces.sea?.update(this.lastX, this.lastZ);
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    this.terrain.dispose();
    this.scenery.dispose();
    this.disposeSurfaces();
  }

  /** Where the road passes a prop, cached per prop: the night kits size towers and turn signs by it. */
  private readonly near = (p: Prop): RoadNear => {
    let n = this.nearCache.get(p);
    if (!n) {
      const path = this.world.stage.path;
      if (path.nearest(p.x, p.z, NEAR_MAX, this.hit)) {
        path.sample(this.hit.along, this.sample);
        n = { dist: this.hit.distance, x: this.sample.x, z: this.sample.z };
      } else {
        n = { dist: NEAR_MAX, x: p.x, z: p.z + 1 };
      }
      this.nearCache.set(p, n);
    }
    return n;
  };

  private buildScenery(theme: WorldTheme): SceneryChunkManager {
    const scenery = new SceneryChunkManager(
      this.world.props,
      sceneryKitsFor(theme, this.world.stage, this.opts.shadows, this.near),
      96,
      this.opts.sceneryRadius,
    );
    this.group.add(scenery.group);
    return scenery;
  }

  private buildSurfaces(theme: WorldTheme): Surfaces {
    const { stage, field } = this.world;
    const town = stage.town;
    const s: Surfaces = {
      road: new RoadBuilder(stage, field, theme.road),
      gates: new GateBuilder(stage, field, theme.gates),
      town: town ? new TownStreetBuilder(town, field, stage.halfWidth, theme.road) : null,
      junctions: town ? new TownJunctionBuilder(stage, field, theme.road) : null,
      walls: town ? new TownWallBuilder(town, field, theme.walls) : null,
      seawall: field.coast ? new SeaWallBuilder(field.coast, field, theme.seawall) : null,
      sea: field.coast ? new SeaPlane(field.coast.seaLevel, theme.sea) : null,
      pools: field.oases.length > 0 ? new OasisBuilder(field.oases, theme.sea) : null,
    };
    this.group.add(s.road.group, s.gates.group);
    for (const b of [s.town, s.junctions, s.walls, s.seawall, s.sea, s.pools])
      if (b) this.group.add(b.group);
    return s;
  }

  /** The builders dispose their GPU resources but not their place in the scene; remove them first. */
  private disposeSurfaces(): void {
    const s = this.surfaces;
    for (const b of [s.road, s.gates, s.town, s.junctions, s.walls, s.seawall, s.sea, s.pools]) {
      if (!b) continue;
      this.group.remove(b.group);
      b.dispose();
    }
  }
}
