const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
const PAGE_URL = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;

async function load(page, progress = {}) {
  await page.addInitScript(saved => {
    if (!localStorage.getItem('zth_progress')) {
      const initial = { showIntro: false, iconMode: true, geckoOn: false, connectionVersion: 1, ...saved };
      if (saved.connectionVersion === null) delete initial.connectionVersion;
      localStorage.setItem('zth_progress', JSON.stringify(initial));
    }
  }, progress);
  await page.goto(PAGE_URL);
  await page.evaluate(() => document.fonts.ready);
}
const tile = (page, name) => page.locator(`#editor-overlay > span:has([title="${name}"])`);
const previewNames = (picker, operator) => picker.getByRole('button', { name: `Use ${operator}`, exact: true })
  .locator('.connection-preview > .icon-sym').evaluateAll(icons => icons.map(icon => icon.getAttribute('title')));
const center = async locator => {
  const r = await locator.boundingBox();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
};
async function dropCard(page, name, target, edge = false) {
  const source = page.locator(`[data-func-name="${name}"]`);
  const from = await center(source);
  const r = await target.boundingBox();
  const to = { x: edge ? r.x + 1 : r.x + r.width / 2, y: r.y + r.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 6, from.y + 6);
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.move(to.x, to.y);
  await page.mouse.up();
}

test('ordinary application stays literal in both modes; all level solutions still pass', async ({ page }) => {
  await load(page, { currentLevel: 1, geckoOn: true });
  const editor = page.locator('#code-editor');
  await editor.fill('mkHero runZero z');
  expect(await page.evaluate(() => getCodeFromEditor())).toBe('mkHero runZero z');
  await expect(page.locator('#status-bar')).toHaveClass(/error/);
  await editor.fill('mkHero $ runZero z');
  await expect(page.locator('.row-feedback')).toContainText('One operation per row');
  await editor.fill('mkHero runZero z');
  await page.evaluate(() => toggleIconMode());
  await expect(editor).toHaveValue('mkHero runZero z');
  await page.evaluate(() => toggleIconMode());
  await expect(editor).toHaveValue('mkHero runZero z');
  const failures = await page.evaluate(() => LEVELS.flatMap(l => {
    const result = typeCheck(l, l.best);
    return result.ok ? [] : [{ level: l.level, result }];
  }));
  expect(failures).toEqual([]);
});

test('old implicit solutions migrate once, preserving all saved levels and preferences', async ({ page }) => {
  await load(page, { connectionVersion: null, currentLevel: 2, editorContents: {
    1: 'zeroToHero z = mkHero runZero z',
    2: 'zeroToHero z = f3 f1 z',
    6: 'zeroToHero z = f2 z <*> (f1 z <*> f3 z)',
  }, completed: [1], optimal: [1] });
  const editor = page.locator('#code-editor');
  await expect(editor).toHaveValue('f1 z');
  await expect(page.locator('textarea.row-editor').nth(1)).toHaveValue('f3 r1');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('zth_progress')));
  expect(saved.editorContents[1]).toBe('zeroToHero z = mkHero $ runZero z');
  expect(saved.editorContents[6]).toBe('zeroToHero z = f2 z <*> (f1 z <*> f3 z)');
  expect(saved.completed).toEqual([1]);
  expect(saved.optimal).toEqual([1]);
  expect(saved.iconMode).toBe(true);
  expect(saved.geckoOn).toBe(false);
  expect(saved.connectionVersion).toBe(1);
  await page.getByText('Icons', { exact: true }).click();
  await editor.fill('let\n  r1 = f3 f1 z\nin\n  f3 r1');
  await page.getByText('Icons', { exact: true }).click();
  await page.reload();
  await expect(editor).toHaveValue('f3 f1 z');
  await page.evaluate(() => toggleIconMode());
  const source = 'let\n  r1 = f3 f1 z\nin\n  f3 r1';
  await expect(editor).toHaveValue(source);
  await page.reload();
  await expect(editor).toHaveValue(source);
});

test('old text-mode solutions are not rewritten', async ({ page }) => {
  await load(page, { connectionVersion: null, iconMode: false, currentLevel: 2,
    editorContents: { 2: 'zeroToHero z = f3 f1 z' } });
  await expect(page.locator('#code-editor')).toHaveValue('f3 f1 z');
  await page.evaluate(() => toggleIconMode());
  await expect(page.locator('#code-editor')).toHaveValue('f3 f1 z');
});

