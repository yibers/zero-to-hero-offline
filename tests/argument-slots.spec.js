const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
const URL = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
const row = (page, i = 0) => page.locator('textarea.row-editor').nth(i);
const slot = (page, i, n) => page.locator(`.argument-slot[data-row="${i}"][data-slot="${n}"]`);
async function open(page, level = 0, code = '') {
  await page.goto(URL);
  await page.evaluate(({ level, code }) => {
    localStorage.clear(); currentLevel = level; showIntro = false; iconMode = true; geckoOn = false;
    editorContents = {}; rowPrograms = {}; activeRow = 0; setEditorContent(code); render();
  }, { level, code });
  await page.evaluate(() => document.fonts.ready);
}
async function center(locator) {
  await locator.scrollIntoViewIfNeeded();
  const r = await locator.boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}
async function mouseDrag(page, source, target) {
  const to = await center(target), from = await center(source);
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(from.x + 6, from.y + 6);
  await page.mouse.move(to.x, to.y, { steps: 8 }); await page.mouse.move(to.x, to.y); await page.mouse.up();
}
async function fillRow(page, index, code) {
  const edit = page.getByRole('button', { name: `Edit code for row ${index + 1}`, exact: true });
  if (await edit.isVisible()) await edit.click();
  await row(page, index).fill(code);
  const block = page.getByRole('button', { name: `Show block for row ${index + 1}`, exact: true });
  if (await block.isVisible()) await block.click();
}
async function choose(page, index, n, name) {
  await slot(page, index, n).click();
  await page.getByRole('button', { name: name ? `Use input ${name}` : 'Clear input', exact: true }).click();
}

test('drop an argument inside a function, without a connector, and render its output', async ({ page }) => {
  await open(page, 0, 'f');
  await mouseDrag(page, page.locator('#editor-prefix [data-func-name="z"]'), slot(page, 0, 0));
  await expect(row(page)).toHaveValue('f z');
  await expect(page.locator('#connection-picker')).toHaveCount(0);
  await expect(slot(page, 0, 0)).toHaveAttribute('aria-label', 'Input 1 of f: z');
  await expect(page.locator('.row-result svg')).toHaveAttribute('aria-label', 'Result r1: Hero a');
  await expect(page.locator('.row-result svg circle')).toHaveCount(1);
  await page.getByRole('button', { name: 'Attempt', exact: true }).click();
  await expect(page.locator('#level-dialog')).toBeVisible();
});

test('arguments appear once inside the function rectangle and code editing is a separate view', async ({ page }) => {
  await open(page, 7, 'fmap cd z');
  await expect(page.locator('.function-block')).toBeVisible();
  await expect(row(page)).not.toBeVisible();
  for (const name of ['fmap', 'cd', 'z']) await expect(page.locator(`.row-call [data-name="${name}"]:visible`)).toHaveCount(1);
  const bounds = await page.locator('.function-block').boundingBox();
  for (const n of [0, 1]) {
    const input = await slot(page, 0, n).boundingBox();
    expect(input.x).toBeGreaterThan(bounds.x);
    expect(input.y).toBeGreaterThan(bounds.y);
    expect(input.x + input.width).toBeLessThan(bounds.x + bounds.width);
    expect(input.y + input.height).toBeLessThan(bounds.y + bounds.height);
  }
  await page.getByRole('button', { name: 'Edit code for row 1', exact: true }).click();
  await expect(row(page)).toBeVisible();
  await expect(page.locator('.function-block')).not.toBeVisible();
  await row(page).fill('fmap bd');
  await expect(row(page)).toBeFocused();
  await page.getByRole('button', { name: 'Show block for row 1', exact: true }).click();
  await expect(slot(page, 0, 0)).toHaveAttribute('aria-label', 'Input 1 of fmap: bd');
  await expect(slot(page, 0, 1)).toHaveAttribute('aria-label', 'Input 2 of fmap: empty');
  await page.reload();
  await expect(row(page)).toHaveValue('fmap bd');
  await expect(row(page)).not.toBeVisible();
});

