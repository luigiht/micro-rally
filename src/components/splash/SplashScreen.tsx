'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useState, useSyncExternalStore, type FormEvent } from 'react';
import logo from '@assets/micro-rally-logo-dark.svg';
import { createGameId, formatGameId, isValidGameId, normalizeGameId } from '@/game/save/GameId';
import { DRIVER_NAME_MAX, sanitizeDriverName, type SaveFile } from '@/game/save/SaveFile';
import { fill } from '@/i18n/format';
import { useMessages } from '@/i18n/useMessages';
import { readGameParam, writeGameParam } from '@/lib/save/gameUrl';
import { useGameStore } from '@/state/gameStore';
import { getSaveManager } from '@/state/saveStore';
import { PixelIcon } from '@/components/hud/PixelIcon';
import { InfoDialog } from './InfoDialog';
import { SplashFooter } from './SplashFooter';

const SplashScene = dynamic(() => import('./SplashScene').then((m) => m.SplashScene), {
  ssr: false,
});

type Step = 'form' | 'checking' | 'not-found';

interface Prefill {
  /** Compact (dash-less) Game ID to show; empty for a new player. */
  id: string;
  name: string;
  /** A local save exists for `id`, so the button reads Continue. */
  returning: boolean;
}

/** From `?game=` or the last game on this device; otherwise an empty form. Client-only. */
function readPrefill(): Prefill {
  const manager = getSaveManager();
  const known = readGameParam(window.location.search) ?? manager.local.lastGameId;
  if (!known) return { id: '', name: '', returning: false };
  const local = manager.local.loadSync(known);
  return { id: known, name: local?.driverName ?? '', returning: local !== null };
}

function subscribeNoop(): () => void {
  return () => {};
}

/** False during SSR and hydration, true once the client owns the tree. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

function SplashForm() {
  const m = useMessages();
  const [initial] = useState(readPrefill);
  const [name, setName] = useState(initial.name);
  const [id, setId] = useState(initial.id);
  const [returning, setReturning] = useState(initial.returning);
  const [step, setStep] = useState<Step>('form');
  const [helpOpen, setHelpOpen] = useState(false);

  const typedName = sanitizeDriverName(name);
  const continuing = id !== '';
  const canSubmit = step !== 'checking' && (continuing ? isValidGameId(id) : typedName !== '');

  const begin = (save: SaveFile | null, gameId: string) => {
    const store = useGameStore.getState();
    if (save) store.loadGame(save, typedName || undefined);
    else store.startGame(gameId, typedName);
    getSaveManager().local.lastGameId = gameId;
    writeGameParam(gameId);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (!continuing) {
      begin(null, createGameId());
      return;
    }
    setStep('checking');
    const save = await getSaveManager().load(id);
    if (save) begin(save, id);
    else setStep('not-found');
  };

  const onIdChange = (value: string) => {
    setId(normalizeGameId(value));
    setReturning(false);
    setStep('form');
  };

  let submitLabel = returning ? m.splash.continue : m.splash.play;
  if (step === 'checking') submitLabel = m.splash.checking;
  const incomplete = continuing && !isValidGameId(id);

  return (
    <form className="mt-6 space-y-5" onSubmit={submit} noValidate>
      <div>
        <label htmlFor="driver-name" className="block font-pixel text-xs">
          {m.splash.nameLabel}
        </label>
        <input
          id="driver-name"
          className="pixel-input mt-2 w-full"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setStep('form');
          }}
          maxLength={DRIVER_NAME_MAX}
          placeholder={m.splash.namePlaceholder}
          autoComplete="nickname"
          autoFocus
        />
      </div>

      <div>
        <label htmlFor="game-id" className="block font-pixel text-xs">
          {m.splash.idLabel}
        </label>
        <div className="mt-2 flex gap-3">
          <input
            id="game-id"
            className="pixel-input min-w-0 flex-1"
            value={formatGameId(id)}
            onChange={(e) => onIdChange(e.target.value)}
            placeholder={m.splash.idPlaceholder}
            maxLength={9}
            aria-invalid={incomplete || step === 'not-found' || undefined}
            aria-describedby="game-id-hint"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
          <button
            type="button"
            aria-label={m.splash.idHelp}
            aria-haspopup="dialog"
            aria-expanded={helpOpen}
            onClick={() => setHelpOpen(true)}
            className="pixel-input-btn"
          >
            <PixelIcon name="help" />
          </button>
        </div>
        {/* Always described for assistive tech; sighted users open the ? dialog. */}
        <p id="game-id-hint" className="sr-only">
          {m.splash.idHint}
        </p>
        {helpOpen && (
          <InfoDialog
            id="game-id-help"
            title={m.splash.idLabel}
            closeLabel={m.game.close}
            onClose={() => setHelpOpen(false)}
          >
            {m.splash.idHint}
          </InfoDialog>
        )}
        {step === 'not-found' && (
          <p role="alert" className="pixel-box-dark mt-4 p-3 text-sm">
            {fill(m.splash.notFound, { id: formatGameId(id) })}
          </p>
        )}
      </div>

      <button type="submit" className="pixel-btn w-full" disabled={!canSubmit}>
        {submitLabel}
      </button>
    </form>
  );
}

/** Start screen over the attract-mode drive: driver name, optional Game ID to resume. */
export function SplashScreen() {
  const m = useMessages();
  const hydrated = useHydrated();
  return (
    <div className="absolute inset-0 overflow-hidden bg-ink">
      <SplashScene />
      {/* Darken the drive so the card reads; the scene stays visible around it. */}
      <div className="absolute inset-0 bg-ink/45" aria-hidden="true" />
      <div className="absolute inset-0 overflow-y-auto">
        <div className="grid min-h-full place-items-center px-4 pt-4 pb-20">
          <section aria-labelledby="splash-title" className="pixel-box w-full max-w-md p-6 md:p-8">
            <h1 id="splash-title">
              <Image
                src={logo}
                alt={m.meta.title}
                priority
                className="mx-auto block h-auto w-60 md:w-72"
              />
            </h1>
            {hydrated && <SplashForm />}
          </section>
        </div>
      </div>
      <SplashFooter />
    </div>
  );
}
