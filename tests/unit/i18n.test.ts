import { describe, expect, it } from 'vitest';
import { LOCALES, getMessages } from '@/i18n';

function keyPaths(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keyPaths(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('i18n dictionaries', () => {
  it('every locale has the same keys as English', () => {
    const reference = keyPaths(getMessages('en')).sort();
    for (const locale of LOCALES) {
      expect(keyPaths(getMessages(locale)).sort()).toEqual(reference);
    }
  });

  it('no locale has empty strings', () => {
    for (const locale of LOCALES) {
      const flat = JSON.stringify(getMessages(locale));
      expect(flat).not.toContain('""');
    }
  });
});
