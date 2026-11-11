import { describe, expect, it } from 'vitest';
import {
  calendarSlot,
  cycleSlot,
  generateStage,
  stageAtDusk,
  stageBrief,
  stageHasTown,
  stageTypeAt,
} from '@/game/stage/StageGenerator';

describe('stage slots', () => {
  it('keeps the career calendar exactly as it was', () => {
    for (let i = 0; i < 40; i++) {
      const slot = calendarSlot(i);
      expect(slot.stageType).toBe(stageTypeAt(i).stageType);
      expect(slot.loop).toBe(stageTypeAt(i).loop);
      expect(slot.town).toBe(stageHasTown(i));
      expect(slot.dusk).toBe(stageAtDusk(i));
      expect(stageBrief(5, i, slot)).toEqual(stageBrief(5, i));
    }
  });

  it('cycles a session through its types, with towns and dusk on every third as in the calendar', () => {
    const types = ['forest', 'arctic'] as const;
    const slots = Array.from({ length: 9 }, (_, i) => cycleSlot(types, i));
    expect(slots.map((s) => s.stageType)).toEqual([
      'forest',
      'arctic',
      'forest',
      'arctic',
      'forest',
      'arctic',
      'forest',
      'arctic',
      'forest',
    ]);
    // Every third rally stage of a town-building type carries a town (Arctic builds none).
    expect(slots.map((s) => s.town)).toEqual([
      false,
      false,
      true,
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
    // Arctic runs every third of its own stages at dusk: its third is stage 6.
    expect(slots.map((s, i) => (s.dusk ? i : -1)).filter((i) => i >= 0)).toEqual([5]);
    expect(slots.map((s) => s.loop)).toEqual([0, 0, 0, 0, 0, 0, 1, 1, 1]);
  });

  it('builds a city or a circuit wherever a session puts one', () => {
    const city = generateStage(3, 1, cycleSlot(['urban'], 1));
    expect(city.stageType).toBe('urban');
    expect(city.town?.city).toBe(true);
    const circuit = generateStage(3, 0, cycleSlot(['circuit'], 0));
    expect(circuit.stageType).toBe('circuit');
    expect(circuit.circuit?.laps).toBeGreaterThan(1);
    expect(stageBrief(3, 0, cycleSlot(['circuit'], 0)).length).toBe(circuit.length);
  });
});
