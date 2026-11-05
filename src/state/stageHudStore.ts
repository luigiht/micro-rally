import { create } from 'zustand';
import type { RegionId } from '@/game/stage/regions';
import type { RunPhase } from '@/game/stage/StageRun';
import type { Surface } from '@/game/vehicle/surfaces';
import type { StageResult } from './gameStore';

export interface StageInfo {
  index: number;
  name: string;
  region: RegionId;
  surface: Surface;
  length: number;
  parTime: number;
  /** Laps in the race on a circuit; 0 on an open stage. */
  laps: number;
  /** One lap of a circuit, metres; 0 on an open stage. */
  lapLength: number;
}

export interface StageHudState {
  stage: StageInfo | null;
  phase: RunPhase;
  countdown: number;
  time: number;
  gatesPassed: number;
  gateCount: number;
  /** 0..1 along the stage, and where each gate sits on that scale. */
  progress: number;
  gateFractions: number[];
  penalties: number;
  hits: number;
  /** The lap being driven on a circuit (1-based), the completed laps' times and the fastest. */
  lap: number;
  lapTimes: number[];
  bestLap: number | null;
  result: StageResult | null;
}

export const INITIAL_STAGE_HUD: StageHudState = {
  stage: null,
  phase: 'countdown',
  countdown: 3,
  time: 0,
  gatesPassed: 0,
  gateCount: 0,
  progress: 0,
  gateFractions: [],
  penalties: 0,
  hits: 0,
  lap: 1,
  lapTimes: [],
  bestLap: null,
  result: null,
};

/** Live stage readout, published from the frame loop at ≤ 10 Hz (plus on events). */
export const useStageHudStore = create<StageHudState>()(() => INITIAL_STAGE_HUD);
