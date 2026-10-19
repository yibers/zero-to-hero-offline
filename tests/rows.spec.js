const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
const URL = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
const row = (page, i) => page.locator('textarea.row-editor').nth(i);
async function open(page, level = 0, icons = false) {
  await page.goto(URL);
  await page.evaluate(({ level, icons }) => {
    localStorage.clear(); currentLevel = level; showIntro = false; iconMode = icons; geckoOn = false;
    editorContents = {}; rowPrograms = {}; activeRow = 0; render();
  }, { level, icons });
  await page.evaluate(() => document.fonts.ready);
}
async function load(page, level, code) {
  await page.evaluate(({ level, code }) => { currentLevel = level; setEditorContent(code); render(); }, { level, code });
}

test('every reference solution migrates to valid single-operation rows and still solves', async ({ page }) => {
  await open(page);
  const results = await page.evaluate(() => LEVELS.map(level => {
    const rows = RowProgram.migrate(level.best), source = RowProgram.source(rows);
    return { level: level.level, valid: RowProgram.validate(rows, level).every(x => !x), solves: typeCheck(level, source).ok, inferred: liveInfer(level, source).valid, score: RowProgram.score(source) === rows.length };
  }));
  for (const result of results) expect(result).toEqual({ level: result.level, valid: true, solves: true, inferred: true, score: true });
});

test('level 2 builds with a result reference, generates let, solves and survives refresh', async ({ page }) => {
  await open(page, 1);
  await row(page, 0).fill('runZero z');
  await expect(page.locator('.row-feedback').first()).toContainText('a');
  await page.getByRole('button', { name: '+ Add row', exact: true }).click();
  await row(page, 1).fill('mkHero');
  await page.getByRole('button', { name: 'Use result r1', exact: true }).click();
  await expect(row(page, 1)).toHaveValue('mkHero r1');
  await expect(page.locator('.row-role').last()).toHaveText('Final answer');
  expect(await page.evaluate(() => getCodeFromEditor())).toBe('let\n  r1 = runZero z\nin\n  mkHero r1');
  await page.reload();
  await expect(row(page, 0)).toHaveValue('runZero z');
  await expect(row(page, 1)).toHaveValue('mkHero r1');
  await page.getByRole('button', { name: 'Attempt', exact: true }).click();
  await expect(page.locator('#level-dialog')).toBeVisible();
  await expect(page.locator('#level-dialog')).toContainText('2 operations');
});

test('nested calls and applied operands are rejected, but f x y and function values are allowed', async ({ page }) => {
  await open(page, 7);
  await row(page, 0).fill('fmap bd z');
  await expect(page.locator('.row-feedback')).not.toContainText('One operation');
  await row(page, 0).fill('f2 (f1 z)');
  await expect(page.locator('.row-feedback')).toContainText('One operation per row');
  await page.getByRole('button', { name: 'Attempt', exact: true }).click();
  await expect(page.locator('#status-output')).toContainText('One operation per row');
  await load(page, 6, '');
  await row(page, 0).fill('f2 z <*> f3 z');
  await expect(page.locator('.row-feedback')).toContainText('One operation per row');
  await row(page, 0).fill('(.) f2 f1');
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
  await row(page, 0).fill('mkHero z');
  await expect(page.locator('#inferred-type')).toContainText('Hero');
  await page.getByRole('button', { name: 'Attempt', exact: true }).click();
  await expect(page.locator('#status-bar')).toContainText('Failed');
});

test('function-valued results can be applied and reused polymorphically', async ({ page }) => {
  await open(page, 14);
  const result = await page.evaluate(() => {
    const code = 'let\n  r1 = pair\n  r2 = g z\n  r3 = r1 <$> r2\n  r4 = f z\nin\n  r3 <*> r4';
    return typeCheck(LEVELS[14], code);
  });
  expect(result.ok).toBe(true);
  await load(page, 1, '');
  await row(page, 0).fill('mkHero');
  await page.getByRole('button', { name: '+ Add row', exact: true }).click();
  await row(page, 1).fill('runZero z');
  await page.getByRole('button', { name: '+ Add row', exact: true }).click();
  await row(page, 2).fill('r1 r2');
  await page.getByRole('button', { name: 'Attempt', exact: true }).click();
  await expect(page.locator('#level-dialog')).toBeVisible();
});