test('native mouse drop at an edge inserts; center opens available operators with previews', async ({ page }) => {
  await load(page, { currentLevel: 2 });
  const editor = page.locator('#code-editor');
  await editor.fill('f1 z');
  await editor.blur();
  await dropCard(page, 'f3', tile(page, 'f1'), true);
  await expect(editor).toHaveValue('f3 f1 z');
  expect(await page.evaluate(() => getCodeFromEditor())).toBe('f3 f1 z');
  await expect(page.locator('#connection-picker')).toHaveCount(0);
  await editor.fill('f3 z');
  await editor.blur();
  await dropCard(page, 'f1', tile(page, 'f3'));
  const picker = page.getByRole('dialog', { name: 'Choose an operator' });
  await expect(picker).toBeVisible();
  await expect(editor).toHaveValue('f3 z');
  await expect(picker.locator('[data-operator]')).toHaveCount(3);
  expect(await previewNames(picker, '$')).toEqual(['f3', '$', 'f1', 'z']);
  expect(await previewNames(picker, '.')).toEqual(['f3', '.', 'f1', 'z']);
  await picker.getByRole('button', { name: 'Use $', exact: true }).click();
  await expect(editor).toHaveValue('f3 $ f1 z');
  expect(await page.evaluate(() => typeCheck(LEVELS[currentLevel], getCodeFromEditor()).ok)).toBe(true);
  await page.reload();
  await expect(editor).toHaveValue('f3 $ f1 z');
});

test('picker supports swap, no operator, Escape, and cancellation without duplicating moved tokens', async ({ page }) => {
  await load(page, { currentLevel: 2 });
  const editor = page.locator('#code-editor');
  await editor.fill('f1 f3 z');
  await editor.blur();
  const from = await center(tile(page, 'f1')), to = await center(tile(page, 'f3'));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await expect(tile(page, 'f3')).toHaveClass(/connection-target/);
  await page.mouse.up();
  const picker = page.locator('#connection-picker');
  await expect(picker).toBeVisible();
  await expect(editor).toHaveValue('f1 f3 z');
  expect(await previewNames(picker, '$')).toEqual(['f3', '$', 'f1', 'z']);
  await picker.getByRole('button', { name: 'Swap order' }).click();
  expect(await previewNames(picker, '$')).toEqual(['f1', '$', 'f3', 'z']);
  await picker.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(editor).toHaveValue('f1 f3 z');
  await expect(page.locator('.connection-target, .drag-source, #drag-out-ghost')).toHaveCount(0);
  await editor.fill('f3 z');
  await editor.blur();
  await dropCard(page, 'f1', tile(page, 'f3'));
  await page.keyboard.press('Escape');
  await expect(picker).toHaveCount(0);
  await expect(editor).toHaveValue('f3 z');
  await dropCard(page, 'f1', tile(page, 'f3'));
  await picker.getByRole('button', { name: 'Insert without operator' }).click();
  await expect(editor).toHaveValue('f3 f1 z');
  await editor.press('Control+z');
  await expect(editor).toHaveValue('f3 z');
});

test('editor-token connections commit as one move and leave no orphan connector', async ({ page }) => {
  await load(page, { currentLevel: 2 });
  const editor = page.locator('#code-editor');
  await editor.fill('f1 $ f3 z');
  await editor.blur();
  const from = await center(tile(page, 'f1')), to = await center(tile(page, 'f3'));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Use $', exact: true }).click();
  await expect(editor).toHaveValue('f3 $ f1 z');
  await editor.press('Control+z');
  await expect(editor).toHaveValue('f1 $ f3 z');
});

test('later levels offer their operators, text mode works, and rendering cancels pending choices', async ({ page }) => {
  await load(page, { currentLevel: 6 });
  const editor = page.locator('#code-editor');
  await editor.fill('f2 z');
  await editor.blur();
  await dropCard(page, 'f1', tile(page, 'f2'));
  await expect(page.locator('#connection-picker [data-operator]')).toHaveCount(5);
  for (const op of ['<$>', '<*>', '$', '.']) {
    await expect(page.getByRole('button', { name: `Use ${op}`, exact: true })).toBeVisible();
  }
  await page.evaluate(() => toggleIconMode());
  await expect(page.locator('#connection-picker')).toHaveCount(0);
  await expect(editor).toHaveValue('f2 z');
  await page.locator('[data-func-name="f1"]').dragTo(editor, { targetPosition: { x: 8, y: 12 } });
  await expect(page.locator('#connection-picker')).toHaveCount(0);
  await expect(editor).toHaveValue('f1 f2 z');
});

test('the function pane marks only operators in both display modes', async ({ page }) => {
  await load(page, { currentLevel: 6 });
  for (const mode of [true, false]) {
    await page.evaluate(mode => { iconMode = mode; render(); }, mode);
    await expect(page.locator('.right-panel .operator-badge')).toHaveCount(4);
    for (const name of ['(<$>)', '(<*>)', '($)', '(.)']) {
      await expect(page.locator(`[data-func-name="${name}"] .operator-badge`)).toHaveText('Operator');
    }
    await expect(page.locator('[data-func-name="f1"] .operator-badge')).toHaveCount(0);
    await expect(page.locator('[data-func-name="z"] .operator-badge')).toHaveCount(0);
  }
});
