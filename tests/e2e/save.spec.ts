import { expect, test } from '@playwright/test';
import { CANVAS, randomGameId, startGame } from './helpers';

const ID_SHAPE = /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

test('a new game gets an ID, saves online, and a reload offers Continue', async ({ page }) => {
  await startGame(page, '/', { name: 'Ada' });
  await page.getByRole('button', { name: 'Game' }).click();
  const dialog = page.getByRole('dialog', { name: 'Game' });
  const shownId = (await dialog.getByTestId('game-id').innerText()).trim();
  expect(shownId).toMatch(ID_SHAPE);
  await expect(dialog.getByTestId('driver-name')).toHaveText('Ada');
  await expect(dialog.getByRole('status')).toHaveText('Progress saved online.');
  await expect(page).toHaveURL(new RegExp(`game=${shownId.replace('-', '')}`));

  await page.reload();
  await expect(page.getByLabel('Game ID', { exact: true })).toHaveValue(shownId);
  await expect(page.getByLabel('Driver name')).toHaveValue('Ada');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator(CANVAS)).toBeVisible();
});

test('a save uploaded through the API resumes from the splash with its name and money', async ({
  page,
  request,
}) => {
  const gameId = randomGameId();
  const save = {
    version: 2,
    gameId,
    driverName: 'Remote Rally',
    gameSeed: 7,
    money: 1234,
    stageIndex: 1,
    records: { 0: { best: 101.5, splits: [50, 101.5] } },
    carId: 'hatchback',
    ownedCars: ['hatchback'],
    upgrades: {},
    updatedAt: Date.now(),
  };
  const put = await request.put(`/api/games/${gameId}`, { data: save });
  expect(put.ok(), await put.text()).toBeTruthy();
  const get = await request.get(`/api/games/${gameId}`);
  expect(await get.json()).toMatchObject({ gameId, money: 1234, driverName: 'Remote Rally' });

  await startGame(page, '/', { name: '', gameId });
  await expect(page.getByTestId('money')).toHaveText(/1,234/);
  await page.getByRole('button', { name: 'Game' }).click();
  await expect(page.getByRole('dialog').getByTestId('driver-name')).toHaveText('Remote Rally');
});

test('the API rejects malformed saves and unknown IDs', async ({ request }) => {
  expect((await request.get('/api/games/nope')).status()).toBe(400);
  expect((await request.get(`/api/games/${randomGameId()}`)).status()).toBe(404);
  const id = randomGameId();
  const bad = await request.put(`/api/games/${id}`, { data: { version: 1, gameId: id } });
  expect(bad.status()).toBe(400);
});

test('an unknown pasted ID is refused; clearing it starts a new game', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Driver name').fill('Ada');
  await page.getByLabel('Game ID', { exact: true }).fill(randomGameId());
  await page.getByRole('button', { name: 'Drive' }).click();
  // Next's route announcer is also role=alert; scope to ours.
  await expect(page.getByRole('alert').filter({ hasText: 'No saved game' })).toBeVisible();
  await expect(page.locator(CANVAS)).toHaveCount(0);
  await page.getByLabel('Game ID', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Drive' }).click();
  await expect(page.locator(CANVAS)).toBeVisible();
});

test('the Garage sells upgrades and the coupé, and the purchase is saved', async ({
  page,
  request,
}) => {
  const gameId = randomGameId();
  const put = await request.put(`/api/games/${gameId}`, {
    data: {
      version: 2,
      gameId,
      driverName: 'Rich',
      gameSeed: 3,
      money: 10_000,
      stageIndex: 0,
      records: {},
      carId: 'hatchback',
      ownedCars: ['hatchback'],
      upgrades: {},
      updatedAt: Date.now(),
    },
  });
  expect(put.ok()).toBeTruthy();
  await startGame(page, '/', { name: '', gameId });

  await page.getByRole('button', { name: 'Garage' }).click();
  const dialog = page.getByRole('dialog', { name: 'Garage' });
  await expect(dialog.getByRole('tab', { name: 'Upgrades' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const tyres = dialog.getByRole('listitem').filter({ hasText: 'Rally tyres' });
  await tyres.getByRole('button', { name: 'Buy' }).click();
  await expect(dialog).toContainText('$9,600');

  await dialog.getByRole('tab', { name: 'Dealership' }).click();
  const coupe = dialog.getByRole('listitem').filter({ hasText: 'Tricolore Coupé' });
  await coupe.getByRole('button', { name: 'Buy' }).click();
  await expect(coupe).toContainText('In use');
  await expect(dialog).toContainText('$5,100');

  await expect
    .poll(async () => (await (await request.get(`/api/games/${gameId}`)).json()) as unknown, {
      timeout: 10_000,
    })
    .toMatchObject({ carId: 'coupe', ownedCars: ['hatchback', 'coupe'], upgrades: { tyres: 1 } });
});
