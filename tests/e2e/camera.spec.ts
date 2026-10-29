import { expect, test } from '@playwright/test';
import { CANVAS, startGame } from './helpers';

test('C cycles the four cameras and Settings shows and sets the same view', async ({ page }) => {
  await startGame(page);
  const openSettings = async () => {
    await page.getByRole('button', { name: 'Settings' }).click();
    return page.getByRole('dialog', { name: 'Settings' }).getByRole('combobox', { name: 'Camera' });
  };

  await expect(await openSettings()).toHaveValue('chase');
  await page.keyboard.press('Escape');

  for (const expected of ['cockpit', 'interior', 'iso']) {
    await page.keyboard.press('KeyC');
    await expect(await openSettings()).toHaveValue(expected);
    await page.keyboard.press('Escape');
  }

  const select = await openSettings();
  await select.selectOption('interior');
  await page.keyboard.press('Escape');
  await expect(page.locator(CANVAS)).toBeVisible();

  for (let i = 0; i < 4; i++) await page.keyboard.press('KeyC');
  await expect(await openSettings()).toHaveValue('interior');
  await page.keyboard.press('Escape');
});
