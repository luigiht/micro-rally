/**
 * Pure helpers behind the "install the app" banner on the splash. Browsers
 * differ: Chromium (Android) raises `beforeinstallprompt` and lets the page
 * open the install sheet itself; iOS never raises it, so there the banner can
 * only explain Share → Add to Home Screen. Neither is wanted once the game
 * already runs as an installed app, or on a desktop pointer.
 */

export type InstallPlatform = 'ios' | 'android' | 'other';

/** How long a dismissed banner stays away before it may be offered again. */
export const INSTALL_DISMISS_DAYS = 14;

export interface PlatformHints {
  userAgent: string;
  /** `navigator.platform`; iPadOS 13+ reports as a Mac, told apart by touch points. */
  platform?: string;
  maxTouchPoints?: number;
}

/** iPhone, iPod, iPad, and an iPad that calls itself a Mac. */
export function isIosDevice({
  userAgent,
  platform = '',
  maxTouchPoints = 0,
}: PlatformHints): boolean {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true;
  return platform === 'MacIntel' && maxTouchPoints > 1;
}

export function detectInstallPlatform(hints: PlatformHints): InstallPlatform {
  if (isIosDevice(hints)) return 'ios';
  if (/Android/i.test(hints.userAgent)) return 'android';
  return 'other';
}

/**
 * Whether a dismissed banner may show again: never within the cool-down, and
 * an unreadable timestamp counts as never dismissed.
 */
export function installPromptDue(dismissedAt: string | null, now: number): boolean {
  if (dismissedAt === null) return true;
  const at = Number(dismissedAt);
  if (!Number.isFinite(at)) return true;
  return now - at >= INSTALL_DISMISS_DAYS * 24 * 60 * 60 * 1000;
}
