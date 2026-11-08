import { devices, expect, test, type Locator } from '@playwright/test';
import { randomGameId, startGame } from './helpers';

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

test('phone landscape: checkpoints and money share a row of icons, the pace note below; turbo only when fitted', async ({
  page,
  request,
}) => {
  await startGame(page);
  const checkpoint = page.getByTestId('checkpoint-counter');
  const money = page.getByTestId('money');
  // Icons stand in for the words, which stay for screen readers.
  await expect(checkpoint).toHaveText(/0\/\d/);
  await expect(checkpoint.locator('svg')).toBeVisible();
  await expect(money.locator('svg')).toBeVisible();
  const c = await box(checkpoint);
  const m = await box(money);
  expect(Math.abs(c.y + c.height / 2 - (m.y + m.height / 2))).toBeLessThan(4);
  expect(m.x).toBeGreaterThan(c.x + c.width);
  const note = await box(page.getByTestId('pace-note'));
  expect(note.y).toBeGreaterThan(Math.max(c.y + c.height, m.y + m.height));
  // The starter hatchback has no turbo, so no turbo pad.
  await expect(page.getByRole('button', { name: 'Turbo' })).toHaveCount(0);

  const gameId = randomGameId();
  const put = await request.put(`/api/games/${gameId}`, {
    data: {
      version: 2,
      gameId,
      driverName: 'Boost',
      gameSeed: 7,
      money: 0,
      stageIndex: 0,
      records: {},
      carId: 'hatchback',
      ownedCars: ['hatchback'],
      upgrades: { turbo: 1 },
      updatedAt: Date.now(),
    },
  });
  expect(put.ok(), await put.text()).toBeTruthy();
  await startGame(page, '/', { name: '', gameId });
  const turbo = await box(page.getByRole('button', { name: 'Turbo' }));
  const left = await box(page.getByRole('button', { name: 'Steer left' }));
  // Over steer-left.
  expect(turbo.y + turbo.height).toBeLessThanOrEqual(left.y);
  expect(Math.abs(turbo.x - left.x)).toBeLessThan(2);
});
