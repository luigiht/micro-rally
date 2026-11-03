import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { createElement, createRef } from 'react';
import {
  type BufferGeometry,
  type InstancedMesh,
  Matrix4,
  type Mesh,
  type Object3D,
  Vector3,
} from 'three';
import { it } from 'vitest';
import { CAR_SPECS, type CarId } from '@/game/vehicle/CarSpec';
import { CarModel, type CarModelHandle } from '@/components/game/CarModel';

/**
 * A dev tool rather than a test: `CAR_STL=<carId> pnpm exec vitest run tests/unit/exportCarStl.test.ts`
 * renders the car's body with the headless React Three renderer and writes it as a binary STL in
 * metres to `exports/` and the Downloads folder. Without `CAR_STL` it does nothing.
 */
const carId = process.env.CAR_STL as CarId | undefined;

function triangles(root: Object3D): number[] {
  const out: number[] = [];
  const v = [new Vector3(), new Vector3(), new Vector3()];
  const world = new Matrix4();
  const emit = (geometry: BufferGeometry, matrix: Matrix4) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    const pos = g.getAttribute('position');
    for (let i = 0; i + 2 < pos.count; i += 3) {
      for (let k = 0; k < 3; k++) v[k]!.fromBufferAttribute(pos, i + k).applyMatrix4(matrix);
      const n = new Vector3()
        .subVectors(v[1]!, v[0]!)
        .cross(new Vector3().subVectors(v[2]!, v[0]!));
      if (n.lengthSq() === 0) continue;
      n.normalize();
      out.push(n.x, n.y, n.z);
      for (let k = 0; k < 3; k++) out.push(v[k]!.x, v[k]!.y, v[k]!.z);
    }
    if (g !== geometry) g.dispose();
  };
  root.updateWorldMatrix(true, true);
  root.traverseVisible((o) => {
    const mesh = o as Mesh & Partial<InstancedMesh>;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (mesh.isInstancedMesh && mesh.instanceMatrix) {
      const local = new Matrix4();
      for (let i = 0; i < mesh.count!; i++) {
        mesh.getMatrixAt!(i, local);
        world.multiplyMatrices(mesh.matrixWorld, local);
        emit(mesh.geometry, world);
      }
      return;
    }
    emit(mesh.geometry, mesh.matrixWorld);
  });
  return out;
}

/**
 * STL axes: X right, Y forward (the game's z), Z up (the game's y). The game's x points left, so the
 * map is X = −x, Y = z, Z = y: a proper rotation, which keeps every triangle's winding and so its
 * outward face. (Swapping two axes instead would mirror the model and turn it inside out.)
 */
function toStl(tris: number[], label: string): Buffer {
  const count = tris.length / 12;
  const buf = Buffer.alloc(84 + count * 50);
  buf.write(label.slice(0, 79), 0, 80, 'ascii');
  buf.writeUInt32LE(count, 80);
  let o = 84;
  for (let t = 0; t < count; t++) {
    for (let k = 0; k < 4; k++) {
      const x = tris[t * 12 + k * 3]!;
      const y = tris[t * 12 + k * 3 + 1]!;
      const z = tris[t * 12 + k * 3 + 2]!;
      buf.writeFloatLE(-x, o);
      buf.writeFloatLE(z, o + 4);
      buf.writeFloatLE(y, o + 8);
      o += 12;
    }
    buf.writeUInt16LE(0, o);
    o += 2;
  }
  return buf;
}

/** Signed volume of the triangle soup: positive when the windings face outward overall. */
function signedVolume(tris: number[]): number {
  let v = 0;
  for (let t = 0; t < tris.length; t += 12) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = tris.slice(t + 3, t + 12) as number[];
    v +=
      (ax! * (by! * cz! - bz! * cy!) -
        ay! * (bx! * cz! - bz! * cx!) +
        az! * (bx! * cy! - by! * cx!)) /
      6;
  }
  return v;
}

it.skipIf(!carId)('exports the car named by CAR_STL as an STL', async () => {
  const spec = CAR_SPECS[carId!];
  if (!spec) throw new Error(`unknown car '${carId}'; one of ${Object.keys(CAR_SPECS).join(', ')}`);
  const ref = createRef<CarModelHandle>();
  const renderer = await ReactThreeTestRenderer.create(createElement(CarModel, { spec, ref }));
  const tris = triangles(renderer.scene.instance as Object3D);
  const buf = toStl(tris, `Micro Rally car ${spec.id} metres`);
  const dir = join(process.cwd(), 'exports');
  mkdirSync(dir, { recursive: true });
  const name = `micro-rally-car-${spec.id}.stl`;
  writeFileSync(join(dir, name), buf);
  try {
    writeFileSync(join(homedir(), 'Downloads', name), buf);
  } catch {
    // No Downloads folder: the copy under exports/ stands.
  }
  // Bounds, for the report.
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let t = 0; t < tris.length; t += 12)
    for (let k = 0; k < 3; k++)
      for (let a = 0; a < 3; a++) {
        const val = tris[t + 3 + k * 3 + a]!;
        min[a] = Math.min(min[a]!, val);
        max[a] = Math.max(max[a]!, val);
      }
  writeFileSync(
    '/tmp/car-stl-result.txt',
    `${spec.id}: triangles ${tris.length / 12}; signed volume ${signedVolume(tris).toFixed(3)} m3; size ${(max[0]! - min[0]!).toFixed(2)} wide x ${(max[2]! - min[2]!).toFixed(2)} long x ${(max[1]! - min[1]!).toFixed(2)} tall m; file exports/${name}\n`,
  );
  await renderer.unmount();
});
