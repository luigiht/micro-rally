import { type BufferGeometry, Color, Group, Mesh, MeshStandardMaterial } from 'three';
import {
  GRAVEL_FROM_KERB,
  GRAVEL_TO_BARRIER,
  KERB_HEIGHT,
  KERB_IN,
  KERB_OUT,
  KERB_RAMP_WIDTH,
  type CircuitTrackside,
} from '@/game/stage/CircuitTrackside';
import type { StageDef } from '@/game/stage/StageGenerator';
import { ROAD_LIFT, type TerrainField } from '@/game/stage/TerrainField';
import { themeColor } from '../theme/themeColor';
import type { CircuitTheme } from '../theme/WorldTheme';
import { TrackMesh } from './TrackMesh';

const SAMPLES_PER_PIECE = 100;
/** Gravel lies this far over the flat runoff it is drawn on. */
const GRAVEL_LIFT = 0.015;

type V3 = [number, number, number];

/**
 * A circuit's kerbs and gravel traps, drawn over the road ribbon and the
 * flat runoff: kerbs as a raised, chamfered band in alternating stripes (one
 * per sample, about 2 m), gravel as a pale band out toward the barrier. Cut
 * into pieces along the lap for frustum culling, like the road.
 */
export class KerbBuilder {
  readonly group = new Group();
  private readonly geometries: BufferGeometry[] = [];
  private readonly material: MeshStandardMaterial;

  constructor(
    stage: StageDef,
    trackside: CircuitTrackside,
    field: TerrainField,
    theme: CircuitTheme,
  ) {
    this.group.name = 'kerbs';
    this.material = new MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.8,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const stripes = [themeColor(theme.kerb[0]), themeColor(theme.kerb[1])] as const;
    const gravel = themeColor(theme.gravel);
    const shade = new Color();
    const { path, halfWidth: hw } = stage;
    const point = (i: number, lateral: number, lift: number): V3 => {
      const h = path.headings[i]!;
      return [
        path.xs[i]! + Math.cos(h) * lateral,
        field.roadHeightAt(i * path.spacing) + ROAD_LIFT + lift,
        path.zs[i]! - Math.sin(h) * lateral,
      ];
    };
    // The kerb's cross-section, from its inner edge (on the carriageway) out: ramp up, top, ramp down.
    const profile: [number, number][] = [
      [hw - KERB_IN, 0.004],
      [hw - KERB_IN + KERB_RAMP_WIDTH, KERB_HEIGHT],
      [hw + KERB_OUT - KERB_RAMP_WIDTH, KERB_HEIGHT],
      [hw + KERB_OUT, 0.004],
    ];
    for (let s0 = 0; s0 < path.count - 1; s0 += SAMPLES_PER_PIECE) {
      const s1 = Math.min(path.count - 1, s0 + SAMPLES_PER_PIECE);
      const mesh = new TrackMesh();
      for (const side of [1, -1] as const) {
        const k = side === 1 ? 0 : 1;
        const kerb = trackside.kerb[k];
        const grav = trackside.gravel[k];
        const barrier = trackside.barrier[k];
        for (let i = s0; i < s1; i++) {
          if (kerb[i] && kerb[i + 1]) {
            const c = stripes[i % 2]!;
            for (let p = 0; p + 1 < profile.length; p++) {
              const [l0, y0] = profile[p]!;
              const [l1, y1] = profile[p + 1]!;
              // Lateral is signed: on the right side the inner edge is the left (b) one.
              const a0 = point(i, side * (side === 1 ? l0 : l1), side === 1 ? y0 : y1);
              const b0 = point(i, side * (side === 1 ? l1 : l0), side === 1 ? y1 : y0);
              const a1 = point(i + 1, side * (side === 1 ? l0 : l1), side === 1 ? y0 : y1);
              const b1 = point(i + 1, side * (side === 1 ? l1 : l0), side === 1 ? y1 : y0);
              mesh.ribbon(a0, b0, a1, b1, c);
            }
          }
          if (grav[i] && grav[i + 1]) {
            const inner = hw + KERB_OUT + GRAVEL_FROM_KERB;
            const outer0 = barrier[i]! - GRAVEL_TO_BARRIER;
            const outer1 = barrier[i + 1]! - GRAVEL_TO_BARRIER;
            if (outer0 <= inner || outer1 <= inner) continue;
            // A faint grain from sample to sample, so the trap reads as loose stone.
            const c = shade.copy(gravel).multiplyScalar(0.95 + ((i * 7919) % 11) / 110);
            const lo = side === 1 ? inner : outer0;
            const hi = side === 1 ? outer0 : inner;
            const lo1 = side === 1 ? inner : outer1;
            const hi1 = side === 1 ? outer1 : inner;
            mesh.ribbon(
              point(i, side * lo, GRAVEL_LIFT),
              point(i, side * hi, GRAVEL_LIFT),
              point(i + 1, side * lo1, GRAVEL_LIFT),
              point(i + 1, side * hi1, GRAVEL_LIFT),
              c,
            );
          }
        }
      }
      if (mesh.empty) continue;
      const geo = mesh.build();
      this.geometries.push(geo);
      const m = new Mesh(geo, this.material);
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
