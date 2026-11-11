'use client';

import { useMessages } from '@/i18n/useMessages';
import { useTelemetryStore } from '@/state/telemetryStore';

/**
 * Speed and gear readout: bottom right on desktop; on touch devices centred
 * between the pedal clusters, lined up with the pads' faces (see touchPad.ts).
 */
export function SpeedReadout() {
  const m = useMessages();
  const speed = useTelemetryStore((s) => Math.round(s.telemetry.speedKmh));
  const gear = useTelemetryStore((s) => s.telemetry.gear);
  return (
    <div
      className="pixel-box pointer-events-none absolute right-6 bottom-6 px-4 py-3 text-right font-pixel coarse:right-1/2 coarse:bottom-4 coarse:flex coarse:h-14 coarse:translate-x-1/2 coarse:flex-col coarse:justify-center coarse:px-3 coarse:py-0 coarse:text-center"
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
