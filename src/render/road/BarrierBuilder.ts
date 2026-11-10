import { type BufferGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial } from 'three';
import { barrierLine, type CircuitTrackside } from '@/game/stage/CircuitTrackside';
import type { StageDef } from '@/game/stage/StageGenerator';
import type { TerrainField } from '@/game/stage/TerrainField';
import { themeColor } from '../theme/themeColor';
import type { CircuitTheme } from '../theme/WorldTheme';
import { TrackMesh } from './TrackMesh';

const SAMPLES_PER_PIECE = 100;
/** The W-beam rail: lower and upper halves, each tipped a little, so the beam reads as a profile, not a plank. */
const RAIL_LOW = 0.42;
const RAIL_MID = 0.6;
const RAIL_TOP = 0.78;
const RAIL_BULGE = 0.07;
/** A post every this many samples (about 4 m), and a fence post every this many (about 8 m). */
const POST_EVERY = 2;
const FENCE_POST_EVERY = 4;
const FENCE_HEIGHT = 3.2;
/** The catch fence stands this far behind the rail, away from the track. */
const FENCE_BACK = 0.35;
/** Horizontal fence wires, as heights above the ground. */
const WIRES = [1.0, 1.4, 1.8, 2.2, 2.6, 3.0];
const WIRE = 0.035;

type V3 = [number, number, number];

/**
 * Armco along both sides of a circuit (a two-part W-beam rail on posts
 * every 4 m) and, where `CircuitTrackside` flags it, a catch fence behind
 * it: tall posts with horizontal wires, readable without any transparency.
 * Lines come from `barrierLine`, the same ones the colliders are cut from.
 * Pieces along the lap for culling; one double-sided flat-shaded material.
 */
export class BarrierBuilder {
  readonly group = new Group();
  private readonly geometries: BufferGeometry[] = [];
  private readonly material: MeshStandardMaterial;

  constructor(
    stage: StageDef,
    trackside: CircuitTrackside,
    field: TerrainField,
    theme: CircuitTheme,
    fences: boolean,
  ) {
    this.group.name = 'barriers';
    this.material = new MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.55,
      metalness: 0.25,
      side: DoubleSide,
    });
    const rail = themeColor(theme.rail);
    const post = themeColor(theme.railPost);
    const fence = themeColor(theme.fence);
    const { path } = stage;
    const lines = { 1: barrierLine(stage, trackside, 1), [-1]: barrierLine(stage, trackside, -1) };
    for (let s0 = 0; s0 < path.count - 1; s0 += SAMPLES_PER_PIECE) {
      const s1 = Math.min(path.count - 1, s0 + SAMPLES_PER_PIECE);
      const mesh = new TrackMesh();
      for (const side of [1, -1] as const) {
        const line = lines[side];
        const flags = trackside.fence[side === 1 ? 0 : 1];
        // Outward (away from the track) at sample i: the left vector times the side.
        const out = (i: number): [number, number] => {
          const h = path.headings[i]!;
          return [Math.cos(h) * side, -Math.sin(h) * side];
        };
        const at = (i: number, back: number, up: number): V3 => {
          const [ox, oz] = out(i);
          const x = line[i * 2]! + ox * back;
          const z = line[i * 2 + 1]! + oz * back;
          return [x, field.heightAt(x, z) + up, z];
        };
        for (let i = s0; i < s1; i++) {
          // The beam bulges toward the track at its middle (negative back), two strips per segment.
          const lo0 = at(i, 0, RAIL_LOW);
          const mid0 = at(i, -RAIL_BULGE, RAIL_MID);
          const top0 = at(i, 0, RAIL_TOP);
          const lo1 = at(i + 1, 0, RAIL_LOW);
          const mid1 = at(i + 1, -RAIL_BULGE, RAIL_MID);
          const top1 = at(i + 1, 0, RAIL_TOP);
          mesh.ribbon(lo0, mid0, lo1, mid1, rail);
          mesh.ribbon(mid0, top0, mid1, top1, rail);
          if (i % POST_EVERY === 0) {
            const [x, y, z] = at(i, 0.12, 0);
            mesh.box(x, y + RAIL_TOP / 2, z, 0.1, RAIL_TOP + 0.1, 0.16, path.headings[i]!, post);
          }
          if (!fences || !flags[i] || !flags[i + 1]) continue;
          for (const h of WIRES) {
            const a0 = at(i, FENCE_BACK, h - WIRE);
            const b0 = at(i, FENCE_BACK, h);
            const a1 = at(i + 1, FENCE_BACK, h - WIRE);
            const b1 = at(i + 1, FENCE_BACK, h);
            mesh.ribbon(a0, b0, a1, b1, fence);
          }
          if (i % FENCE_POST_EVERY === 0) {
            const [x, y, z] = at(i, FENCE_BACK, 0);
            mesh.box(
              x,
              y + FENCE_HEIGHT / 2,
              z,
              0.09,
              FENCE_HEIGHT,
              0.09,
              path.headings[i]!,
              fence,
            );
          }
        }
      }
      if (mesh.empty) continue;
      const geo = mesh.build();
      this.geometries.push(geo);
      const m = new Mesh(geo, this.material);
      m.castShadow = true;
      m.receiveShadow = true;
      m.matrixAutoUpdate = false;
      this.group.add(m);
    }
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    this.material.dispose();
  }
}
