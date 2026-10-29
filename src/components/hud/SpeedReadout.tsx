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
      className="pointer-events-none absolute right-4 bottom-4 rounded-xl bg-paper/85 px-4 py-2 text-right text-ink shadow"
      data-testid="speed-readout"
    >
      <p className="text-4xl leading-none font-black tabular-nums">
        {speed}
        <span className="ml-1 text-sm font-semibold">{m.hud.kmh}</span>
      </p>
      <p className="text-sm font-semibold">
        {m.hud.gear} {gear === -1 ? m.hud.reverse : gear}
      </p>
    </div>
  );
}
