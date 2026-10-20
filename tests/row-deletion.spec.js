const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
const URL = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
const branch = [
  { id: 'r1', expr: 'runZero z' },
  { id: 'r2', expr: 'mkHero r1' },
  { id: 'r3', expr: 'runZero z' },
  { id: 'r4', expr: 'mkHero r2' },
  { id: 'r5', expr: 'mkHero r4' },
  { id: 'r6', expr: 'mkHero r3' },
];
async function open(page, rows = branch) {
  await page.goto(URL);
  await page.evaluate(rows => {
    localStorage.clear(); currentLevel = 1; showIntro = false; iconMode = true; geckoOn = false;
    editorContents = {}; textDrafts = {}; rowPrograms = { 1: rows }; activeRow = 0; clearRowHistory();
    persistRows(); render();
  }, rows);
  await page.evaluate(() => document.fonts.ready);
}
const state = page => page.evaluate(() => getRows());
const dialog = page => page.locator('.row-delete-dialog');
// The row header is hidden; exercise the retained deletion command directly.
const remove = (page, n) => page.locator('.row-delete').nth(n - 1).evaluate(button => button.click());
const impact = page => dialog(page).locator('.delete-preview-item').evaluateAll(nodes => nodes.map(node => Number(node.dataset.deleteIndex)));

test('confirmation previews direct and indirect dependents, preserves the independent branch, and persists', async ({ page }) => {
  await open(page);
  await expect(page.locator('.row-menu, .row-actions')).toHaveCount(0);
  await expect(page.locator('.row-delete')).toHaveCount(6);
  await remove(page, 1);
  await expect(dialog(page)).toHaveAccessibleName('Delete 4 rows?');
  await expect(dialog(page)).toContainText('Row 1 and 3 dependent rows will be deleted.');
  expect(await impact(page)).toEqual([0, 1, 3, 4]);
  await expect(dialog(page).locator('.delete-preview-item').last()).toContainText('Uses row 4');
  await expect(page.locator('.program-row.delete-preview')).toHaveCount(4);
  expect(await state(page)).toEqual(branch);
  await page.screenshot({ path: '/tmp/zth-delete-desktop.png' });
  await dialog(page).getByRole('button', { name: 'Delete 4 rows', exact: true }).click();
  const remaining = [branch[2], branch[5]];
  expect(await state(page)).toEqual(remaining);
  expect(await page.evaluate(() => getRowError())).toBe(null);
  await page.getByRole('button', { name: 'Undo row edit' }).click();
  expect(await state(page)).toEqual(branch);
  await page.getByRole('button', { name: 'Redo row edit' }).click();
  expect(await state(page)).toEqual(remaining);
  await page.reload();
  expect(await state(page)).toEqual(remaining);
});

test('dependency matching uses whole binding names and recognizes function-valued references', async ({ page }) => {
  const rows = [
    { id: 'value', expr: 'mkHero' },
    { id: 'value2', expr: 'mkHero' },
    { id: 'arg', expr: 'runZero z' },
    { id: 'used', expr: 'value arg' },
    { id: 'other', expr: 'value2 arg' },
    { id: 'r1', expr: 'other' },
  ];
  await open(page, rows);
  await remove(page, 1);
  expect(await impact(page)).toEqual([0, 3]);
  await dialog(page).getByRole('button', { name: 'Delete 2 rows', exact: true }).click();
  expect(await state(page)).toEqual([rows[1], rows[2], rows[4], rows[5]]);
  expect(await page.evaluate(() => typeCheck(LEVELS[currentLevel], getCodeFromEditor()).ok)).toBe(true);
});

test('Cancel, Escape, and rerender dismiss the preview; changed content needs a fresh confirmation', async ({ page }) => {
  await open(page);
  await remove(page, 1);
  await expect(dialog(page).getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.locator('.delete-preview')).toHaveCount(0);
  expect(await state(page)).toEqual(branch);
  await remove(page, 1);
  await dialog(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await state(page)).toEqual(branch);
  await remove(page, 1);
  await page.evaluate(() => toggleGecko());
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.locator('.delete-preview')).toHaveCount(0);
  expect(await state(page)).toEqual(branch);
  await remove(page, 1);
  await page.evaluate(() => { getRows()[5].expr = 'z'; });
  await dialog(page).getByRole('button', { name: 'Delete 4 rows', exact: true }).click();
  await expect(page.locator('#row-notice')).toContainText('Review the deletion again');
  expect((await state(page)).length).toBe(6);
});

test('even an empty or final row asks first, and deleting everything leaves a usable empty row', async ({ page }) => {
  await open(page, [{ id: 'r1', expr: 'runZero z' }]);
  await remove(page, 1);
  await expect(dialog(page)).toHaveAccessibleName('Delete 1 row?');
  expect(await state(page)).toEqual([{ id: 'r1', expr: 'runZero z' }]);
  await dialog(page).getByRole('button', { name: 'Delete row', exact: true }).click();
  expect(await state(page)).toEqual([{ id: 'r1', expr: '' }]);
  await remove(page, 1);
  await expect(dialog(page)).toContainText('Empty row');
  await dialog(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('textarea.row-editor')).toBeVisible();
});

test.describe('phone deletion preview', () => {
  test.use({ viewport: { width: 320, height: 800 }, isMobile: true, hasTouch: true });
  test('deletion shows the full impact with reachable touch confirmation buttons and one undo', async ({ page }) => {
    await open(page);
    await remove(page, 1);
    expect(await impact(page)).toEqual([0, 1, 3, 4]);
    const bounds = await dialog(page).boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(800);
    const confirm = dialog(page).getByRole('button', { name: 'Delete 4 rows', exact: true });
    expect((await confirm.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: '/tmp/zth-delete-phone.png' });
    await confirm.tap();
    expect(await state(page)).toEqual([branch[2], branch[5]]);
    await page.getByRole('button', { name: 'Undo row edit' }).tap();
    expect(await state(page)).toEqual(branch);
  });
});
