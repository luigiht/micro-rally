import { describe, expect, it } from 'vitest';
import { markerDistances } from '@/game/stage/RoadMarkers';

describe('markerDistances skip spans', () => {
  it('drops every post inside a skipped stretch and keeps the rest on the 20 m grid', () => {
    expect(markerDistances(200, [], [[45, 95]])).toEqual([10, 30, 110, 130, 150, 170, 190]);
  });

  it('is unchanged with no spans', () => {
    expect(markerDistances(100, [])).toEqual([10, 30, 50, 70, 90]);
  });
});
