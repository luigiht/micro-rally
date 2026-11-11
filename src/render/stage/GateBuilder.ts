import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONTROL_BOARD_LEAD } from '@/game/stage/RoadMarkers';
import { halfWidthAt } from '@/game/stage/RoadWidth';
import type { StageDef } from '@/game/stage/StageGenerator';
import type { TerrainField } from '@/game/stage/TerrainField';
import { themedMaterial, themeGlow, themeHex } from '../theme/themeColor';
import type { GateTheme, ThemeColor } from '../theme/WorldTheme';

const HEIGHT = 4.4;
const POST = 0.35;
/** The gantry's banner: a chequer two squares tall, this tall and deep. */
const BANNER = { height: 0.9, depth: 0.3 } as const;

/** Control board standing on the ground: a plain white plate with a round sign (`clock` radius, `ring` rim) near its top. */
const BOARD = { width: 0.9, height: 1.0, clock: 0.3, ring: 0.045 } as const;
/** Checkpoint clock hands, clockwise from 12 as the approaching driver sees them: 2:50. */
const HOUR_ANGLE = (2 + 50 / 60) * (Math.PI / 6);
const MINUTE_ANGLE = 50 * (Math.PI / 30);
/** Layers sit this far in front of each other: flat to the eye, no z-fighting. */
const LAYER = 0.003;

/** Board line off the road edge, as at the checkpoints. */
const BOARD_OFFSET = 1.2;

/** One flat layer of a board's sign: geometry, colour, spin about the sign's centre, depth in front of the plate. */
type SignLayer = readonly [BufferGeometry, ThemeColor, number, number];

/**
 * Start and finish lines are chequered gantries and, on an open stage, a
 * pair of red-disc boards just before the line: a stopwatch at the start,
 * a chequered flag at the finish (the
 * "flying finish"); checkpoints are a pair of roadside time-control
 * boards (yellow clock on white), as at real rally controls, rather than
 * arches. A circuit's start/finish gantry, crossed every lap, has no boards.
 */
export class GateBuilder {
  readonly group = new Group();
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials = new Map<string, MeshStandardMaterial>();

