import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  ShapeUtils,
  Vector2,
} from 'three';
import { KERB_LIFT, type GroundQuery, type TownDef } from '@/game/stage/Town';
import type { Pt } from '@/game/stage/TownTerraces';

/** Façade tints, one per `INFILL_TINTS`: sandstone, brick, grey render, cream. */
const TINTS = ['#d8c7a5', '#c58d6c', '#b7b0a3', '#e2d8c4'].map((c) => new Color(c));
const WINDOW = new Color('#3a4048');
const ROOF = new Color('#8d8781');
/** Fronts stand this far behind the pavement line, so where they overlap a neighbour's front they hide behind it. */
const INSET = 0.05;
/** Footings sink this far below the lowest pavement, so a slope never shows under them. */
const SINK = 0.8;
const STOREY = 3.1;
const WINDOW_W = 1.1;
const WINDOW_H = 1.5;
const WINDOW_EVERY = 2.6;
const PLINTH = 0.7;
const CORNICE_H = 0.35;
const CORNICE_OUT = 0.2;

/** Triangles with a colour per corner, flat-shaded. */
class Faces {
  readonly pos: number[] = [];
  readonly col: number[] = [];

  tri(a: number[], b: number[], c: number[], color: Color): void {
    this.pos.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) this.col.push(color.r, color.g, color.b);
  }

  quad(a: number[], b: number[], c: number[], d: number[], color: Color): void {
    this.pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (let i = 0; i < 6; i++) this.col.push(color.r, color.g, color.b);
  }
}

/**
 * A city's fitted buildings (`TownInfill`): each footprint (a slice round a
 * corner, a block in an L, a strip along a gap) stands from a sunk footing
 * to its roof, walls in the building's tint, and along the street front a
 * darker plinth, a row of windows per storey spaced along the whole front
 * (curve and all) and a cornice; a flat grey roof. One merged mesh for the
 * whole city.
 */
export class TownInfillBuilder {
  readonly group = new Group();
  private readonly geometry: BufferGeometry | null;
  private readonly material = new MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.9,
    side: DoubleSide,
  });

  constructor(town: TownDef, ground: GroundQuery) {
    this.group.name = 'town-infill';
    const f = new Faces();
    const tmp = new Color();
    for (const infill of town.infills ?? []) {
      const tint = TINTS[infill.tint % TINTS.length]!;
      const front = infill.front;
      const decks = front.map((p) => ground.deckAt(p.x, p.z));
      const floor = Math.max(...decks) + KERB_LIFT;
      const bottom = Math.min(...decks) - SINK;
      const top = floor + infill.height;
      // The outline, its front pulled back off the pavement line a hair toward the middle.
      const all = [...front, ...infill.back];
      const cx = all.reduce((s, p) => s + p.x, 0) / all.length;
      const cz = all.reduce((s, p) => s + p.z, 0) / all.length;
      const pulled = front.map((p) => {
        const dx = cx - p.x;
        const dz = cz - p.z;
        const l = Math.hypot(dx, dz) || 1;
        return { x: p.x + (dx / l) * INSET, z: p.z + (dz / l) * INSET };
      });
      const outline = [...pulled, ...infill.back];
      const v = (a: Pt, y: number) => [a.x, y, a.z];
      for (let i = 0; i < outline.length; i++) {
        const a = outline[i]!;
        const b = outline[(i + 1) % outline.length]!;
        f.quad(v(a, bottom), v(b, bottom), v(b, top), v(a, top), tint);
      }
      const contour = outline.map((p) => new Vector2(p.x, p.z));
      for (const [a, b, c] of ShapeUtils.triangulateShape(contour, []))
        f.tri(v(outline[a!]!, top), v(outline[b!]!, top), v(outline[c!]!, top), ROOF);
      // The street front: plinth, cornice and windows along every piece, standing just proud of it.
      const outward = (p: Pt, q: Pt) => {
        const len = Math.hypot(q.x - p.x, q.z - p.z) || 1;
        let nx = (q.z - p.z) / len;
        let nz = -(q.x - p.x) / len;
        if (nx * (cx - p.x) + nz * (cz - p.z) > 0) {
          nx = -nx;
          nz = -nz;
        }
        return { x: nx, z: nz, len, ux: (q.x - p.x) / len, uz: (q.z - p.z) / len };
      };
      let run = 0;
      let next = WINDOW_EVERY / 2;
      for (let i = 1; i < pulled.length; i++) {
        const p = pulled[i - 1]!;
        const q = pulled[i]!;
        const o = outward(p, q);
        const at = (s: number, y: number, out: number) => [
          p.x + o.ux * s + o.x * out,
          y,
          p.z + o.uz * s + o.z * out,
        ];
        tmp.copy(tint).multiplyScalar(0.72);
        f.quad(
          at(0, bottom, 0.03),
          at(o.len, bottom, 0.03),
          at(o.len, floor + PLINTH, 0.03),
          at(0, floor + PLINTH, 0.03),
          tmp,
        );
        tmp.copy(tint).multiplyScalar(0.85);
        const c0 = top - CORNICE_H;
        f.quad(
          at(0, c0, CORNICE_OUT),
          at(o.len, c0, CORNICE_OUT),
          at(o.len, top, CORNICE_OUT),
          at(0, top, CORNICE_OUT),
          tmp,
        );
        f.quad(
          at(0, top, CORNICE_OUT),
          at(o.len, top, CORNICE_OUT),
          at(o.len, top, 0),
          at(0, top, 0),
          tmp,
        );
        f.quad(
          at(0, c0, 0),
          at(o.len, c0, 0),
          at(o.len, c0, CORNICE_OUT),
          at(0, c0, CORNICE_OUT),
          tmp,
        );
        // Windows every WINDOW_EVERY along the whole front, each on the piece its middle falls on.
        while (next <= run + o.len) {
          const s = next - run;
          const a = Math.max(0, s - WINDOW_W / 2);
          const b = Math.min(o.len, s + WINDOW_W / 2);
          if (b - a > WINDOW_W * 0.6)
            for (let y = floor + 1.1; y + WINDOW_H < top - CORNICE_H - 0.3; y += STOREY)
              f.quad(
                at(a, y, 0.03),
                at(b, y, 0.03),
                at(b, y + WINDOW_H, 0.03),
                at(a, y + WINDOW_H, 0.03),
                WINDOW,
              );
          next += WINDOW_EVERY;
        }
        run += o.len;
      }
    }
    if (f.pos.length === 0) {
      this.geometry = null;
      return;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(Float32Array.from(f.pos), 3));
    geo.setAttribute('color', new BufferAttribute(Float32Array.from(f.col), 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    this.geometry = geo;
    const mesh = new Mesh(geo, this.material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);
  }

  dispose(): void {
    this.geometry?.dispose();
    this.material.dispose();
  }
}
