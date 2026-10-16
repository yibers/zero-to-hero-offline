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
  const editor = page.getByRole('textbox', { name: 'Solution expression' });
  const prefix = page.locator('#editor-prefix');
  await expect(prefix).toHaveText('zeroToHero z =');
  await editor.fill('f z');
  const header = await prefix.boundingBox();
  const input = await editor.boundingBox();
  expect(input.y).toBeGreaterThanOrEqual(header.y + header.height);
  expect(input.x).toBeCloseTo(header.x, 0);
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
  await expect(editor).toHaveValue(solution);
  await expect(page.locator('#inferred-type')).toContainText('Hero');
  await page.getByText('Icons', { exact: true }).click();
  await page.getByText('Gecko Graph', { exact: true }).click();
  await expect(editor).toHaveValue(solution);
  await page.reload();
  await expect(editor).toHaveValue(solution);
  await page.getByRole('button', { name: 'Attempt', exact: true }).click();
  await expect(page.locator('#level-dialog')).toBeVisible();
});

test('multiline solutions retain their line breaks, highlighting, and saved progress', async ({ page }) => {
  await loadProgress(page, { currentLevel: 0 });
  const editor = page.locator('#code-editor');
  await editor.fill('f\nz');
  await expect(page.locator('#line-numbers')).toHaveText('23');
  await expect(page.locator('#editor-overlay')).toHaveText('f\nz');
  await expect(page.locator('#inferred-type')).toContainText('Hero');
  await editor.press('Control+Home');
  await editor.press('ArrowRight');
  await editor.press('ArrowRight');
  expect(await editor.evaluate(el => el.selectionStart)).toBe(3);
  await editor.press('ArrowLeft');
  await editor.press('ArrowLeft');
  expect(await editor.evaluate(el => el.selectionStart)).toBe(0);
  await editor.blur();
  await page.reload();
  await expect(editor).toHaveValue('f\nz');
  await expect(page.locator('#editor-prefix')).toHaveText('zeroToHero z =');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('zth_progress')));
  expect(saved.editorContents[0]).toBe('zeroToHero z = f\nz');
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
