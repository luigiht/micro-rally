import { BoxGeometry, type BufferGeometry, Color } from 'three';
import { hashSeed, mulberry32 } from '@/game/rng';
import type { CoastWall, WallPoint } from '@/game/stage/Coastline';
import type { GroundQuery } from '@/game/stage/Town';
import { paint } from '../scenery/HouseGeometry';
import type { WallTheme } from '../theme/WorldTheme';

/**
 * A dry-stone wall of big rounded stones: two staggered courses, every stone
 * a box with its corners and edges drawn in toward a sphere (so it keeps flat
 * low-poly facets but no brick edges), its own length, height, thickness,
 * set, tilt and grey, the upper course bedded into the lower so the uneven
 * top opens no holes.
 */
const COURSES = [0.62, 0.56] as const;
const THICK = 0.58;
const SINK = 0.3;
/** The upper course beds this far into the lower. */
const BED = 0.1;
const STONE_MIN = 0.6;
const STONE_MAX = 1.1;
const JOINT = 0.02;
/** How far corners and edges move toward the sphere (0 a box, 1 an ellipsoid). */
const ROUND = 0.45;
/** Vertex jitter as a share of the stone's size, the same for vertices that share a position. */
const JITTER = 0.05;

/** A box of the given size with 2×2 facets a side, its vertices pulled toward the sphere and jittered. */
function roundedStone(w: number, h: number, l: number, rand: () => number): BufferGeometry {
  const g = new BoxGeometry(w, h, l, 2, 2, 2);
  const pos = g.getAttribute('position');
  const seen = new Map<string, [number, number, number]>();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / (w / 2);
    const y = pos.getY(i) / (h / 2);
    const z = pos.getZ(i) / (l / 2);
    const key = `${x.toFixed(2)}|${y.toFixed(2)}|${z.toFixed(2)}`;
    let out = seen.get(key);
    if (!out) {
      const len = Math.hypot(x, y, z) || 1;
      const k = 1 - ROUND + ROUND / len;
      const j = () => 1 + (rand() - 0.5) * 2 * JITTER;
      out = [x * k * j(), y * k * j(), z * k * j()];
      seen.set(key, out);
    }
    pos.setXYZ(i, (out[0] * w) / 2, (out[1] * h) / 2, (out[2] * l) / 2);
  }
  return g;
}

export function stoneWallParts(
  wall: CoastWall,
  sample: (along: number, out: WallPoint) => WallPoint,
  ground: GroundQuery,
  theme: WallTheme,
  seed: number,
  into: BufferGeometry[],
): void {
  const rand = mulberry32(hashSeed(seed, 'stone', Math.round(wall.from), wall.side));
  const body = new Color(theme.body);
  const cap = new Color(theme.cap);
  const tint = new Color();
  const p: WallPoint = { x: 0, z: 0, heading: 0 };
  let base = -SINK;
  for (let course = 0; course < COURSES.length; course++) {
    const height = COURSES[course]!;
    // Stagger the joints: the upper course starts with a half stone.
    let at = wall.from;
    if (course === 1) {
      const half = (STONE_MIN + STONE_MAX) / 4;
      stone(at, at + half, base, height);
      at += half;
    }
    while (at < wall.to - JOINT) {
      const len = Math.min(wall.to - at, STONE_MIN + rand() * (STONE_MAX - STONE_MIN));
      stone(at, at + len, base, height);
      at += len;
    }
    base += height;
  }

  function stone(from: number, to: number, bottom: number, course: number): void {
    const len = to - from - JOINT;
    if (len < 0.2) return;
    sample((from + to) / 2, p);
    const deck = ground.deckAt(p.x, p.z);
    const h = course + BED + rand() * 0.08;
    const t = THICK * (0.9 + rand() * 0.2);
    tint
      .copy(body)
      .lerp(cap, rand())
      .multiplyScalar(0.92 + rand() * 0.16);
    const g = paint(roundedStone(t, h, len * 1.06, rand), tint);
    // A little tilt, yaw and set, so the course reads as laid stone rather than a kerb.
    g.rotateX((rand() - 0.5) * 0.06);
    g.rotateZ((rand() - 0.5) * 0.06);
    g.rotateY(p.heading + (rand() - 0.5) * 0.08);
    const set = (rand() - 0.5) * 0.08;
    g.translate(
      p.x + Math.cos(p.heading) * set,
      deck + bottom - BED + h / 2,
      p.z - Math.sin(p.heading) * set,
    );
    into.push(g);
  }
}
