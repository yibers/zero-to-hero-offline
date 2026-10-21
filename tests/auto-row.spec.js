const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
const URL = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
const ready = page => page.getByRole('button', { name: 'New function row', exact: true });
const row = (page, i = 0) => page.locator('textarea.row-editor').nth(i);
const slot = (page, i = 0) => page.locator(`.argument-slot[data-row="${i}"][data-slot="0"]`);
async function open(page, level = 0, code = '') {
  await page.goto(URL);
  await page.evaluate(({ level, code }) => {
    localStorage.clear(); currentLevel = level; showIntro = false; iconMode = true; geckoOn = false;
    editorContents = {}; rowPrograms = {}; textDrafts = {}; activeRow = 0; clearRowHistory();
    setEditorContent(code); render();
  }, { level, code });
  await page.evaluate(() => document.fonts.ready);
}
async function dragFunctionOut(page, index = 0) {
  const head = page.locator('.program-row').nth(index).locator('.function-head');
  await head.scrollIntoViewIfNeeded();
  const box = await head.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 3);
  await page.mouse.down(); await page.mouse.move(8, 10, { steps: 8 }); await page.mouse.up();
}
async function choose(page, index, name) {
  await slot(page, index).click();
  await page.getByRole('button', { name: name ? `Use input ${name}` : 'Clear input', exact: true }).click();
}

test('a compatible unfinished function keeps the goal in its row through edits and refresh', async ({ page }) => {
  await open(page);
  await expect(row(page)).toHaveValue('');
  await expect(ready(page)).toHaveCount(0); // The initial row is already empty.
  await page.locator('[data-func-name="f"]').dragTo(row(page));
  await expect(ready(page)).toHaveCount(0);
  await expect(page.locator('.program-row')).toHaveCount(1);
  await expect(page.locator('.program-row').last()).toHaveAccessibleName('Row 1');
  await expect(page.locator('.program-row').last().locator('.row-number')).toHaveText('1');
  await expect(page.locator('.final-row')).toHaveCount(0);
  expect(await page.evaluate(() => getCodeFromEditor())).toBe('f');
  await expect(page.locator('.program-row .goal-picture')).toBeVisible();
  await expect(page.locator('.row-result, .goal-reached')).toHaveCount(0);
  await expect(page.locator('.argument-slot .type-placeholder')).toHaveCount(1);
  await choose(page, 0, 'z');
  await expect(ready(page)).toHaveCount(0);
  expect(await page.evaluate(() => typeCheck(LEVELS[currentLevel], getCodeFromEditor()).ok)).toBe(true);
  expect(await page.evaluate(() => completedLevels.has(currentLevel))).toBe(true);
  await choose(page, 0, null);
  await expect(ready(page)).toHaveCount(0);
  await page.reload();
  await expect(ready(page)).toHaveCount(0);
  await page.evaluate(() => toggleIconMode());
  await expect(page.getByRole('textbox', { name: 'Haskell expression' })).toHaveValue('f');
  await expect(ready(page)).toHaveCount(0);
  await page.evaluate(() => toggleIconMode());
  await expect(ready(page)).toHaveCount(0);
  await dragFunctionOut(page);
  await expect(ready(page)).toHaveCount(0);
  await expect(page.locator('.program-row')).toHaveCount(1);
});

test('dropping into the spare row adds one step, preserves scoring, and is one undo action', async ({ page }) => {
  await open(page, 1);
  await page.locator('[data-func-name="runZero"]').dragTo(row(page));
  await choose(page, 0, 'z');
  await expect(page.locator('.program-row')).toHaveCount(2);
  await expect(page.locator('.program-row').last()).toHaveAccessibleName('Row 2');
  await expect(row(page)).not.toBeFocused();
  await page.locator('[data-func-name="mkHero"]').dragTo(ready(page));
  await expect(page.locator('.program-row')).toHaveCount(2);
  await expect(row(page, 1)).toHaveValue('mkHero');
  await expect(ready(page)).toHaveCount(0);
  await choose(page, 1, 'r1');
  await expect(ready(page)).toHaveCount(0);
  await expect(page.locator('.program-row')).toHaveCount(2);
  await expect(page.locator('.program-row').last()).toHaveClass(/final-row/);
  expect(await page.evaluate(() => ({ code: getCodeFromEditor(), score: RowProgram.score(getCodeFromEditor()), error: getRowError() })))
    .toEqual({ code: 'let\n  r1 = runZero z\nin\n  mkHero r1', score: 2, error: null });
  await page.locator('.program-row:not(.ready-row)').first().press('Control+z');
  await expect(row(page, 1)).toHaveValue('mkHero');
  await expect(ready(page)).toHaveCount(0);
  await page.locator('.program-row:not(.ready-row)').first().press('Control+z');
  await expect(page.locator('.program-row')).toHaveCount(2);
  await expect(ready(page)).toHaveCount(1);
  await page.locator('.program-row:not(.ready-row)').first().press('Control+Shift+z');
  await expect(row(page, 1)).toHaveValue('mkHero');
  await page.locator('.program-row:not(.ready-row)').first().press('Control+Shift+z');
  await expect(ready(page)).toHaveCount(0);

  await expect(page.locator('#status-bar')).toHaveClass(/success/);
  await expect(ready(page)).toHaveCount(0);
});

