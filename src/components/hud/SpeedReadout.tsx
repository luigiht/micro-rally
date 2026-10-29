'use client';

import { useMessages } from '@/i18n/useMessages';
import { useTelemetryStore } from '@/state/telemetryStore';

/** Minimal speed + gear readout; the full HUD arrives in milestone 5. */
export function SpeedReadout() {
  const m = useMessages();
  const speed = useTelemetryStore((s) => Math.round(s.telemetry.speedKmh));
  const gear = useTelemetryStore((s) => s.telemetry.gear);
  return (
    <div
      className="pixel-box pointer-events-none absolute right-6 bottom-6 px-4 py-3 text-right font-pixel coarse:right-1/2 coarse:bottom-4 coarse:translate-x-1/2 coarse:px-3 coarse:py-2 coarse:text-center"
      data-testid="speed-readout"
    >
      <p className="text-3xl leading-none coarse:text-xl">
        {speed}
        <span className="ml-2 text-[10px]">{m.hud.kmh}</span>
      </p>
      <p className="mt-2 text-xs">
        {m.hud.gear} {gear === -1 ? m.hud.reverse : gear}
      </p>
    </div>
  );
}
