const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');

const PAGE_URL = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;

async function loadProgress(page, progress) {
  await page.addInitScript(saved => {
    if (!localStorage.getItem('zth_progress')) {
      localStorage.setItem('zth_progress', JSON.stringify({ showIntro: false, ...saved }));
    }
  }, progress);
  await page.goto(PAGE_URL);
}

test('prefix stays above a left-aligned playground and survives selecting all', async ({ page }) => {
  await loadProgress(page, { currentLevel: 0 });
  const editor = page.getByRole('textbox', { name: 'Haskell expression' });
  const prefix = page.locator('#editor-prefix');
  await expect(prefix).toHaveText('zeroToHero z =');
  await editor.fill('f z');
  const header = await prefix.boundingBox();
  const input = await editor.boundingBox();
  expect(input.y).toBeGreaterThanOrEqual(header.y + header.height);
  expect(input.x).toBeLessThanOrEqual(header.x + 1);
  await editor.press('Control+a');
  await editor.press('Backspace');
  await expect(editor).toHaveValue('');
  await expect(prefix).toHaveText('zeroToHero z =');
  await editor.press('Backspace');
  await editor.press('f');
  await expect(editor).toHaveValue('f');
  await expect(prefix).toHaveText('zeroToHero z =');
});

test('existing level 8 progress loads and preserves the extra parameters', async ({ page }) => {
  const solution = 'f2 $ f1 $ f1 $ fmap bd $ f1 z';
  await loadProgress(page, {
    currentLevel: 7,
    completed: [0, 1, 2],
    editorContents: { 0: 'zeroToHero z = f z', 7: 'zeroToHero ad bd cd z = ' + solution },
  });
  const editor = page.locator('#code-editor');
  await expect(page.locator('#editor-prefix')).toHaveText('zeroToHero ad bd cd z =');
  await expect(page.locator('textarea.row-editor')).toHaveCount(0);
  await expect(editor).toHaveValue(/let\n.*\nin\n/s);
  expect(await page.evaluate(() => typeCheck(LEVELS[7], getCodeFromEditor()).ok)).toBe(true);
  await expect(page.locator('#inferred-type')).toContainText('Hero');
  await page.getByText('Icons', { exact: true }).click();
  await expect(page.locator('#editor-prefix .parameter-icon')).toHaveCount(4);
  expect(await page.locator('#editor-prefix').innerText()).toBe('');
  await expect(page.locator('.right-panel [data-func-name="z"]')).toHaveCount(0);
  await expect(page.locator('.row-instructions')).toHaveCount(0);
  await page.getByText('Gecko Graph', { exact: true }).click();
  await expect(page.locator('textarea.row-editor')).toHaveCount(5);
  expect(await page.evaluate(() => typeCheck(LEVELS[7], getCodeFromEditor()).ok)).toBe(true);
  await page.reload();
  await expect(page.locator('#editor-prefix .parameter-icon')).toHaveCount(4);
  await expect(page.locator('textarea.row-editor')).toHaveCount(5);
  expect(await page.evaluate(() => typeCheck(LEVELS[7], getCodeFromEditor()).ok)).toBe(true);
  await page.getByRole('button', { name: 'Attempt', exact: true }).click();
  await expect(page.locator('#level-dialog')).toBeVisible();
});

test('Enter adds a source line and preserves the let program after refresh', async ({ page }) => {
  await loadProgress(page, { currentLevel: 1 });
  const editor = page.locator('#code-editor');
  await editor.fill('let');
  await editor.press('End');
  await editor.press('Enter');
  await expect(editor).toHaveValue('let\n  ');
  const source = 'let\n  value = runZero z\nin\n  mkHero value';
  await editor.fill(source);
  await expect(page.locator('#inferred-type')).toContainText('Hero');
  await page.reload();
  await expect(editor).toHaveValue(source);
  await expect(page.locator('.program-row')).toHaveCount(0);
  await expect(page.locator('#editor-prefix')).toHaveText('zeroToHero z =');
  await page.getByRole('button', { name: 'Attempt', exact: true }).click();
  await expect(page.locator('#level-dialog')).toBeVisible();
});

test('operators containing equals do not prevent dropping at the start', async ({ page }) => {
  await loadProgress(page, { currentLevel: 11 });
  const editor = page.locator('#code-editor');
  await editor.fill('z >>= dup');
  await page.locator('[data-func-name="f"]').dragTo(editor, { targetPosition: { x: 8, y: 12 } });
  await expect(editor).toHaveValue('f z >>= dup');
  await expect(page.locator('#editor-prefix')).toHaveText('zeroToHero z =');
});
