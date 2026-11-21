import {
  BoxGeometry,
  type BufferGeometry,
  Color,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
} from 'three';
import type { WallPoint } from '@/game/stage/Coastline';
import type { MoorlandDressing, RoadsideRun } from '@/game/stage/MoorlandDressing';
import type { RoadSample } from '@/game/stage/RoadPath';
import type { StageDef } from '@/game/stage/StageGenerator';
import type { TerrainField } from '@/game/stage/TerrainField';
import { stoneWallParts } from '../road/StoneWallGeometry';
import { merge, paint } from './HouseGeometry';

/**
 * The Moorland's farm dressing (`MoorlandDressing`): sheep grazing the open
 * slopes, white fleeces on dark legs and heads; wooden post-and-rail fences
 * along the open road, the rails following the ground from post to post; dry-stone walls of grey slate out across the fields. Sheep
 * and fence posts are instanced, the walls one merged mesh. Visual only.
 */

const FLEECE = '#e6e2d6';
const DARK = '#2c2824';
/** Weathered wood: darker posts, paler rails. */
const POST = '#6e5236';
const RAIL = '#8f6a43';
/** Slate field walls: dark grey with paler stones among them. */
const WALL = { body: '#5f625f', cap: '#8a8d89' };
/** A fence post: square, this tall over the ground, set this deep into it. */
const POST_WIDTH = 0.13;
const POST_HEIGHT = 1.25;
const POST_SINK = 0.15;
/** Plank rails: their heights on the posts (two or three a fence), size, and overlap past each post. */
const RAILS_2 = [0.45, 0.85] as const;
const RAILS_3 = [0.3, 0.6, 0.9] as const;
const RAIL_HEIGHT = 0.13;
const RAIL_THICK = 0.045;
const RAIL_OVERHANG = 0.12;

export class MoorlandDressingBuilder {
  readonly group = new Group();
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: MeshStandardMaterial[] = [];

