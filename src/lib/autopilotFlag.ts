/** The autopilot's speed when `?autopilot` carries none, km/h. */
export const DEFAULT_AUTOPILOT_KMH = 108;

/**
 * Development aid: `?autopilot` lets the car drive itself down the stage (for
 * recordings and demos), at up to `?autopilot=<km/h>`. Null without the flag
 * and always in production. Read once when the module loads, before the app
 * rewrites the URL with the Game ID.
 */
export const DEV_AUTOPILOT_KMH: number | null = (() => {
  if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('autopilot');
  if (raw === null) return null;
  const kmh = Number(raw);
  return Number.isFinite(kmh) && kmh > 0 ? kmh : DEFAULT_AUTOPILOT_KMH;
})();