test('insertion keeps names stable, dependency-aware move/delete and undo work', async ({ page }) => {
  await open(page, 1);
  await load(page, 1, 'mkHero $ runZero z');
  await page.getByLabel('Actions for row 2').click();
  await page.getByRole('button', { name: 'Insert row above 2', exact: true }).click();
  await expect(row(page, 2)).toHaveValue('mkHero r1');
  await expect(page.locator('.result-handle')).toHaveText(['r1', 'r3', 'r2']);
  await page.getByRole('button', { name: 'Undo row edit' }).click();
  await expect(page.locator('.program-row')).toHaveCount(2);
  await page.getByLabel('Actions for row 1').click();
  await page.getByRole('button', { name: 'Remove row 1', exact: true }).click();
  await expect(page.locator('#row-notice')).toContainText('used by another row');
  await page.getByRole('button', { name: 'Move row 1 down', exact: true }).click();
  await expect(page.locator('#row-notice')).toContainText('Keep a result above');
  await row(page, 1).fill('z');
  await page.getByRole('button', { name: 'Remove row 1', exact: true }).click();
  await expect(page.locator('.program-row')).toHaveCount(1);
  await expect(row(page, 0)).toHaveValue('z');
  await page.getByRole('button', { name: 'Undo row edit' }).click();
  await expect(page.locator('.program-row')).toHaveCount(2);
  await page.getByRole('button', { name: 'Redo row edit' }).click();
  await expect(page.locator('.program-row')).toHaveCount(1);
});

test('legacy saved progress migrates once without losing settings or completion', async ({ page }) => {
  await page.goto(URL);
  await page.evaluate(() => { window.removeEventListener('beforeunload', saveProgress); localStorage.setItem('zth_progress', JSON.stringify({
    currentLevel: 6, showIntro: false, iconMode: true, geckoOn: false, connectionVersion: 1,
    completed: [0,1], optimal: [0], bypassCount: 2,
    editorContents: { 6: 'zeroToHero z = f2 z <*> (f1 z <*> f3 z)' }
  })); });
  await page.reload();
  await expect(page.locator('.program-row')).toHaveCount(5);
  expect(await page.evaluate(() => typeCheck(LEVELS[6], getCodeFromEditor()).ok)).toBe(true);
  await row(page, 4).focus();
  await page.getByText('Icons', { exact: true }).click();
  await page.reload();
  expect(await page.evaluate(() => ({ count: getRows().length, completed: [...completedLevels], bypassCount, geckoOn, iconMode }))).toEqual({ count: 5, completed: [0,1], bypassCount: 2, geckoOn: false, iconMode: false });
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
    await page.getByRole('button', { name: '+ Add row', exact: true }).tap();
    await row(page, 1).fill('mkHero'); await row(page, 1).blur();
    const from = await center(page.getByRole('button',{name:'Use result r1',exact:true}));
    const to = await center(row(page, 1));
    // Right edge inserts next to the function instead of opening the picker.
    const bounds = await row(page,1).boundingBox(); to.x = bounds.x+bounds.width-12;
    await (await touch(page)).drag(from,to);
    await expect(row(page,1)).toHaveValue('mkHero r1');
    await expect(row(page,1)).not.toBeFocused();
    await page.reload(); await expect(row(page,1)).toHaveValue('mkHero r1');
    await page.getByRole('button',{name:'Attempt',exact:true}).tap();
    await expect(page.locator('#level-dialog')).toBeVisible();
  });
  test('tokens move between rows, drag out, and undo restores them', async ({ page }) => {
    await open(page, 0, true);
    await row(page, 0).fill('f z');
    await page.getByRole('button',{name:'+ Add row',exact:true}).tap();
    const t = await touch(page);
    // Both rows must be visible during the gesture.
    await page.locator('#program-rows').evaluate(el=>{el.style.minHeight='470px';el.scrollTop=0;});
    const to = await center(row(page,1));
    const from = await center(page.locator('.program-row').first().locator('[data-name="f"]'));
    await t.drag(from,to);
    await expect(row(page,0)).toHaveValue('z'); await expect(row(page,1)).toHaveValue('f');
    await t.drag(await center(page.locator('.program-row').nth(1).locator('[data-name="f"]')),{x:8,y:10});
    await expect(row(page,1)).toHaveValue('');
    await page.getByRole('button',{name:'Undo row edit'}).tap();
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
    await open(page,6,true);
    await load(page,6,'f1 z');
    await page.getByRole('button',{name:'+ Add row',exact:true}).tap(); await row(page,1).fill('f3 z');
    await page.getByRole('button',{name:'+ Add row',exact:true}).tap(); await row(page,2).fill('r1'); await row(page,2).blur();
    const from=await center(page.getByRole('button',{name:'Use result r2',exact:true}));
    const to=await center(page.locator('.program-row').nth(2).locator('[data-name="r1"]'));
    await (await touch(page)).drag(from,to);
    await expect(page.getByRole('dialog',{name:'Choose an operator'})).toBeVisible();
    await page.getByRole('button',{name:'Use <*>',exact:true}).tap();
    await expect(row(page,2)).toHaveValue('r1 <*> r2');
    await expect(page.locator('.row-feedback').last()).toContainText('Hero');
  });
});
