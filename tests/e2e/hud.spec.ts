import { expect, test } from '@playwright/test';
import { startGame } from './helpers';

test('H hides the HUD chrome and shows it again; Esc still opens a dialog over the hidden HUD', async ({
  page,
}) => {
  await startGame(page);
  const timer = page.getByTestId('stage-timer');
  const speed = page.getByTestId('speed-readout');
  await expect(timer).toBeVisible();
  await expect(speed).toBeVisible();
  await expect(page.getByRole('progressbar')).toBeVisible();

  await page.keyboard.press('KeyH');
  await expect(timer).toBeHidden();
  await expect(speed).toBeHidden();
  await expect(page.getByRole('progressbar')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Settings' })).toBeHidden();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.keyboard.press('KeyH');
  await expect(timer).toBeVisible();
  await expect(speed).toBeVisible();
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
});
