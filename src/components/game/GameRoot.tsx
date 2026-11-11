'use client';

import dynamic from 'next/dynamic';
import { useMessages } from '@/i18n/useMessages';
import { DebugOverlay } from '@/components/hud/DebugOverlay';
import { HudToolbar } from '@/components/hud/HudToolbar';
import { SpeedReadout } from '@/components/hud/SpeedReadout';
import { StageHud } from '@/components/hud/StageHud';
import { StageProgress } from '@/components/hud/StageProgress';
import { TouchControls } from '@/components/hud/TouchControls';
import { SessionLobby } from '@/components/multiplayer/SessionLobby';
import { SplashScreen } from '@/components/splash/SplashScreen';
import { useGameStore } from '@/state/gameStore';
import { useSessionStore } from '@/state/sessionStore';
import { useUiStore } from '@/state/uiStore';
import { useAutosave } from './useAutosave';
import { useSessionLive } from './useSessionLive';
import { useSessionRunUpload } from './useSessionRunUpload';

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

/**
 * Canvas + HUD. H hides the HUD chrome for a clean view; dialogs, the
 * countdown and the touch controls stay. `session` swaps in multiplayer's
 * HUD: no money or garage, and the session's result and Game panels.
 */
function DriveView({ session = false }: { session?: boolean }) {
  const hidden = useUiStore((s) => s.hudHidden);
  return (
    <>
      <GameCanvas />
      <div className="hud-frame">
        {!hidden && <DebugOverlay />}
        {!hidden && <SpeedReadout />}
        <StageHud session={session} />
        {!hidden && <StageProgress />}
        <TouchControls />
        <HudToolbar session={session} />
      </div>
    </>
  );
}

/** Single player: the active game; autosaves while mounted. */
function GameShell() {
  useAutosave();
  return <DriveView />;
}

/**
 * Multiplayer: one stage of the session; the first finish is sent to the
 * server, and the other driver shows up live while they're on it too.
 */
function SessionDriveShell() {
  useSessionRunUpload();
  useSessionLive();
  return <DriveView session />;
}

export function GameRoot() {
  const solo = useGameStore((s) => s.gameId !== null);
  const sessionScreen = useSessionStore((s) => (s.session ? s.screen : null));
  if (solo) return <GameShell />;
  if (sessionScreen === 'drive') return <SessionDriveShell />;
  if (sessionScreen === 'lobby') return <SessionLobby />;
  return <SplashScreen />;
}
