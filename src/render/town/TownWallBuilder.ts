import { BoxGeometry, BufferGeometry, Color, Group, Mesh, MeshStandardMaterial } from 'three';
import { KERB_LIFT, WALL_HALF, type GroundQuery, type TownDef } from '@/game/stage/Town';
import { merge, paint } from '../scenery/HouseGeometry';
import type { WallTheme } from '../theme/WorldTheme';

/** Garden walls: a plastered run with a pale coping, sunk into the slope so no gap opens under them. */
const WALL_HEIGHT = 1.1;
const SINK = 0.6;
const CAP_HEIGHT = 0.12;
const CAP_OVERHANG = 0.06;
/** A city's hedges on the same lines: a thicker, lower leaf body under a lighter clipped top. */
const HEDGE_HALF = 0.3;
const HEDGE_HEIGHT = 0.9;
const HEDGE_TOP = 0.1;

/** Every garden wall of the village as one merged, flat-shaded mesh; with `hedge` set, every wall is a hedge instead. */
export class TownWallBuilder {
  readonly group = new Group();
  private readonly geometry: BufferGeometry | null;
  private readonly material: MeshStandardMaterial;

  constructor(town: TownDef, field: GroundQuery, walls: WallTheme, hedge?: WallTheme) {
    this.group.name = hedge ? 'town-hedges' : 'town-walls';
    const BODY = new Color((hedge ?? walls).body);
    const CAP = new Color((hedge ?? walls).cap);
    const half = hedge ? HEDGE_HALF : WALL_HALF;
    const height = hedge ? HEDGE_HEIGHT : WALL_HEIGHT;
    const capHeight = hedge ? HEDGE_TOP : CAP_HEIGHT;
    const capOver = hedge ? -0.04 : CAP_OVERHANG;
    const parts: BufferGeometry[] = [];
    for (const w of town.walls) {
      const len = Math.hypot(w.x1 - w.x0, w.z1 - w.z0);
      if (len < 0.05) continue;
      const yaw = Math.atan2(w.x1 - w.x0, w.z1 - w.z0);
      // Walls stand at the back of the pavement, at its level.
      const y0 = field.deckAt(w.x0, w.z0) + KERB_LIFT;
      const y1 = field.deckAt(w.x1, w.z1) + KERB_LIFT;
      const top = Math.max(y0, y1) + height;
      const bottom = Math.min(y0, y1) - SINK;
      const body = paint(new BoxGeometry(half * 2, top - bottom, len), BODY).translate(
        0,
        (top + bottom) / 2,
        0,
      );
      const cap = paint(
        new BoxGeometry(half * 2 + capOver * 2, capHeight, len + capOver * 2),
        CAP,
      ).translate(0, top + capHeight / 2 - (hedge ? 0.01 : 0), 0);
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
