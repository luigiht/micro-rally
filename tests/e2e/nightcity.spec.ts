import { expect, test } from '@playwright/test';
import { startGame } from './helpers';

test('N toggles the hidden Nightcity mode in place and leaves the run alone', async ({ page }) => {
  await startGame(page);
  const canvas = page.getByTestId('game-canvas');
  const timer = page.getByTestId('stage-timer');
  const tag = page.getByTestId('nightcity-tag');
  await expect(timer).toBeVisible();
  await expect(tag).toBeHidden();
  await expect(canvas).not.toHaveAttribute('data-nightcity', 'true');

  await page.keyboard.press('KeyN');
  await expect(tag).toBeVisible();
  await expect(canvas).toHaveAttribute('data-nightcity', 'true');
  // The HUD and the clock stay: this is a re-skin, not a pause or a restart.
  await expect(timer).toBeVisible();
  await expect(page.getByRole('progressbar')).toBeVisible();

  await page.keyboard.press('KeyN');
  await expect(tag).toBeHidden();
  await expect(canvas).not.toHaveAttribute('data-nightcity', 'true');
});
