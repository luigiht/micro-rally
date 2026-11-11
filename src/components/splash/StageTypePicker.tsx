'use client';

import { SESSION_STAGE_TYPES } from '@/game/multiplayer/Session';
import type { StageTypeId } from '@/game/stage/regions';
import { useMessages } from '@/i18n/useMessages';

interface StageTypePickerProps {
  picked: ReadonlySet<StageTypeId>;
  onChange: (next: Set<StageTypeId>) => void;
}

/** The stage types a new session cycles through, in turn: a checkbox each, at least one ticked. */
export function StageTypePicker({ picked, onChange }: StageTypePickerProps) {
  const m = useMessages();
  const toggle = (type: StageTypeId) => {
    const next = new Set(picked);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    onChange(next);
  };
  return (
    <fieldset>
      <legend className="font-pixel text-xs">{m.session.typesLabel}</legend>
      <p className="mt-1 text-xs text-ink/70">{m.session.typesHint}</p>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
        {SESSION_STAGE_TYPES.map((type) => (
          <label key={type} className="flex min-w-0 cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="pixel-checkbox"
              checked={picked.has(type)}
              onChange={() => toggle(type)}
            />
            <span className="truncate">{m.stageTypes[type]}</span>
          </label>
        ))}
      </div>
      {picked.size === 0 && (
        <p role="alert" className="mt-2 text-xs font-semibold">
          {m.session.typesNone}
        </p>
      )}
    </fieldset>
  );
}
