import { BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshStandardMaterial } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { GroundQuery } from '@/game/stage/Town';
import {
  RAIL_LIFT,
  TRAM_BED_HALF,
  TRAM_GAUGE,
  TRAM_WIRE_HEIGHT,
  type TramLine,
} from '@/game/stage/Tram';
import type { TramLoopDef, TramSpan } from '@/game/stage/city/TramLoop';
import { LINE_ABOVE_DECK } from '../road/RoadBuilder';
import { themeColor } from '../theme/themeColor';
import type { RoadTheme } from '../theme/WorldTheme';

/** The bed is laid in pieces this long so it follows the deck. */
const STEP = 2;
/**
 * The paved bed sits well over the surface it runs on: above the painted
 * lines (`LINE_ABOVE_DECK`) and the small steps between a junction's plates
 * and the ribbon, so nothing it crosses cuts through it; the rail heads
 * stand `RAIL_LIFT` over it.
 */
export const BED_LIFT = LINE_ABOVE_DECK + 0.02;
const RAIL_WIDTH = 0.08;
const RAIL_TOP = RAIL_LIFT + BED_LIFT;
/** The overhead wire's thickness, and how far short of the line's ends it stops (the trams fade there). */
const WIRE = 0.05;
const WIRE_END = 2;
/** Span wires: their thickness, how far above the contact wire they meet the wall, the wall rosette's size and its offset. */
const SPAN_WIRE = 0.035;
const SPAN_RISE = 1.1;
const ROSETTE = 0.22;
const ROSETTE_OFF = 0.05;

/**
 * A city's tram tracks: a strip of sett paving across the carriageway with
 * two steel rails set in it a gauge apart, each section on the surface the
 * field reports on the track's axis (the deck, or a median's kerb-high top)
 * so the track follows the street up and down and rides its median; and
 * over the axis the overhead contact wire at the pantograph's height,
 * following the rails.
 * One merged mesh; the ridge the wheels feel is `tramLift`'s.
 */
export class TramTrackBuilder {
  readonly group = new Group();
  private readonly geometry: BufferGeometry;
  private readonly material: MeshStandardMaterial;
  private readonly pos: number[] = [];
  private readonly col: number[] = [];
  private readonly idx: number[] = [];

