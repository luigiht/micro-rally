import { expect, type Page } from '@playwright/test';

export const CANVAS = '[data-testid="game-canvas"] canvas';

/**
 * Pick Single player on the splash's mode choice. A URL naming a game
 * (`?game=`) opens the form directly, so this only clicks when asked.
 */
export async function chooseSinglePlayer(page: Page): Promise<void> {
  const single = page.getByRole('button', { name: 'Single player' });
  const name = page.getByLabel('Driver name');
  // Both only mount after hydration, so once either exists our clicks and typing stick.
  await expect(single.or(name)).toBeVisible();
  if (await single.isVisible()) await single.click();
  await expect(name).toBeVisible();
}

/** Get through the splash screen into a running game. */
export async function startGame(
  page: Page,
  path = '/',
  opts: { name?: string; gameId?: string } = {},
): Promise<void> {
  await page.goto(path);
  await chooseSinglePlayer(page);
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
