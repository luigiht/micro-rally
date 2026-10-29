'use client';

import { useState, type KeyboardEvent } from 'react';
import { formatMoney } from '@/i18n/format';
import { useMessages } from '@/i18n/useMessages';
import { useGameStore } from '@/state/gameStore';
import { useSettingsStore } from '@/state/settingsStore';
import { useUiStore } from '@/state/uiStore';
import { GarageDealership } from './GarageDealership';
import { GarageUpgrades } from './GarageUpgrades';
import { HudDialog } from './HudDialog';

const TABS = ['upgrades', 'dealership'] as const;
type Tab = (typeof TABS)[number];

/** The Garage: Upgrades (default) and Dealership tabs. Purchases apply on the next run. */
export function GaragePanel() {
  const m = useMessages();
  const locale = useSettingsStore((s) => s.locale);
  const money = useGameStore((s) => s.money);
  const [tab, setTab] = useState<Tab>('upgrades');

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next =
      TABS[(TABS.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]!;
    setTab(next);
    document.getElementById(`garage-tab-${next}`)?.focus();
  };

  return (
    <HudDialog
      id="garage-panel"
      title={m.garage.title}
      subtitle={`${m.stage.money} ${formatMoney(money, locale)} · ${m.garage.hint}`}
      closeLabel={m.game.close}
      onClose={() => useUiStore.getState().closePanel()}
    >
      <div
        role="tablist"
        aria-label={m.garage.title}
        className="mt-5 flex gap-3"
        onKeyDown={onTabKey}
      >
        {TABS.map((t) => (
          <button
            key={t}
            id={`garage-tab-${t}`}
            role="tab"
            type="button"
            aria-selected={tab === t}
            aria-controls={`garage-panel-${t}`}
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
            className={`${tab === t ? 'pixel-btn' : 'pixel-btn-ghost'} flex-1`}
          >
            {m.garage.tabs[t]}
          </button>
        ))}
      </div>
      <div id={`garage-panel-${tab}`} role="tabpanel" aria-labelledby={`garage-tab-${tab}`}>
        {tab === 'upgrades' ? <GarageUpgrades /> : <GarageDealership />}
      </div>
    </HudDialog>
  );
}
