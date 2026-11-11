import {
  Color,
  Group,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
} from 'three';
import { hashSeed, mulberry32 } from '@/game/rng';
import { halfWidthAt } from '@/game/stage/RoadWidth';
import type { StageDef } from '@/game/stage/StageGenerator';
import { ROAD_LIFT, type TerrainField } from '@/game/stage/TerrainField';
import { townFade } from '@/game/stage/Town';

/** Loose stones per metre of road, both edges and the middle together. */
const PER_METRE = 3;
/** One instanced mesh per this much road, so stretches out of view are culled. */
const PIECE = 100;
/** Stone sizes (m) and how flat they lie (height as a share of width). */
const SIZE_MIN = 0.05;
const SIZE_MAX = 0.17;
const FLAT_MIN = 0.4;
const FLAT_MAX = 0.75;
/** Greys and warm greys: river stones and broken rock among the gravel. */
const STONE_COLORS = ['#8c8578', '#a39b8c', '#6f6a62', '#b8ad98', '#7d7365'];

/**
 * Loose stones on a gravel road: small flat-lying faceted pebbles, thrown
 * aside by the wheels, so most lie along the edges and on the hump between
 * the wheel tracks and fewer across the rest. Visual only (the car rolls
 * straight over them), deterministic per stage, no shadows cast; skipped
 * where the road runs into a town's tarmac.
 */
export class GravelStoneBuilder {
  readonly group = new Group();
  private readonly geometry = new OctahedronGeometry(1, 0);
  private readonly material = new MeshStandardMaterial({ flatShading: true, roughness: 1 });
  private readonly meshes: InstancedMesh[] = [];

  constructor(stage: StageDef, field: TerrainField) {
    this.group.name = 'gravel-stones';
    const rand = mulberry32(hashSeed(stage.seed, 'stones'));
    const path = stage.path;
    const sample = { x: 0, z: 0, heading: 0 };
    const dummy = new Object3D();
    const colors = STONE_COLORS.map((c) => new Color(c));
    const tint = new Color();
    for (let from = 0; from < path.length; from += PIECE) {
      const to = Math.min(path.length, from + PIECE);
      const count = Math.round((to - from) * PER_METRE);
      const mesh = new InstancedMesh(this.geometry, this.material, count);
      let n = 0;
      for (let i = 0; i < count; i++) {
        const d = from + rand() * (to - from);
        const lateral = lateralAt(halfWidthAt(stage, d), rand);
        const size = SIZE_MIN + (SIZE_MAX - SIZE_MIN) * rand() ** 2;
        const flat = FLAT_MIN + (FLAT_MAX - FLAT_MIN) * rand();
        const turn = rand() * Math.PI * 2;
        const color = colors[Math.floor(rand() * colors.length)]!;
        const shade = 0.85 + rand() * 0.3;
        if (stage.town && townFade(stage.town, d) > 0) continue;
        path.sample(d, sample);
        const x = sample.x + Math.cos(sample.heading) * lateral;
        const z = sample.z - Math.sin(sample.heading) * lateral;
        // Half sunk into the gravel, lying flat, turned any way.
        dummy.position.set(x, field.roadHeightAt(d) + ROAD_LIFT - size * flat * 0.4, z);
        dummy.rotation.set(0, turn, 0);
        dummy.scale.set(size * (0.8 + rand() * 0.4), size * flat, size);
        dummy.updateMatrix();
        mesh.setMatrixAt(n, dummy.matrix);
        mesh.setColorAt(n, tint.copy(color).multiplyScalar(shade));
        n++;
      }
      mesh.count = n;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      this.meshes.push(mesh);
      this.group.add(mesh);
    }
  }

  dispose(): void {
    for (const m of this.meshes) m.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}

/**
 * Where across the road a stone lies, right (−) to left (+): along either
 * edge (half of them, a few just over it onto the verge), on the hump between
 * the wheel tracks (a quarter) or anywhere (the rest).
 */
export function lateralAt(hw: number, rand: () => number): number {
  const r = rand();
  const side = rand() < 0.5 ? -1 : 1;
  const u = rand();
  if (r < 0.35) return side * (hw - 0.6 - u * 0.9);
  if (r < 0.5) return side * (hw - 0.3 + u * 0.6);
  if (r < 0.75) return (u - 0.5) * 0.8;
  return (u - 0.5) * 2 * (hw - 0.3);
}
