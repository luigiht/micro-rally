import { expect, test } from '@playwright/test';

test('home page boots and renders the 3D canvas', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Micro Rally/);
  await expect(page.getByRole('heading', { name: 'Micro Rally' })).toBeVisible();
  await expect(page.locator('[data-testid="game-canvas"] canvas')).toBeVisible();
});
