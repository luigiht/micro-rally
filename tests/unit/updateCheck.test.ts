import { describe, expect, it } from 'vitest';
import { newVersionAvailable } from '@/lib/updateCheck';

const answer =
  (body: unknown, status = 200): typeof fetch =>
  async () =>
    Response.json(body, { status });

describe('newVersionAvailable', () => {
  it('is true only when the server reports a different build', async () => {
    expect(await newVersionAvailable(answer({ buildId: 'b2' }), 'b1')).toBe(true);
    expect(await newVersionAvailable(answer({ buildId: 'b1' }), 'b1')).toBe(false);
  });

  it('treats errors, junk and being offline as no news', async () => {
    expect(await newVersionAvailable(answer({ buildId: 'b2' }, 500), 'b1')).toBe(false);
    expect(await newVersionAvailable(answer({ nope: 1 }), 'b1')).toBe(false);
    const offline: typeof fetch = async () => {
      throw new TypeError('offline');
    };
    expect(await newVersionAvailable(offline, 'b1')).toBe(false);
  });
});
