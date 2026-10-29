'use client';

import dynamic from 'next/dynamic';
import { useMessages } from '@/i18n/useMessages';
import { DebugOverlay } from '@/components/hud/DebugOverlay';
import { SpeedReadout } from '@/components/hud/SpeedReadout';
import { StageHud } from '@/components/hud/StageHud';
import { GameMenu } from '@/components/hud/GameMenu';

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
        <h1 className="font-pixel text-lg tracking-tight text-ink">{m.meta.title}</h1>
        <p className="mt-1 text-sm text-ink/70">{m.boot.tagline}</p>
      </header>
      <DebugOverlay />
      <SpeedReadout />
      <StageHud />
      <GameMenu />
    </>
  );
}
