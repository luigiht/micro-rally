import { expect, type Page } from '@playwright/test';

export const CANVAS = '[data-testid="game-canvas"] canvas';

/** Get through the splash screen into a running game. */
export async function startGame(
  page: Page,
  path = '/',
  opts: { name?: string; gameId?: string } = {},
): Promise<void> {
  await page.goto(path);
  // The form only mounts after hydration, so once it exists our typing sticks.
  await page.getByLabel('Driver name').fill(opts.name ?? 'Tester');
  if (opts.gameId !== undefined)
    await page.getByLabel('Game ID', { exact: true }).fill(opts.gameId);
  await page.getByRole('button', { name: /^(Drive|Continue)$/ }).click();
  await expect(page.locator(CANVAS)).toBeVisible();
}

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** A random, almost certainly unused Game ID for tests. */
export function randomGameId(): string {
  let id = '';
  for (let i = 0; i < 8; i++) id += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return id;
}
