'use client';

import dynamic from 'next/dynamic';
import { useMessages } from '@/i18n/useMessages';

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
    </>
  );
}
