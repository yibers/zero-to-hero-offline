const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
const URL = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
const card = (page, name) => page.locator(`#function-palette [data-func-name="${name}"]`);
const slot = (page, row, position) => page.locator(`.argument-slot[data-row="${row}"][data-slot="${position}"]`);
async function open(page, level = 0, code = '', icons = true) {
  await page.goto(URL);
  await page.evaluate(({ level, code, icons }) => {
    localStorage.clear(); currentLevel = level; showIntro = false; iconMode = icons; geckoOn = false;
    completedLevels.clear(); bypassCount = 0; editorContents = {}; rowPrograms = {}; textDrafts = {}; activeRow = 0;
    clearRowHistory(); setEditorContent(code); render();
  }, { level, code, icons });
  await page.evaluate(() => document.fonts.ready);
}
async function choose(page, row, position, name) {
  await slot(page, row, position).click();
  await page.getByRole('button', { name: name ? `Use input ${name}` : 'Clear input', exact: true }).click();
}
async function pointerDrag(page, source, target, cdp) {
  await target.scrollIntoViewIfNeeded(); await source.scrollIntoViewIfNeeded();
  const a = await source.boundingBox(), b = await target.boundingBox();
  const from = { x: a.x + a.width / 2, y: a.y + a.height / 2 }, to = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  if (await source.evaluate(node => node.matches('.function-head'))) from.y = a.y + 3;
  if (await target.evaluate(node => node.matches('.function-head'))) to.y = b.y + 3;
  if (cdp) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...to, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.move(from.x, from.y); await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 }); await page.mouse.up();
  }
}

test('all levels define explicit exact budgets that match their reference solution cards', async ({ page }) => {
  await open(page);
  const levels = await page.evaluate(() => LEVELS.map(level => ({
    counts: level.funcs.map(f => f.uses), stock: functionUsage(level, level.solution),
    valid: checkSolution(level, level.solution).ok
  })));
  const expected = [[1], [1,1], [1,1,1], [1,1,1], [1,1,1], [1,1,1,2], [1,1,1,2],
    [1,1,1,1,2,1], [1,3,1,4], [2,1,1,3], [3,4,1,7], [1,1], [1,1,1], [1,1,1], [1,1,1,2], [1,1,1,1,1]];
  expect(levels.map(l => l.counts)).toEqual(expected);
  for (const level of levels) {
    expect(level.valid).toBe(true);
    for (const f of level.stock) { expect(f.used).toBe(f.limit); expect(f.remaining).toBe(0); }
  }
});

test('fewer copies, excess copies and unused copies fail even when the target type matches', async ({ page }) => {
  await open(page);
  const result = await page.evaluate(() => {
    const level = LEVELS[9];
    const fewer = 'let helper = f1; r1 = (.) helper f3; r2 = (.) helper r1; r3 = (.) f2 r2 in r3 z';
    const unused = fewer.replace('let ', 'let unused = f1; ');
    const excess = level.solution.replace('let', 'let unused = f1;');
    return { checks: [fewer, unused, excess].map(code => ({ typed: typeCheck(level, code).ok, ...checkSolution(level, code) })),
      unusedStock: functionUsage(level, unused).every(f => f.remaining === 0),
      alias: checkSolution(LEVELS[0], 'let helper = f in helper z').ok };
  });
  expect(result.checks.every(check => check.typed && !check.ok)).toBe(true);
  expect(result.checks[0].missing).toEqual(['f1']);
  expect(result.checks[1].missing).toEqual(['f1']);
  expect(result.checks[2].excess).toEqual(['f1']);
  expect(result.unusedStock).toBe(true); expect(result.alias).toBe(true);
});

test('text edits, unfinished drafts, undo, mode switches and reload derive the same inventory', async ({ page }) => {
  await open(page, 0, '', false);
  const source = page.getByRole('textbox', { name: 'Haskell expression', exact: true });
  await expect(card(page, 'f')).toHaveCount(1);
  await source.fill('let first = f z in f z');
  await expect(card(page, 'f')).toHaveCount(0);
  await expect(page.locator('#status-output')).toContainText('Too many copies: f');
  await expect(page.locator('#next-level')).toBeHidden();
  await source.fill('let first = f z\n next =');
  await expect(card(page, 'f')).toHaveCount(0);
  await page.reload();
  await expect(source).toHaveValue('let first = f z\n next =');
  await expect(card(page, 'f')).toHaveCount(0);
  await source.fill('');
  await expect(card(page, 'f')).toHaveCount(1);
  await source.press('Control+z');
  await expect(card(page, 'f')).toHaveCount(0);
  await source.fill('let helper = f in helper z');
  await expect(page.locator('#status-bar')).toHaveClass(/success/);
  await page.evaluate(() => toggleIconMode());
  await expect(card(page, 'f')).toHaveCount(0);
  await page.reload();
  await expect(card(page, 'f')).toHaveCount(0);
  await expect(page.locator('#status-bar')).toHaveClass(/success/);
});

