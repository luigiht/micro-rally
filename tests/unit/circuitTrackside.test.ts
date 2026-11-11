import { describe, expect, it } from 'vitest';
import {
  GRAVEL_FROM_KERB,
  GRAVEL_TO_BARRIER,
  KERB_HEIGHT,
  KERB_OUT,
  KERB_RADIUS,
  barrierAt,
  barrierObstacles,
  circuitTrackside,
  cornerStandSpots,
  grandstandSpot,
  gravelDepth,
  outermostBarrier,
} from '@/game/stage/CircuitTrackside';
import { scatterScenery } from '@/game/stage/SceneryScatter';
import { generateStage } from '@/game/stage/StageGenerator';
import { ROAD_LIFT, TerrainField, type TerrainSample } from '@/game/stage/TerrainField';

const stage = generateStage(6, 9);
const t = circuitTrackside(stage)!;
const field = new TerrainField(stage);
const n = stage.path.count - 1;

describe('circuit trackside', () => {
  it('exists only on circuit stages, built once per stage', () => {
    expect(circuitTrackside(generateStage(6, 0))).toBeNull();
    expect(circuitTrackside(stage)).toBe(t);
  });

  it('puts kerbs on corners only, within a few samples of a bend tighter than the kerb radius', () => {
    for (const k of [0, 1] as const) {
      for (let i = 0; i < n; i++) {
        if (!t.kerb[k][i]) continue;
        let near = false;
        for (let m = -4; m <= 4 && !near; m++)
          near = 1 / Math.abs(t.curvature[(i + m + n) % n]!) < KERB_RADIUS;
        expect(near).toBe(true);
      }
    }
    expect(t.kerb[0].some(Boolean) && t.kerb[1].some(Boolean)).toBe(true);
  });

  it('keeps barriers clear of the track and inside every corner radius, so the line never folds', () => {
    for (const k of [0, 1] as const) {
      for (let i = 0; i < n; i++) {
        const offset = t.barrier[k][i]!;
        expect(offset).toBeGreaterThanOrEqual(stage.halfWidth + 2.5 - 1e-9);
        const curv = t.curvature[i]!;
        const inside = (curv > 0 ? 0 : 1) === k;
        if (inside && Math.abs(curv) > 1e-6) expect(offset).toBeLessThan(1 / Math.abs(curv));
      }
    }
  });

  it('lays gravel on the outside of corners only', () => {
    let any = false;
    for (const k of [0, 1] as const) {
      for (let i = 0; i < n; i++) {
        if (!t.gravel[k][i]) continue;
        any = true;
        // Somewhere near, the road turns away from this side.
        let outside = false;
        for (let m = -14; m <= 14 && !outside; m++) {
          const c = t.curvature[(i + m + n) % n]!;
          outside = (c > 0 ? 1 : 0) === k && Math.abs(c) > 1 / 160;
        }
        expect(outside).toBe(true);
      }
    }
    expect(any).toBe(true);
  });

  it('stands colliders along both barrier lines, well off the carriageway', () => {
    const boxes = barrierObstacles(stage);
    expect(boxes.length).toBeGreaterThan((2 * stage.path.length) / 5);
    const hit = { index: 0, along: 0, lateral: 0, distance: 0 };
    for (const b of boxes) {
      stage.path.nearest(b.x, b.z, 60, hit);
      expect(hit.distance).toBeGreaterThan(stage.halfWidth + 2);
    }
  });

  it('gives the terrain a seamless road profile, kerb bumps and surfaces', () => {
    // The closed profile meets itself at the seam.
    const L = stage.path.length;
    expect(Math.abs(field.roadHeightAt(0) - field.roadHeightAt(L - 1e-6))).toBeLessThan(0.01);
    expect(Math.abs(field.roadHeightAt(L + 10) - field.roadHeightAt(10))).toBeLessThan(1e-9);
    // On a kerb: tarmac, and lifted by the kerb's height at its top.
    const k = t.kerb[0].findIndex(
      (v, i) => v === 1 && t.kerb[0][i + 1] === 1 && t.kerb[0][i - 1] === 1,
    );
    const s = { x: 0, z: 0, heading: 0 };
    stage.path.sample(k * stage.path.spacing, s);
    const lat = stage.halfWidth + 0.35;
    const x = s.x + Math.cos(s.heading) * lat;
    const z = s.z - Math.sin(s.heading) * lat;
    expect(field.surfaceAt(x, z)).toBe('tarmac');
    const deck = field.roadHeightAt(k * stage.path.spacing) + ROAD_LIFT;
    expect(field.heightAt(x, z) - deck).toBeCloseTo(KERB_HEIGHT, 2);
    // In a gravel trap: gravel.
    const g = t.gravel[0].findIndex((v) => v === 1);
    stage.path.sample(g * stage.path.spacing, s);
    const gl = stage.halfWidth + 4;
    expect(field.surfaceAt(s.x + Math.cos(s.heading) * gl, s.z - Math.sin(s.heading) * gl)).toBe(
      'gravel',
    );
  });

  it('keeps the terrain mesh under the gravel band, so no grass shows through it', () => {
    const sample: TerrainSample = { height: 0, roadBlend: 0, roadDistance: 0 };
    const h = (x: number, z: number) => field.sample(x, z, sample).height;
    // The terrain chunks' 2 m grid, each cell split along its (0,0)–(1,1) diagonal.
    const mesh = (x: number, z: number) => {
      const i = Math.floor(x / 2);
      const j = Math.floor(z / 2);
      const fx = x / 2 - i;
      const fz = z / 2 - j;
      const h00 = h(i * 2, j * 2);
      const h11 = h(i * 2 + 2, j * 2 + 2);
      if (fz >= fx) return h00 + (h(i * 2, j * 2 + 2) - h00) * (fz - fx) + (h11 - h00) * fx;
      return h00 + (h(i * 2 + 2, j * 2) - h00) * (fx - fz) + (h11 - h00) * fz;
    };
    const { path, halfWidth } = stage;
    let checked = 0;
    for (const side of [1, -1] as const) {
      const k = side === 1 ? 0 : 1;
      for (let i = 0; i < path.count - 1; i += 2) {
        if (!t.gravel[k][i] || !t.gravel[k][i + 1]) continue;
        const head = path.headings[i]!;
        // The band as `KerbBuilder` draws it, barely over the runoff.
        const band = field.roadHeightAt(i * path.spacing) + ROAD_LIFT + 0.015;
        const inner = halfWidth + KERB_OUT + GRAVEL_FROM_KERB + 0.25;
        const outer = t.barrier[k][i]! - GRAVEL_TO_BARRIER - 0.25;
        for (let l = inner; l <= outer; l += 0.5) {
          const x = path.xs[i]! + Math.cos(head) * l * side;
          const z = path.zs[i]! - Math.sin(head) * l * side;
          if (gravelDepth(t, path, halfWidth, i * path.spacing, l * side) < 0.25) continue;
          checked++;
          expect(mesh(x, z)).toBeLessThan(band);
        }
      }
    }
    expect(checked).toBeGreaterThan(500);
  });

  it('keeps scenery outside the fences and off the grandstand', () => {
    const props = scatterScenery(field);
    expect(props.length).toBeGreaterThan(50);
    const reach = outermostBarrier(t);
    const stand = grandstandSpot(stage, t);
    const hit = { index: 0, along: 0, lateral: 0, distance: 0 };
    for (const p of props) {
      if (stage.path.nearest(p.x, p.z, reach, hit)) {
        const side = hit.lateral >= 0 ? 1 : -1;
        expect(Math.abs(hit.lateral)).toBeGreaterThan(barrierAt(t, stage.path, hit.along, side));
      }
      expect(Math.hypot(p.x - stand.x, p.z - stand.z)).toBeGreaterThanOrEqual(stand.radius);
    }
  });

  it('places compact stands beyond the outside barrier at several tight corners', () => {
    const stands = cornerStandSpots(stage, t);
    expect(stands.length).toBeGreaterThanOrEqual(3);
    for (const stand of stands) {
      expect(
        Math.abs(t.curvature[Math.round(stand.distance / stage.path.spacing)]!),
      ).toBeGreaterThan(1 / 120);
      expect(stand.back).toBeCloseTo(barrierAt(t, stage.path, stand.distance, stand.side) + 3);
      expect(
        Math.hypot(stand.x - grandstandSpot(stage, t).x, stand.z - grandstandSpot(stage, t).z),
      ).toBeGreaterThan(30);
    }
  });
});
