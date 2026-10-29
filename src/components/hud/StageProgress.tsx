'use client';

import { useMessages } from '@/i18n/useMessages';
import { useStageHudStore } from '@/state/stageHudStore';
import { PixelIcon } from './PixelIcon';

/**
 * Stage progress down the left edge: start at the top, finish at the bottom,
 * a tick per checkpoint (paper once passed) and a pointer at the car.
 * Reads the 10 Hz HUD store; hidden on the free-roam test track.
 */
export function StageProgress() {
  const m = useMessages();
  const progress = useStageHudStore((s) => s.progress);
  const gates = useStageHudStore((s) => s.gateFractions);
  const passed = useStageHudStore((s) => s.gatesPassed);
  if (gates.length === 0) return null;
  const top = `${progress * 100}%`;
  return (
    <div
      role="progressbar"
      aria-label={m.stage.progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      data-testid="stage-progress"
      data-progress={progress.toFixed(4)}
      className="pointer-events-none absolute top-4 bottom-20 left-4 w-3 coarse:bottom-40"
    >
      <div className="pixel-tag absolute inset-0 overflow-hidden">
        <div className="absolute inset-x-0 top-0 bg-rally" style={{ height: top }} />
        {gates.slice(0, -1).map((g, i) => (
          <span
            key={g}
            className={`absolute inset-x-0 h-0.5 ${i < passed ? 'bg-paper' : 'bg-ink/50'}`}
            style={{ top: `calc(${g * 100}% - 1px)` }}
          />
        ))}
      </div>
      <span className="absolute left-full ml-0.5 -translate-y-1/2 text-ink" style={{ top }}>
        <PixelIcon name="pointer" />
      </span>
    </div>
  );
}
