const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
const URL = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
async function open(page) {
  await page.goto(URL);
  await page.evaluate(() => {
    localStorage.clear(); currentLevel = 0; showIntro = false; iconMode = true; geckoOn = false;
    completedLevels.clear(); bypassCount = 0; editorContents = {}; rowPrograms = {}; textDrafts = {}; render();
  });
  await page.evaluate(() => document.fonts.ready);
}

test('the new third level repeats Assembly required and requires meaningful composition', async ({ page }) => {
  await open(page);
  const result = await page.evaluate(() => {
    const previous = LEVELS[1], intro = LEVELS[2];
    const goal = level => ({ init: level.init, target: level.target, lhs: level.lhs, testing: level.testing });
    return { count: LEVELS.length, numbers: LEVELS.map(level => level.level),
      sameGoal: JSON.stringify(goal(previous)) === JSON.stringify(goal(intro)),
      sameHelpers: JSON.stringify(previous.funcs) === JSON.stringify(intro.funcs.slice(0, 2)),
      functions: intro.funcs.map(f => f.name),
      oldSolutionPassesOldLevel: checkSolution(previous, previous.solution).ok,
      oldSolutionHasRightType: typeCheck(intro, previous.solution).ok,
      manual: checkSolution(intro, previous.solution),
      unused: checkSolution(intro, 'let unused = (.); value = runZero z in mkHero value'),
      prefix: checkSolution(intro, intro.solution).ok,
      infix: checkSolution(intro, 'let pipeline = mkHero . runZero in pipeline z').ok };
  });
  expect(result.count).toBe(16);
  expect(result.numbers).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  expect(result.sameGoal).toBe(true); expect(result.sameHelpers).toBe(true);
  expect(result.functions).toEqual(['runZero', 'mkHero', '(.)']);
  expect(result.oldSolutionPassesOldLevel).toBe(true); expect(result.oldSolutionHasRightType).toBe(true);
  for (const attempt of [result.manual, result.unused]) {
    expect(attempt.ok).toBe(false); expect(attempt.missing).toEqual(['(.)']);
  }
  expect(result.prefix).toBe(true); expect(result.infix).toBe(true);
});

test('inserting a level preserves every old puzzle draft, completion, setting and position exactly once', async ({ page }) => {
  await open(page);
  const old = await page.evaluate(() => {
    const oldLevels = LEVELS.filter((_, index) => index !== 2);
    const saved = {
      currentLevel: 7, completed: oldLevels.map((_, index) => index), bypassCount: 4,
      showIntro: false, iconMode: true, geckoOn: false,
      connectionVersion: 1, rowVersion: 1, completionVersion: 2,
      editorContents: Object.fromEntries(oldLevels.map((level, index) => [index, level.lhs + ' ' + level.solution])),
      rowPrograms: Object.fromEntries(oldLevels.map((level, index) => [index, RowProgram.migrate(level.solution)])),
      textDrafts: Object.fromEntries(oldLevels.map((level, index) => [index, level.solution]))
    };
    window.removeEventListener('beforeunload', saveProgress);
    localStorage.setItem('zth_progress', JSON.stringify(saved));
    return saved;
  });
  await page.reload();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('zth_progress')));
  expect(saved.levelOrderVersion).toBe(1);
  expect(saved.currentLevel).toBe(8);
  await expect(page.locator('nav')).toContainText('The middle man');
  await expect(page.locator('.level-badge')).toContainText('Level 9 / 16');
  expect(saved.completed).toEqual([0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  for (const field of ['editorContents', 'rowPrograms', 'textDrafts']) {
    expect(saved[field][2]).toBeUndefined();
    for (let index = 0; index < 15; index++) {
      expect(saved[field][index < 2 ? index : index + 1]).toEqual(old[field][index]);
    }
  }
  expect(saved.bypassCount).toBe(4); expect(saved.iconMode).toBe(true); expect(saved.geckoOn).toBe(false);
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('zth_progress')))).toEqual(saved);
});

test.describe('phone composition introduction', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('advance from level 2, compose functions by touch, apply the result, and continue to the old level 3', async ({ page }) => {
    await open(page);
    await page.evaluate(() => { currentLevel = 1; setEditorContent(LEVELS[1].solution); render(); });
    await page.getByRole('button', { name: 'Next level', exact: true }).tap();
    await expect(page.locator('nav')).toContainText('Assembly by composition');
    await expect(page.locator('.level-badge')).toContainText('Level 3 / 16');
    const cdp = await page.context().newCDPSession(page);
    async function drag(source, target) {
      await target.scrollIntoViewIfNeeded(); await source.scrollIntoViewIfNeeded();
      const a = await source.boundingBox(), b = await target.boundingBox();
      const send = (type, at) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: at ? [{ ...at, id: 1 }] : [] });
      await send('touchStart', { x: a.x + a.width / 2, y: a.y + a.height / 2 });
      await send('touchMove', { x: b.x + b.width / 2, y: b.y + b.height / 2 });
      await send('touchEnd');
    }
    await drag(page.locator('.func-card[data-func-name="(.)"]'), page.locator('textarea.row-editor'));
    for (const [slot, name] of [[0, 'mkHero'], [1, 'runZero']]) {
      await page.locator(`.argument-slot[data-row="0"][data-slot="${slot}"]`).tap();
      await page.getByRole('button', { name: `Use input ${name}`, exact: true }).tap();
    }
    await expect(page.locator('textarea.row-editor').first()).toHaveValue('(.) mkHero runZero');
    await drag(page.locator('.row-result').first(), page.locator('.empty-row-drop'));
    await drag(page.locator('#editor-prefix [data-func-name="z"]'), page.locator('.argument-slot[data-row="1"][data-slot="0"]'));
    await expect(page.locator('#status-bar')).toHaveClass(/success/);
    await expect(page.locator('.goal-reached')).toHaveCount(1);
    await expect(page.locator('textarea.row-editor').last()).not.toBeFocused();
    await page.reload();
    await expect(page.locator('nav')).toContainText('Assembly by composition');
    await expect(page.locator('#status-bar')).toHaveClass(/success/);
    await page.getByRole('button', { name: 'Next level', exact: true }).tap();
    await expect(page.locator('nav')).toContainText('Which path?');
    await expect(page.locator('.level-badge')).toContainText('Level 4 / 16');
  });
});
