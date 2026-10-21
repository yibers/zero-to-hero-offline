const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
const URL = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
const row = (page, i) => page.locator('textarea.row-editor').nth(i);
async function open(page, level = 0, icons = true) {
  await page.goto(URL);
  await page.evaluate(({ level, icons }) => {
    localStorage.clear(); currentLevel = level; showIntro = false; iconMode = icons; geckoOn = false;
    editorContents = {}; rowPrograms = {}; activeRow = 0; render();
  }, { level, icons });
  await page.evaluate(() => document.fonts.ready);
}
async function fillRow(page, i, code) {
  const source = await page.evaluate(({ i, code }) => {
    const rows = structuredClone(getRows()); rows[i].expr = code;
    return RowProgram.source(rows);
  }, { i, code });
  await page.getByText('Icons', { exact: true }).click();
  await page.getByRole('textbox', { name: 'Haskell expression' }).fill(source);
  await page.getByText('Icons', { exact: true }).click();
}
async function load(page, level, code) {
  await page.evaluate(({ level, code }) => { currentLevel = level; setEditorContent(code); render(); }, { level, code });
}

test('every reference solution migrates to valid single-operation rows and still solves', async ({ page }) => {
  await open(page);
  const results = await page.evaluate(() => LEVELS.map(level => {
    const rows = RowProgram.migrate(level.solution), source = RowProgram.source(rows);
    return { level: level.level, valid: RowProgram.validate(rows, level).every(x => !x), solves: typeCheck(level, source).ok, inferred: liveInfer(level, source).valid, score: RowProgram.score(source) === rows.length };
  }));
  for (const result of results) expect(result).toEqual({ level: result.level, valid: true, solves: true, inferred: true, score: true });
});

test('level 2 builds with a result reference, generates let, solves and survives refresh', async ({ page }) => {
  await open(page, 1);
  await row(page, 0).fill('runZero z');
  await expect(page.locator('.row-feedback').first()).toContainText('a');
  await page.locator('#add-row').evaluate(button => button.click());
  await row(page, 1).fill('mkHero');
  await page.locator('.row-result[data-func-name="r1"]').click();
  await expect(row(page, 1)).toHaveValue('mkHero r1');
  await expect(page.locator('.row-role').last()).toHaveText('Final answer');
  expect(await page.evaluate(() => getCodeFromEditor())).toBe('let\n  r1 = runZero z\nin\n  mkHero r1');
  await page.reload();
  await expect(row(page, 0)).toHaveValue('runZero z');
  await expect(row(page, 1)).toHaveValue('mkHero r1');

  await expect(page.locator('#status-bar')).toHaveClass(/success/);
  await expect(page.locator('#status-output')).toContainText('every function is used exactly as many times as supplied');
});

test('nested calls and applied operands are rejected, but f x y and function values are allowed', async ({ page }) => {
  await open(page, 8);
  await row(page, 0).fill('fmap bd z');
  await expect(page.locator('.row-feedback')).not.toContainText('One operation');
  await row(page, 0).fill('f2 (f1 z)');
  await expect(page.locator('.row-feedback')).toContainText('One operation per row');

  await expect(page.locator('#status-output')).toContainText('One operation per row');
  await load(page, 7, '');
  await row(page, 0).fill('f2 z <*> f3 z');
  await expect(page.locator('.row-feedback')).toContainText('One operation per row');
  await row(page, 0).fill('(<*>) f2 f1');
  expect(await page.evaluate(() => RowProgram.validate(getRows(), LEVELS[currentLevel]))).toEqual([null]);
});

test('self and forward references are rejected and changing an earlier row updates dependents', async ({ page }) => {
  await open(page, 1);
  await row(page, 0).fill('mkHero r1');
  await expect(page.locator('.row-feedback')).toContainText('not an earlier result');
  await row(page, 0).fill('mkHero r2');
  await expect(page.locator('.row-feedback')).toContainText('not an earlier result');
  await load(page, 1, 'mkHero $ runZero z');
  await expect(page.locator('.row-feedback').last()).toContainText('Hero');
  await fillRow(page, 0, 'mkHero z');
  await expect(page.locator('.row-feedback').last()).toContainText('Hero');

  await expect(page.locator('#status-bar')).toContainText('Not solved');
});

