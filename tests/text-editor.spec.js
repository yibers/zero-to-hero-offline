const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
const URL = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
const source = page => page.getByRole('textbox', { name: 'Haskell expression', exact: true });
async function open(page, level = 1, code = 'mkHero $ runZero z') {
  await page.goto(URL);
  await page.evaluate(({ level, code }) => {
    localStorage.clear(); showIntro = false; iconMode = false; geckoOn = false; currentLevel = level;
    editorContents = {}; rowPrograms = {}; textDrafts = {}; setEditorContent(code); render();
  }, { level, code });
  await page.evaluate(() => document.fonts.ready);
}

test('text mode shows one editable let/in program, with no row cards or row controls', async ({ page }) => {
  await open(page);
  await expect(source(page)).toHaveValue('let\n  r1 = runZero z\nin\n  mkHero r1');
  await expect(page.locator('.program-row, #add-row, #available-results, .haskell-preview')).toHaveCount(0);
  await expect(page.locator('#editor-prefix')).toHaveText('zeroToHero z =');
  await expect(page.locator('.source-keyword')).toHaveText(['let', 'in']);

  await expect(page.locator('#status-bar')).toHaveClass(/success/);
});

test('named bindings, formatting, and edits survive refresh and both mode switches', async ({ page }) => {
  await open(page);
  const code = 'let\n    value = runZero z\nin mkHero value';
  await source(page).fill(code);
  await expect(page.locator('#syntax-hint')).not.toHaveClass(/invalid/);
  await page.evaluate(() => toggleIconMode());
  await expect(page.locator('.program-row')).toHaveCount(2);
  await expect(page.locator('.argument-slot[data-row="1"] svg')).toHaveAttribute('aria-label', /value: a/);
  await page.reload();
  await expect(page.locator('.program-row')).toHaveCount(2);
  await page.evaluate(() => toggleIconMode());
  await expect(source(page)).toHaveValue(code);
  await page.evaluate(() => toggleGecko());
  await expect(source(page)).toHaveValue(code);
  await page.evaluate(() => toggleIconMode());
  await page.locator('.argument-slot[data-row="0"]').click();
  await page.getByRole('button', { name: 'Clear input', exact: true }).click();
  await page.evaluate(() => toggleIconMode());
  await expect(source(page)).toHaveValue('let\n  value = runZero\nin\n  mkHero value');
});

test('incomplete drafts are not reformatted or discarded on refresh and mode switches', async ({ page }) => {
  await open(page);
  const draft = 'let\n  r1 = runZero z\n  r2 =';
  await source(page).fill(draft);
  await expect(page.locator('#syntax-hint')).toHaveClass(/invalid/);
  await page.reload();
  await expect(source(page)).toHaveValue(draft);
  await page.evaluate(() => toggleIconMode());
  await page.evaluate(() => toggleIconMode());
  await expect(source(page)).toHaveValue(draft);
  await source(page).fill('let\n  r1 = runZero z\nin\n  mkHero r1');
  await expect(page.locator('#syntax-hint')).not.toHaveClass(/invalid/);
});

test('Enter and Tab edit code indentation; typing and toolbar changes undo and redo', async ({ page }) => {
  await open(page, 1, '');
  const editor = source(page);
  await editor.fill('let');
  await editor.press('End');
  await editor.press('Enter');
  await expect(editor).toHaveValue('let\n  ');
  await editor.pressSequentially('value = runZero z');
  await editor.press('Enter');
  await expect(editor).toHaveValue('let\n  value = runZero z\n  ');
  await editor.press('Shift+Tab');
  await editor.pressSequentially('in');
  await editor.press('Enter');
  await editor.pressSequentially('mkHero value');
  const complete = await editor.inputValue();
  await expect(page.locator('#syntax-hint')).not.toHaveClass(/invalid/);
  await editor.press('Control+a'); await editor.press('Backspace');
  await expect(editor).toHaveValue('');
  await editor.press('Control+z');
  await expect(editor).toHaveValue(complete);
  await page.locator('.text-source-editor').first().press('Control+Shift+z');
  await expect(editor).toHaveValue('');
  await page.locator('.text-source-editor').first().press('Control+z');
  await expect(editor).toHaveValue(complete);
  await expect(page.locator('.program-row')).toHaveCount(0);
});

test('binding errors and forward references do not solve; all reference programs still type-check', async ({ page }) => {
  await open(page);
  for (const code of [
    'let\n  value = other\n  other = runZero z\nin mkHero value',
    'let\n  value = runZero z\n  value = runZero z\nin mkHero value',
    'let\n  z = runZero z\nin mkHero z',
    'let\n  value = mkHero (runZero z)\nin value'
  ]) {
    await source(page).fill(code);
    await expect(page.locator('#syntax-hint')).toHaveClass(/invalid/);
  }
  const failures = await page.evaluate(() => LEVELS.flatMap((level, index) => {
    currentLevel = index; setEditorContent(level.solution); render();
    return getRowError() || !typeCheck(level, getCodeFromEditor()).ok ? [level.level] : [];
  }));
  expect(failures).toEqual([]);
});

test('mouse drops target the correct line of the complete program', async ({ page }) => {
  await open(page, 0, '');
  await source(page).fill('let\n  r1 = z\nin\n  r1');
  const target = await source(page).evaluate(el => {
    const s = getComputedStyle(el); const context = document.createElement('canvas').getContext('2d'); context.font = s.font;
    return { x: parseFloat(s.paddingLeft) + 2 * context.measureText('M').width, y: parseFloat(s.paddingTop) + 3 * parseFloat(s.lineHeight) + 13 };
  });
  await page.locator('[data-func-name="f"]').dragTo(source(page), { targetPosition: target });
  await expect(source(page)).toHaveValue('let\n  r1 = z\nin\n  f r1');
  await page.locator('.text-source-editor').first().press('Control+z');
  await expect(source(page)).toHaveValue('let\n  r1 = z\nin\n  r1');
});

test('phone palette drag inserts into text mode without opening a row editor', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(); await open(page, 0, '');
  const cdp = await context.newCDPSession(page);
  const center = async locator => { await locator.scrollIntoViewIfNeeded(); const r = await locator.boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
  const from = await center(page.locator('[data-func-name="f"]')), to = await center(source(page));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
  await expect(page.locator('#touch-drag-ghost')).toBeVisible();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [to] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(source(page)).toHaveValue('f');
  await expect(page.locator('.program-row')).toHaveCount(0);
  await context.close();
});
