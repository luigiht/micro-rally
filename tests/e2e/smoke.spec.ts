import { expect, test } from '@playwright/test';
import { CANVAS, startGame } from './helpers';

test('the splash screen boots, then Drive starts the game', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Micro Rally/);
  await expect(page.getByRole('heading', { name: 'Micro Rally' })).toBeVisible();
  await expect(page.locator(CANVAS)).toHaveCount(0);
  await expect(page.locator('[data-testid="splash-scene"] canvas')).toBeVisible();
  await startGame(page);
});

test('holding W accelerates the car on the test track', async ({ page }) => {
  await startGame(page, '/?track=test');
  const readout = page.getByTestId('speed-readout');
  await expect(readout).toBeVisible();
  await page.waitForTimeout(500);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(2500);
  await page.keyboard.up('KeyW');
  const text = await readout.innerText();
  const speed = Number(text.match(/\d+/)?.[0]);
  expect(speed, text).toBeGreaterThan(20);
});

test('a stage counts down, then the clock runs', async ({ page }) => {
  await startGame(page);
  const timer = page.getByTestId('stage-timer');
  await expect(timer).toHaveText('0:00.00');
  await expect(timer).not.toHaveText('0:00.00', { timeout: 10_000 });
});

test('the Game button shows stage info and the driver, Esc closes it', async ({ page }) => {
  await startGame(page, '/', { name: 'Ada' });
  await page.getByRole('button', { name: 'Game' }).click();
  const dialog = page.getByRole('dialog', { name: 'Game' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Par time')).toBeVisible();
  await expect(dialog.getByTestId('driver-name')).toHaveText('Ada');
  await expect(dialog.getByRole('rowheader', { name: 'Space' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('Restart stage in the Game panel puts the clock back to zero', async ({ page }) => {
  await startGame(page);
  const timer = page.getByTestId('stage-timer');
  await expect(timer).not.toHaveText('0:00.00', { timeout: 10_000 });
  await page.getByRole('button', { name: 'Game' }).click();
  await page.getByRole('button', { name: 'Restart stage' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(timer).toHaveText('0:00.00');
});

test('Settings lists the controls and switches the language', async ({ page }) => {
  await startGame(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('rowheader', { name: 'Space' })).toBeVisible();
  await dialog.getByRole('combobox', { name: 'Language' }).selectOption('es');
  await expect(page.getByRole('dialog', { name: 'Ajustes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Juego' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('the progress bar fills as the car drives down the stage', async ({ page }) => {
  await startGame(page);
  const bar = page.getByRole('progressbar', { name: 'Stage progress' });
  await expect(bar).toHaveAttribute('aria-valuenow', '0');
  await expect(page.getByTestId('stage-timer')).not.toHaveText('0:00.00', { timeout: 10_000 });
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(5000);
  await page.keyboard.up('KeyW');
  expect(Number(await bar.getAttribute('aria-valuenow'))).toBeGreaterThan(0);
});

test('the page ships a favicon, Apple icon, Open Graph image and Twitter card', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Micro Rally');
  expect(await page.locator('link[rel="icon"]').count()).toBeGreaterThan(0);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    /opengraph-image/,
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    'content',
    'summary_large_image',
  );
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', /image/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /rally/i);
  // Scripts have no rendered text, so read the raw content.
  expect(await page.locator('script[type="application/ld+json"]').textContent()).toContain(
    'VideoGame',
  );
});

test('the Game ID help is a small dialog, and the footer links and language work', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'About the Game ID' }).click();
  const dialog = page.getByRole('dialog', { name: 'Game ID' });
  await expect(dialog).toContainText('Leave it empty');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();

  // Inside <main> a <footer> is not a landmark, so target the element itself.
  const footer = page.locator('footer');
  await expect(footer).toContainText('Luis Hermosilla');
  await expect(footer.getByRole('link', { name: 'Luis Hermosilla' })).toHaveAttribute(
    'href',
    'https://www.luigiht.com',
  );
  await footer.getByRole('combobox', { name: 'Language' }).selectOption('es');
  await expect(page.getByRole('button', { name: 'Conducir' })).toBeVisible();
  await footer.getByRole('link', { name: 'Privacidad' }).click();
  await expect(page.getByRole('heading', { name: 'Privacidad', level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'Volver al juego' }).click();
  await expect(page.getByRole('button', { name: 'Conducir' })).toBeVisible();
});
