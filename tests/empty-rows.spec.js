const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
const URL = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
const state = page => page.evaluate(() => getRows());
async function open(page, rows) {
  await page.goto(URL);
  await page.evaluate(rows => {
    localStorage.clear(); currentLevel = 1; showIntro = false; iconMode = true; geckoOn = false;
    editorContents = {}; textDrafts = {}; rowPrograms = { 1: rows }; activeRow = 0; clearRowHistory();
    persistRows(); render();
  }, rows);
}
async function dragOut(page, index) {
  const head = page.locator('.program-row').nth(index).locator('.function-head');
  await head.scrollIntoViewIfNeeded();
  const box = await head.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(8, 10, { steps: 8 }); await page.mouse.up();
}

test('clearing the last step removes it in the same undo action and restores the spare goal row', async ({ page }) => {
  const rows = [{ id: 'r1', expr: 'runZero z' }, { id: 'r2', expr: 'mkHero r1' }];
  await open(page, rows);
  await dragOut(page, 1);
  expect(await state(page)).toEqual([rows[0]]);
  await expect(page.locator('.ready-row .puzzle-goal')).toHaveCount(1);
  await page.locator('.program-row').first().press('Control+z');
  expect(await state(page)).toEqual(rows);
  await expect(page.locator('.ready-row')).toHaveCount(0);
  await page.locator('.program-row').first().press('Control+Shift+z');
  await page.reload();
  expect(await state(page)).toEqual([rows[0]]);
});

test('removing an empty row preserves other work and never reuses an unresolved result name', async ({ page }) => {
  const rows = [{ id: 'r1', expr: 'runZero z' }, { id: 'r2', expr: 'mkHero r1' }];
  await open(page, rows);
  await dragOut(page, 0);
  expect(await state(page)).toEqual([rows[1]]);
  await expect(page.locator('.row-error')).toContainText('not an earlier result');
  await page.locator('.right-panel [data-func-name="runZero"]').dragTo(page.getByRole('button', { name: 'New function row', exact: true }));
  expect(await state(page)).toEqual([rows[1], { id: 'r3', expr: 'runZero' }]);
  expect(await page.evaluate(() => activeRow)).toBe(1);
  await page.locator('.program-row').first().press('Control+z');
  await page.locator('.program-row').first().press('Control+z');
  expect(await state(page)).toEqual(rows);
});

test('saved empty rows disappear on opening, preserve binding identities, and cannot hide a solved output', async ({ page }) => {
  const rows = [
    { id: 'r1', expr: '' }, { id: 'r2', expr: 'runZero z' },
    { id: 'r3', expr: '  ' }, { id: 'r4', expr: 'mkHero r2' }, { id: 'r5', expr: '' }
  ];
  await open(page, rows);
  expect(await state(page)).toEqual([rows[1], rows[3]]);
  await expect(page.locator('.ready-row')).toHaveCount(0);
  await expect(page.locator('.goal-reached')).toHaveCount(1);
  await page.reload();
  expect(await state(page)).toEqual([rows[1], rows[3]]);
});

test('moving the sole function from an earlier row keeps the target active after cleanup', async ({ page }) => {
  await open(page, [{ id: 'r1', expr: 'runZero' }, { id: 'r2', expr: 'mkHero' }]);
  const source = page.locator('.function-head').first(), target = page.locator('.argument-slot').nth(1);
  const from = await source.boundingBox(), to = await target.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down(); await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 }); await page.mouse.up();
  expect(await state(page)).toEqual([{ id: 'r2', expr: 'mkHero runZero' }]);
  expect(await page.evaluate(() => activeRow)).toBe(0);
  await expect(page.locator('.ready-row')).toHaveCount(1);
});
