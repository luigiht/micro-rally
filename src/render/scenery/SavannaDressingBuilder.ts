import {
  type BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
} from 'three';
import type { Animal, SavannaDressing } from '@/game/stage/SavannaDressing';
import { giraffeGeometry, zebraGeometry } from './AnimalGeometry';
import { merge, paint } from './HouseGeometry';
import { sisalGeometry } from './kits/SavannaKits';

/**
 * The Savanna's safari dressing (`SavannaDressing`): low-poly giraffes in a
 * patchwork coat and striped zebras, standing about the plain in herds; the
 * sisal plantations, each plant a rosette with its tall flower pole; red
 * termite mounds. Every kind is one instanced mesh, coloured in its geometry.
 * Visual only (the mounds and plants' colliders are `savannaObstacles`).
 */

const POLE = new Color('#7a7a4a');
const BLOSSOM = new Color('#a3a85a');
const MOUND = new Color('#a3502e');
const MOUND_DARK = new Color('#8a4026');

/** A sisal's flower pole: a thin stalk, 1 m tall before scaling, with a few short branches near its top. */
function poleGeometry(): BufferGeometry {
  return merge([
    paint(new CylinderGeometry(0.035, 0.06, 1, 4).translate(0, 0.5, 0), POLE),
    ...[0, 1, 2, 3].map((i) =>
      paint(
        new ConeGeometry(0.06, 0.18, 4)
          .rotateZ(1.1)
          .rotateY((i * Math.PI) / 2)
          .translate(0, 0.8 + i * 0.05, 0),
        BLOSSOM,
      ),
    ),
  ]);
}

/** A termite mound, 1 m tall before scaling: a lumpy red spire on a broad foot. */
function moundGeometry(): BufferGeometry {
  return merge([
    paint(new ConeGeometry(0.55, 0.45, 7).translate(0, 0.2, 0), MOUND_DARK),
    paint(new ConeGeometry(0.32, 1.05, 6).translate(0.05, 0.5, 0), MOUND),
    paint(new ConeGeometry(0.18, 0.6, 5).translate(-0.18, 0.35, 0.1), MOUND),
  ]);
}

export class SavannaDressingBuilder {
  readonly group = new Group();
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: MeshStandardMaterial[] = [];

  constructor(dressing: SavannaDressing, shadows: boolean) {
    this.group.name = 'savanna-dressing';
    const dummy = new Object3D();
    const add = (
      geometry: BufferGeometry,
      count: number,
      set: (i: number) => void,
      castShadow: boolean,
    ) => {
      if (count === 0) {
        geometry.dispose();
        return;
      }
      const material = new MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: 0.92,
      });
      this.geometries.push(geometry);
      this.materials.push(material);
      const mesh = new InstancedMesh(geometry, material, count);
      for (let i = 0; i < count; i++) {
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(1);
        set(i);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.castShadow = castShadow && shadows;
      mesh.computeBoundingSphere();
      this.group.add(mesh);
    };
    const herd = (kind: Animal['kind']) => dressing.animals.filter((a) => a.kind === kind);
    for (const [kind, geometry] of [
      ['giraffe', giraffeGeometry()],
      ['zebra', zebraGeometry()],
    ] as const) {
      const animals = herd(kind);
      add(
        geometry,
        animals.length,
        (i) => {
          const a = animals[i]!;
          dummy.position.set(a.x, a.y, a.z);
          dummy.rotation.y = a.yaw;
          dummy.scale.setScalar(a.scale);
        },
        true,
      );
    }
    const { poles, mounds } = dressing;
    add(
      sisalGeometry(),
      poles.length,
      (i) => {
        const p = poles[i]!;
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.y = i * 2.4;
        dummy.scale.setScalar(0.9 + (i % 5) * 0.06);
      },
      false,
    );
    add(
      poleGeometry(),
      poles.length,
      (i) => {
        const p = poles[i]!;
        dummy.position.set(p.x, p.y + 0.3, p.z);
        dummy.rotation.set(p.lean, i * 1.7, p.lean * 0.5);
        dummy.scale.set(1, p.height, 1);
      },
      true,
    );
    add(
      moundGeometry(),
      mounds.length,
      (i) => {
        const m = mounds[i]!;
        dummy.position.set(m.x, m.y - 0.1, m.z);
        dummy.rotation.y = i * 1.3;
        dummy.scale.set(0.6 + m.height * 0.3, m.height, 0.6 + m.height * 0.3);
      },
      true,
    );
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
