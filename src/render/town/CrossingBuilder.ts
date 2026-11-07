import {
  junctionCrossings,
  STOP_GAP,
  STOP_LINE,
  ZEBRA_DEPTH,
  ZEBRA_PITCH,
  ZEBRA_STRIPE,
} from '@/game/stage/Crossings';
import type { RoadWidthSource } from '@/game/stage/RoadWidth';
import type { GroundQuery, TownDef } from '@/game/stage/Town';
import { LINE_ABOVE_DECK } from '../road/RoadBuilder';
import { themeColor } from '../theme/themeColor';
import type { RoadTheme } from '../theme/WorldTheme';
import { MarkingMesh } from './MarkingMesh';

/** Over the deck: above the ribbon's lines (+0.02) and the lane dashes (+0.021), under a ring's lines (+0.024). */
const CROSSING_LIFT = LINE_ABOVE_DECK + 0.003;
/** Stripes keep this far from the carriageway edge. */
const EDGE_KEEP = 0.5;

/**
 * A city's pedestrian crossings (`junctionCrossings`): a zebra of stripes
 * across every arm just past its junction's paving, and a stop line beyond
 * it on the approach. One mesh.
 */
export class CrossingBuilder {
  readonly group;
  private readonly mesh: MarkingMesh;

  constructor(town: TownDef, stage: RoadWidthSource, field: GroundQuery, road: RoadTheme) {
    this.mesh = new MarkingMesh('crossings', field);
    this.group = this.mesh.group;
    const line = themeColor(road.line);
    for (const c of junctionCrossings(town, stage)) {
      const span = 2 * c.halfWidth - 2 * EDGE_KEEP;
      const n = Math.max(2, Math.floor((span - ZEBRA_STRIPE) / ZEBRA_PITCH) + 1);
      const first = -((n - 1) * ZEBRA_PITCH) / 2;
      for (let i = 0; i < n; i++) {
        const e = first + i * ZEBRA_PITCH;
        this.mesh.rect(
          c.x,
          c.z,
          c.heading,
          -ZEBRA_DEPTH / 2,
          ZEBRA_DEPTH / 2,
          e - ZEBRA_STRIPE / 2,
          e + ZEBRA_STRIPE / 2,
          CROSSING_LIFT,
          line,
        );
      }
      const stop = ZEBRA_DEPTH / 2 + STOP_GAP;
      this.mesh.rect(
        c.x,
        c.z,
        c.heading,
        stop,
        stop + STOP_LINE,
        -c.halfWidth + EDGE_KEEP,
        c.halfWidth - EDGE_KEEP,
        CROSSING_LIFT,
        line,
      );
    }
    this.mesh.finish(road);
  }

  dispose(): void {
    this.mesh.dispose();
  }
}
