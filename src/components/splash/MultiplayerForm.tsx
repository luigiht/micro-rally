'use client';

import { useState, type FormEvent } from 'react';
import {
  SESSION_LENGTHS,
  SESSION_STAGE_TYPES,
  type SessionLength,
} from '@/game/multiplayer/Session';
import { formatGameId, isValidGameId, normalizeGameId } from '@/game/save/GameId';
import { DRIVER_NAME_MAX, sanitizeDriverName } from '@/game/save/SaveFile';
import { fill } from '@/i18n/format';
import { useMessages } from '@/i18n/useMessages';
import { readSessionParam, SessionApiError } from '@/lib/multiplayer/SessionClient';
import type { StageTypeId } from '@/game/stage/regions';
import { enterSession, getSessionClient, getSessionSeats } from '@/state/sessionStore';
import { StageTypePicker } from './StageTypePicker';

/** The form's two tabs, in order. */
const CHOICES = ['create', 'join'] as const;

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

/**
 * Multiplayer on the splash: a driver name, then start a new session (how
 * many stages, and which stage types they cycle through) or join one by its
 * Session ID. Each driver picks their car in the lobby.
 */
export function MultiplayerForm() {
  const m = useMessages();
  const [initial] = useState(readPrefill);
  const [choice, setChoice] = useState<Choice>(initial.choice);
  const [name, setName] = useState(initial.name);
  const [id, setId] = useState(initial.id);
  const [stageCount, setStageCount] = useState<SessionLength>(SESSION_LENGTHS[0]);
  const [types, setTypes] = useState<ReadonlySet<StageTypeId>>(() => new Set(SESSION_STAGE_TYPES));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typedName = sanitizeDriverName(name);
  const pick = (c: Choice) => {
    setChoice(c);
    setError(null);
  };
  const holdsSeat = choice === 'join' && isValidGameId(id) && getSessionSeats().get(id) !== null;
  const canSubmit =
    !busy &&
    (choice === 'create'
      ? typedName !== '' && types.size > 0
      : isValidGameId(id) && (holdsSeat || typedName !== ''));

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
        const picked = SESSION_STAGE_TYPES.filter((t) => types.has(t));
        const { session, seat } = await client.create(typedName, stageCount, picked);
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

      <div role="tablist" aria-label={m.session.choiceLabel} className="pixel-tabs">
        {CHOICES.map((c, index) => (
          <button
            key={c}
            id={`session-tab-${c}`}
            type="button"
            role="tab"
            aria-selected={choice === c}
            aria-controls="session-panel"
            tabIndex={choice === c ? 0 : -1}
            onClick={() => pick(c)}
            onKeyDown={(e) => {
              // Arrow keys (and Home / End) move between the two tabs, as in any tab list.
              const next =
                e.key === 'ArrowRight' || e.key === 'ArrowLeft'
                  ? CHOICES[(index + 1) % CHOICES.length]!
                  : e.key === 'Home'
                    ? CHOICES[0]!
                    : e.key === 'End'
                      ? CHOICES[CHOICES.length - 1]!
                      : null;
              if (!next) return;
              e.preventDefault();
              pick(next);
              document.getElementById(`session-tab-${next}`)?.focus();
            }}
            className="pixel-tab"
          >
            {c === 'create' ? m.session.newTab : m.session.joinTab}
          </button>
        ))}
      </div>

      <div
        id="session-panel"
        role="tabpanel"
        aria-labelledby={`session-tab-${choice}`}
        className="space-y-5"
      >
        {choice === 'create' ? (
          <>
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
            <StageTypePicker picked={types} onChange={setTypes} />
          </>
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
      </div>

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