test('a trailing empty row is reused, and clearing an earlier row removes it and keeps the next step', async ({ page }) => {
  await open(page, 1, 'runZero z');
  await ready(page).click();
  await expect(row(page, 1)).toHaveValue('');
  await expect(row(page, 1)).not.toBeFocused();
  await expect(page.locator('.program-row').nth(1)).toBeFocused();
  await expect(ready(page)).toHaveCount(0);
  await row(page, 1).fill('mkHero');
  await expect(ready(page)).toHaveCount(0);
  await dragFunctionOut(page);
  await expect(row(page, 0)).toHaveValue('mkHero');
  await expect(page.locator('textarea.row-editor')).toHaveCount(1);
  await expect(ready(page)).toHaveCount(0);
  await expect(page.locator('.program-row')).toHaveCount(1);
  await page.reload();
  await expect(ready(page)).toHaveCount(0);
  await choose(page, 0, 'z');
  await expect(ready(page)).toBeVisible();
  await page.locator('[data-func-name="runZero"]').dragTo(ready(page));
  await expect(row(page, 1)).toHaveValue('runZero');
  await expect(page.locator('.program-row')).toHaveCount(2);
  await page.locator('.program-row:not(.ready-row)').first().press('Control+z');
  await expect(page.locator('.program-row')).toHaveCount(2);
});

test('every solved reference has no spare row; wrong types and invalid row programs still have one', async ({ page }) => {
  await open(page);
  const failures = await page.evaluate(() => LEVELS.flatMap((level, index) => {
    currentLevel = index; setEditorContent(level.solution); render();
    return document.querySelector('.ready-row') || !typeCheck(level, getCodeFromEditor()).ok ? [index + 1] : [];
  }));
  expect(failures).toEqual([]);
  await page.evaluate(() => { currentLevel = 1; setEditorContent('mkHero z'); render(); });
  await expect(ready(page)).toHaveCount(1); // Hero (Zero a) is not the target Hero a.
  await dragFunctionOut(page);
  await row(page).fill('mkHero (runZero z)');
  await expect(ready(page)).toHaveCount(1); // Correct type, but two calls in one row.
  await expect(page.locator('#status-bar')).toHaveClass(/error/);
});

test.describe('phone automatic rows', () => {
  test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  test('the next row stays visible after outputs grow, and returns on undo after solving', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 760 });
    await open(page, 1, 'let\n  r1 = runZero z\nin\n  mkHero z');
    await expect(page.locator('.ready-row')).toBeInViewport({ ratio: 1 });
    await expect(row(page, 1)).not.toBeFocused();
    await choose(page, 1, 'r1');
    await expect(ready(page)).toHaveCount(0);
    await page.locator('.program-row:not(.ready-row)').first().press('Control+z');
    await expect(page.locator('.ready-row')).toBeInViewport({ ratio: 1 });
    await expect(row(page, 1)).not.toBeFocused();
  });

  test('tapping the empty next row focuses it without a typing cursor', async ({ page }) => {
    await open(page, 1, 'runZero z');
    await ready(page).tap();
    await expect(page.locator('.program-row').nth(1)).toBeFocused();
    await expect(row(page, 1)).not.toBeFocused();
    await expect(row(page, 1)).toHaveAttribute('inputmode', 'none');
    await expect(row(page, 1)).toHaveCSS('caret-color', 'rgba(0, 0, 0, 0)');
  });

  test('touch drop adds the next row; cancellation leaves it empty and solving removes the spare', async ({ page }) => {
    await open(page, 1, 'runZero z');
    const cdp = await page.context().newCDPSession(page);
    const send = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(p => ({ ...p, id: 1 })) });
    const center = async locator => { await locator.scrollIntoViewIfNeeded(); const r = await locator.boundingBox(); return { x: r.x+r.width/2, y: r.y+r.height/2 }; };
    const from = await center(page.locator('[data-func-name="mkHero"]')), to = await center(ready(page));
    await send('touchStart', [from]);
    await send('touchMove', [to]);
    await expect(page.locator('.ready-row')).toHaveClass(/drag-over/);
    await expect(page.locator('#touch-drag-ghost')).not.toHaveClass(/removing/);
    await send('touchCancel', []);
    await expect(page.locator('.program-row')).toHaveCount(2);
    await expect(ready(page)).toHaveCount(1);
    await send('touchStart', [from]);
    for (let i = 1; i <= 8; i++) await send('touchMove', [{ x: from.x+(to.x-from.x)*i/8, y: from.y+(to.y-from.y)*i/8 }]);
    await send('touchEnd', []);
    await expect(row(page, 1)).toHaveValue('mkHero');
    await expect(row(page, 1)).not.toBeFocused();
    await expect(ready(page)).toHaveCount(0);
    await expect(page.locator('.program-row').last().locator('.goal-picture')).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: '/tmp/zth-auto-row-phone.png' });
    await choose(page, 1, 'r1');
    await expect(ready(page)).toHaveCount(0);
    await page.reload();
    await expect(page.locator('.program-row')).toHaveCount(2);
    await expect(ready(page)).toHaveCount(0);

    await expect(page.locator('#status-bar')).toHaveClass(/success/);
  });
});


