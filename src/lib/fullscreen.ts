/**
 * Edge-to-edge play on Android. An installed app launches fullscreen via the
 * manifest; a browser tab can ask for the same with the Fullscreen API, which
 * needs a user gesture, so the splash calls it from the Drive tap. Only for
 * touch devices: a desktop player keeps their window as it is. iPhone Safari
 * has no element fullscreen, so the guard on the method quietly skips it.
 */

/** Whether this device is one where the game should take the whole screen. */
export function wantsFullscreen(): boolean {
  if (!window.matchMedia('(pointer: coarse)').matches) return false;
  if (window.matchMedia('(display-mode: fullscreen)').matches) return false;
  return typeof document.documentElement.requestFullscreen === 'function';
}

/** Call from a click handler. Failures (denied, unsupported) are ignored. */
export function enterGameFullscreen(): void {
  if (!wantsFullscreen()) return;
  document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
}

/** Back to the splash: give the system bars back. */
export function exitGameFullscreen(): void {
  if (document.fullscreenElement === null) return;
  document.exitFullscreen().catch(() => {});
}
