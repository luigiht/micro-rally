'use client';

import { useMessages } from '@/i18n/useMessages';
import { useTelemetryStore } from '@/state/telemetryStore';

function DebugPanel() {
  const m = useMessages();
  const t = useTelemetryStore((s) => s.telemetry);
  const rows: [string, string][] = [
    [m.debug.fps, String(t.fps)],
    [m.debug.drawCalls, String(t.drawCalls)],
    [m.debug.triangles, t.triangles.toLocaleString()],
    [m.debug.speed, `${t.speedKmh.toFixed(1)} ${m.hud.kmh}`],
    [m.debug.rpm, t.rpm.toFixed(0)],
    [m.debug.surface, m.surfaces[t.surface]],
    [m.debug.airborne, t.airborne ? m.debug.yes : m.debug.no],
    [m.debug.slip, t.slip.toFixed(2)],
  ];
  return (
    <section
      aria-label={m.debug.title}
      className="pointer-events-none absolute top-20 left-4 rounded-md bg-ink/80 px-3 py-2 font-mono text-xs text-paper"
    >
      <dl className="grid grid-cols-[auto_auto] gap-x-3">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="opacity-70">{k}</dt>
            <dd className="text-right tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function DebugOverlay() {
  const open = useTelemetryStore((s) => s.debugOpen);
  return open ? <DebugPanel /> : null;
}
