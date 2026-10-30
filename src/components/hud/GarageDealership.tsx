'use client';

import { useState, type KeyboardEvent } from 'react';
import { CAR_CATALOG, carStats } from '@/game/economy/cars';
import { CAR_SPECS } from '@/game/vehicle/CarSpec';
import { formatMoney } from '@/i18n/format';
import { useMessages } from '@/i18n/useMessages';
import { useGameStore } from '@/state/gameStore';
import { useSettingsStore } from '@/state/settingsStore';
import { CarPreview } from './CarPreview';
import { PixelIcon } from './PixelIcon';

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

/** Showroom carousel: a spinning 3D preview with prev/next, dots, and the car's card underneath. */
export function GarageDealership() {
  const m = useMessages();
  const locale = useSettingsStore((s) => s.locale);
  const money = useGameStore((s) => s.money);
  const owned = useGameStore((s) => s.ownedCars);
  const active = useGameStore((s) => s.carId);
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      CAR_CATALOG.findIndex((c) => c.id === active),
    ),
  );
  const car = CAR_CATALOG[index]!;
  const spec = CAR_SPECS[car.id];
  const text = m.cars[car.id];
  const stats = carStats(spec);
  const isOwned = owned.includes(car.id);
  const inUse = active === car.id;
  const affordable = car.price <= money;
  const step = (d: number) => setIndex((i) => (i + d + CAR_CATALOG.length) % CAR_CATALOG.length);
  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
    else return;
    e.preventDefault();
  };

  return (
    <section
      role="region"
      aria-roledescription="carousel"
      aria-label={m.garage.tabs.dealership}
      onKeyDown={onKey}
      className="mt-4"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={m.garage.prev}
          onClick={() => step(-1)}
          className="pixel-btn-ghost shrink-0 p-3"
        >
          <PixelIcon name="left" />
        </button>
        <div className="min-w-0 flex-1 border-4 border-ink">
          <CarPreview spec={spec} />
        </div>
        <button
          type="button"
          aria-label={m.garage.next}
          onClick={() => step(1)}
          className="pixel-btn-ghost shrink-0 p-3"
        >
          <PixelIcon name="right" />
        </button>
      </div>
      <div className="mt-3 flex justify-center gap-2">
        {CAR_CATALOG.map((c, i) => (
          <button
            key={c.id}
            type="button"
            aria-label={m.cars[c.id].name}
            aria-current={i === index ? 'true' : undefined}
            onClick={() => setIndex(i)}
            className={`size-3 ${i === index ? 'bg-rally' : 'bg-ink/30'}`}
          />
        ))}
      </div>
      <div className="mt-4 border-4 border-ink p-3" aria-live="polite" data-testid="car-details">
        <h4 className="font-pixel text-[10px] leading-snug">{text.name}</h4>
        <p className="mt-2 text-xs text-ink/80">{text.blurb}</p>
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
      </div>
    </section>
  );
}
