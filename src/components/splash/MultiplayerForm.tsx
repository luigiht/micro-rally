'use client';

import { useState, type FormEvent } from 'react';
import { CATALOG_IDS, type CatalogCarId } from '@/game/economy/cars';
import { SESSION_LENGTHS, type SessionLength } from '@/game/multiplayer/Session';
import { formatGameId, isValidGameId, normalizeGameId } from '@/game/save/GameId';
import { DRIVER_NAME_MAX, sanitizeDriverName } from '@/game/save/SaveFile';
import { fill } from '@/i18n/format';
import { useMessages } from '@/i18n/useMessages';
import { readSessionParam, SessionApiError } from '@/lib/multiplayer/SessionClient';
import { enterSession, getSessionClient, getSessionSeats } from '@/state/sessionStore';

type Choice = 'create' | 'join';

interface Prefill {
  choice: Choice;
  id: string;
  name: string;
}

/** A shared link (`?session=`) or the last session on this device opens Join with its ID; otherwise New session. */
function readPrefill(): Prefill {
  const seats = getSessionSeats();
  const linked = readSessionParam(window.location.search);
  const id = linked ?? seats.lastSessionId ?? '';
  return { choice: linked ? 'join' : 'create', id, name: seats.lastName };
}

/** Multiplayer on the splash: a driver name, then start a new session or join one by its Session ID. */
export function MultiplayerForm() {
  const m = useMessages();
  const [initial] = useState(readPrefill);
  const [choice, setChoice] = useState<Choice>(initial.choice);
  const [name, setName] = useState(initial.name);
  const [id, setId] = useState(initial.id);
  const [stageCount, setStageCount] = useState<SessionLength>(SESSION_LENGTHS[0]);
  const [carId, setCarId] = useState<CatalogCarId>('hatchback');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typedName = sanitizeDriverName(name);
  const holdsSeat = choice === 'join' && isValidGameId(id) && getSessionSeats().get(id) !== null;
  const canSubmit =
    !busy &&
    (choice === 'create' ? typedName !== '' : isValidGameId(id) && (holdsSeat || typedName !== ''));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const client = getSessionClient();
    const seats = getSessionSeats();
    if (typedName) seats.lastName = typedName;
    try {
      if (choice === 'create') {
        const { session, seat } = await client.create(typedName, stageCount, carId);
        enterSession(session, seat);
        return;
      }
      const seat = seats.get(id);
      const session = seat ? await client.get(id) : null;
      if (session && seat && session.players.some((p) => p.id === seat.playerId)) {
        enterSession(session, seat);
        return;
      }
      const joined = await client.join(id, typedName);
      enterSession(joined.session, joined.seat);
    } catch (err) {
      setError(err instanceof SessionApiError ? err.code : 'unavailable');
      setBusy(false);
    }
  };

  const errorText =
    error === 'not_found'
      ? fill(m.session.notFound, { id: formatGameId(id) })
      : error === 'full'
        ? fill(m.session.full, { id: formatGameId(id) })
        : error
          ? m.session.unavailable
          : null;

  let submitLabel = choice === 'create' ? m.session.create : m.session.join;
  if (holdsSeat) submitLabel = m.session.rejoin;
  if (busy) submitLabel = m.session.busy;

  return (
    <form className="mt-6 space-y-5" onSubmit={submit} noValidate>
      <div>
        <label htmlFor="session-driver-name" className="block font-pixel text-xs">
          {m.splash.nameLabel}
        </label>
        <input
          id="session-driver-name"
          className="pixel-input mt-2 w-full"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          maxLength={DRIVER_NAME_MAX}
          placeholder={m.splash.namePlaceholder}
          autoComplete="nickname"
          autoFocus
        />
      </div>

      <div role="group" aria-label={m.session.choiceLabel} className="grid grid-cols-2 gap-3">
        {(['create', 'join'] as const).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={choice === c}
            onClick={() => {
              setChoice(c);
              setError(null);
            }}
            className={`${choice === c ? 'pixel-btn' : 'pixel-btn-ghost'} px-2 text-[10px]`}
          >
            {c === 'create' ? m.session.newTab : m.session.joinTab}
          </button>
        ))}
      </div>

      {choice === 'create' ? (
        <div className="grid grid-cols-[auto_1fr] gap-3">
          <div>
            <label htmlFor="session-stages" className="block font-pixel text-xs">
              {m.session.stagesLabel}
            </label>
            <select
              id="session-stages"
              className="pixel-select mt-2 w-full"
              value={stageCount}
              onChange={(e) => setStageCount(Number(e.target.value) as SessionLength)}
            >
              {SESSION_LENGTHS.map((n) => (
                <option key={n} value={n}>
                  {fill(m.session.stagesOption, { n })}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label htmlFor="session-car" className="block font-pixel text-xs">
              {m.session.carLabel}
            </label>
            <select
              id="session-car"
              className="pixel-select mt-2 w-full"
              value={carId}
              onChange={(e) => setCarId(e.target.value as CatalogCarId)}
            >
              {CATALOG_IDS.map((car) => (
                <option key={car} value={car}>
                  {m.cars[car].name}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div>
          <label htmlFor="session-id" className="block font-pixel text-xs">
            {m.session.idLabel}
          </label>
          <input
            id="session-id"
            className="pixel-input mt-2 w-full"
            value={formatGameId(id)}
            onChange={(e) => {
              setId(normalizeGameId(e.target.value));
              setError(null);
            }}
            placeholder={m.session.idPlaceholder}
            maxLength={9}
            aria-invalid={error === 'not_found' || error === 'full' || undefined}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
      )}

      {errorText && (
        <p role="alert" className="pixel-box-dark p-3 text-sm">
          {errorText}
        </p>
      )}

      <button type="submit" className="pixel-btn w-full" disabled={!canSubmit}>
        {submitLabel}
      </button>
    </form>
  );
}
