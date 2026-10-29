import { hashSeed, mulberry32 } from '../rng';
import type { Obstacle } from '../vehicle/Collisions';
import { REGIONS } from './regions';
import { createRoadHit, type RoadSample } from './RoadPath';
import type { TerrainField } from './TerrainField';

export type PropKind = 'tree' | 'broadleaf' | 'bush' | 'rock';

export interface Prop {
  kind: PropKind;
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
  variant: number;
}

const STEP = 4;
const MIN_CLEARANCE = 3;
const MEAN_OFFSET = 28;
const MAX_OFFSET = 160;

const COLLIDER_RADIUS: Readonly<Record<PropKind, number>> = {
  tree: 0.45,
  broadleaf: 0.4,
  bush: 0,
  rock: 0.85,
};

/** Deterministic roadside scenery along the stage. */
export function scatterScenery(field: TerrainField): Prop[] {
  const stage = field.stage;
  const density = REGIONS[stage.region].scenery;
  const rand = mulberry32(hashSeed(stage.seed, 'scenery'));
  const path = stage.path;
  const hit = createRoadHit();
  const sample: RoadSample = { x: 0, z: 0, heading: 0 };
  const props: Prop[] = [];
  const kinds: readonly [PropKind, number][] = [
    ['tree', density.trees],
    ['broadleaf', density.broadleaf],
    ['bush', density.bushes],
    ['rock', density.rocks],
  ];

  for (let d = 0; d < path.length; d += STEP) {
    // Slow wobble so trees clump into copses and clearings.
    const clump =
      0.35 + 1.3 * (0.5 + 0.5 * Math.sin(d * 0.011 + stage.seed * 1e-9) * Math.cos(d * 0.0047));
    for (const [kind, perHundred] of kinds) {
      const expected = ((perHundred * STEP) / 100) * (kind === 'rock' ? 1 : clump);
      let n = Math.floor(expected) + (rand() < expected % 1 ? 1 : 0);
      while (n-- > 0) {
        path.sample(d + rand() * STEP, sample);
        const side = rand() < 0.5 ? -1 : 1;
        const offset = Math.min(
          MAX_OFFSET,
          stage.halfWidth + MIN_CLEARANCE + -Math.log(1 - rand()) * MEAN_OFFSET,
        );
        const x = sample.x + Math.cos(sample.heading) * offset * side;
        const z = sample.z - Math.sin(sample.heading) * offset * side;
        const scale = kind === 'rock' || kind === 'bush' ? 0.6 + rand() * 0.8 : 0.7 + rand() * 0.8;
        const rotation = rand() * Math.PI * 2;
        const variant = rand() < 0.5 ? 0 : 1;
        // Keep every part of the road (including other bends) clear.
        if (path.nearest(x, z, stage.halfWidth + MIN_CLEARANCE, hit)) continue;
        props.push({ kind, x, y: field.heightAt(x, z), z, scale, rotation, variant });
      }
    }
  }
  return props;
}

export function propObstacles(props: readonly Prop[]): Obstacle[] {
  const out: Obstacle[] = [];
  for (const p of props) {
    const r = COLLIDER_RADIUS[p.kind];
    if (r > 0) out.push({ x: p.x, z: p.z, r: r * p.scale });
  }
  return out;
}
