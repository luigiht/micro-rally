'use client';

import Image from 'next/image';
import { useState } from 'react';
import { fill } from '@/i18n/format';
import { useMessages } from '@/i18n/useMessages';
import { CAMERA_VIEWS, landingAsset, twoDigits } from './landingContent';

/**
 * The four camera views as tabs over their screenshots, which crossfade in
 * one frame as the tab or the arrows change. Follows the controls in the
 * page's controls section.
 */
export function LandingCameras() {
  const m = useMessages();
  const t = m.landing.cameras;
  const [active, setActive] = useState(0);
  const count = t.names.length;
  const step = (d: number) => setActive((i) => (i + d + count) % count);

  return (
    <div className="content-section camera-layout">
      <div className="camera-copy">
        <h3>{t.title}</h3>
        <p>{t.body}</p>
        <div className="camera-tabs" role="tablist" aria-label={t.tabsLabel}>
          {t.names.map((name, i) => (
            <button
              type="button"
              key={name}
              className={i === active ? 'active' : ''}
              onClick={() => setActive(i)}
              role="tab"
              aria-selected={i === active}
            >
              <span>{twoDigits(i + 1)}</span>
              {name}
            </button>
          ))}
        </div>
      </div>
      <div className="camera-media">
        <div className="camera-frame">
          {/* All four stacked, the active one shown, so switching never waits on a download. */}
          {CAMERA_VIEWS.map((view, i) => (
            <Image
              key={view}
              className={i === active ? 'active' : ''}
              src={landingAsset(`camera-${view}.webp`)}
              alt={i === active ? fill(t.alt, { name: t.names[i]! }) : ''}
              aria-hidden={i !== active}
              width={1600}
              height={1040}
              sizes="(max-width: 950px) 90vw, 640px"
            />
          ))}
        </div>
        <div className="camera-caption">
          <div>
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
    </div>
  );
}
