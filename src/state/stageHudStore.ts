import { create } from 'zustand';
import type { RunPhase } from '@/game/stage/StageRun';
import type { StageResult } from './gameStore';

export interface StageHudState {
  phase: RunPhase;
  countdown: number;
  time: number;
  gatesPassed: number;
  gateCount: number;
  penalties: number;
  hits: number;
  result: StageResult | null;
}

export const INITIAL_STAGE_HUD: StageHudState = {
  phase: 'countdown',
  countdown: 3,
  time: 0,
  gatesPassed: 0,
  gateCount: 0,
  penalties: 0,
  hits: 0,
  result: null,
};

/** Live stage readout, published from the frame loop at ≤ 10 Hz (plus on events). */
export const useStageHudStore = create<StageHudState>()(() => INITIAL_STAGE_HUD);
