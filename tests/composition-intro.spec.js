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

test('composition cannot consume a value in the same step, including through aliases and partial applications', async ({ page }) => {
  await open(page);
  const results = await page.evaluate(() => {
    const level = LEVELS[2];
    const invalid = [
      '(.) mkHero runZero z',
      '((.) mkHero runZero) z',
      'let compose = (.) in compose mkHero runZero z',
      'let compose = (.); alias = compose in alias mkHero runZero z',
      'let partial = (.) mkHero in partial runZero z',
      'let partial = (.) mkHero; alias = partial in alias runZero z'
    ];
    const valid = [
      level.solution,
      'let pipeline = mkHero . runZero in pipeline z',
      'let compose = (.); alias = compose; pipeline = alias mkHero runZero in pipeline z',
      'let partial = (.) mkHero; alias = partial; pipeline = alias runZero in pipeline z',
      'let pipeline = (.) mkHero runZero; alias = pipeline in alias z'
    ];
    return { invalid: invalid.map(code => ({ typed: typeCheck(level, code).ok, ...checkSolution(level, code) })),
      valid: valid.map(code => checkSolution(level, code).ok),
      nested: checkSolution(level, '(mkHero . runZero) z') };
  });
  for (const result of results.invalid) {
    expect(result.typed).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.msg).toContain('Apply the composed result in a separate row');
  }
  expect(results.valid).toEqual(Array(5).fill(true));
  expect(results.nested.ok).toBe(false);
  expect(results.nested.msg).toContain('One operation per row');
});

test('aliases and partial composition expose only their remaining function slots', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    currentLevel = 2;
    setEditorContent('let compose = (.); alias = compose; partial = alias mkHero; pipeline = partial runZero in pipeline');
    render();
  });
  for (const [row, slots] of [2, 2, 2, 1, 1].entries()) {
    await expect(page.locator(`.argument-slot[data-row="${row}"]`)).toHaveCount(slots);
  }
  await page.locator('.argument-slot[data-row="4"]').click();
  await page.getByRole('button', { name: 'Use input z', exact: true }).click();
  await expect(page.locator('#status-bar')).toHaveClass(/success/);
});

test('text mode explains the composition step boundary and preserves the rejected draft for repair', async ({ page }) => {
  await open(page);
  await page.evaluate(() => { currentLevel = 2; iconMode = false; render(); });
  const source = page.getByRole('textbox', { name: 'Haskell expression', exact: true });
  await source.fill('(.) mkHero runZero z');
  await expect(page.locator('#status-output')).toContainText('Apply the composed result in a separate row');
  await expect(page.locator('#next-level')).toBeHidden();
  await page.evaluate(() => toggleIconMode());
  await expect(page.locator('textarea.row-editor')).toHaveValue('(.) mkHero runZero z');
  await expect(page.locator('.argument-slot')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('textarea.row-editor')).toHaveValue('(.) mkHero runZero z');
  await page.evaluate(() => toggleIconMode());
  await source.fill('let pipeline = (.) mkHero runZero in pipeline z');
  await expect(page.locator('#status-bar')).toHaveClass(/success/);
});

test('previous one-step composition completions are rechecked without losing saved work', async ({ page }) => {
  await open(page);
  const previous = await page.evaluate(() => {
    const saved = {
      currentLevel: 2, completed: [0, 2, 3], bypassCount: 3,
      showIntro: false, iconMode: true, geckoOn: false,
      connectionVersion: 1, rowVersion: 1, completionVersion: 2, levelOrderVersion: 1,
      editorContents: { 0: 'zeroToHero z = f z' },
      rowPrograms: { 2: [{ id: 'r1', expr: '(.) mkHero runZero z' }] },
      textDrafts: { 3: '(.) f3 f1 z' }
    };
    window.removeEventListener('beforeunload', saveProgress);
    localStorage.setItem('zth_progress', JSON.stringify(saved));
    return saved;
  });
  await page.reload();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('zth_progress')));
  expect(saved.completed).toEqual([0]);
  expect(saved.completionVersion).toBe(3);
  for (const field of ['rowPrograms', 'textDrafts', 'editorContents', 'bypassCount', 'iconMode', 'geckoOn']) {
    expect(saved[field]).toEqual(previous[field]);
  }
  await expect(page.locator('#status-output')).toContainText('Apply the composed result in a separate row');
  await expect(page.locator('#next-level')).toBeHidden();
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
    await expect(page.locator('.argument-slot[data-row="0"]')).toHaveCount(2);
    for (const [slot, name] of [[0, 'mkHero'], [1, 'runZero']]) {
      await page.locator(`.argument-slot[data-row="0"][data-slot="${slot}"]`).tap();
      await page.getByRole('button', { name: `Use input ${name}`, exact: true }).tap();
    }
    await expect(page.locator('textarea.row-editor').first()).toHaveValue('(.) mkHero runZero');
    await expect(page.locator('.argument-slot[data-row="0"]')).toHaveCount(2);
    await drag(page.locator('.row-result').first(), page.locator('.empty-row-drop'));
    await expect(page.locator('.argument-slot[data-row="1"]')).toHaveCount(1);
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

  test('compose three functions by reusing a composed result, then apply it in a third row', async ({ page }) => {
    await open(page);
    await page.evaluate(() => { currentLevel = 6; setEditorContent('(.)'); render(); });
    async function choose(row, slot, name) {
      await page.locator(`.argument-slot[data-row="${row}"][data-slot="${slot}"]`).tap();
      await page.getByRole('button', { name: `Use input ${name}`, exact: true }).tap();
    }
    const cdp = await page.context().newCDPSession(page);
    async function dragToNextRow(source) {
      const target = page.locator('.empty-row-drop');
      await target.scrollIntoViewIfNeeded(); await source.scrollIntoViewIfNeeded();
      const a = await source.boundingBox(), b = await target.boundingBox();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x + a.width / 2, y: a.y + a.height / 2, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    await choose(0, 0, 'f1'); await choose(0, 1, 'f2');
    await dragToNextRow(page.locator('.func-card[data-func-name="(.)"]'));
    await expect(page.locator('.argument-slot[data-row="1"]')).toHaveCount(2);
    await choose(1, 0, 'f3'); await choose(1, 1, 'r1');
    await expect(page.locator('.row-result').nth(1)).toHaveAttribute('aria-label', /Zero a b c -> Hero c a/);
    await dragToNextRow(page.locator('.row-result').nth(1));
    await expect(page.locator('.argument-slot[data-row="2"]')).toHaveCount(1);
    await choose(2, 0, 'z');
    await expect(page.locator('#status-bar')).toHaveClass(/success/);
    await expect(page.locator('.program-row')).toHaveCount(3);
    await expect(page.locator('.goal-reached')).toHaveCount(1);
  });
});
