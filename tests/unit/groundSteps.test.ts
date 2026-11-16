import { describe, expect, it } from 'vitest';
import { generateStage } from '@/game/stage/StageGenerator';
import { TerrainField } from '@/game/stage/TerrainField';
import { stageIndexOf } from './stageIndex';

/**
 * The ground beside the road never steps: walking out from the road on
 * either side, it may climb or fall steeply (cuttings, fills, a bench's edge)
 * but never jumps (more than 15 cm within 2.5 cm), where the nearest stretch
 * of road changes on the inside of a tight bend, nor where a crowd's bench
 * meets the hillside.
 */
/** Walk out in steps this long; a change over one this big is looked at closely, in this many slivers; a sliver changing this much is a step. */
const STEP = 0.25;
const STEEP = 0.3;
const SPLIT = 10;
const STEP_SLIVER = 0.15;

describe('the ground beside the road', () => {
  for (const type of ['forest', 'alpine'] as const)
    it(`never steps on ${type} stages`, () => {
      for (const seed of [2, 989380427]) {
        const stage = generateStage(seed, stageIndexOf(type, 1));
        const field = new TerrainField(stage);
        const p = stage.path;
        const steps: string[] = [];
        for (let i = 2; i < p.count - 2; i += 4) {
          const d = i * p.spacing;
          if (stage.town && d > stage.town.from - 30 && d < stage.town.to + 30) continue;
          const lx = Math.cos(p.headings[i]!);
          const lz = -Math.sin(p.headings[i]!);
          for (const side of [1, -1]) {
            const h = (e: number) =>
              field.heightAt(p.xs[i]! + lx * e * side, p.zs[i]! + lz * e * side);
            let prev = NaN;
            for (let e = stage.halfWidth + 0.5; e <= stage.halfWidth + 26; e += STEP) {
              const y = h(e);
              const change = y - prev;
              prev = y;
              if (!(Math.abs(change) > STEEP)) continue;
              // Steep here: a slope spreads its change over the interval, a step keeps it in one sliver.
              let sliver = 0;
              for (let k = 0; k < SPLIT; k++) {
                const a0 = e - STEP + (STEP * k) / SPLIT;
                sliver = Math.max(sliver, Math.abs(h(a0 + STEP / SPLIT) - h(a0)));
              }
              if (sliver > STEP_SLIVER)
                steps.push(
                  `${seed} ${Math.round(d)}${side > 0 ? 'L' : 'R'} ${e.toFixed(2)}: ${sliver.toFixed(2)}`,
                );
            }
          }
        }
        expect(steps).toEqual([]);
      }
    }, 30_000);
});
