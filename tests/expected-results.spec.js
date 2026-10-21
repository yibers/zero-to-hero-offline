const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
const URL = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
async function open(page, level, code) {
  await page.goto(URL);
  await page.evaluate(({ level, code }) => {
    localStorage.clear(); currentLevel = level; showIntro = false; iconMode = true; geckoOn = false;
    editorContents = {}; rowPrograms = {}; textDrafts = {}; completedLevels.clear(); activeRow = 0;
    clearRowHistory(); setEditorContent(code); render();
  }, { level, code });
}
async function choose(page, row, position, name) {
  await page.locator(`.argument-slot[data-row="${row}"][data-slot="${position}"]`).click();
  await page.getByRole('button', { name: name ? `Use input ${name}` : 'Clear input', exact: true }).click();
}

test('every palette function starts with a generic output and every solved level shows its concrete goal', async ({ page }) => {
  await open(page, 0, '');
  const failures = await page.evaluate(() => {
    const failures = [];
    LEVELS.forEach((level, index) => {
      currentLevel = index;
      for (const f of level.funcs) {
        setEditorContent(f.name); render();
        const output = document.querySelector('.row-feedback .semantic-diagram');
        if (!output || output.querySelector('.type-atom')) failures.push([level.level, f.name]);
        const inputs = document.querySelector('.function-head .icon-inputs');
        if (!inputs || inputs.parentElement.children.length !== 1) failures.push([level.level, f.name, 'repeated output in head']);
      }
      setEditorContent(level.solution); render();
      if (document.querySelectorAll('.row-result').length !== getRows().length
        || !document.querySelector('.goal-reached .type-atom') || !checkSolution(level, getCodeFromEditor()).ok) {
        failures.push([level.level, 'reference solution']);
      }
    });
    return failures;
  });
  expect(failures).toEqual([]);
});

test('the output specializes on input, survives refresh, and resets when the input is cleared', async ({ page }) => {
  await open(page, 0, 'f');
  const picture = page.locator('.row-result > svg[data-diagram-type]');
  await expect(picture).toHaveAttribute('aria-label', 'Expected result r1: Hero a');
  await expect(picture.locator('.icon-inputs')).toHaveCount(0);
  await expect(picture.locator('.type-placeholder')).toHaveCount(1);
  await expect(page.locator('.row-result')).toHaveAttribute('aria-label', /Zero a -> Hero a/);
  await choose(page, 0, 0, 'z');
  await expect(picture).toHaveAttribute('aria-label', 'Expected result r1: Hero a');
  await expect(picture.locator('.type-atom')).toHaveAttribute('data-type', 'a');
  await expect(picture.locator('.type-placeholder, .icon-inputs')).toHaveCount(0);
  await expect(page.locator('.row-result')).toHaveAttribute('aria-label', 'Drag result r1: Hero a');
  await expect(page.locator('#status-bar')).toHaveClass(/success/);
  await page.reload();
  await expect(picture.locator('.type-atom')).toHaveAttribute('data-type', 'a');
  await choose(page, 0, 0, null);
  await expect(picture.locator('.type-placeholder')).toHaveCount(1);
  await expect(picture.locator('.type-atom')).toHaveCount(0);
  await page.locator('.program-row').first().press('Control+z');
  await expect(picture.locator('.type-atom')).toHaveAttribute('data-type', 'a');
});

test('missing or incompatible inputs keep the expected output visible without exposing an invalid result', async ({ page }) => {
  await open(page, 8, 'fmap');
  const output = page.locator('.program-row').first().locator('.row-feedback');
  await expect(output.locator('.icon-inputs')).toHaveCount(0);
  expect(await output.locator('.type-placeholder').evaluateAll(nodes => nodes.map(n => n.dataset.marker))).toEqual(['3', '4', '2']);
  await choose(page, 0, 1, 'z');
  await expect(page.locator('.row-error')).toContainText('Fill the empty input');
  await expect(output.locator('.row-result')).toHaveCount(0);
  await expect(output.locator('.row-result-preview')).toBeVisible();
  await expect(output.locator('[data-func-name], [draggable="true"]')).toHaveCount(0);
  await expect(output.locator('.type-placeholder')).toHaveCount(1);
  expect(await output.locator('.type-atom').evaluateAll(nodes => nodes.map(n => n.dataset.type))).toEqual(['a', 'b']);
  await choose(page, 0, 0, 'bd');
  await expect(page.locator('.program-row').first()).toHaveClass(/row-invalid/);
  await expect(output.locator('.row-result-preview')).toBeVisible();
  await choose(page, 0, 0, 'cd');
  await expect(output.locator('.row-result-preview')).toHaveCount(0);
  await expect(output.locator('.row-result')).toBeVisible();
  expect(await output.locator('.type-atom').evaluateAll(nodes => nodes.map(n => n.dataset.type))).toEqual(['a', 'b', 'd']);
  await expect(output.locator('.type-placeholder, .icon-inputs')).toHaveCount(0);
  await expect(page.locator('.row-error')).toBeEmpty();
});

test('composition previews its returned function without repeating its two function inputs', async ({ page }) => {
  await open(page, 2, '(.)');
  const output = page.locator('.row-feedback').first();
  await expect(output.locator('.icon-inputs')).toHaveCount(1);
  await expect(output.locator('.icon-inputs .type-placeholder')).toHaveCount(1);
  await expect(output.locator('.icon-output .type-placeholder')).toHaveCount(1);
  // The two function inputs still need their own complete transformations.
  await expect(page.locator('.function-head .icon-output')).toHaveCount(2);
  await choose(page, 0, 0, 'mkHero'); await choose(page, 0, 1, 'runZero');
  await expect(output.locator('.type-placeholder')).toHaveCount(2);
  await expect(output.locator('.type-atom')).toHaveCount(0);
  await expect(page.locator('.row-result')).toHaveAttribute('aria-label', /Zero a -> Hero a/);
  await page.locator('.row-result').dragTo(page.locator('.empty-row-drop'));
  await expect(page.locator('.row-result').nth(1).locator('svg[data-diagram-type]')).toHaveAttribute('aria-label', 'Expected result r2: Hero a');
  await choose(page, 1, 0, 'z');
  await expect(page.locator('#status-bar')).toHaveClass(/success/);
  await expect(page.locator('.goal-reached .type-atom')).toHaveAttribute('data-type', 'a');
});

test.describe('phone output specialization', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('dragging the concrete input updates the output and dragging it out restores its placeholder', async ({ page }) => {
    await open(page, 0, 'f');
    const cdp = await page.context().newCDPSession(page);
    const input = page.locator('.argument-slot');
    const output = page.locator('.row-result');
    async function drag(source, target) {
      await target.scrollIntoViewIfNeeded(); await source.scrollIntoViewIfNeeded();
      const a = await source.boundingBox(), b = await target.boundingBox();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x + a.width / 2, y: a.y + a.height / 2, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    await expect(output.locator('.type-placeholder')).toHaveCount(1);
    await drag(page.locator('#editor-prefix [data-func-name="z"]'), input);
    await expect(output.locator('.type-atom')).toHaveAttribute('data-type', 'a');
    await expect(output.locator('.type-placeholder, .icon-inputs')).toHaveCount(0);
    await drag(input, page.locator('nav'));
    await expect(output.locator('.type-placeholder')).toHaveCount(1);
    await expect(output.locator('.type-atom, .icon-inputs')).toHaveCount(0);
  });
});
