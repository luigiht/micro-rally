import { describe, expect, it } from 'vitest';
import { useAutopilotStore } from '@/state/autopilotStore';
import { useGameStore } from '@/state/gameStore';

describe('autopilot demo', () => {
  it('starts an unsaved run of the picked car and stage type, with new roads each time', () => {
    const demo = useAutopilotStore.getState();
    demo.pick({ carId: 'buggy', stageType: 'coastal', kmh: 140 });
    demo.start();
    const first = useGameStore.getState();
    expect(useAutopilotStore.getState().running).toBe(true);
    expect(first).toMatchObject({
      gameId: null,
      stageIndex: 0,
      stageTypes: ['coastal'],
      carId: 'buggy',
      upgrades: {},
    });
    demo.start();
    expect(useGameStore.getState().gameSeed).not.toBe(first.gameSeed);

    demo.stop();
    expect(useAutopilotStore.getState().running).toBe(false);
    expect(useGameStore.getState().gameId).toBeNull();
    expect(useGameStore.getState().stageTypes).toBeNull();
  });

  it('hides and shows its window, and shows it again for the next run', () => {
    const demo = useAutopilotStore.getState();
    demo.start();
    demo.toggleWindow();
    expect(useAutopilotStore.getState().windowHidden).toBe(true);
    demo.toggleWindow();
    expect(useAutopilotStore.getState().windowHidden).toBe(false);
    demo.toggleWindow();
    demo.stop();
    expect(useAutopilotStore.getState().windowHidden).toBe(false);
  });
});