test('function-valued results can be applied and reused polymorphically', async ({ page }) => {
  await open(page, 15);
  const result = await page.evaluate(() => {
    const code = 'let\n  r1 = pair\n  r2 = g z\n  r3 = r1 <$> r2\n  r4 = f z\nin\n  r3 <*> r4';
    return typeCheck(LEVELS[15], code);
  });
  expect(result.ok).toBe(true);
  await load(page, 1, '');
  await row(page, 0).fill('mkHero');
  await page.locator('#add-row').evaluate(button => button.click());
  await row(page, 1).fill('runZero z');
  await page.locator('#add-row').evaluate(button => button.click());
  await row(page, 2).fill('r1 r2');

  await expect(page.locator('#status-bar')).toHaveClass(/success/);
});

test('deleting dependent rows requires confirmation and undo restores the full program', async ({ page }) => {
  await open(page, 1);
  await load(page, 1, 'mkHero $ runZero z');
  await expect(page.locator('.row-menu')).toHaveCount(0);
  await page.locator('.row-delete').first().evaluate(button => button.click());
  const dialog = page.getByRole('dialog', { name: 'Delete 2 rows?', exact: true });
  await expect(dialog).toBeVisible();
  await expect(page.locator('.program-row')).toHaveCount(2);
  await expect(page.locator('.program-row.delete-preview')).toHaveCount(2);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.delete-preview')).toHaveCount(0);
  await expect(row(page, 1)).toHaveValue('mkHero r1');
  await page.locator('.row-delete').first().evaluate(button => button.click());
  await dialog.getByRole('button', { name: 'Delete 2 rows', exact: true }).click();
  await expect(page.locator('.program-row')).toHaveCount(1);
  await expect(row(page, 0)).toHaveValue('');
  await page.locator('.program-row:not(.ready-row)').first().press('Control+z');
  await expect(row(page, 0)).toHaveValue('runZero z');
  await expect(row(page, 1)).toHaveValue('mkHero r1');
  await page.locator('.program-row:not(.ready-row)').first().press('Control+Shift+z');
  await expect(page.locator('.program-row')).toHaveCount(1);
  await expect(row(page, 0)).toHaveValue('');
});

test('legacy saved progress preserves settings and rechecks the learning requirements', async ({ page }) => {
  await page.goto(URL);
  await page.evaluate(() => { window.removeEventListener('beforeunload', saveProgress); localStorage.setItem('zth_progress', JSON.stringify({
    currentLevel: 6, showIntro: false, iconMode: true, geckoOn: false, connectionVersion: 1,
    completed: [0,1], optimal: [0], bypassCount: 2,
    editorContents: { 6: 'zeroToHero z = f2 z <*> (f1 z <*> f3 z)' }
  })); });
  await page.reload();
  await expect(page.locator('.program-row:not(.ready-row)')).toHaveCount(5);
  await expect(page.locator('.ready-row')).toHaveCount(1);
  expect(await page.evaluate(() => typeCheck(LEVELS[7], getCodeFromEditor()).ok)).toBe(true);
  await page.getByText('Icons', { exact: true }).click();
  await page.reload();
  expect(await page.evaluate(() => ({ count: getRows().length, completed: [...completedLevels], bypassCount, geckoOn, iconMode }))).toEqual({ count: 5, completed: [], bypassCount: 2, geckoOn: false, iconMode: false });
});

test('unfinished legacy expressions are retained with an actionable error', async ({ page }) => {
  await open(page, 1);
  await load(page, 1, 'mkHero $ (runZero');
  await expect(row(page, 0)).toHaveValue('mkHero $ (runZero');
  await expect(page.locator('.row-feedback')).toContainText('closing parenthesis');
});

test('score ignores generated names and includes unused operations', async ({ page }) => {
  await open(page);
  expect(await page.evaluate(() => [
    RowProgram.score('let\n  r1 = f z\nin\n  r1'),
    RowProgram.score('let\n  r999 = f z\nin\n  r999'),
    RowProgram.score('let\n  r1 = f z\nin\n  f z')
  ])).toEqual([1,1,2]);
});

