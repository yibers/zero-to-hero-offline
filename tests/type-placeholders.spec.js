const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
const URL = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
async function open(page, level, code) {
  await page.goto(URL);
  await page.evaluate(({ level, code }) => {
    localStorage.clear(); currentLevel = level; showIntro = false; iconMode = true; geckoOn = false;
    editorContents = {}; rowPrograms = {}; textDrafts = {}; activeRow = 0; clearRowHistory();
    setEditorContent(code); render();
  }, { level, code });
}
const head = (page, row = 0) => page.locator('.function-head').nth(row);
const markers = locator => locator.locator('.type-placeholder').evaluateAll(nodes => nodes.map(n => n.dataset.marker));
const atoms = locator => locator.locator('.type-atom').evaluateAll(nodes => nodes.map(n => n.dataset.type));
async function choose(page, row, slot, name) {
  await page.locator(`.argument-slot[data-row="${row}"][data-slot="${slot}"]`).click();
  await page.getByRole('button', { name: name ? `Use input ${name}` : 'Clear input', exact: true }).click();
}

test('all palettes are generic while starting parameters and goals keep fixed shapes', async ({ page }) => {
  await open(page, 0, '');
  const errors = await page.evaluate(() => LEVELS.flatMap((level, index) => {
    currentLevel = index; setEditorContent(''); render();
    const checks = [
      !document.querySelector('.icon-palette .type-atom'),
      !!document.querySelector('.icon-palette .type-placeholder'),
      !document.querySelector('#editor-prefix .type-placeholder, .puzzle-goal .type-placeholder'),
      !!document.querySelector('#editor-prefix .type-atom'),
      !!document.querySelector('.puzzle-goal .type-atom'),
    ];
    return checks.every(Boolean) ? [] : [{ level: level.level, checks }];
  }));
  expect(errors).toEqual([]);
});

test('supplying, clearing and undoing an argument specializes only its call and survives refresh', async ({ page }) => {
  await open(page, 0, 'f');
  expect(await markers(head(page))).toEqual(['1', '1']);
  await choose(page, 0, 0, 'z');
  expect(await atoms(head(page))).toEqual(['a', 'a']);
  expect(await markers(head(page))).toEqual([]);
  expect(await markers(page.locator('.icon-palette'))).toEqual(['1', '1']);
  expect(await atoms(page.locator('.row-result'))).toEqual(['a']);
  await page.reload();
  expect(await atoms(head(page))).toEqual(['a', 'a']);
  await choose(page, 0, 0, null);
  expect(await markers(head(page))).toEqual(['1', '1']);
  expect(await atoms(head(page))).toEqual([]);
  await page.locator('.program-row:not(.ready-row)').first().press('Control+z');
  expect(await atoms(head(page))).toEqual(['a', 'a']);
});

test('partial application retains unresolved markers and fixed function parameters remain fixed', async ({ page }) => {
  await open(page, 8, 'fmap');
  await choose(page, 0, 0, 'cd');
  expect(await atoms(head(page))).toEqual(['c', 'd', 'c', 'd']);
  expect(await markers(head(page))).toEqual(['3', '4', '3', '4']);
  expect(await markers(page.locator('.row-result'))).toEqual(['3', '4', '3', '4']);
  await choose(page, 0, 1, 'z');
  expect(await markers(head(page))).toEqual([]);
  expect(await atoms(page.locator('.row-result'))).toEqual(['a', 'b', 'd']);
  await choose(page, 0, 0, null);
  expect(await markers(head(page))).toEqual(['2', '2']);
  await choose(page, 0, 0, 'bd');
  await expect(page.locator('.row-result')).toHaveCount(0);
  await expect(page.locator('.program-row').first()).toHaveClass(/row-invalid/);
});

test('a placeholder accepts an entire tuple, and separate placeholders may become the same fixed type', async ({ page }) => {
  await open(page, 15, 'let r1 = f z; r2 = pair r1 r1; r3 = pair r2 r1 in r3');
  expect(await markers(head(page, 1))).toEqual([]);
  expect(await atoms(head(page, 1))).toEqual(['a', 'a', 'a', 'a']);
  expect(await atoms(head(page, 2))).toEqual(['a', 'a', 'a', 'a', 'a', 'a']);
  await expect(page.locator('.row-result')).toHaveCount(4); // Migration retains the final `in r3` reference.
  await choose(page, 1, 1, null);
  expect(await markers(head(page, 1))).toEqual(['2', '2']);
  expect(await atoms(head(page, 1))).toEqual(['a', 'a']);
  // Applying this partial result specializes that use, not its definition.
  await page.evaluate(() => { getRows()[2].expr = 'r2 r1'; persistRows(); render(); });
  expect(await markers(head(page, 2))).toEqual([]);
  expect(await atoms(head(page, 2))).toEqual(['a', 'a', 'a']);
  expect(await markers(page.locator('.row-result').nth(1))).toEqual(['2', '2']);
});

test('generic function arguments specialize together with their surrounding call', async ({ page }) => {
  await open(page, 14, 'let r1 = f z; r2 = (>>=) r1 dup in r2');
  const argument = page.locator('.argument-slot[data-row="1"][data-slot="1"]');
  expect(await markers(argument)).toEqual([]);
  expect(await atoms(argument)).toEqual(['a', 'a', 'a']);
  expect(await atoms(page.locator('.row-result').last())).toEqual(['a', 'a']);
  expect(await markers(page.locator('.func-card[data-func-name="dup"]'))).toEqual(['1', '1', '1']);
  await choose(page, 1, 0, null);
  expect(await atoms(argument)).toEqual([]);
  expect(await markers(argument)).toEqual(['1', '1', '1']);
});