  constructor(
    stage: StageDef,
    field: TerrainField,
    private readonly theme: GateTheme,
  ) {
    this.group.name = 'gates';
    const face = this.clockSign();
    if (stage.circuit) {
      // One lap's worth: a single gantry over the start/finish line, with no stopwatch boards as
      // it is crossed every lap, and the sector boards of the first lap (every later lap's gates
      // stand in the same places).
      this.addLine(stage, stage.startDistance, stage.halfWidth + 2.2, field, null);
      const lapEnd = stage.startDistance + stage.circuit.lapLength;
      for (const g of stage.gates)
        if (g.kind === 'checkpoint' && g.distance < lapEnd)
          this.addBoards(g.x, g.z, g.heading, g.halfWidth - 3 + BOARD_OFFSET, field, face);
      return;
    }
    this.addLine(stage, stage.startDistance, stage.halfWidth + 2.2, field, this.stopwatchSign());
    for (const g of stage.gates) {
      if (g.kind === 'finish')
        this.addLine(stage, g.distance, g.halfWidth - 0.8, field, this.flagSign());
      else this.addBoards(g.x, g.z, g.heading, g.halfWidth - 3 + BOARD_OFFSET, field, face);
    }
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials.values()) m.dispose();
  }

  private material(color: ThemeColor): MeshStandardMaterial {
    const key = `${themeHex(color)}*${themeGlow(color)}`;
    let m = this.materials.get(key);
    if (!m) {
      m = themedMaterial(color);
      this.materials.set(key, m);
    }
    return m;
  }

  private track<T extends BufferGeometry>(g: T): T {
    this.geometries.push(g);
    return g;
  }

  private box(w: number, h: number, d: number): BoxGeometry {
    return this.track(new BoxGeometry(w, h, d));
  }

  /** Thin disc facing -z (toward the approaching car). */
  private disc(radius: number, depth: number): BufferGeometry {
    return this.track(new CylinderGeometry(radius, radius, depth, 16).rotateX(Math.PI / 2));
  }

  /** One geometry from several parts built in place; the parts are disposed. */
  private merged(parts: BufferGeometry[]): BufferGeometry {
    const g = mergeGeometries(parts)!;
    for (const p of parts) p.dispose();
    return this.track(g);
  }

  /** The checkpoints' sign: a flat yellow clock with an ink rim, reading 2:50. */
  private clockSign(): SignLayer[] {
    const { clock, ring } = BOARD;
    const { clock: face, ink } = this.theme;
    // Positive z-rotation reads clockwise from the -z side the driver sees.
    return [
      [this.disc(clock + ring, LAYER), ink, 0, 1],
      [this.disc(clock, LAYER), face, 0, 2],
      [this.box(0.05, clock * 0.55, LAYER).translate(0, clock * 0.275, 0), ink, HOUR_ANGLE, 3],
      [this.box(0.04, clock * 0.8, LAYER).translate(0, clock * 0.4, 0), ink, MINUTE_ANGLE, 3],
      [this.disc(0.04, LAYER), ink, 0, 4],
    ];
  }

  /**
   * The start's sign: a red disc with an ink rim carrying a stopwatch
   * pictogram drawn in ink: a case rim round a red face, crown and side
   * button, four ticks and a hand. Ink parts at one depth share a merged
   * geometry.
   */
  private stopwatchSign(): SignLayer[] {
    const { clock, ring } = BOARD;
    const { startDisc, ink } = this.theme;
    const body = 0.17;
    const face = 0.135;
    const piece = (w: number, h: number, y: number, spin: number) =>
      new BoxGeometry(w, h, LAYER).translate(0, y, 0).rotateZ(spin);
    const disc = (r: number) => new CylinderGeometry(r, r, LAYER, 16).rotateX(Math.PI / 2);
    const caseParts = [
      disc(body),
      piece(0.05, 0.05, body + 0.02, 0),
      piece(0.12, 0.045, body + 0.0675, 0),
      piece(0.045, 0.05, body + 0.015, Math.PI / 4),
    ];
    const markParts = [
      ...[0, 1, 2, 3].map((k) => piece(0.02, 0.035, face - 0.03, (k * Math.PI) / 2)),
      piece(0.025, 0.1, 0.05, Math.PI / 3),
      disc(0.025),
    ];
    return [
      [this.disc(clock + ring, LAYER), ink, 0, 1],
      [this.disc(clock, LAYER), startDisc, 0, 2],
      [this.merged(caseParts), ink, 0, 3],
      [this.disc(face, LAYER), startDisc, 0, 4],
      [this.merged(markParts), ink, 0, 5],
    ];
  }

  /**
   * The finish's sign, the rally "flying finish" board: the red disc with an
   * ink rim carrying a chequered flag on a pole. The flag is four columns of
   * three squares, each column stepped up or down so the flag waves, flying
   * left of the pole as the driver sees it; the whole flag leans clockwise.
   * Light squares share one merged geometry, dark squares and the pole another.
   */
  private flagSign(): SignLayer[] {
    const { clock, ring } = BOARD;
    const { startDisc, board, ink } = this.theme;
    const square = 0.07;
    const pole = 0.03;
    // The pole's centre across the sign, so flag and pole together sit centred on it.
    const poleAt = (4 * square + pole) / 2 - pole / 2;
    // Each column's lift, from the pole out to the fly end.
    const wave = [0, 0.02, 0.028, 0.014];
    const lean = Math.PI / 10;
    // Built as the driver sees it, rightward `u` and upward `v`; the driver's right is -x.
    // Everything stays within 0.27 of the centre, clear of the disc's ink rim at 0.3.
    const part = (w: number, h: number, u: number, v: number) =>
      new BoxGeometry(w, h, LAYER).translate(-u, v, 0).rotateZ(lean);
    const light: BufferGeometry[] = [];
    const dark: BufferGeometry[] = [part(pole, 0.41, poleAt, -0.015)];
    wave.forEach((lift, c) => {
      const u = poleAt - pole / 2 - square * (c + 0.5);
      for (let r = 0; r < 3; r++)
        ((r + c) % 2 === 0 ? dark : light).push(
          part(square, square, u, square * (r - 0.5) + 0.01 + lift),
        );
    });
    return [
      [this.disc(clock + ring, LAYER), ink, 0, 1],
      [this.disc(clock, LAYER), startDisc, 0, 2],
      [this.merged(light), board, 0, 3],
      [this.merged(dark), ink, 0, 3],
    ];
  }

  /**
   * One board on each verge, standing on the ground with no post: a plain
   * white plate with `sign` near its top, facing the approaching car.
   */
  private addBoards(
    x: number,
    z: number,
    heading: number,
    half: number,
    field: TerrainField,
    sign: readonly SignLayer[],
  ) {
    const { width, height, clock, ring } = BOARD;
    const thick = 0.04;
    const cy = height - clock - ring - 0.12;
    const front = -thick / 2;
    for (const side of [-1, 1]) {
      const px = x + Math.cos(heading) * half * side;
      const pz = z - Math.sin(heading) * half * side;
      // The ground under the plate's ends and middle: it stands on the middle and reaches below the
      // lowest, so no edge hangs in the air; a snow bank's slope may bury its foot at the high end.
      let mid = 0;
      let low = Infinity;
      for (const u of [-width / 2, 0, width / 2]) {
        const h = field.heightAt(px + Math.cos(heading) * u, pz - Math.sin(heading) * u);
        if (u === 0) mid = h;
        low = Math.min(low, h);
      }
      const sink = mid - low + 0.1;
      const plateGeo = this.box(width, height + sink, thick).translate(0, (height - sink) / 2, 0);
      const board = new Group();
      board.position.set(px, mid, pz);
      board.rotation.y = heading;
      const plate = new Mesh(plateGeo, this.material(this.theme.board));
      plate.castShadow = true;
      board.add(plate);
      for (const [geo, color, spin, layer] of sign) {
        const m = new Mesh(geo, this.material(color));
        m.position.set(0, cy, front - LAYER * layer);
        m.rotation.z = spin;
        board.add(m);
      }
      this.freeze(board);
    }
  }

  /**
   * A start or finish line `along` the road: a chequered gantry with posts
   * `half` off the centreline and, given a `sign`, a control board on each
   * verge just before the line.
   */
  private addLine(
    stage: StageDef,
    along: number,
    half: number,
    field: TerrainField,
    sign: readonly SignLayer[] | null,
  ) {
    const s = { x: 0, z: 0, heading: 0 };
    stage.path.sample(along, s);
    const arch = new Group();
    arch.position.set(s.x, field.heightAt(s.x, s.z), s.z);
    arch.rotation.y = s.heading;
    const postGeo = this.box(POST, HEIGHT, POST);
    for (const side of [-1, 1]) {
      const post = new Mesh(postGeo, this.material(this.theme.post));
      post.position.set(side * half, HEIGHT / 2, 0);
      post.castShadow = true;
      arch.add(post);
    }
    this.addChequer(arch, half);
    this.freeze(arch);
    if (!sign) return;
    const boardsAt = along - CONTROL_BOARD_LEAD;
    stage.path.sample(boardsAt, s);
    const boardHalf = halfWidthAt(stage, boardsAt) + BOARD_OFFSET;
    this.addBoards(s.x, s.z, s.heading, boardHalf, field, sign);
  }

  /** The banner: a chequer two squares tall across the posts, as two merged meshes (dark and light squares). */
  private addChequer(arch: Group, half: number) {
    const rows = 2;
    const size = BANNER.height / rows;
    const cols = Math.max(8, Math.round((half * 2) / size));
    const w = (half * 2) / cols;
    const squares: [BufferGeometry[], BufferGeometry[]] = [[], []];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        squares[(r + c) % 2]!.push(
          new BoxGeometry(w, size, BANNER.depth).translate(
            -half + w * (c + 0.5),
            HEIGHT - size * (r + 0.5),
            0,
          ),
        );
    this.theme.chequer.forEach((color, i) =>
      arch.add(new Mesh(this.merged(squares[i]!), this.material(color))),
    );
  }

  /** Static from here on: bake the matrices once and add the group. */
  private freeze(group: Group) {
    group.traverse((o) => {
      o.matrixAutoUpdate = false;
      o.updateMatrix();
    });
    group.updateMatrixWorld(true);
    this.group.add(group);
  }
}
