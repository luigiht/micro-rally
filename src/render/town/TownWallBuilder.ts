import { BoxGeometry, BufferGeometry, Color, Group, Mesh, MeshStandardMaterial } from 'three';
import { WALL_HALF, type GroundQuery, type TownDef } from '@/game/stage/Town';
import { merge, paint } from '../scenery/HouseGeometry';

/** Garden walls: a plastered run with a pale coping, sunk into the slope so no gap opens under them. */
const WALL_HEIGHT = 1.1;
const SINK = 0.6;
const CAP_HEIGHT = 0.12;
const CAP_OVERHANG = 0.06;
const BODY = new Color('#c9c0b0');
const CAP = new Color('#e3dccf');

/** Every garden wall of the village as one merged, flat-shaded mesh. */
export class TownWallBuilder {
  readonly group = new Group();
  private readonly geometry: BufferGeometry | null;
  private readonly material: MeshStandardMaterial;

  constructor(town: TownDef, field: GroundQuery) {
    this.group.name = 'town-walls';
    const parts: BufferGeometry[] = [];
    for (const w of town.walls) {
      const len = Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
      if (len < 0.05) continue;
      const yaw = Math.atan2(w.x1 - w.x0, w.z1 - w.z0);
      const y0 = field.heightAt(w.x0, w.z0);
      const y1 = field.heightAt(w.x1, w.z1);
      const top = Math.max(y0, y1) + WALL_HEIGHT;
      const bottom = Math.min(y0, y1) - SINK;
      const body = paint(new BoxGeometry(WALL_HALF * 2, top - bottom, len), BODY).translate(
        0,
        (top + bottom) / 2,
        0,
      );
      const cap = paint(
        new BoxGeometry(WALL_HALF * 2 + CAP_OVERHANG * 2, CAP_HEIGHT, len + CAP_OVERHANG * 2),
        CAP,
      ).translate(0, top + CAP_HEIGHT / 2, 0);
      for (const g of [body, cap]) {
        g.rotateY(yaw);
        g.translate((w.x0 + w.x1) / 2, 0, (w.z0 + w.z1) / 2);
        parts.push(g);
      }
    }
    this.material = new MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.9,
    });
    this.geometry = parts.length > 0 ? merge(parts) : null;
    if (this.geometry) {
      const mesh = new Mesh(this.geometry, this.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
    }
  }

  dispose(): void {
    this.geometry?.dispose();
    this.material.dispose();
  }
}
