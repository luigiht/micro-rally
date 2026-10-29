import { expect, test } from '@playwright/test';

test('home page boots and renders the 3D canvas', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Micro Rally/);
  await expect(page.getByRole('heading', { name: 'Micro Rally' })).toBeVisible();
  await expect(page.locator('[data-testid="game-canvas"] canvas')).toBeVisible();
});

test('holding W accelerates the car on the test track', async ({ page }) => {
  await page.goto('/?track=test');
  const readout = page.getByTestId('speed-readout');
  await expect(readout).toBeVisible();
  await expect(page.locator('[data-testid="game-canvas"] canvas')).toBeVisible();
  await page.waitForTimeout(500);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(2500);
  await page.keyboard.up('KeyW');
  const text = await readout.innerText();
  const speed = Number(text.match(/\d+/)?.[0]);
  expect(speed, text).toBeGreaterThan(20);
});

test('a stage counts down, then the clock runs', async ({ page }) => {
  await page.goto('/');
  const timer = page.getByTestId('stage-timer');
  await expect(timer).toHaveText('0:00.00');
  await expect(timer).not.toHaveText('0:00.00', { timeout: 10_000 });
});

test('the Game button opens controls and info, Esc closes it', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-testid="game-canvas"] canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Game' }).click();
  const dialog = page.getByRole('dialog', { name: 'Game' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('rowheader', { name: 'Space' })).toBeVisible();
  await expect(dialog.getByText('Par time')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
