import { describe, expect, it } from 'vitest';
import {
  INSTALL_DISMISS_DAYS,
  detectInstallPlatform,
  installPromptDue,
  isIosDevice,
} from '@/lib/installPrompt';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const IPAD_AS_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const PIXEL =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
const DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

describe('detectInstallPlatform', () => {
  it('recognises iPhones by user agent', () => {
    expect(detectInstallPlatform({ userAgent: IPHONE })).toBe('ios');
  });

  it('recognises an iPad that reports as a Mac by its touch points', () => {
    const hints = { userAgent: IPAD_AS_MAC, platform: 'MacIntel', maxTouchPoints: 5 };
    expect(isIosDevice(hints)).toBe(true);
    expect(detectInstallPlatform(hints)).toBe('ios');
  });

  it('leaves a real Mac alone', () => {
    expect(
      detectInstallPlatform({ userAgent: IPAD_AS_MAC, platform: 'MacIntel', maxTouchPoints: 0 }),
    ).toBe('other');
  });

  it('recognises Android and nothing else', () => {
    expect(detectInstallPlatform({ userAgent: PIXEL })).toBe('android');
    expect(detectInstallPlatform({ userAgent: DESKTOP })).toBe('other');
  });
});

describe('installPromptDue', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const now = 1_800_000_000_000;

  it('is due when never dismissed or the record is garbage', () => {
    expect(installPromptDue(null, now)).toBe(true);
    expect(installPromptDue('yesterday', now)).toBe(true);
  });

  it('waits out the cool-down after a dismissal', () => {
    expect(installPromptDue(String(now - DAY), now)).toBe(false);
    expect(installPromptDue(String(now - (INSTALL_DISMISS_DAYS - 1) * DAY), now)).toBe(false);
    expect(installPromptDue(String(now - INSTALL_DISMISS_DAYS * DAY), now)).toBe(true);
  });
});