  constructor(
    trams: readonly TramLine[],
    private readonly field: GroundQuery,
    road: RoadTheme,
    loop?: TramLoopDef,
  ) {
    this.group.name = 'tram-tracks';
    const bed = new Color(road.tramBed);
    const rail = themeColor(road.rail);
    if (loop) this.loopTrack(loop, bed, rail);
    for (const t of trams) {
      // A loop's pieces are drawn as one continuous track above.
      if (loop && t.loop) continue;
      const dx = t.x1 - t.x0;
      const dz = t.z1 - t.z0;
      const len = Math.hypot(dx, dz);
      if (len < 1) continue;
      const h = Math.atan2(dx, dz);
      this.strip(t, h, len, -TRAM_BED_HALF, TRAM_BED_HALF, BED_LIFT, bed);
      for (const side of [-1, 1] as const) {
        const c = (side * TRAM_GAUGE) / 2;
        this.strip(t, h, len, c - RAIL_WIDTH / 2, c + RAIL_WIDTH / 2, RAIL_TOP, rail);
      }
      // The contact wire over the axis, its underside on the pantograph's strips, stopping short of the ends.
      // A loop's wire runs on unbroken from piece to piece; a line's stops short of its ends.
      const end = t.loop ? 0 : WIRE_END;
      this.wire(t, h, end, len - end, RAIL_TOP + TRAM_WIRE_HEIGHT + WIRE / 2, rail);
    }
    const raw = new BufferGeometry();
    raw.setAttribute('position', new BufferAttribute(Float32Array.from(this.pos), 3));
    raw.setAttribute('color', new BufferAttribute(Float32Array.from(this.col), 3));
    raw.setIndex(this.idx);
    this.geometry = mergeVertices(raw, 1e-4);
    raw.dispose();
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
    this.material = new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.6,
      metalness: 0.2,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const mesh = new Mesh(this.geometry, this.material);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);
  }

  /**
   * A point `along` the line, `left` across it, at the track's height there
   * plus `lift`. The track's height at a station is the highest surface
   * under the bed's axis and its two edges (off the rails), so a bed that
   * crosses a kerb or a plate's edge rides over it rather than through it.
   */
  private corner(t: TramLine, h: number, along: number, left: number, lift: number) {
    const ax = t.x0 + Math.sin(h) * along;
    const az = t.z0 + Math.cos(h) * along;
    const lx = Math.cos(h);
    const lz = -Math.sin(h);
    const base = Math.max(
      this.field.heightAt(ax, az),
      this.field.heightAt(ax + lx * TRAM_BED_HALF, az + lz * TRAM_BED_HALF),
      this.field.heightAt(ax - lx * TRAM_BED_HALF, az - lz * TRAM_BED_HALF),
    );
    return [ax + lx * left, base + lift, az + lz * left] as const;
  }

  private strip(
    t: TramLine,
    h: number,
    len: number,
    l0: number,
    l1: number,
    lift: number,
    c: Color,
  ): void {
    for (let a = 0; a < len - 1e-6; a += STEP) {
      const b = Math.min(len, a + STEP);
      const base = this.pos.length / 3;
      for (const [x, y, z] of [
        this.corner(t, h, a, l0, lift),
        this.corner(t, h, b, l0, lift),
        this.corner(t, h, b, l1, lift),
        this.corner(t, h, a, l1, lift),
      ]) {
        this.pos.push(x, y, z);
        this.col.push(c.r, c.g, c.b);
      }
      this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  /** A wire along the axis from `a0` to `a1` at `lift`: a horizontal and a vertical ribbon crossed, so it reads from any angle. */
  private wire(t: TramLine, h: number, a0: number, a1: number, lift: number, c: Color): void {
    for (let a = a0; a < a1 - 1e-6; a += STEP) {
      const b = Math.min(a1, a + STEP);
      this.quad(
        [
          this.corner(t, h, a, -WIRE / 2, lift),
          this.corner(t, h, b, -WIRE / 2, lift),
          this.corner(t, h, b, WIRE / 2, lift),
          this.corner(t, h, a, WIRE / 2, lift),
        ],
        c,
      );
      this.quad(
        [
          this.corner(t, h, a, 0, lift - WIRE / 2),
          this.corner(t, h, b, 0, lift - WIRE / 2),
          this.corner(t, h, b, 0, lift + WIRE / 2),
          this.corner(t, h, a, 0, lift + WIRE / 2),
        ],
        c,
      );
    }
  }

  /**
   * A loop as one continuous track: the polyline resampled every `STEP`,
   * each sample's cross-section mitred between its two pieces so the bed's
   * and rails' edges run smooth round the curves without notches or
   * overlaps; then the contact wire along the axis and the span wires out to
   * the facades.
   */
  private loopTrack(loop: TramLoopDef, bed: Color, rail: Color): void {
    const pts: { x: number; z: number }[] = [];
    const n0 = loop.xs.length;
    for (let k = 0; k < n0; k++) {
      const ax = loop.xs[k]!;
      const az = loop.zs[k]!;
      const bx = loop.xs[(k + 1) % n0]!;
      const bz = loop.zs[(k + 1) % n0]!;
      const m = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / STEP));
      for (let i = 0; i < m; i++)
        pts.push({ x: ax + ((bx - ax) * i) / m, z: az + ((bz - az) * i) / m });
    }
    const n = pts.length;
    // Per sample: the mitred left vector (scaled so offsets keep their width across each piece) and the height.
    const lx: number[] = [];
    const lz: number[] = [];
    const base: number[] = [];
    for (let i = 0; i < n; i++) {
      const p = pts[(i - 1 + n) % n]!;
      const c = pts[i]!;
      const q = pts[(i + 1) % n]!;
      const h0 = Math.atan2(c.x - p.x, c.z - p.z);
      const h1 = Math.atan2(q.x - c.x, q.z - c.z);
      const mx = Math.cos(h0) + Math.cos(h1);
      const mz = -Math.sin(h0) - Math.sin(h1);
      const ml = Math.hypot(mx, mz) || 1;
      const half = Math.atan2(Math.sin(h1 - h0), Math.cos(h1 - h0)) / 2;
      const scale = 1 / Math.max(0.5, Math.cos(half));
      lx.push((mx / ml) * scale);
      lz.push((mz / ml) * scale);
      base.push(
        Math.max(
          this.field.heightAt(c.x, c.z),
          this.field.heightAt(c.x + lx[i]! * TRAM_BED_HALF, c.z + lz[i]! * TRAM_BED_HALF),
          this.field.heightAt(c.x - lx[i]! * TRAM_BED_HALF, c.z - lz[i]! * TRAM_BED_HALF),
        ),
      );
    }
    const at = (i: number, left: number, lift: number) => {
      const k = i % n;
      return [pts[k]!.x + lx[k]! * left, base[k]! + lift, pts[k]!.z + lz[k]! * left] as const;
    };
    const ribbon = (l0: number, l1: number, lift: number, c: Color) => {
      for (let i = 0; i < n; i++) {
        const b = this.pos.length / 3;
        for (const [x, y, z] of [
          at(i, l0, lift),
          at(i + 1, l0, lift),
          at(i + 1, l1, lift),
          at(i, l1, lift),
        ]) {
          this.pos.push(x, y, z);
          this.col.push(c.r, c.g, c.b);
        }
        this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      }
    };
    ribbon(-TRAM_BED_HALF, TRAM_BED_HALF, BED_LIFT, bed);
    for (const side of [-1, 1] as const) {
      const c = (side * TRAM_GAUGE) / 2;
      ribbon(c - RAIL_WIDTH / 2, c + RAIL_WIDTH / 2, RAIL_TOP, rail);
    }
    const wireY = RAIL_TOP + TRAM_WIRE_HEIGHT + WIRE / 2;
    for (let i = 0; i < n; i++) {
      this.quad(
        [
          at(i, -WIRE / 2, wireY),
          at(i + 1, -WIRE / 2, wireY),
          at(i + 1, WIRE / 2, wireY),
          at(i, WIRE / 2, wireY),
        ],
        rail,
      );
      this.quad(
        [
          at(i, 0, wireY - WIRE / 2),
          at(i + 1, 0, wireY - WIRE / 2),
          at(i + 1, 0, wireY + WIRE / 2),
          at(i, 0, wireY + WIRE / 2),
        ],
        rail,
      );
    }
    for (const span of loop.spans ?? []) this.span(span, wireY, rail);
  }

  /** One span wire: from the contact wire over the axis out and up to a rosette on each facade. */
  private span(sp: TramSpan, wireY: number, c: Color): void {
    const fx = Math.sin(sp.heading);
    const fz = Math.cos(sp.heading);
    const lx = Math.cos(sp.heading);
    const lz = -Math.sin(sp.heading);
    const deck = this.field.heightAt(sp.x, sp.z);
    const w = [sp.x, deck + wireY, sp.z] as const;
    for (const [sign, out] of [
      [1, sp.left],
      [-1, sp.right],
    ] as const) {
      // Anchored a hair off the wall, a little higher than the wire so the span sags onto it.
      const reach = out - ROSETTE_OFF;
      const a = [
        sp.x + lx * reach * sign,
        deck + wireY + SPAN_RISE,
        sp.z + lz * reach * sign,
      ] as const;
      const t = (p: readonly [number, number, number], dx: number, dy: number, dz: number) =>
        [p[0] + dx, p[1] + dy, p[2] + dz] as const;
      const h = SPAN_WIRE / 2;
      this.quad(
        [
          t(w, -fx * h, 0, -fz * h),
          t(a, -fx * h, 0, -fz * h),
          t(a, fx * h, 0, fz * h),
          t(w, fx * h, 0, fz * h),
        ],
        c,
      );
      this.quad([t(w, 0, -h, 0), t(a, 0, -h, 0), t(a, 0, h, 0), t(w, 0, h, 0)], c);
      // The rosette: a small plate on the wall, facing the street.
      const r = ROSETTE / 2;
      const p = [sp.x + lx * out * sign, deck + wireY + SPAN_RISE, sp.z + lz * out * sign] as const;
      const plate = t(p, -lx * sign * 0.02, 0, -lz * sign * 0.02);
      this.quad(
        [
          t(plate, -fx * r, -r, -fz * r),
          t(plate, fx * r, -r, fz * r),
          t(plate, fx * r, r, fz * r),
          t(plate, -fx * r, r, -fz * r),
        ],
        c,
      );
    }
  }

  /** A quad from four corners, drawn from both sides (two triangles each way), so a thin ribbon never culls away. */
  private quad(p: readonly (readonly [number, number, number])[], c: Color): void {
    const base = this.pos.length / 3;
    for (const [x, y, z] of p) {
      this.pos.push(x, y, z);
      this.col.push(c.r, c.g, c.b);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    this.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
