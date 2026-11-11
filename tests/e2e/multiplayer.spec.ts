import { expect, test, type Browser, type Page } from '@playwright/test';
import { CANVAS } from './helpers';

/** The lobby polls every 4 s, so news from the other driver can take that long to show. */
const POLL = { timeout: 10_000 };

/** A fresh browser (own storage) on the splash, through the Multiplayer choice. */
async function multiplayerPage(browser: Browser, path = '/'): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto(path);
  if (!path.includes('session=')) await page.getByRole('button', { name: 'Multiplayer' }).click();
  await expect(page.getByLabel('Driver name')).toBeVisible();
  return page;
}

/** Count a run for this page's seat straight through the API, as the game does at the finish. */
async function finishStage(page: Page, id: string, stageIndex: number, time: number) {
  const seat = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? 'null') as object,
    `micro-rally:session-seat:${id}`,
  );
  const res = await page.request.post(`/api/sessions/${id}/results`, {
    data: { ...seat, stageIndex, time, splits: [time / 3, (2 * time) / 3] },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
}

test('two drivers share a session, and a stage opens only once both have run the last', async ({
  browser,
}) => {
  const ada = await multiplayerPage(browser);
  await ada.getByLabel('Driver name').fill('Ada');
  await ada.getByLabel('Stages').selectOption('3');
  await ada.getByRole('button', { name: 'Create session' }).click();
  const shown = (await ada.getByTestId('session-id').innerText()).trim();
  const id = shown.replace('-', '');
  await expect(ada).toHaveURL(new RegExp(`session=${id}`));
  await expect(ada.getByTestId('session-standings')).toContainText('Open seat');

  // A shared link opens Join with the ID filled in.
  const bo = await multiplayerPage(browser, `/?session=${id}`);
  await expect(bo.getByLabel('Session ID')).toHaveValue(shown);
  await bo.getByLabel('Driver name').fill('Bo');
  await bo.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(bo.getByTestId('session-standings')).toContainText('Bo (you)');
  await expect(ada.getByTestId('session-standings')).toContainText('Bo', POLL);

  // A third driver is turned away.
  const cy = await multiplayerPage(browser, `/?session=${id}`);
  await cy.getByLabel('Driver name').fill('Cy');
  await cy.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(cy.getByRole('alert').filter({ hasText: 'already has two drivers' })).toBeVisible();

  // Ada runs stage 1: she waits for Bo, who can still drive it.
  await finishStage(ada, id, 0, 300);
  await expect(ada.getByTestId('session-status')).toHaveText(
    'Waiting for Bo to finish stage 1.',
    POLL,
  );
  await expect(ada.getByRole('button', { name: /^Drive stage/ })).toHaveCount(0);
  await expect(bo.getByRole('button', { name: 'Drive stage 1' })).toBeVisible(POLL);

  // Bo beats her: stage 2 opens for both, and the stage win is his.
  await finishStage(bo, id, 0, 280);
  await expect(ada.getByRole('button', { name: 'Drive stage 2' })).toBeVisible(POLL);
  await expect(bo.getByRole('button', { name: 'Drive stage 2' })).toBeVisible(POLL);
  const table = ada.getByTestId('session-standings');
  await expect(table).toContainText('5:00.00');
  await expect(table).toContainText('4:40.00');
  await expect(table.getByText('Stage win:')).toHaveCount(1);

  // Driving a stage: no money or garage, and the Game panel leads back to the session.
  await ada.getByRole('button', { name: 'Drive stage 2' }).click();
  await expect(ada.locator(CANVAS)).toBeVisible();
  await expect(ada.getByTestId('stage-timer')).toBeVisible();
  await expect(ada.getByTestId('money')).toHaveCount(0);
  await ada.getByRole('button', { name: 'Game' }).click();
  const panel = ada.getByRole('dialog', { name: 'Game' });
  await expect(panel.getByTestId('session-id')).toHaveText(shown);
  await panel.getByRole('button', { name: 'Back to session' }).click();
  await expect(ada.getByRole('button', { name: 'Drive stage 2' })).toBeVisible();
  await ada.getByRole('button', { name: 'Leave session' }).click();
  await expect(ada.getByRole('button', { name: 'Single player' })).toBeVisible();
});

test('the session API refuses unknown sessions and stray runs', async ({ request }) => {
  expect((await request.get('/api/sessions/nope')).status()).toBe(400);
  expect((await request.get('/api/sessions/ZZZZ9999')).status()).toBe(404);
  const created = await request.post('/api/sessions', {
    data: { name: 'Ada', stageCount: 3, carId: 'hatchback' },
  });
  expect(created.status()).toBe(201);
  const { session } = (await created.json()) as { session: { id: string } };
  const stray = await request.post(`/api/sessions/${session.id}/results`, {
    data: { playerId: 'someone', token: 'x', stageIndex: 0, time: 100, splits: [] },
  });
  expect(stray.status()).toBe(403);
});
