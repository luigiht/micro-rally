import { BAY_LENGTH, BAY_WIDTH, type ParkingStretch } from '@/game/stage/ParkingBays';
import type { GroundQuery } from '@/game/stage/Town';
import { LINE_ABOVE_DECK } from '../road/RoadBuilder';
import { themeColor } from '../theme/themeColor';
import type { RoadTheme } from '../theme/WorldTheme';
import { MarkingMesh } from './MarkingMesh';

/** Over the deck: above the ribbon's edge lines, under the crossings. */
const BAY_LIFT = LINE_ABOVE_DECK + 0.002;
const BAY_LINE = 0.12;
/** The bays start this far inside the carriageway edge, where the ribbon's edge line runs. */
const BAY_EDGE = 0.6;

/**
 * The painted bays along a city's parking stretches (`parkingStretches`):
 * a line down the inside of the kerb lane each side and a tick across it
 * every bay length. One mesh.
 */
export class ParkingBayBuilder {
  readonly group;
  private readonly mesh: MarkingMesh;

  constructor(stretches: readonly ParkingStretch[], field: GroundQuery, road: RoadTheme) {
    this.mesh = new MarkingMesh('parking-bays', field);
    this.group = this.mesh.group;
    const line = themeColor(road.line);
    for (const s of stretches) {
      const dx = s.x1 - s.x0;
      const dz = s.z1 - s.z0;
      const len = Math.hypot(dx, dz);
      if (len < BAY_LENGTH) continue;
      const h = Math.atan2(dx, dz);
      const n = Math.floor(len / BAY_LENGTH);
      const start = (len - n * BAY_LENGTH) / 2;
      for (const side of [1, -1] as const) {
        const outer = side * (s.halfWidth - BAY_EDGE);
        const inner = side * (s.halfWidth - BAY_EDGE - BAY_WIDTH);
        this.mesh.rect(
          s.x0,
          s.z0,
          h,
          start,
          start + n * BAY_LENGTH,
          inner,
          inner - side * BAY_LINE,
          BAY_LIFT,
          line,
        );
        for (let i = 0; i <= n; i++) {
          const a = start + i * BAY_LENGTH;
          this.mesh.rect(
            s.x0,
            s.z0,
            h,
            a - BAY_LINE / 2,
            a + BAY_LINE / 2,
            inner,
            outer,
            BAY_LIFT,
            line,
          );
        }
      }
    }
    this.mesh.finish(road);
  }

  dispose(): void {
    this.mesh.dispose();
  }
}