  constructor(stage: StageDef, field: TerrainField, dressing: MoorlandDressing) {
    this.group.name = 'moorland-dressing';
    const matte = (color?: string) => {
      const m = new MeshStandardMaterial({
        flatShading: true,
        roughness: 0.95,
        ...(color ? { color } : { vertexColors: true }),
      });
      this.materials.push(m);
      return m;
    };
    const dummy = new Object3D();
    const s: RoadSample = { x: 0, z: 0, heading: 0 };
    const along = (run: RoadsideRun, d: number, out: WallPoint) => {
      stage.path.sample(d, s);
      const off = (stage.halfWidth + run.offset) * run.side;
      out.x = s.x + Math.cos(s.heading) * off;
      out.z = s.z - Math.sin(s.heading) * off;
      out.heading = s.heading;
      return out;
    };

    // Sheep: a fleece body, and a dark head and legs, both instanced.
    if (dressing.sheep.length > 0) {
      const body = new BoxGeometry(0.5, 0.42, 0.95);
      body.translate(0, 0.62, 0);
      const dark = merge([
        paint(boxAt(0.22, 0.26, 0.3, 0, 0.78, 0.58), new Color(DARK)),
        ...[-0.15, 0.15].flatMap((x) =>
          [-0.3, 0.3].map((z) => paint(boxAt(0.08, 0.42, 0.08, x, 0.21, z), new Color(DARK))),
        ),
      ]);
      const fleece = new InstancedMesh(this.keep(body), matte(FLEECE), dressing.sheep.length);
      const legs = new InstancedMesh(this.keep(dark), matte(), dressing.sheep.length);
      dressing.sheep.forEach((sh, i) => {
        dummy.position.set(sh.x, sh.y, sh.z);
        dummy.rotation.set(0, sh.yaw, 0);
        dummy.scale.setScalar(sh.scale);
        dummy.updateMatrix();
        fleece.setMatrixAt(i, dummy.matrix);
        legs.setMatrixAt(i, dummy.matrix);
      });
      for (const m of [fleece, legs]) {
        m.castShadow = true;
        m.computeBoundingSphere();
        this.group.add(m);
      }
    }

    // Fences: square wooden posts, and plank rails from each post to the next at the posts' own
    // heights, so the fence follows the ground; every piece its own shade of weathered wood.
    const wood = new Color();
    const posts: { x: number; y: number; z: number }[] = [];
    const rails: { a: [number, number, number]; b: [number, number, number] }[] = [];
    let n = 0;
    for (const fence of dressing.fences) {
      const tops = fence.posts.map((p) => ({ ...p, y: field.heightAt(p.x, p.z) }));
      posts.push(...tops);
      const heights = fence.rails === 3 ? RAILS_3 : RAILS_2;
      for (let k = 1; k < tops.length; k++) {
        const a = tops[k - 1]!;
        const b = tops[k]!;
        for (const h of heights) rails.push({ a: [a.x, a.y + h, a.z], b: [b.x, b.y + h, b.z] });
        // Now and then a brace across the span, low at one post and high at the next.
        if (wobble(n++, 7) < 0.15)
          rails.push({
            a: [a.x, a.y + heights[0]!, a.z],
            b: [b.x, b.y + heights[heights.length - 1]!, b.z],
          });
      }
    }
    if (posts.length > 0) {
      const post = new BoxGeometry(POST_WIDTH, POST_HEIGHT, POST_WIDTH);
      post.translate(0, POST_HEIGHT / 2 - POST_SINK, 0);
      const pm = new InstancedMesh(this.keep(post), matte('#ffffff'), posts.length);
      posts.forEach((p, i) => {
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(0, wobble(i, 3) * Math.PI, (wobble(i, 5) - 0.5) * 0.06);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        pm.setMatrixAt(i, dummy.matrix);
        pm.setColorAt(i, wood.set(POST).multiplyScalar(0.85 + 0.3 * wobble(i, 11)));
      });
      pm.castShadow = true;
      pm.computeBoundingSphere();
      this.group.add(pm);
      // A plank one metre long down +z, stretched and turned to run from post to post.
      const plank = new BoxGeometry(RAIL_THICK, RAIL_HEIGHT, 1);
      const rm = new InstancedMesh(this.keep(plank), matte('#ffffff'), rails.length);
      rails.forEach((r, i) => {
        const len = Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1], r.b[2] - r.a[2]);
        dummy.position.set((r.a[0] + r.b[0]) / 2, (r.a[1] + r.b[1]) / 2, (r.a[2] + r.b[2]) / 2);
        dummy.scale.set(1, 1, len + RAIL_OVERHANG);
        dummy.rotation.set(0, 0, 0);
        dummy.lookAt(r.b[0], r.b[1], r.b[2]);
        dummy.updateMatrix();
        rm.setMatrixAt(i, dummy.matrix);
        rm.setColorAt(i, wood.set(RAIL).multiplyScalar(0.82 + 0.36 * wobble(i, 13)));
      });
      rm.castShadow = true;
      rm.computeBoundingSphere();
      this.group.add(rm);
    }

    // Dry-stone walls across the fields, of the moor's grey slate.
    const parts: BufferGeometry[] = [];
    for (const run of dressing.walls) {
      stoneWallParts(
        { from: run.from, to: run.to, side: run.side },
        (d, out) => along(run, d, out),
        field,
        WALL,
        stage.seed,
        parts,
      );
    }
    if (parts.length > 0) {
      const walls = new Mesh(this.keep(merge(parts)), matte());
      walls.castShadow = true;
      walls.receiveShadow = true;
      this.group.add(walls);
    }
  }

  private keep<G extends BufferGeometry>(g: G): G {
    this.geometries.push(g);
    return g;
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}

/** A fixed 0..1 value per piece, so the wood's shades and the braces never change. */
function wobble(i: number, salt: number): number {
  let h = Math.imul(i * 2654435761 + salt * 40503, 2246822519);
  h = Math.imul(h ^ (h >>> 15), 3266489917);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A box of this size centred at (x, y, z). */
function boxAt(w: number, h: number, d: number, x: number, y: number, z: number): BoxGeometry {
  const g = new BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}
