import { devices, expect, test, type Locator } from '@playwright/test';
import { startGame } from './helpers';

test.use({ ...devices['Pixel 7 landscape'] });

async function box(l: Locator) {
  const b = await l.boundingBox();
  expect(b).not.toBeNull();
  return b!;
}

function overlaps(a: { x: number; y: number; width: number; height: number }, b: typeof a) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

test('phone landscape: HUD pieces do not overlap and touch pads are shown', async ({ page }) => {
  await startGame(page);
  // Drive asked the browser for fullscreen on this touch device.
  await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
  const timer = await box(page.getByTestId('stage-timer'));
  const toolbar = await box(page.getByRole('navigation'));
  const money = await box(page.getByTestId('money'));
  const speed = await box(page.getByTestId('speed-readout'));
  const gas = await box(page.getByRole('button', { name: 'Gas' }));
  const steer = await box(page.getByRole('button', { name: 'Steer right' }));
  const handbrake = await box(page.getByRole('button', { name: 'Handbrake' }));
  const bar = await box(page.getByRole('progressbar'));
  expect(overlaps(timer, toolbar)).toBe(false);
  expect(overlaps(money, toolbar)).toBe(false);
  expect(overlaps(speed, gas)).toBe(false);
  expect(overlaps(speed, steer)).toBe(false);
  expect(overlaps(bar, timer)).toBe(false);
  expect(overlaps(bar, money)).toBe(false);
  expect(overlaps(bar, handbrake)).toBe(false);
  // Desktop toolbar buttons are hidden on touch; the Pause button carries its label for assistive tech.
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  // On touch devices the toolbar is a single Pause button whose menu opens Game, Garage and Settings.
  await expect(page.getByRole('navigation').getByRole('button')).toHaveCount(1);
  await page.getByRole('button', { name: 'Pause' }).click();
  const menu = page.getByRole('dialog', { name: 'Paused' });
  for (const name of ['Game', 'Garage', 'Settings'])
    await expect(menu.getByRole('button', { name })).toBeVisible();
  await menu.getByRole('button', { name: 'Garage' }).click();
  await expect(page.getByRole('dialog', { name: 'Garage' })).toBeVisible();
  await expect(menu).toBeHidden();
});

test('holding the on-screen gas pedal drives the car', async ({ page }) => {
  await startGame(page, '/?track=test');
  const readout = page.getByTestId('speed-readout');
  await page.waitForTimeout(500);
  const gas = await box(page.getByRole('button', { name: 'Gas' }));
  const cdp = await page.context().newCDPSession(page);
  const touchPoints = [{ x: gas.x + gas.width / 2, y: gas.y + gas.height / 2 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
  await page.waitForTimeout(2500);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const speed = Number((await readout.innerText()).match(/\d+/)?.[0]);
  expect(speed).toBeGreaterThan(20);
});
