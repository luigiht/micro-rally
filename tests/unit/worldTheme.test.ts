import { describe, expect, it } from 'vitest';
import { REGIONS } from '@/game/stage/regions';
import {
  CAP_COLOR,
  KERB_COLOR,
  LINE_COLOR,
  PAVEMENT_COLOR,
  POST_COLOR,
  ROAD_COLORS,
} from '@/render/road/roadColors';
import { themeColor, themeGlow, themeHex } from '@/render/theme/themeColor';
import { dayTheme, flatTheme, NIGHTCITY_THEME, type ThemeColor } from '@/render/theme/WorldTheme';

const HEX = /^#[0-9a-f]{6}$/i;

/** Every string or `{hex, glow}` leaf in a theme. */
function colours(value: unknown, out: ThemeColor[] = []): ThemeColor[] {
  if (typeof value === 'string') {
    if (value.startsWith('#')) out.push(value);
  } else if (value && typeof value === 'object') {
    if ('hex' in value && 'glow' in value) out.push(value as ThemeColor);
    else for (const v of Object.values(value)) colours(v, out);
  }
  return out;
}

describe('WorldTheme', () => {
  it('the day theme reproduces the daytime constants for every region', () => {
    for (const region of Object.values(REGIONS)) {
      const t = dayTheme(region);
      expect(t.id).toBe('day');
      expect(t.lighting).toEqual({
        background: region.palette.sky,
        fog: region.palette.fog,
        fogNear: 70,
        fogFar: 260,
        hemiSky: '#fff6e0',
        hemiGround: '#7fa05f',
        hemiIntensity: 1.9,
        sunColor: '#ffffff',
        sunIntensity: 2.6,
      });
      expect(t.terrain).toEqual({ mode: 'palette' });
      expect(t.road.surfaces).toBe(ROAD_COLORS);
      expect(t.road.surface).toBeNull();
      expect(t.road.snowPatches).toBe(true);
      expect(t.road.verge).toBe(region.palette.shoulder);
      expect(t.road.line).toBe(LINE_COLOR);
      expect(t.road.pavement).toBe(PAVEMENT_COLOR);
      expect(t.road.kerb).toBe(KERB_COLOR);
      expect(t.road.post).toBe(POST_COLOR);
      expect(t.road.cap).toBe(CAP_COLOR);
      expect(t.road.neon).toBe(false);
      expect(t.gates.start.map(themeGlow)).toEqual([0.25, 0.25]);
      expect(t.gates.finish.map(themeGlow)).toEqual([0, 0]);
      expect(t.walls).toEqual({ body: '#c9c0b0', cap: '#e3dccf' });
      expect(t.scenery.kit).toBe('rally');
      expect(t.skidInk).toBeNull();
      // Memoised, so the renderer can compare themes by identity.
      expect(dayTheme(region)).toBe(t);
    }
  });

  it('the flat theme is the day theme with its own sky and fog', () => {
    const t = flatTheme('#cfe3e8', '#dde');
    expect(t.id).toBe('day');
    expect(t.lighting.background).toBe('#cfe3e8');
    expect(t.lighting.fog).toBe('#dde');
    expect(t.lighting.sunIntensity).toBe(2.6);
  });

  it('Nightcity is dark with HDR neon on lines, kerbs, caps, tiles and tyre marks', () => {
    const t = NIGHTCITY_THEME;
    expect(t.id).toBe('nightcity');
    expect(t.terrain.mode).toBe('flat');
    expect(t.road.neon).toBe(true);
    expect(t.road.snowPatches).toBe(false);
    expect(t.road.surface).not.toBeNull();
    expect(t.scenery.kit).toBe('nightcity');
    for (const c of [t.road.line, t.road.kerb, t.road.cap, ...t.gates.start, ...t.gates.finish]) {
      expect(themeGlow(c)).toBeGreaterThan(1);
      const rgb = themeColor(c);
      expect(Math.max(rgb.r, rgb.g, rgb.b)).toBeGreaterThan(1);
    }
    expect(t.skidInk).not.toBeNull();
    expect(themeGlow(t.skidInk!.color)).toBeGreaterThan(1);
    // A moon, not a sun: well under the daytime 2.6.
    expect(t.lighting.sunIntensity).toBeLessThan(1.5);
    expect(t.lighting.fogFar).toBeLessThan(260);
  });

  it('every colour in every theme is a six-digit hex', () => {
    const themes = [...Object.values(REGIONS).map(dayTheme), NIGHTCITY_THEME];
    for (const t of themes) {
      const list = colours(t);
      expect(list.length).toBeGreaterThan(20);
      for (const c of list) expect(themeHex(c)).toMatch(HEX);
    }
  });

  it('themeColor bakes glow above one and leaves faint glow lit', () => {
    expect(themeColor('#ffffff').r).toBe(1);
    expect(themeColor({ hex: '#ffffff', glow: 0.25 }).r).toBe(1);
    expect(themeColor({ hex: '#ffffff', glow: 2 }).r).toBe(2);
  });
});
