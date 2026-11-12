import { type BufferGeometry, Color, Group, Mesh, MeshStandardMaterial } from 'three';
import type { GroundQuery, TownDef } from '@/game/stage/Town';
import { box, merge } from '../scenery/HouseGeometry';

/** Galvanised crowd-barrier steel and its feet. */
const STEEL = new Color('#b9bec4');
const FOOT = new Color('#5f646b');
/** One barrier panel: this wide, this tall, its rails and bars this thick. */
const PANEL = 2.3;
const HEIGHT = 1.1;
const RAIL = 0.05;
const BARS = 9;
/** Half the gap a barrier leaves for a tram (its body is 2.65 m wide). */
const TRAM_GAP = 1.5;

/**
 * The crowd barriers that close a city's streets where the route passes
 * them (`TownDef.barriers`): a row of galvanised panels on flat feet right
 * across the carriageway, each a frame of rails with upright bars. One merged mesh; the
 * colliders stand whatever is drawn.
 */
export class RoadClosedBuilder {
  readonly group = new Group();
  private readonly geometry: BufferGeometry | null;
  private readonly material = new MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.6,
    metalness: 0.2,
  });

  constructor(town: TownDef, ground: GroundQuery) {
    this.group.name = 'road-closed';
    const parts: BufferGeometry[] = [];
    for (const b of town.barriers ?? []) {
      // Panels laid along the barrier (local x across the street), then turned and placed.
      const local: BufferGeometry[] = [];
      const n = Math.max(1, Math.round((2 * b.halfLength) / PANEL));
      const w = (2 * b.halfLength) / n;
      for (let k = 0; k < n; k++) {
        const cx = -b.halfLength + w * (k + 0.5);
        // Where a tram runs through, the panels over its rails are left out.
        if (b.tramGap && Math.abs(cx) < TRAM_GAP + w / 2 - 0.2) continue;
        local.push(
          box(w - 0.1, RAIL, RAIL, cx, HEIGHT, 0, STEEL),
          box(w - 0.1, RAIL, RAIL, cx, 0.25, 0, STEEL),
          box(RAIL, HEIGHT - 0.2, RAIL, cx - w / 2 + 0.08, 0.15 + HEIGHT / 2, 0, STEEL),
          box(RAIL, HEIGHT - 0.2, RAIL, cx + w / 2 - 0.08, 0.15 + HEIGHT / 2, 0, STEEL),
          box(0.08, 0.04, 0.7, cx - w / 2 + 0.08, 0.02, 0, FOOT),
          box(0.08, 0.04, 0.7, cx + w / 2 - 0.08, 0.02, 0, FOOT),
        );
        for (let i = 1; i < BARS; i++)
          local.push(
            box(
              0.025,
              HEIGHT - 0.25,
              0.025,
              cx - w / 2 + (w * i) / BARS,
              0.25 + (HEIGHT - 0.25) / 2,
              0,
              STEEL,
            ),
          );
      }
      const y = ground.deckAt(b.x, b.z);
      for (const g of local) {
        // Local x runs across the street: turn so local +z points along it.
        g.rotateY(b.yaw);
        g.translate(b.x, y, b.z);
        parts.push(g);
      }
    }
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
