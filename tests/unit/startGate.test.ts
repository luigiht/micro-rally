import { Mesh, type MeshStandardMaterial, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import {
  CONTROL_BOARD_LEAD,
  MARKER_CLEARANCE,
  controlBoardSkip,
  markerDistances,
} from '@/game/stage/RoadMarkers';
import { STAGE_TYPES } from '@/game/stage/regions';
import { generateStage } from '@/game/stage/StageGenerator';
import { TerrainField } from '@/game/stage/TerrainField';
import { GateBuilder } from '@/render/stage/GateBuilder';
import { themeHex } from '@/render/theme/themeColor';
import { dayTheme } from '@/render/theme/WorldTheme';
import { stageIndexOf } from './stageIndex';

function meshesOf(root: Object3D, hex: string): Mesh[] {
  const out: Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof Mesh && (o.material as MeshStandardMaterial).color.getHexString() === hex)
      out.push(o);
  });
  return out;
}

describe('the start and finish gates', () => {
  const build = (index: number) => {
    const stage = generateStage(1, index);
    const theme = dayTheme(STAGE_TYPES[stage.stageType]).gates;
    const gates = new GateBuilder(stage, new TerrainField(stage), theme);
    const find = (c: Parameters<typeof themeHex>[0]) =>
      meshesOf(gates.group, themeHex(c).slice(1).toLowerCase());
    return { gates, theme, find };
  };

  it('give an open stage’s start and finish each a pair of red-disc boards', () => {
    const { gates, theme, find } = build(stageIndexOf('pinewood'));
    // Two boards per line. A start board's stopwatch has a red face inside its rim on top of the
    // red disc; a finish board's flag flies on the red disc alone.
    expect(find(theme.startDisc)).toHaveLength(2 * 2 + 2 * 1);
    gates.dispose();
  });

  it('give a circuit’s start/finish gantry no boards, as it is crossed every lap', () => {
    const { gates, theme, find } = build(stageIndexOf('circuit'));
    expect(find(theme.startDisc)).toHaveLength(0);
    gates.dispose();
  });
});

describe('marker posts round the start and finish', () => {
  it('drop the pair that would stand behind a line’s boards', () => {
    expect(markerDistances(100, [], [controlBoardSkip(30)])).toEqual([10, 50, 70, 90]);
  });

  it('keep clear of the start and finish boards on every generated open stage', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const stage = generateStage(seed, stageIndexOf('forest'));
      const finish = stage.gates.find((g) => g.kind === 'finish')!.distance;
      const lines = [stage.startDistance, finish];
      const posts = markerDistances(stage.path.length, stage.gates, lines.map(controlBoardSkip));
      for (const line of lines)
        for (const d of posts)
          expect(Math.abs(d - (line - CONTROL_BOARD_LEAD))).toBeGreaterThanOrEqual(
            MARKER_CLEARANCE,
          );
    }
  });
});