test('dropping on the function head still opens the operator chooser', async ({ page }) => {
  await open(page, 2, 'f1 z');
  await mouseDrag(page, page.locator('.right-panel [data-func-name="f3"]'), page.locator('.function-head'));
  await expect(page.getByRole('dialog', { name: 'Choose an operator' })).toBeVisible();
  await page.getByRole('button', { name: 'Use $', exact: true }).click();
  await expect(row(page)).toHaveValue('f1 $ f3 z');
});

test('fill a later input first, keep the hole through reload, then supply a function parameter', async ({ page }) => {
  await open(page, 7, 'fmap');
  await choose(page, 0, 1, 'z');
  await expect(row(page)).toHaveValue('fmap _ z');
  await expect(page.locator('.row-feedback')).toContainText('Fill the empty input');
  await expect(page.locator('.row-result')).toHaveCount(0);
  await page.reload();
  await expect(slot(page, 0, 0)).toHaveAttribute('aria-label', 'Input 1 of fmap: empty');
  await choose(page, 0, 0, 'cd');
  await expect(row(page)).toHaveValue('fmap cd z');
  await expect(page.locator('.row-result svg')).toHaveAttribute('aria-label', 'Result r1: Zero a b d');
  expect(await page.evaluate(() => getRowError())).toBe(null);
  await page.getByRole('button', { name: 'Undo row edit' }).click();
  await expect(row(page)).toHaveValue('fmap _ z');
});

test('slots accept ordinary functions and operators as values, and partial application stays valid', async ({ page }) => {
  await open(page, 2, '(.)');
  await choose(page, 0, 0, 'f3');
  await choose(page, 0, 1, 'f1');
  await expect(row(page)).toHaveValue('(.) f3 f1');
  await expect(page.locator('.row-result svg')).toHaveAttribute('aria-label', 'Result r1: Zero a -> Hero (a, a)');
  await choose(page, 0, 2, 'z');
  await expect(page.locator('.row-result svg')).toHaveAttribute('aria-label', 'Result r1: Hero (a, a)');
  await fillRow(page, 0, '($)');
  await choose(page, 0, 0, '(.)');
  await expect(row(page)).toHaveValue('($) (.)');
  expect(await page.evaluate(() => getRowError())).toBe(null);
});

test('replace and clear infix inputs without deleting their operator', async ({ page }) => {
  await open(page, 1, '');
  await fillRow(page, 0, 'mkHero $ z');
  await choose(page, 0, 1, 'runZero');
  await expect(row(page)).toHaveValue('mkHero $ runZero');
  await choose(page, 0, 0, null);
  await expect(row(page)).toHaveValue('_ $ runZero');
  await choose(page, 0, 0, 'mkHero');
  await expect(row(page)).toHaveValue('mkHero $ runZero');
});

test('rendered results update dependent rows and are removed when inference fails', async ({ page }) => {
  await open(page, 2, 'f3 $ f1 z');
  await expect(page.locator('.row-result').nth(1).locator('svg')).toHaveAttribute('aria-label', 'Result r2: Hero (a, a)');
  await expect(page.locator('.row-result').nth(1).locator('circle')).toHaveCount(2);
  await fillRow(page, 0, 'f3');
  await expect(page.locator('.program-row').nth(1).locator('.row-result')).toHaveCount(0);
  await expect(page.locator('.program-row').nth(1)).toHaveClass(/row-invalid/);
  await fillRow(page, 0, 'f1 z');
  await expect(page.locator('.row-result').nth(1).locator('svg circle')).toHaveCount(2);
  await page.evaluate(() => toggleIconMode());
  await expect(page.locator('.row-result')).toHaveCount(2);
});

test('drag the output picture itself into a later input; self references remain blocked', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1200 });
  await open(page, 1, 'runZero z');
  await page.getByRole('button', { name: '+ Add row', exact: true }).click();
  await fillRow(page, 1, 'mkHero');
  await mouseDrag(page, page.locator('.row-result').first(), slot(page, 1, 0));
  await expect(row(page, 0)).toHaveValue('runZero z');
  await expect(row(page, 1)).toHaveValue('mkHero r1');
  await mouseDrag(page, page.locator('.row-result').last(), slot(page, 1, 0));
  await expect(row(page, 1)).toHaveValue('mkHero r1');
  await expect(page.locator('#row-notice')).toContainText('only in a row below');
});

