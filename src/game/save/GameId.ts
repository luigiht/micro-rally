/** Game IDs: 8 chars of Crockford base32 (no I, L, O, U), shown as XXXX-XXXX. */
export const GAME_ID_LENGTH = 8;

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const VALID = new RegExp(`^[${ALPHABET}]{${GAME_ID_LENGTH}}$`);

/** Letters a human might type for a look-alike digit. */
const LOOKALIKES: Readonly<Record<string, string>> = { I: '1', L: '1', O: '0', U: 'V' };

function secureRandomBytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  globalThis.crypto.getRandomValues(buf);
  return buf;
}

/** A fresh random ID. 32^8 ≈ 1.1e12 values, so collisions are not a practical concern. */
export function createGameId(randomBytes: (n: number) => Uint8Array = secureRandomBytes): string {
  // 256 is a multiple of 32, so `byte % 32` is unbiased.
  return Array.from(randomBytes(GAME_ID_LENGTH), (b) => ALPHABET[b % 32]!).join('');
}

/** Upper-case, drop separators, fix look-alikes, keep at most 8 valid chars. May be shorter than 8 while typing. */
export function normalizeGameId(input: string): string {
  let out = '';
  for (const ch of input.toUpperCase()) {
    const mapped = LOOKALIKES[ch] ?? ch;
    if (ALPHABET.includes(mapped)) out += mapped;
    if (out.length === GAME_ID_LENGTH) break;
  }
  return out;
}

export function isValidGameId(id: string): boolean {
  return VALID.test(id);
}

/** Display form, tolerant of partial input: "ABCD" → "ABCD", "ABCDE" → "ABCD-E". */
export function formatGameId(input: string): string {
  const id = normalizeGameId(input);
  return id.length > 4 ? `${id.slice(0, 4)}-${id.slice(4)}` : id;
}
