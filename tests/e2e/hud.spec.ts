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

test('the pace note calls the next corner from the start line, always on', async ({ page }) => {
  await startGame(page);
  const note = page.getByTestId('pace-note');
  await expect(note).toBeVisible();
  await expect(note).toHaveAttribute('data-side', /^(left|right)$/);
  await expect(note).toHaveAttribute('data-grade', /^(acute|hairpin|square|[1-6])$/);

  await page.getByRole('button', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog.getByRole('checkbox', { name: 'Pace notes' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(note).toBeVisible();
});
