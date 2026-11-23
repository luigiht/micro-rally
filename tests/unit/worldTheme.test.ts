import { describe, expect, it } from 'vitest';
import { STAGE_TYPES } from '@/game/stage/regions';
import { stageAtDusk, stageBrief, stageTypeAt } from '@/game/stage/StageGenerator';
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
  SUNNY_LIGHT,
  dayTheme,
  DUSK_LIGHTING,
  SUNSET_LIGHTING,
  flatTheme,
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
    for (const region of Object.values(STAGE_TYPES)) {
      const t = dayTheme(region);
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
        // A sunny type (Lakeland) brightens the sun and the sky fill over the stock day.
        ...(region.sunny ? SUNNY_LIGHT : {}),
        // Open country (the Savanna) sees further, with a warm bounce off its red earth.
        ...(region.haze
          ? { fogNear: region.haze.near, fogFar: region.haze.far, hemiGround: '#a07850' }
          : {}),
        // A morning sky (the Savanna): the gradient dome, the mist its horizon, a low warm sun.
        ...(region.skyGradient
          ? {
              sky: region.skyGradient,
              fog: region.skyGradient.horizon,
              background: region.skyGradient.horizon,
              sunColor: '#ffe6bd',
            }
          : {}),
      });
      // A road of its own colour (the Savanna's murram) over its surface's stock one.
      if (region.palette.road)
        expect(t.road.surfaces).toEqual({ ...ROAD_COLORS, [region.surface]: region.palette.road });
      else expect(t.road.surfaces).toBe(ROAD_COLORS);
      expect(t.road.surface).toBeNull();
      expect(t.road.snowPatches).toBe(true);
      expect(t.road.verge).toBe(region.palette.shoulder);
      expect(t.road.line).toBe(region.id === 'autumnal' ? '#c0a682' : LINE_COLOR);
      expect(t.road.pavement).toBe(PAVEMENT_COLOR);
      expect(t.road.kerb).toBe(KERB_COLOR);
      expect(t.road.post).toBe(POST_COLOR);
      expect(t.road.cap).toBe(CAP_COLOR);
      expect(t.gates.chequer.map(themeGlow)).toEqual([0.25, 0.25]);
      expect(t.walls).toEqual({ body: '#c9c0b0', cap: '#e3dccf' });
      expect(t.skidInk).toEqual(region.dust ? { color: region.dust.ink, opacity: 0.5 } : null);
      // Memoised, so the renderer can compare themes by identity.
      expect(dayTheme(region)).toBe(t);
    }
  });

  it('a stage at dusk gets a twilight sky, little light, the car lamps lit, the day kits', () => {
    const arctic = dayTheme(STAGE_TYPES.arctic, true);
    expect(STAGE_TYPES.arctic.dusk).toEqual({ every: 3, light: 'dusk' });
    expect(arctic.lighting).toBe(DUSK_LIGHTING);
    expect(arctic.carLamps).toBe(true);
    // Unlit marks: dark and faint after dark, never the snow's pale ink.
    expect(arctic.skidInk?.opacity).toBeLessThan(0.5);
    const l = arctic.lighting;
    // The fog melts distant ground into the sky's horizon; far dimmer than by day.
    expect(l.sky?.horizon).toBe(l.fog);
    expect(l.hemiIntensity).toBeLessThan(1.9 / 2);
    expect(l.sunIntensity).toBeLessThan(2.6 / 4);
    expect(dayTheme(STAGE_TYPES.arctic, true)).toBe(arctic);
    expect(dayTheme(STAGE_TYPES.arctic)).not.toBe(arctic);
    for (const region of Object.values(STAGE_TYPES)) expect(dayTheme(region).carLamps).toBe(false);
  });

  it('a Coast stage run late gets a sunset: lamps lit, dimmer than day, brighter than dusk', () => {
    const coast = dayTheme(STAGE_TYPES.coastal, true);
    expect(coast.lighting).toBe(SUNSET_LIGHTING);
    expect(coast.carLamps).toBe(true);
    expect(coast.skidInk).toBeNull();
    const l = coast.lighting;
    expect(l.sky?.horizon).toBe(l.fog);
    expect(l.hemiIntensity).toBeLessThan(1.9);
    expect(l.hemiIntensity).toBeGreaterThan(DUSK_LIGHTING.hemiIntensity);
    expect(l.sunIntensity).toBeLessThan(2.6);
    expect(l.sunIntensity).toBeGreaterThan(DUSK_LIGHTING.sunIntensity);
  });

  it('runs every third Arctic stage at dusk, every other Coast stage at sunset, the rest by day', () => {
    const arctic: boolean[] = [];
    const coast: boolean[] = [];
    for (let i = 0; i < 200; i++) {
      const { stageType } = stageTypeAt(i);
      if (stageType === 'arctic') arctic.push(stageAtDusk(i));
      else if (stageType === 'coastal') coast.push(stageAtDusk(i));
      else expect(stageAtDusk(i)).toBe(false);
    }
    expect(arctic.length).toBeGreaterThan(9);
    expect(coast.length).toBeGreaterThan(9);
    arctic.forEach((dusk, k) => expect(dusk).toBe(k % 3 === 2));
    coast.forEach((late, k) => expect(late).toBe(k % 2 === 1));
    const first = [...Array(200).keys()].find((i) => stageAtDusk(i))!;
    expect(stageBrief(1, first).dusk).toBe(true);
    expect(stageBrief(1, first - 1).dusk).toBeUndefined();
  });

  it('the flat theme is the day theme with its own sky and fog', () => {
    const t = flatTheme('#cfe3e8', '#dde');
    expect(t.lighting.background).toBe('#cfe3e8');
    expect(t.lighting.fog).toBe('#dde');
    expect(t.lighting.sunIntensity).toBe(2.6);
  });

  it('every colour in every theme is a six-digit hex', () => {
    const themes = [
      ...Object.values(STAGE_TYPES).map((r) => dayTheme(r)),
      dayTheme(STAGE_TYPES.arctic, true),
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
