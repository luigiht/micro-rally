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
  ) {
    this.group.name = 'tram-tracks';
    const bed = new Color(road.tramBed);
    const rail = themeColor(road.rail);
    for (const t of trams) {
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
