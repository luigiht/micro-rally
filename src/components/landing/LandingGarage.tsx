'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/components/game/usePrefersReducedMotion';
import { CAR_SPECS, carStats } from '@/game/economy/cars';
import { fill } from '@/i18n/format';
import { useMessages } from '@/i18n/useMessages';
import { LANDING_CARS, landingAsset, twoDigits } from './landingContent';

/** The car stills are 676 × 511. */
const CAR_W = 676;
const CAR_H = 511;
/** Load the 3D stage this far before the section scrolls into view. */
const PRELOAD_MARGIN = '400px 0px';

/** three.js and the car models load only when the garage is near; the page stays light until then. */
const LandingCarStage = dynamic(() => import('./LandingCarStage'), { ssr: false });

/**
 * Whether the element is within `margin` of the viewport, and whether it ever
 * has been: the stage mounts on the first approach and pauses while off screen.
 */
function useNearViewport(margin: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState({ near: false, seen: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        const near = entry?.isIntersecting ?? false;
        setState((s) => (s.near === near ? s : { near, seen: s.seen || near }));
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return [ref, state] as const;
}

/**
 * The garage showcase: one car large with its stat bars (the game's own
 * Power, Grip and Agility), turning live as the game's own model; drag or the
 * arrow keys turn it by hand. The name and arrows sit in a footer under
 * the car, and the arrows flip through the dealership. The car's still sits under the stage as its poster, and stays
 * if WebGL can't start.
 */
export function LandingGarage() {
  const m = useMessages();
  const t = m.landing.garage;
  const reduced = usePrefersReducedMotion();
  const [viewRef, view] = useNearViewport(PRELOAD_MARGIN);
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(false);
  const id = LANDING_CARS[active]!;
  const name = m.cars[id].name;
  const stats = carStats(CAR_SPECS[id]);
  const step = (d: number) => setActive((i) => (i + d + LANDING_CARS.length) % LANDING_CARS.length);

  return (
    <section id="garage" className="content-section garage">
      <div className={`garage-showcase ${ready ? 'live' : ''}`} ref={viewRef}>
        <Image
          className="active-car"
          src={landingAsset(`car-${id}.png`)}
          alt={ready ? '' : fill(t.alt, { name })}
          aria-hidden={ready}
          width={CAR_W}
          height={CAR_H}
          sizes="(max-width: 950px) 90vw, 676px"
        />
        {view.seen && (
          <LandingCarStage
            id={id}
            label={fill(t.stage, { name })}
            autoSpin={!reduced}
            active={view.near}
            onReady={() => setReady(true)}
          />
        )}
        <div className="specs">
          {(
            [
              [m.garage.stats.power, stats.power],
              [m.garage.stats.grip, stats.grip],
              [m.garage.stats.agility, stats.agility],
            ] as const
          ).map(([label, value]) => (
            <div className="spec" key={label}>
              <span>{label}</span>
              <i>
                <b style={{ width: `${Math.round(value * 100)}%` }} />
              </i>
            </div>
          ))}
        </div>
        {ready && (
          <span className="turn-hint" aria-hidden="true">
            {t.turn}
          </span>
        )}
        <div className="car-footer">
          <div className="car-name">
            <span>{t.types[id]}</span>
            <strong>{name}</strong>
          </div>
          <div className="car-controls">
            <button type="button" onClick={() => step(-1)} aria-label={t.prev}>
              <Image
                className="flip"
                src={landingAsset('icon-prev.svg')}
                alt=""
                width={20}
                height={20}
                unoptimized
              />
            </button>
            <span>
              {twoDigits(active + 1)} / {LANDING_CARS.length}
            </span>
            <button type="button" onClick={() => step(1)} aria-label={t.next}>
              <Image
                src={landingAsset('icon-next.svg')}
                alt=""
                width={20}
                height={20}
                unoptimized
              />
            </button>
          </div>
        </div>
      </div>
      <div className="garage-copy">
        <h2>
          <span>{t.top}</span>
          <strong>{t.bottom}</strong>
        </h2>
        <p>{t.body}</p>
      </div>
    </section>
  );
}
