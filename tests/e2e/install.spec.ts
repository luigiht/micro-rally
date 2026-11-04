import { devices, expect, test } from '@playwright/test';

/** A device profile usable inside a describe: Playwright forbids a per-group browser type. */
function phone(name: string) {
  const profile = { ...devices[name] } as Partial<(typeof devices)[string]>;
  delete profile.defaultBrowserType;
  return profile;
}

test.describe('install prompt on an Android browser', () => {
  test.use(phone('Pixel 7'));

  test('appears once the browser offers to install, Not now hides it for a fortnight', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByLabel('Driver name')).toBeVisible();
    await expect(page.getByTestId('install-prompt')).toHaveCount(0);
    // Headless Chromium never raises the event on its own; stand in for it.
    await page.evaluate(() => window.dispatchEvent(new Event('beforeinstallprompt')));
    const prompt = page.getByTestId('install-prompt');
    await expect(prompt).toHaveAttribute('data-platform', 'android');
    await expect(prompt.getByRole('button', { name: 'Install' })).toBeVisible();
    await prompt.getByRole('button', { name: 'Not now' }).click();
    await expect(prompt).toHaveCount(0);
    await page.reload();
    await expect(page.getByLabel('Driver name')).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event('beforeinstallprompt')));
    await expect(page.getByTestId('install-prompt')).toHaveCount(0);
  });
});

test.describe('install prompt on an iPhone', () => {
  test.use(phone('iPhone 13'));

  test('explains Share → Add to Home Screen without an Install button', async ({ page }) => {
    await page.goto('/');
    const prompt = page.getByTestId('install-prompt');
    await expect(prompt).toHaveAttribute('data-platform', 'ios');
    await expect(prompt).toContainText('Add to Home Screen');
    await expect(prompt.getByRole('button', { name: 'Install' })).toHaveCount(0);
  });

  test('stays away when already running from the home screen', async ({ browser }) => {
    const context = await browser.newContext(phone('iPhone 13'));
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'standalone', { get: () => true });
    });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.getByLabel('Driver name')).toBeVisible();
    await expect(page.getByTestId('install-prompt')).toHaveCount(0);
    await context.close();
  });
});

test('a desktop pointer is never asked to install', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Driver name')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('beforeinstallprompt')));
  await expect(page.getByTestId('install-prompt')).toHaveCount(0);
});
