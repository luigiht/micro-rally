import { describe, expect, it } from 'vitest';
import { REGIONS } from '@/game/stage/regions';
import { stageAtDusk, stageBrief, stageRegion } from '@/game/stage/StageGenerator';
import {
  CAP_COLOR,
  KERB_COLOR,
  LINE_COLOR,
  PAVEMENT_COLOR,
  POST_COLOR,
  ROAD_COLORS,
} from '@/render/road/roadColors';
import { themeColor, themeGlow, themeHex } from '@/render/theme/themeColor';
import {
  COAST_HEMI,
  dayTheme,
  DUSK_LIGHTING,
  flatTheme,
  NIGHTCITY_THEME,
  type ThemeColor,
} from '@/render/theme/WorldTheme';

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
        // The coast's sky light is cooler, so its limestone shades blue-grey rather than olive.
        hemiSky: region.coast ? COAST_HEMI.hemiSky : '#fff6e0',
        hemiGround: region.coast ? COAST_HEMI.hemiGround : '#7fa05f',
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

  it('a stage at dusk gets a twilight sky, little light, the car lamps lit, the day kits', () => {
    const arctic = dayTheme(REGIONS.arctic, true);
    expect(REGIONS.arctic.dusk).toBe(true);
    expect(arctic.id).toBe('day');
    expect(arctic.lighting).toBe(DUSK_LIGHTING);
    expect(arctic.carLamps).toBe(true);
    // Unlit marks: dark and faint after dark, never the snow's pale ink.
    expect(arctic.skidInk?.opacity).toBeLessThan(0.5);
    expect(arctic.scenery.kit).toBe('rally');
    const l = arctic.lighting;
    // The fog melts distant ground into the sky's horizon; far dimmer than by day.
    expect(l.sky?.horizon).toBe(l.fog);
    expect(l.hemiIntensity).toBeLessThan(1.9 / 2);
    expect(l.sunIntensity).toBeLessThan(2.6 / 4);
    expect(dayTheme(REGIONS.arctic, true)).toBe(arctic);
    expect(dayTheme(REGIONS.arctic)).not.toBe(arctic);
    for (const region of Object.values(REGIONS)) expect(dayTheme(region).carLamps).toBe(false);
  });

  it('runs every third Arctic stage at dusk and every other stage by day', () => {
    const arctic: boolean[] = [];
    for (let i = 0; i < 200; i++) {
      const { region } = stageRegion(i);
      if (region === 'arctic') arctic.push(stageAtDusk(i));
      else expect(stageAtDusk(i)).toBe(false);
    }
    expect(arctic.length).toBeGreaterThan(9);
    arctic.forEach((dusk, k) => expect(dusk).toBe(k % 3 === 2));
    const first = [...Array(200).keys()].find((i) => stageAtDusk(i))!;
    expect(stageBrief(1, first).dusk).toBe(true);
    expect(stageBrief(1, first - 1).dusk).toBeUndefined();
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
    const themes = [
      ...Object.values(REGIONS).map((r) => dayTheme(r)),
      dayTheme(REGIONS.arctic, true),
      NIGHTCITY_THEME,
    ];
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
