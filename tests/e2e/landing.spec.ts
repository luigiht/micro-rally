import { devices, expect, test } from '@playwright/test';

test('the front page is the landing page, and Play opens the game', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.landing-page')).toBeVisible();
  await page.locator('.hero').getByRole('link', { name: 'Play', exact: true }).click();
  await expect(page).toHaveURL(/\/game$/);
  await expect(page.getByRole('button', { name: 'Single player' })).toBeVisible();
});

test('links from before the move still open the game', async ({ page }) => {
  await page.goto('/?game=ABCD2345');
  await expect(page).toHaveURL(/\/game\?game=ABCD2345$/);
  await page.goto('/?session=ABCD2345');
  await expect(page).toHaveURL(/\/game\?session=ABCD2345$/);
  await page.goto('/landing');
  await expect(page).toHaveURL(/\/$/);
});

test('the installed app skips the landing page', async ({ browser }) => {
  const profile = { ...devices['iPhone 13'] } as Partial<(typeof devices)[string]>;
  delete profile.defaultBrowserType;
  const context = await browser.newContext(profile);
  // Launched from the home screen: Safari's flag, and the display mode other browsers report.
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { get: () => true });
  });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page).toHaveURL(/\/game$/);
  await expect(page.getByRole('button', { name: 'Single player' })).toBeVisible();
  await context.close();
});

test('the manifest starts the installed app in the game', async ({ request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.start_url).toBe('/game');
  expect(manifest.id).toBe('/');
});