test('all reference solutions render every row including tuples, nested Heroes, unit and functions', async ({ page }) => {
  await open(page);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const results = await page.evaluate(() => LEVELS.map((level, index) => {
    currentLevel = index; setEditorContent(level.best); render();
    return { level: index + 1, expected: getRows().length, rendered: document.querySelectorAll('.row-result .result-shape').length, valid: !getRowError() };
  }));
  expect(errors).toEqual([]);
  for (const r of results) { expect(r.rendered, `Level ${r.level}`).toBe(r.expected); expect(r.valid).toBe(true); }
});

test.describe('phone input slots', () => {
  test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  async function touch(page) {
    const cdp = await page.context().newCDPSession(page);
    const send = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({ ...p, id: i + 1 })) });
    return { send, async drag(from, to) {
      await send('touchStart', [from]);
      await expect(page.locator('#touch-drag-ghost')).toBeVisible();
      for (let i = 1; i <= 8; i++) await send('touchMove', [{ x: from.x + (to.x - from.x) * i / 8, y: from.y + (to.y - from.y) * i / 8 }]);
      await send('touchEnd', []);
    }};
  }
  test('immediately drag into a slot, replace it, drag out and undo', async ({ page }) => {
    await open(page, 7, 'fmap');
    const t = await touch(page);
    const to = await center(slot(page, 0, 0));
    await t.drag(await center(page.locator('#editor-prefix [data-func-name="bd"]')), to);
    await expect(row(page)).toHaveValue('fmap bd');
    await t.drag(await center(page.locator('#editor-prefix [data-func-name="cd"]')), await center(slot(page, 0, 0)));
    await expect(row(page)).toHaveValue('fmap cd');
    await t.drag(await center(slot(page, 0, 0)), { x: 8, y: 10 });
    await expect(row(page)).toHaveValue('fmap');
    await page.getByRole('button', { name: 'Undo row edit' }).tap();
    await expect(row(page)).toHaveValue('fmap cd');
    await expect(page.locator('.slot-target, #touch-drag-ghost')).toHaveCount(0);
  });
  test('use the rendered previous result as an input and preserve it after refresh', async ({ page }) => {
    await open(page, 1, 'runZero z');
    await page.getByRole('button', { name: '+ Add row', exact: true }).tap();
    await fillRow(page, 1, 'mkHero'); await row(page, 1).blur();
    const target = await center(slot(page, 1, 0));
    const card = page.getByRole('button', { name: 'Use result r1', exact: true });
    await expect(card.locator('.result-shape')).toHaveCount(1);
    await (await touch(page)).drag(await center(card), target);
    await expect(row(page, 1)).toHaveValue('mkHero r1');
    await expect(slot(page, 1, 0).locator('.result-shape')).toHaveCount(1);
    await expect(row(page, 1)).not.toBeFocused();
    await page.reload();
    await expect(row(page, 1)).toHaveValue('mkHero r1');
    await page.getByRole('button', { name: 'Attempt', exact: true }).tap();
    await expect(page.locator('#level-dialog')).toBeVisible();
  });
  test('move a filled input between slots, preserve argument position, and cancel without changes', async ({ page }) => {
    await open(page, 14, 'pair f g');
    const t = await touch(page);
    await t.drag(await center(slot(page, 0, 0)), await center(slot(page, 0, 1)));
    await expect(row(page)).toHaveValue('pair _ f');
    await expect(page.locator('.row-result')).toHaveCount(0);
    const start = await center(slot(page, 0, 1));
    await t.send('touchStart', [start]);
    await t.send('touchMove', [{ x: start.x - 20, y: start.y - 20 }]);
    await t.send('touchCancel', []);
    await expect(row(page)).toHaveValue('pair _ f');
    await page.getByRole('button', { name: 'Undo row edit' }).tap();
    await expect(row(page)).toHaveValue('pair f g');
    await slot(page, 0, 0).tap();
    await expect(page.getByRole('dialog', { name: 'Choose input 1 of pair' })).toBeVisible();
  });
});