test('incompatible arguments move the goal to a new row, and clearing or undoing brings it back', async ({ page }) => {
  await open(page, 1, 'mkHero');
  const goal = page.locator('.goal-picture svg[data-diagram-type]');
  await expect(ready(page)).toHaveCount(0);
  await expect(goal).toHaveAttribute('aria-label', 'Goal: Hero a');
  await expect(page.locator('.row-result')).toHaveCount(0);
  await expect(slot(page).locator('.type-placeholder')).toHaveCount(1);
  await choose(page, 0, 'z');
  await expect(ready(page)).toHaveCount(1);
  await expect(page.locator('.ready-row .goal-picture')).toBeVisible();
  await expect(page.locator('.row-result svg')).toHaveAttribute('aria-label', 'Expected result r1: Hero (Zero a)');
  await page.reload();
  await expect(ready(page)).toHaveCount(1);
  await choose(page, 0, null);
  await expect(ready(page)).toHaveCount(0);
  await expect(page.locator('.program-row')).toHaveCount(1);
  await expect(page.locator('.row-result')).toHaveCount(0);
  await expect(goal).toHaveAttribute('aria-label', 'Goal: Hero a');
  await page.locator('.program-row').first().press('Control+z');
  await expect(ready(page)).toHaveCount(1);
  await page.locator('.program-row').first().press('Control+Shift+z');
  await expect(ready(page)).toHaveCount(0);
  expect(await page.evaluate(() => getRows())).toEqual([{ id: 'r1', expr: 'mkHero' }]);
});

test('partial applications recheck the goal after any input and preserve earlier rows', async ({ page }) => {
  await open(page, 15, 'let r1 = g z in (<$>)');
  const chooseSlot = async (position, name) => {
    await page.locator(`.argument-slot[data-row="1"][data-slot="${position}"]`).click();
    await page.getByRole('button', { name: name ? `Use input ${name}` : 'Clear input', exact: true }).click();
  };
  await expect(ready(page)).toHaveCount(0);
  await chooseSlot(1, 'r1');
  await expect(ready(page)).toHaveCount(0); // The return placeholder can still be the target pair.
  await expect(page.locator('.program-row').last().locator('.goal-picture')).toBeVisible();
  await expect(page.locator('.goal-reached')).toHaveCount(0);
  await chooseSlot(0, 'pair');
  await expect(ready(page)).toHaveCount(1); // The output is now a Hero containing a function.
  await chooseSlot(1, null);
  await expect(ready(page)).toHaveCount(1); // The first input alone already fixes the output's structure.
  await chooseSlot(0, null);
  await expect(ready(page)).toHaveCount(0);
  expect(await page.evaluate(() => getRows())).toEqual([{ id: 'r1', expr: 'g z' }, { id: 'r2', expr: '(<$>)' }]);
});

test('changes in earlier results recheck the last row without removing completed work', async ({ page }) => {
  await open(page, 1, 'let r1 = runZero z in mkHero r1');
  await expect(page.locator('.goal-reached')).toHaveCount(1);
  await choose(page, 0, null);
  await expect(ready(page)).toHaveCount(1); // mkHero now wraps the partially applied runZero function.
  await expect(page.locator('textarea.row-editor')).toHaveCount(2);
  await choose(page, 0, 'z');
  await expect(ready(page)).toHaveCount(0);
  await expect(page.locator('.goal-reached')).toHaveCount(1);
  await expect(page.locator('textarea.row-editor')).toHaveCount(2);
});
