const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
const URL = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
async function open(page, level = 1, code = '') {
  await page.goto(URL);
  await page.evaluate(({ level, code }) => {
    localStorage.clear(); currentLevel = level; showIntro = false; iconMode = true; geckoOn = false;
    editorContents = {}; rowPrograms = {}; textDrafts = {}; activeRow = 0; clearRowHistory();
    setEditorContent(code); render();
  }, { level, code });
  await page.evaluate(() => document.fonts.ready);
}
async function input(page, row, name) {
  await page.locator(`.argument-slot[data-row="${row}"][data-slot="0"]`).click();
  await page.getByRole('button', { name: `Use input ${name}`, exact: true }).click();
}

test('each level begins with its fixed output goal, including levels with function parameters', async ({ page }) => {
  await open(page);
  const goals = await page.evaluate(() => LEVELS.map((level, index) => {
    currentLevel = index; setEditorContent(''); render();
    const goal = document.querySelector('.puzzle-goal');
    return { label: goal.querySelector('svg').getAttribute('aria-label'),
      count: document.querySelectorAll('.puzzle-goal').length,
      last: goal.closest('.program-row') === document.querySelector('.program-row:last-child') };
  }));
  const expected = ['Hero a', 'Hero a', 'Hero a', 'Hero (a, a)', 'Hero b b', 'Hero (a, b)', 'Hero c a',
    'Hero c', 'Hero a d c', 'Hero d d d d', 'Hero d', 'Hero a', 'Hero (a, a)',
    'Hero (b, a)', 'Hero (a, (a, a))', 'Hero (b, a)', 'Zero a'];
  expect(goals).toEqual(expected.map(type => ({ label: `Goal: ${type}`, count: 1, last: true })));
});

test('the fixed goal cannot be used as an input or changed by dropping a function on it', async ({ page }) => {
  await open(page, 1, 'runZero z');
  const before = await page.evaluate(() => rowSnapshot());
  const goal = page.locator('.goal-picture');
  await goal.click();
  await page.locator('.right-panel [data-func-name="mkHero"]').dragTo(goal);
  expect(await page.evaluate(() => rowSnapshot())).toBe(before);
  await expect(goal).not.toHaveAttribute('draggable', 'true');
  await expect(goal.locator('[data-func-name]')).toHaveCount(0);
  await expect(page.locator('.puzzle-goal')).toHaveCount(1);
});

test.describe('phone transformation rows', () => {
  test.use({ viewport: { width: 390, height: 760 }, isMobile: true, hasTouch: true });
  test('outputs share the call line and the final output fills the goal without a duplicate', async ({ page }) => {
    await open(page);
    await page.locator('.right-panel [data-func-name="runZero"]').dragTo(page.locator('textarea.row-editor').first());
    await input(page, 0, 'z');
    const first = page.locator('.program-row').first();
    const bounds = await first.evaluate(row => {
      const call = row.querySelector('.function-block').getBoundingClientRect();
      const result = row.querySelector('.row-result').getBoundingClientRect();
      return { callRight: call.right, resultLeft: result.left,
        callCenter: call.y + call.height / 2, resultCenter: result.y + result.height / 2 };
    });
    expect(bounds.resultLeft).toBeGreaterThan(bounds.callRight);
    expect(Math.abs(bounds.callCenter - bounds.resultCenter)).toBeLessThan(1);
    await expect(page.locator('.program-row').last().locator('.puzzle-goal')).toBeInViewport({ ratio: 1 });
    await page.locator('.right-panel [data-func-name="mkHero"]').dragTo(page.getByRole('button', { name: 'New function row', exact: true }));
    await page.screenshot({ path: '/tmp/zth-transformation-phone.png' });
    await input(page, 1, 'r1');
    await expect(page.locator('.ready-row')).toHaveCount(0);
    await expect(page.locator('.puzzle-goal')).toHaveCount(1);
    await expect(page.locator('.program-row').last().locator('.row-result')).toHaveClass(/goal-reached/);
    await expect(page.locator('.goal-picture')).toHaveCount(0);
    expect(await page.evaluate(() => ({ code: getCodeFromEditor(), score: RowProgram.score(getCodeFromEditor()) })))
      .toEqual({ code: 'let\n  r1 = runZero z\nin\n  mkHero r1', score: 2 });
    await page.screenshot({ path: '/tmp/zth-goal-reached-phone.png' });
    await page.locator('.program-row').first().press('Control+z');
    await expect(page.locator('.program-row').last().locator('.goal-picture')).toBeVisible();
    await page.reload();
    await expect(page.locator('.program-row').last().locator('.goal-picture')).toBeVisible();
    await page.evaluate(() => toggleIconMode());
    await expect(page.locator('.puzzle-goal')).toHaveCount(0);
  });
});
