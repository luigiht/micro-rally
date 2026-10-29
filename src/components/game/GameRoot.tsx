'use client';

import dynamic from 'next/dynamic';
import { useMessages } from '@/i18n/useMessages';
import { DebugOverlay } from '@/components/hud/DebugOverlay';
import { SpeedReadout } from '@/components/hud/SpeedReadout';

const GameCanvas = dynamic(() => import('./GameCanvas').then((m) => m.GameCanvas), {
  ssr: false,
  loading: () => <BootMessage />,
});

function BootMessage() {
  const m = useMessages();
  return (
    <p role="status" className="absolute inset-0 grid place-items-center text-lg">
      {m.boot.loading}
    </p>
  );
}

export function GameRoot() {
  const m = useMessages();
  return (
    <>
      <GameCanvas />
      <header className="pointer-events-none absolute top-4 left-4">
        <h1 className="text-2xl font-black tracking-tight text-ink">{m.meta.title}</h1>
        <p className="text-sm text-ink/70">{m.boot.tagline}</p>
      </header>
      <DebugOverlay />
      <SpeedReadout />
      <p className="pointer-events-none absolute bottom-4 left-4 rounded-md bg-paper/80 px-2 py-1 text-xs text-ink">
        {m.hud.controlsHint}
      </p>
    </>
  );
}
