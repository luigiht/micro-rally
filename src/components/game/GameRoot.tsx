'use client';

import dynamic from 'next/dynamic';
import { useMessages } from '@/i18n/useMessages';
import { DebugOverlay } from '@/components/hud/DebugOverlay';
import { HudToolbar } from '@/components/hud/HudToolbar';
import { SpeedReadout } from '@/components/hud/SpeedReadout';
import { StageHud } from '@/components/hud/StageHud';
import { StageProgress } from '@/components/hud/StageProgress';
import { TouchControls } from '@/components/hud/TouchControls';
import { SplashScreen } from '@/components/splash/SplashScreen';
import { useGameStore } from '@/state/gameStore';
import { useAutosave } from './useAutosave';

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

/** Canvas + HUD for the active game; autosaves while mounted. */
function GameShell() {
  useAutosave();
  return (
    <>
      <GameCanvas />
      <div className="hud-frame">
        <DebugOverlay />
        <SpeedReadout />
        <StageHud />
        <StageProgress />
        <TouchControls />
        <HudToolbar />
      </div>
    </>
  );
}

export function GameRoot() {
  const active = useGameStore((s) => s.gameId !== null);
  return active ? <GameShell /> : <SplashScreen />;
}
