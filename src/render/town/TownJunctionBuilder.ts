import { BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshStandardMaterial } from 'three';
import { createRoadHit } from '@/game/stage/RoadPath';
import { halfWidthAt } from '@/game/stage/RoadWidth';
import type { StageDef } from '@/game/stage/StageGenerator';
import {
  FILLET,
  KERB_LIFT,
  PAVEMENT_WIDTH,
  type GroundQuery,
  type Junction,
} from '@/game/stage/Town';
import { stubCut } from '@/game/stage/TownJunctions';
import { LINE_COLOR, LINE_LIFT, PAVEMENT_COLOR, ROAD_COLORS } from '../road/RoadBuilder';
import { band, clip, type Vert } from './Isobands';

/** Grid the junction surface is cut on; kerb returns come out as facets this long. */
const CELL = 0.5;
/** The tarmac fill sits under the ribbon and the side-street plates; pavements and lines just under the ribbon's own. */
const FILL_DROP = 0.02;
const UNDER = 0.005;
const LINE_INSET = 0.35;
const LINE_WIDTH = 0.22;
/** The grid reaches this far beyond the farthest side-street cut. */
const ZONE_MARGIN = 6;
/** The route only shapes the surface this close to its edge. */
const ROUTE_REACH = 8;

interface Stub {
  fx: number;
  fz: number;
  lx: number;
  lz: number;
  hw: number;
  cut: number;
}

/**
 * The paved ground of every junction, cut from a signed-distance field: the
 * union of the route's carriageway, the blocked arms and a core disc, with
 * every concave corner rounded to a kerb return of `FILLET`. Tarmac fills
 * the inside, a pavement band and a white edge line follow the outline, so
 * the kerbs run unbroken round crossings at any angle. Each blocked arm's
 * straight plates take over beyond its cut. One merged mesh.
 */
export class TownJunctionBuilder {
  readonly group = new Group();
  private readonly geometry: BufferGeometry;
  private readonly material: MeshStandardMaterial;
  private readonly pos: number[] = [];
  private readonly col: number[] = [];
  private readonly hit = createRoadHit();
  private readonly tarmac = new Color(ROAD_COLORS.tarmac);
  private readonly pavement = new Color(PAVEMENT_COLOR);
  private readonly line = new Color(LINE_COLOR);

  constructor(
    private readonly stage: StageDef,
    private readonly field: GroundQuery,
  ) {
    this.group.name = 'town-junctions';
    for (const j of stage.town?.junctions ?? []) this.junction(j);
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', new BufferAttribute(Float32Array.from(this.pos), 3));
    this.geometry.setAttribute('color', new BufferAttribute(Float32Array.from(this.col), 3));
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
    this.material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
    const mesh = new Mesh(this.geometry, this.material);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);
  }

  private junction(j: Junction): void {
    const stubs: Stub[] = j.arms
      .filter((a) => a.role === 'blocked')
      .map((a) => ({
        fx: Math.sin(a.heading),
        fz: Math.cos(a.heading),
        lx: Math.cos(a.heading),
        lz: -Math.sin(a.heading),
        hw: a.halfWidth,
        cut: stubCut(j, a, this.stage.halfWidth),
      }));
    const core = Math.max(...j.arms.filter((a) => a.role !== 'blocked').map((a) => a.halfWidth));
    const zone = Math.max(core, ...stubs.map((s) => s.cut)) + ZONE_MARGIN;
    const cells = Math.ceil((2 * zone) / CELL);
    const n = cells + 1;
    const x0 = j.x - zone;
    const z0 = j.z - zone;
    // Field, route distance and height memoised per grid corner; clipped vertices are evaluated directly.
    const fs = new Float64Array(n * n).fill(NaN);
    const rs = new Float64Array(n * n);
    const hs = new Float64Array(n * n);
    const corner = (ix: number, iz: number): Vert => {
      const k = ix + iz * n;
      const x = x0 + ix * CELL;
      const z = z0 + iz * CELL;
      if (Number.isNaN(fs[k])) {
        const e = this.evaluate(x, z, j, stubs, core);
        fs[k] = e.f;
        rs[k] = e.r;
        hs[k] = this.field.heightAt(x, z);
      }
      return { x, z, f: fs[k]!, h: hs[k] };
    };
    for (let iz = 0; iz < cells; iz++) {
      for (let ix = 0; ix < cells; ix++) {
        const quad = [
          corner(ix, iz),
          corner(ix, iz + 1),
          corner(ix + 1, iz + 1),
          corner(ix + 1, iz),
        ];
        if (Math.min(...quad.map((v) => v.f)) > PAVEMENT_WIDTH + 0.3) continue;
        // Wholly inside the route's carriageway: the ribbon covers it.
        if (
          Math.max(
            rs[ix + iz * n]!,
            rs[ix + (iz + 1) * n]!,
            rs[ix + 1 + (iz + 1) * n]!,
            rs[ix + 1 + iz * n]!,
          ) < -0.6
        )
          continue;
        let poly: Vert[] = quad;
        for (const s of stubs) {
          poly = clip(poly, (v) => s.cut - ((v.x - j.x) * s.fx + (v.z - j.z) * s.fz));
          if (poly.length < 3) break;
        }
        if (poly.length < 3) continue;
        this.emit(
          clip(poly, (v) => -v.f),
          -FILL_DROP,
          this.tarmac,
        );
        this.emit(band(poly, 0, PAVEMENT_WIDTH), KERB_LIFT - UNDER, this.pavement);
        this.emit(band(poly, -LINE_INSET - LINE_WIDTH, -LINE_INSET), LINE_LIFT - UNDER, this.line);
      }
    }
  }

  /** Rounded-union distance to the paved ground (negative inside) and the plain distance beyond the route's edge. */
  private evaluate(
    x: number,
    z: number,
    j: Junction,
    stubs: Stub[],
    core: number,
  ): { f: number; r: number } {
    let acc = 0;
    const add = (d: number) => {
      const t = FILLET - d;
      if (t > 0) acc += t * t;
    };
    const rx = x - j.x;
    const rz = z - j.z;
    for (const s of stubs)
      add(Math.max(-(rx * s.fx + rz * s.fz), Math.abs(rx * s.lx + rz * s.lz) - s.hw));
    add(Math.hypot(rx, rz) - core);
    let r = Infinity;
    if (this.stage.path.nearest(x, z, ROUTE_REACH, this.hit)) {
      r = this.hit.distance - halfWidthAt(this.stage, this.hit.along);
      add(r);
    }
    return { f: FILLET - Math.sqrt(acc), r };
  }

  /** Fan-triangulate a convex polygon at the ground plus `lift`, counter-clockwise seen from above. */
  private emit(poly: Vert[], lift: number, c: Color): void {
    if (poly.length < 3) return;
    const ys = poly.map((v) => (v.h ?? this.field.heightAt(v.x, v.z)) + lift);
    for (let i = 1; i + 1 < poly.length; i++) {
      for (const k of [0, i, i + 1]) {
        const v = poly[k]!;
        this.pos.push(v.x, ys[k]!, v.z);
        this.col.push(c.r, c.g, c.b);
      }
    }
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
