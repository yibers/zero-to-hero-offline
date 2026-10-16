const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
const PAGE_URL = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;

async function load(page, progress = {}) {
  await page.addInitScript(saved => {
    if (!localStorage.getItem('zth_progress')) {
      localStorage.setItem('zth_progress', JSON.stringify({ showIntro: false, iconMode: true, ...saved }));
    }
  }, progress);
  await page.goto(PAGE_URL);
  await page.evaluate(() => document.fonts.ready);
}

test('implicit chains use the same type checking and graph as explicit dollars', async ({ page }) => {
  await load(page, { currentLevel: 1 });
  const editor = page.locator('#code-editor');
  await editor.fill('mkHero runZero z');
  await expect(editor).toHaveValue('mkHero runZero z');
  expect(await page.evaluate(() => getCodeFromEditor())).toBe('mkHero $ runZero z');
  await expect(page.locator('#syntax-hint')).not.toHaveClass(/invalid/);
  const implicitGraph = await page.locator('#editor-tokens').innerHTML();
  expect(implicitGraph).not.toBe('');
  await editor.fill('mkHero $ runZero z');
  expect(await page.locator('#editor-tokens').innerHTML()).toBe(implicitGraph);
  await editor.fill('mkHero runZero z');
  await page.getByRole('button', { name: 'Attempt', exact: true }).click();
  await expect(page.locator('#level-dialog')).toBeVisible();
  expect(await page.evaluate(() => optimalLevels.has(1))).toBe(true);
});

test('parameters stay arguments, explicit connectors and grouping win, and wrong chains still fail', async ({ page }) => {
  await load(page);
  const cases = [
    { level: 2, input: 'f3 f1 z', code: 'f3 $ f1 z', ok: true },
    { level: 2, input: 'f3\nf1 z', code: 'f3\n$ f1 z', ok: true },
    { level: 2, input: 'f3 . f1 $ z', code: 'f3 . f1 $ z', ok: true },
    { level: 2, input: 'f3 (f1 z)', code: 'f3 (f1 z)', ok: true },
    { level: 2, input: 'f1 f3 z', code: 'f1 $ f3 z', ok: false },
    { level: 7, input: 'f2 f1 f1 fmap bd f1 z', code: 'f2 $ f1 $ f1 $ fmap bd $ f1 z', ok: true },
    { level: 11, input: 'f z >>= dup', code: 'f z >>= dup', ok: true },
    { level: 14, input: 'pair <$> g z <*> f z', code: 'pair <$> g z <*> f z', ok: true },
  ];
  for (const c of cases) {
    const result = await page.evaluate(c => {
      currentLevel = c.level;
      setEditorContent(c.input);
      render();
      const code = getCodeFromEditor();
      return { code, ok: typeCheck(LEVELS[currentLevel], code).ok };
    }, c);
    expect(result, c.input).toEqual({ code: c.code, ok: c.ok });
  }
});

test('implicit solutions survive reload and text mode materializes every saved level', async ({ page }) => {
  await load(page, { currentLevel: 2, editorContents: {
    1: 'zeroToHero z = mkHero runZero z',
    2: 'zeroToHero z = f3 f1 z',
  } });
  await page.reload();
  const editor = page.locator('#code-editor');
  await expect(editor).toHaveValue('f3 f1 z');
  expect(await page.evaluate(() => getCodeFromEditor())).toBe('f3 $ f1 z');
  await page.getByText('Icons', { exact: true }).click();
  await expect(editor).toHaveValue('f3 $ f1 z');
  expect(await page.evaluate(() => editorContents[1])).toBe('zeroToHero z = mkHero $ runZero z');
  await page.reload();
  await expect(editor).toHaveValue('f3 $ f1 z');
  await editor.fill('f3 f1 z');
  expect(await page.evaluate(() => getCodeFromEditor())).toBe('f3 f1 z');
  expect(await page.evaluate(() => typeCheck(LEVELS[currentLevel], getCodeFromEditor()).ok)).toBe(false);
});
