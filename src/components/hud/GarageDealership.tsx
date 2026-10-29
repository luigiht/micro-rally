'use client';

import { CAR_CATALOG, carStats } from '@/game/economy/cars';
import { CAR_SPECS } from '@/game/vehicle/CarSpec';
import { formatMoney } from '@/i18n/format';
import { useMessages } from '@/i18n/useMessages';
import { useGameStore } from '@/state/gameStore';
import { useSettingsStore } from '@/state/settingsStore';

const LIVERY: Record<string, readonly string[]> = {
  hatchback: ['#e8623a', '#f4ecd8', '#e8623a'],
  coupe: ['#2f8f5b', '#ffffff', '#d9343a'],
};

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="w-14 text-ink/70">{label}</span>
      <span className="h-2 flex-1 bg-ink/15">
        <span className="block h-full bg-ink" style={{ width: `${Math.round(value * 100)}%` }} />
      </span>
    </div>
  );
}

/** One card per car: livery band, stats from the physics, price and Buy / Select. */
export function GarageDealership() {
  const m = useMessages();
  const locale = useSettingsStore((s) => s.locale);
  const money = useGameStore((s) => s.money);
  const owned = useGameStore((s) => s.ownedCars);
  const active = useGameStore((s) => s.carId);
  return (
    <ul className="mt-4 grid gap-4 sm:grid-cols-2">
      {CAR_CATALOG.map((car) => {
        const text = m.cars[car.id];
        const stats = carStats(CAR_SPECS[car.id]);
        const isOwned = owned.includes(car.id);
        const inUse = active === car.id;
        const affordable = car.price <= money;
        return (
          <li key={car.id} className="flex flex-col border-4 border-ink p-3">
            <div className="flex h-2" aria-hidden="true">
              {LIVERY[car.id]!.map((c, i) => (
                <span key={i} className="flex-1" style={{ background: c }} />
              ))}
            </div>
            <h4 className="mt-2 font-pixel text-[10px] leading-snug">{text.name}</h4>
            <p className="mt-2 flex-1 text-xs text-ink/80">{text.blurb}</p>
            <div className="mt-3 space-y-1">
              <StatBar label={m.garage.stats.power} value={stats.power} />
              <StatBar label={m.garage.stats.grip} value={stats.grip} />
              <StatBar label={m.garage.stats.agility} value={stats.agility} />
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="font-pixel text-[10px]">
                {isOwned ? m.garage.owned : formatMoney(car.price, locale)}
              </span>
              {inUse ? (
                <span className="font-pixel text-[10px] text-rally">{m.garage.inUse}</span>
              ) : isOwned ? (
                <button
                  type="button"
                  onClick={() => useGameStore.getState().selectCar(car.id)}
                  className="pixel-btn-ghost px-3 py-2 text-[10px]"
                >
                  {m.garage.select}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!affordable}
                  onClick={() => useGameStore.getState().buyCar(car.id)}
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