test.describe('phone rows', () => {
  test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  async function center(locator) { await locator.scrollIntoViewIfNeeded(); const r = await locator.boundingBox(); return { x: r.x+r.width/2, y:r.y+r.height/2 }; }
  async function touch(page) {
    const cdp = await page.context().newCDPSession(page);
    const send = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints:points.map((p,i)=>({...p,id:i+1})) });
    return { send, async drag(a,b) { await send('touchStart',[a]); for(let i=1;i<=8;i++) await send('touchMove',[{x:a.x+(b.x-a.x)*i/8,y:a.y+(b.y-a.y)*i/8}]); await send('touchEnd',[]); } };
  }
  test('drag a prior result into a later row and keep it after reload', async ({ page }) => {
    await open(page, 1, true);
    await row(page, 0).fill('runZero z');
    await page.locator('#add-row').evaluate(button => button.click());
    await row(page, 1).fill('mkHero'); await row(page, 1).blur();
    // Return to the normal icon layout after setting up the expressions.
    await page.evaluate(() => render());
    const to = await center(page.locator('.argument-slot[data-row="1"][data-slot="0"]'));
    const from = await center(page.locator('.row-result[data-func-name="r1"]'));
    await (await touch(page)).drag(from,to);
    await expect(row(page,1)).toHaveValue('mkHero r1');
    await expect(row(page,1)).not.toBeFocused();
    await page.reload(); await expect(row(page,1)).toHaveValue('mkHero r1');

    await expect(page.locator('#status-bar')).toHaveClass(/success/);
  });
  test('tokens move between rows, drag out, and undo restores them', async ({ page }) => {
    await open(page, 0, true);
    await row(page, 0).fill('f z');
    await page.locator('#add-row').evaluate(button => button.click());
    const t = await touch(page);
    // Both rows must be visible during the gesture.
    await page.locator('#program-rows').evaluate(el=>{el.style.minHeight='470px';el.scrollTop=0;});
    const to = await center(row(page,1));
    const from = await center(page.locator('.program-row').first().locator('[data-name="f"]'));
    await t.drag(from,to);
    await expect(row(page,0)).toHaveValue('z'); await expect(row(page,1)).toHaveValue('f');
    await t.drag(await center(page.locator('.program-row').nth(1).locator('[data-name="f"]')),{x:8,y:10});
    await expect(page.locator('textarea.row-editor')).toHaveCount(1);
    await expect(page.locator('.ready-row')).toHaveCount(1);
    await page.locator('.program-row:not(.ready-row)').first().press('Control+z');
    await expect(row(page,1)).toHaveValue('f');
  });
  test('immediate drag has a preview, cancellation and second fingers leave code intact', async ({ page }) => {
    await open(page,0,true); await row(page,0).fill('f z');
    const t = await touch(page), start = await center(page.locator('[data-name="f"]'));
    await t.send('touchStart',[start]);
    await expect(page.locator('#touch-drag-ghost')).toBeVisible();
    await t.send('touchCancel',[]);
    await expect(page.locator('#touch-drag-ghost')).toHaveCount(0);
    await expect(row(page,0)).toHaveValue('f z');
    await t.send('touchStart',[start]);
    await t.send('touchStart',[start,{x:start.x+30,y:start.y+30}]);
    await t.send('touchEnd',[]);
    await expect(row(page,0)).toHaveValue('f z');
  });
  test('dropping result on result offers an operator; edges remain ordinary insertion', async ({ page }) => {
    await open(page,7,true);
    await load(page,7,'f1 z');
    await page.locator('#add-row').evaluate(button => button.click()); await row(page,1).fill('f3 z');
    await page.locator('#add-row').evaluate(button => button.click()); await row(page,2).fill('r1'); await row(page,2).blur();
    const from=await center(page.locator('.row-result[data-func-name="r2"]'));
    const to=await center(page.locator('.program-row').nth(2).locator('[data-name="r1"]'));
    await (await touch(page)).drag(from,to);
    await expect(page.getByRole('dialog',{name:'Choose an operator'})).toBeVisible();
    await page.getByRole('button',{name:'Use <*>',exact:true}).tap();
    await expect(row(page,2)).toHaveValue('r1 <*> r2');
    await expect(page.locator('.row-feedback').last()).toContainText('Hero');
  });
});
