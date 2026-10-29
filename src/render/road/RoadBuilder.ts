import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
} from 'three';
import type { StageDef } from '@/game/stage/StageGenerator';
import type { TerrainField } from '@/game/stage/TerrainField';
import type { Surface } from '@/game/vehicle/surfaces';

const ROAD_COLORS: Readonly<Record<Surface, string>> = {
  tarmac: '#55565e',
  gravel: '#a98e68',
  mud: '#6b4d33',
  snow: '#e9eef2',
  grass: '#8fbf6a',
};
const LINE_COLOR = '#f4f1e8';
const SAMPLES_PER_PIECE = 100;
const ROAD_LIFT = 0.08;
const LINE_LIFT = 0.1;
const LINE_WIDTH = 0.22;
const MARKER_SPACING = 20;

/** Ribbon road split into pieces for frustum culling, plus edge lines and marker posts. */
export class RoadBuilder {
  readonly group = new Group();
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: MeshStandardMaterial[] = [];
  private readonly instanced: InstancedMesh[] = [];

  constructor(stage: StageDef, field: TerrainField) {
    this.group.name = 'road';
    const roadMat = new MeshStandardMaterial({
      vertexColors: true,
      roughness: stage.surface === 'tarmac' ? 0.75 : 1,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.materials.push(roadMat);
    const path = stage.path;
    for (let s0 = 0; s0 < path.count - 1; s0 += SAMPLES_PER_PIECE) {
      const s1 = Math.min(path.count - 1, s0 + SAMPLES_PER_PIECE);
      const geo = this.buildPiece(stage, field, s0, s1);
      this.geometries.push(geo);
      const mesh = new Mesh(geo, roadMat);
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
    this.buildMarkers(stage, field);
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    for (const i of this.instanced) i.dispose();
  }

  private buildPiece(stage: StageDef, field: TerrainField, s0: number, s1: number): BufferGeometry {
    const path = stage.path;
    const hw = stage.halfWidth;
    const road = new Color(ROAD_COLORS[stage.surface]);
    const line = new Color(LINE_COLOR);
    const n = s1 - s0 + 1;
    // Three strips (road, left line, right line), two verts per sample each.
    const pos = new Float32Array(n * 6 * 3);
    const col = new Float32Array(n * 6 * 3);
    const strips: [number, number, number, Color][] = [
      [-hw, hw, ROAD_LIFT, road],
      [hw - 0.35 - LINE_WIDTH, hw - 0.35, LINE_LIFT, line],
      [-hw + 0.35, -hw + 0.35 + LINE_WIDTH, LINE_LIFT, line],
    ];
    const index: number[] = [];
    strips.forEach(([a, b, lift, color], strip) => {
      const base = strip * n * 2;
      for (let k = 0; k < n; k++) {
        const i = s0 + k;
        const x = path.xs[i]!;
        const z = path.zs[i]!;
        const h = path.headings[i]!;
        const lx = Math.cos(h);
        const lz = -Math.sin(h);
        const y = field.roadHeightAt(i * path.spacing) + lift;
        const shade = strip === 0 ? 0.96 + (((i * 2654435761) % 997) / 997) * 0.08 : 1;
        const v = (base + k * 2) * 3;
        pos.set([x + lx * a, y, z + lz * a, x + lx * b, y, z + lz * b], v);
        col.set(
          [
            color.r * shade,
            color.g * shade,
            color.b * shade,
            color.r * shade,
            color.g * shade,
            color.b * shade,
          ],
          v,
        );
        if (k > 0) {
          const p = base + (k - 1) * 2;
          const q = base + k * 2;
          // a is the right-hand edge; wind counter-clockwise seen from above.
          index.push(p, q, p + 1, q, q + 1, p + 1);
        }
      }
    });
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('color', new BufferAttribute(col, 3));
    geo.setIndex(index);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }

  private buildMarkers(stage: StageDef, field: TerrainField): void {
    const path = stage.path;
    const count = Math.floor(path.length / MARKER_SPACING) * 2;
    const postGeo = new BoxGeometry(0.14, 0.9, 0.14).translate(0, 0.45, 0);
    const capGeo = new BoxGeometry(0.16, 0.18, 0.16).translate(0, 0.98, 0);
    this.geometries.push(postGeo, capGeo);
    const postMat = new MeshStandardMaterial({ color: '#f4f1e8', flatShading: true });
    const capMat = new MeshStandardMaterial({ color: '#e8623a', flatShading: true });
    this.materials.push(postMat, capMat);
    const posts = new InstancedMesh(postGeo, postMat, count);
    const caps = new InstancedMesh(capGeo, capMat, count);
    const dummy = new Object3D();
    const sample = { x: 0, z: 0, heading: 0 };
    let n = 0;
    for (let d = MARKER_SPACING / 2; n < count; d += MARKER_SPACING) {
      path.sample(d, sample);
      for (const side of [-1, 1]) {
        const off = (stage.halfWidth + 1.4) * side;
        const x = sample.x + Math.cos(sample.heading) * off;
        const z = sample.z - Math.sin(sample.heading) * off;
        dummy.position.set(x, field.heightAt(x, z), z);
        dummy.rotation.set(0, sample.heading, 0);
        dummy.updateMatrix();
        posts.setMatrixAt(n, dummy.matrix);
        caps.setMatrixAt(n, dummy.matrix);
        n++;
      }
    }
    posts.computeBoundingSphere();
    caps.computeBoundingSphere();
    this.instanced.push(posts, caps);
    this.group.add(posts, caps);
  }
}
