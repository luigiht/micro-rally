import { describe, expect, it } from 'vitest';
import { penaltyRows } from '@/components/hud/resultRows';
import { en } from '@/i18n/messages/en';

describe('penaltyRows', () => {
  it('lists the hits and the seconds they added, and nothing for a clean run', () => {
    expect(penaltyRows({ penalties: 4, hits: 2 }, en)).toEqual([['Hit penalties ×2', '+4.0s']]);
    expect(penaltyRows({ penalties: 0, hits: 0 }, en)).toEqual([]);
  });
});
