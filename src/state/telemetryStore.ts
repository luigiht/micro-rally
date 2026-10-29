import { create } from 'zustand';
import type { Surface } from '@/game/vehicle/surfaces';

export interface Telemetry {
  fps: number;
  drawCalls: number;
  triangles: number;
  speedKmh: number;
  gear: number;
  rpm: number;
  surface: Surface;
  airborne: boolean;
  slip: number;
}

interface TelemetryState {
  telemetry: Telemetry;
  debugOpen: boolean;
  toggleDebug: () => void;
}

/** Published from the frame loop at ≤ 10 Hz; never per frame. */
export const useTelemetryStore = create<TelemetryState>()((set) => ({
  telemetry: {
    fps: 0,
    drawCalls: 0,
    triangles: 0,
    speedKmh: 0,
    gear: 1,
    rpm: 0,
    surface: 'tarmac',
    airborne: false,
    slip: 0,
  },
  debugOpen: false,
  toggleDebug: () => set((s) => ({ debugOpen: !s.debugOpen })),
}));
