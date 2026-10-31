const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

const GAME_URL = pathToFileURL(path.resolve(__dirname, '../index.html')).href;
const TEST_URL = GAME_URL + '?test=1';

async function expectClean(page) {
  await expect(page.locator('#level-badge')).toHaveText('Level 1 / 25');
  expect(await page.evaluate(() => ({
    completed: [...completedLevels],
    code: getCodeFromEditor(),
    filledRows: Object.values(rowPrograms).flat().filter(row => row.expr.trim()),
    drafts: textDrafts,
    textHistory: textHistory.size,
    rowHistory: rowHistory.size,
    iconMode, geckoOn, activeRow, showComplete
  }))).toEqual({
    completed: [], code: '', filledRows: [], drafts: {},
    textHistory: 0, rowHistory: 0, iconMode: true, geckoOn: false,
    activeRow: 0, showComplete: false
  });
}

test('test links clear all progress on every load while preserving normal saves', async ({ page, context }) => {
  await page.goto(GAME_URL);
  const saved = await page.evaluate(() => {
    for (const [index, level] of LEVELS.entries()) {
      setEditorContent(level.solution, index);
      rowPrograms[index] = RowProgram.migrate(level.solution);
      textDrafts[index] = level.solution;
      completedLevels.add(index);
    }
    currentLevel = LEVEL_ORDER[7];
    iconMode = false;
    saveProgress();
    return localStorage.getItem('zth_progress');
  });
  const normal = await context.newPage();
  await normal.goto(GAME_URL);
  await page.goto(TEST_URL);
  await expectClean(page);

  // Complete a real puzzle, navigate, and leave an unfinished draft.
  await page.evaluate(() => toggleIconMode());
  await page.locator('#code-editor').fill('wrap value');
  await page.getByRole('button', { name: 'Next level', exact: true }).click();
  await expect(page.locator('#level-badge')).toHaveText('Level 2 / 25');
  await page.locator('#code-editor').fill('f');
  expect(await page.evaluate(() => completedLevels.size)).toBe(1);
  expect(await normal.evaluate(() => localStorage.getItem('zth_progress'))).toBe(saved);

  await page.reload();
  await expectClean(page);
  expect(await page.evaluate(() => localStorage.getItem('zth_progress'))).toBe(saved);

  await page.goto(GAME_URL);
  expect(await page.evaluate(() => ({
    level: LEVELS[currentLevel].level, count: completedLevels.size, iconMode,
    saved: localStorage.getItem('zth_progress')
  }))).toEqual({ level: 8, count: 25, iconMode: false, saved });
  await normal.close();
});

test('test-only play creates no save and browser back starts fresh', async ({ page }) => {
  await page.goto(TEST_URL);
  await expectClean(page);
  await page.getByRole('button', { name: 'Skip level', exact: true }).click();
  await expect(page.locator('#level-badge')).toHaveText('Level 2 / 25');
  await page.goto('about:blank');
  await page.goBack();
  await expectClean(page);
  expect(await page.evaluate(() => localStorage.getItem('zth_progress'))).toBeNull();

  await page.goto(GAME_URL + '?test=0');
  await expectClean(page);
  await page.getByRole('button', { name: 'Skip level', exact: true }).click();
  await page.reload();
  await expect(page.locator('#level-badge')).toHaveText('Level 2 / 25');
});