test('dragging out a call returns its function and all arguments, and undo consumes them again', async ({ page }) => {
  await open(page, 2, '(.) mkHero runZero');
  await expect(page.locator('#function-palette .func-card')).toHaveCount(0);
  await pointerDrag(page, page.locator('.function-head'), page.locator('nav'));
  await expect(page.locator('#function-palette .func-card')).toHaveCount(3);
  await expect(page.locator('textarea.row-editor')).toHaveValue('');
  await page.locator('.program-row').first().press('Control+z');
  await expect(page.locator('#function-palette .func-card')).toHaveCount(0);
  await page.locator('.program-row').first().press('Control+Shift+z');
  await page.reload();
  await expect(page.locator('#function-palette .func-card')).toHaveCount(3);
});

test('depleted functions disappear from argument and operator pickers and cannot be injected by drop', async ({ page }) => {
  await open(page, 2, 'let helper = (.) mkHero in runZero');
  await slot(page, 0, 1).click();
  await expect(page.getByRole('button', { name: 'Use input mkHero', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Use input runZero', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await pointerDrag(page, page.locator('#editor-prefix [data-func-name="z"]'), page.locator('.function-head').last());
  await expect(page.getByRole('dialog', { name: 'Choose an operator' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Use .', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  const before = await page.evaluate(() => rowSnapshot());
  await page.locator('.empty-row-drop').evaluate(node => {
    const dataTransfer = new DataTransfer(); dataTransfer.setData('text/plain', '(.)');
    const r = node.getBoundingClientRect();
    node.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));
  });
  expect(await page.evaluate(() => rowSnapshot())).toBe(before);
  await expect(page.locator('#row-notice')).toContainText('No copies left: (.)');
});

test('old completions that used extra copies are reopened while drafts and settings survive', async ({ page }) => {
  await open(page);
  const code = 'let unused = f z in f z';
  await page.evaluate(code => {
    window.removeEventListener('beforeunload', saveProgress);
    localStorage.setItem('zth_progress', JSON.stringify({
      currentLevel: 0, completed: [0], bypassCount: 1, showIntro: false, iconMode: false, geckoOn: false,
      connectionVersion: 1, rowVersion: 1, completionVersion: 3, levelOrderVersion: 1, textDrafts: { 0: code }
    }));
  }, code);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Haskell expression', exact: true })).toHaveValue(code);
  await expect(page.locator('#next-level')).toBeHidden();
  expect(await page.evaluate(() => ({ completed: [...completedLevels], bypassCount, iconMode, geckoOn })))
    .toEqual({ completed: [], bypassCount: 1, iconMode: false, geckoOn: false });
  await expect(page.locator('#status-output')).toContainText('Too many copies');
});

test.describe('phone function inventory', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('two copies remain available until both are placed; moving, cancelling and removing keep stock correct', async ({ page }) => {
    await open(page, 6);
    const cdp = await page.context().newCDPSession(page);
    await expect(card(page, '(.)').locator('.function-stock')).toHaveText('×2');
    await pointerDrag(page, card(page, '(.)'), page.locator('textarea.row-editor'), cdp);
    await expect(card(page, '(.)').locator('.function-stock')).toHaveText('×1');
    await pointerDrag(page, card(page, '(.)'), page.locator('.empty-row-drop'), cdp);
    await expect(card(page, '(.)')).toHaveCount(0);
    await pointerDrag(page, page.locator('.function-head').first(), page.locator('.empty-row-drop'), cdp);
    await expect(page.locator('.function-head')).toHaveCount(2);
    await expect(card(page, '(.)')).toHaveCount(0);
    const head = page.locator('.function-head').first();
    await head.scrollIntoViewIfNeeded();
    const r = await head.boundingBox();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x + r.width / 2, y: r.y + 3, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await expect(card(page, '(.)')).toHaveCount(0);
    await pointerDrag(page, head, page.locator('nav'), cdp);
    await expect(card(page, '(.)').locator('.function-stock')).toHaveText('×1');
    await page.reload();
    await expect(card(page, '(.)').locator('.function-stock')).toHaveText('×1');
  });

  test('replacing, moving and removing function arguments releases only the appropriate copies', async ({ page }) => {
    await open(page, 2, '(.) mkHero');
    const cdp = await page.context().newCDPSession(page);
    await expect(card(page, 'mkHero')).toHaveCount(0);
    await pointerDrag(page, card(page, 'runZero'), slot(page, 0, 0), cdp);
    await expect(card(page, 'mkHero')).toHaveCount(1);
    await expect(card(page, 'runZero')).toHaveCount(0);
    await pointerDrag(page, slot(page, 0, 0), slot(page, 0, 1), cdp);
    await expect(card(page, 'runZero')).toHaveCount(0);
    await expect(page.locator('textarea.row-editor')).toHaveValue('(.) _ runZero');
    await choose(page, 0, 0, 'mkHero');
    await expect(page.locator('#function-palette .func-card')).toHaveCount(0);
    await pointerDrag(page, slot(page, 0, 1), page.locator('nav'), cdp);
    await expect(card(page, 'runZero')).toHaveCount(1);
    await expect(card(page, 'mkHero')).toHaveCount(0);
    await expect(card(page, '(.)')).toHaveCount(0);
  });
});
