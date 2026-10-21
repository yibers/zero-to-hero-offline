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

test('every palette function shows a generic output immediately, and all solved rows stay generic', async ({ page }) => {
  await open(page, 0, '');
  const failures = await page.evaluate(() => {
    const failures = [];
    LEVELS.forEach((level, index) => {
      currentLevel = index;
      for (const f of level.funcs) {
        setEditorContent(f.name); render();
        const output = document.querySelector('.row-feedback .semantic-diagram');
        if (!output || output.querySelector('.type-atom')) failures.push([level.level, f.name]);
      }
      setEditorContent(level.solution); render();
      if (document.querySelectorAll('.row-result').length !== getRows().length
        || document.querySelector('.row-result .type-atom') || !checkSolution(level, getCodeFromEditor()).ok) {
        failures.push([level.level, 'reference solution']);
      }
    });
    return failures;
  });
  expect(failures).toEqual([]);
});

test('a row shows only its declared result before and after supplying the concrete input', async ({ page }) => {
  await open(page, 0, 'f');
  const picture = page.locator('.row-result > svg[data-diagram-type]');
  await expect(picture).toHaveAttribute('aria-label', 'Expected result r1: Hero a');
  await expect(picture.locator('.icon-inputs')).toHaveCount(0);
  await expect(picture.locator('.type-placeholder')).toHaveCount(1);
  await expect(page.locator('.row-result')).toHaveAttribute('aria-label', /Zero a -> Hero a/);
  await choose(page, 0, 0, 'z');
  await expect(picture).toHaveAttribute('aria-label', 'Expected result r1: Hero a');
  await expect(picture.locator('.type-atom')).toHaveCount(0);
  await expect(page.locator('.row-result')).toHaveAttribute('aria-label', 'Drag result r1: Hero a');
  await expect(page.locator('#status-bar')).toHaveClass(/success/);
  await page.reload();
  await expect(picture.locator('.type-placeholder')).toHaveCount(1);
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
  await expect(output.locator('.type-placeholder')).toHaveCount(3);
  await choose(page, 0, 0, 'bd');
  await expect(page.locator('.program-row').first()).toHaveClass(/row-invalid/);
  await expect(output.locator('.row-result-preview')).toBeVisible();
  await choose(page, 0, 0, 'cd');
  await expect(output.locator('.row-result-preview')).toHaveCount(0);
  await expect(output.locator('.row-result')).toBeVisible();
  await expect(output.locator('.type-atom')).toHaveCount(0);
  await expect(page.locator('.row-error')).toBeEmpty();
});

test('composition previews its returned function without repeating its two function inputs', async ({ page }) => {
  await open(page, 2, '(.)');
  const output = page.locator('.row-feedback').first();
  await expect(output.locator('.icon-inputs')).toHaveCount(1);
  await expect(output.locator('.icon-inputs .type-placeholder')).toHaveCount(1);
  await expect(output.locator('.icon-output .type-placeholder')).toHaveCount(1);
  await choose(page, 0, 0, 'mkHero'); await choose(page, 0, 1, 'runZero');
  await expect(output.locator('.type-placeholder')).toHaveCount(2);
  await expect(output.locator('.type-atom')).toHaveCount(0);
  await expect(page.locator('.row-result')).toHaveAttribute('aria-label', /Zero a -> Hero a/);
  await page.locator('.row-result').dragTo(page.locator('.empty-row-drop'));
  await expect(page.locator('.row-result').nth(1).locator('svg[data-diagram-type]')).toHaveAttribute('aria-label', 'Expected result r2: Hero a');
  await choose(page, 1, 0, 'z');
  await expect(page.locator('#status-bar')).toHaveClass(/success/);
  await expect(page.locator('.goal-reached .type-atom')).toHaveCount(0);
});
