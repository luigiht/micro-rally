'use client';

import { nextUpgradePrice, upgradeDef, upgradeLevel, UPGRADES } from '@/game/economy/upgrades';
import { fill, formatMoney } from '@/i18n/format';
import { useMessages } from '@/i18n/useMessages';
import { useGameStore } from '@/state/gameStore';
import { useSettingsStore } from '@/state/settingsStore';

/** One card per upgrade: level pips, blurb, price and a Buy button. */
export function GarageUpgrades() {
  const m = useMessages();
  const locale = useSettingsStore((s) => s.locale);
  const money = useGameStore((s) => s.money);
  const levels = useGameStore((s) => s.upgrades);
  return (
    <ul className="mt-4 grid gap-4 sm:grid-cols-2">
      {UPGRADES.map((def) => {
        const level = upgradeLevel(levels, def.id);
        const price = nextUpgradePrice(levels, def.id);
        const affordable = price !== null && price <= money;
        const text = m.upgrades[def.id];
        return (
          <li key={def.id} className="flex flex-col border-4 border-ink p-3">
            <h4 className="font-pixel text-[10px] leading-snug">{text.name}</h4>
            <p
              className="mt-1 flex gap-1"
              aria-label={fill(m.garage.level, { n: level, max: upgradeDef(def.id).maxLevel })}
            >
              {Array.from({ length: def.maxLevel }, (_, i) => (
                <span key={i} className={`size-2.5 ${i < level ? 'bg-rally' : 'bg-ink/20'}`} />
              ))}
            </p>
            <p className="mt-2 flex-1 text-xs text-ink/80">{text.desc}</p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="font-pixel text-[10px]">
                {price === null ? m.garage.maxed : formatMoney(price, locale)}
              </span>
              {price !== null && (
                <button
                  type="button"
                  disabled={!affordable}
                  onClick={() => useGameStore.getState().buyUpgrade(def.id)}
                  className="pixel-btn px-3 py-2 text-[10px]"
                >
                  {m.garage.buy}
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
