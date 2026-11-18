'use client';

import { useState, useSyncExternalStore } from 'react';
import { landingAsset } from './landingContent';

/** Where the hero plays its video: wide enough to show it, and motion welcome. */
const VIDEO_QUERY = '(min-width: 621px) and (prefers-reduced-motion: no-preference)';

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(VIDEO_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/** Data saver on (where the browser says so): keep the still image. */
function savesData(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

/**
 * The hero's gameplay loop, over the still image it replaces: a silent
 * H.264 MP4 (1280×834, 30 fps, 7.7 MB) that fades in once it is actually
 * playing, so a browser that can't play it keeps the image. Phones, reduced
 * motion and data saver never load it. Not rendered on the server.
 */
export function HeroVideo() {
  const wanted = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(VIDEO_QUERY).matches && !savesData(),
    () => false,
  );
  const [playing, setPlaying] = useState(false);
  if (!wanted) return null;
  return (
    <video
      className={`hero-video ${playing ? 'playing' : ''}`}
      src={landingAsset('hero.mp4')}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      disablePictureInPicture
      onPlaying={() => setPlaying(true)}
    />
  );
}
