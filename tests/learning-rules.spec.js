const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
const URL = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
const expectedFunctions = [
 ['f'], ['runZero', 'mkHero'], ['runZero', 'mkHero', '(.)'], ['f1', 'f3', '(.)'], ['f2', 'f4', '(.)'], ['snd', 'f1', 'f3', '(.)'], ['f1', 'f2', 'f3', '(.)'],
 ['f1', 'f2', 'f3', '(<*>)', '(.)'], ['fmap', 'f1', 'f2', '(.)'], ['f1', 'f2', 'f3', '(.)'], ['f1', 'f2', 'f3', '(.)'],
 ['wrap', 'join'], ['f', 'dup', '(>>=)'], ['f', 'swap', '(<$>)'], ['f', 'dup', 'nest', '(>>=)'],
 ['f', 'g', 'pair', '(<$>)', '(<*>)'], ['wrap']
];
async function open(page, icons = true) {
 await page.goto(URL);
 await page.evaluate(icons => {
  localStorage.clear(); completedLevels.clear(); currentLevel = 0;
  showIntro = false; iconMode = icons; geckoOn = false;
  editorContents = {}; rowPrograms = {}; textDrafts = {}; render();
 }, icons);
}

test('all 17 palettes contain exactly the required functions and every reference solves in both modes', async ({ page }) => {
 await open(page);
 for (const icons of [true, false]) {
  const levels = await page.evaluate(icons => LEVELS.map((level, index) => {
   currentLevel = index; iconMode = icons; setEditorContent(level.solution); render();
   return { functions: level.funcs.map(f => f.name), available: document.querySelectorAll('#function-palette .func-card').length,
    ok: checkSolution(level, getCodeFromEditor()).ok, complete: completedLevels.has(index),
    next: !document.getElementById('next-level').hidden, ready: !!document.querySelector('.ready-row'),
    solvedGoal: !icons || !!document.querySelector('.goal-reached') };
  }), icons);
  expect(levels).toEqual(expectedFunctions.map(functions => ({ functions, available: 0, ok: true, complete: true, next: true, ready: false, solvedGoal: true })));
 }
 await expect(page.locator('nav')).not.toContainText(/Attempt|Optimal/);
 await expect(page.locator('#status-output')).not.toContainText(/operations|conciseness/i);
 expect(await page.evaluate(() => completedLevels.size)).toBe(17);
 await page.evaluate(() => { currentLevel = LEVEL_ORDER.at(-1); render(); });
 await page.getByRole('button', { name: 'Finish', exact: true }).click();
 await expect(page.locator('#complete-dialog')).toBeVisible();
});

test('required functions must reach the final answer: unused bindings, aliases and unused chains cannot satisfy them', async ({ page }) => {
 await open(page);
 const results = await page.evaluate(() => {
  // A target that can be reached manually, alongside a higher-order helper.
  const level = { ...LEVELS[0], funcs: [
   { name: 'f', sig: 'Zero a -> Hero a' },
   { name: 'map', sig: '(a -> b) -> Hero a -> Hero b' },
   { name: 'id', sig: 'a -> a' }
  ] };
  const manual = 'f z';
  const dead = 'let\n  unused = map id\nin\n  f z';
  const deadChain = 'let\n  helper = map\n  unused = helper id\nin\n  f z';
  const live = 'let\n  helper = map\n  value = f z\nin\n  helper id value';
  return { typed: [manual, dead, deadChain].map(code => typeCheck(level, code).ok),
   missing: [manual, dead, deadChain].map(code => checkSolution(level, code).missing),
   live: checkSolution(level, live).ok,
   extraWork: checkSolution(LEVELS[0], 'let\n  extra = f z\n  alias = f\nin\n  alias z').ok };
 });
 expect(results).toEqual({ typed: [true, true, true], missing: [['map','id'],['map','id'],['map','id']], live: true, extraWork: false });
});

test('a matching target with a missing function keeps the goal unsolved in the current row', async ({ page }) => {
 await open(page);
 await page.evaluate(() => {
  // Exercise the completion gate independently of whether this level admits
  // a manual workaround: the target can be reached without its second function.
  LEVELS[1].target = 'Zero a -> a'; currentLevel = 1;
  setEditorContent('let\n  unused = mkHero\nin\n  runZero z'); render();
 });
 await expect(page.locator('#status-bar')).toHaveClass(/error/);
 await expect(page.locator('#status-output')).toContainText('Still needed: mkHero');
 await expect(page.locator('.goal-reached')).toHaveCount(0);
 await expect(page.locator('.ready-row')).toHaveCount(0);
 await expect(page.locator('.program-row').last().locator('.goal-picture')).toBeVisible();
 await expect(page.locator('#next-level')).toBeHidden();
 expect(await page.evaluate(() => completedLevels.has(1))).toBe(false);
});

test('removed functions and operators cannot be used in current solutions', async ({ page }) => {
 await open(page);
 const outcomes = await page.evaluate(() => [
  checkSolution(LEVELS[3], 'f2 z'),
  checkSolution(LEVELS[4], 'f1 z'),
  checkSolution(LEVELS[5], 'fst z'),
  checkSolution(LEVELS[1], 'mkHero $ z'),
  checkSolution(LEVELS[15], 'f >>= g')
 ].map(r => ({ ok: r.ok, unknown: /Unknown identifier/.test(r.msg) })));
 expect(outcomes).toEqual(Array(5).fill({ ok: false, unknown: true }));
});

test('operator aliases and prefix notation satisfy the same requirements as infix notation', async ({ page }) => {
 await open(page);
 const results = await page.evaluate(() => {
  const level = LEVELS[12];
  return [level.solution, 'let\n  bind = (>>=)\n  value = f z\nin\n  bind value dup',
   'let\n  value = f z\nin\n  (>>=) value dup'].map(code => checkSolution(level, code).ok);
 });
 expect(results).toEqual([true, true, true]);
});

test('manual solutions cannot bypass composition in the revised lessons', async ({ page }) => {
 await open(page);
 const outcomes = await page.evaluate(() => {
  const manual = [
   'let r1 = f1 z in f3 r1',
   'let r1 = f4 z in f2 r1',
   'let r1 = f1 z; r2 = f3 r1 in snd r2',
   'let r1 = f2 z; r2 = f1 r1 in f3 r2',
   'let r1 = f2 z; r2 = f1 z; r3 = f3 z; r4 = r2 <*> r3 in r1 <*> r4',
   'let r1 = f1 z; r2 = fmap bd r1; r3 = f1 r2; r4 = f1 r3 in f2 r4',
   'let r1 = f3 z; r2 = f1 r1; r3 = f1 r2 in f2 r3',
   'let r1 = f1 z; r2 = f2 r1; r3 = f1 r2; r4 = f2 r3; r5 = f1 r4; r6 = f2 r5; r7 = f2 r6 in f3 r7'
  ];
  return manual.map((code, i) => {
   const level = LEVELS[i + 3];
   const unused = code.replace('let ', 'let unused = (.); ');
   return { level: level.level, typed: typeCheck(level, code).ok,
    manual: checkSolution(level, code), unused: checkSolution(level, unused),
    composed: checkSolution(level, level.solution).ok };
  });
 });
 for (const result of outcomes) {
  expect(result.typed, `Level ${result.level}: manual solution still has the target type`).toBe(true);
  expect(result.composed, `Level ${result.level}: composed solution passes`).toBe(true);
  const missing = ['(.)'];
  for (const attempt of [result.manual, result.unused]) {
   expect(attempt.ok, `Level ${result.level}: required operators cannot be skipped`).toBe(false);
   expect(attempt.missing).toEqual(missing);
  }
 }
});

test('version 1 completions are rechecked for restored operators while row and text drafts survive', async ({ page }) => {
 const manualSeven = 'let r1 = f2 z; r2 = f1 z; r3 = f3 z; r4 = r2 <*> r3 in r1 <*> r4';
 await page.addInitScript(manualSeven => {
  localStorage.setItem('zth_progress', JSON.stringify({
   completed: [0,2,6], completionVersion: 1, connectionVersion: 1, rowVersion: 1,
   bypassCount: 3, currentLevel: 6, showIntro: false, iconMode: true, geckoOn: false,
   editorContents: { 0: 'zeroToHero z = f z' },
   rowPrograms: { 2: [{ id: 'r1', expr: 'f1 z' }, { id: 'r2', expr: 'f3 r1' }] },
   textDrafts: { 6: manualSeven }
  }));
 }, manualSeven);
 await page.goto(URL);
 const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('zth_progress')));
 expect(saved.completed).toEqual([0]);
 expect(saved.completionVersion).toBe(5);
 expect(saved.bypassCount).toBeUndefined();
 expect(saved.rowPrograms[3]).toEqual([{ id: 'r1', expr: 'f1 z' }, { id: 'r2', expr: 'f3 r1' }]);
 expect(saved.textDrafts[7]).toBe(manualSeven);
 await expect(page.locator('#status-output')).toContainText('Still needed: (.)');
 await expect(page.locator('#next-level')).toBeHidden();
 await expect(page.locator('.ready-row')).toHaveCount(1);
});

test('automatic completion preserves editing, records completion once, survives reload, and advances only on Next', async ({ page }) => {
 await open(page, false);
 await page.locator('#code-editor').fill('f z');
 await expect(page.locator('#status-bar')).toHaveClass(/success/);
 await expect(page.locator('#code-editor')).toBeFocused();
 expect(await page.evaluate(() => currentLevel)).toBe(0);
 await expect(page.locator('#next-level')).toBeVisible();
 await page.locator('#code-editor').fill('z');
 await expect(page.locator('#status-bar')).toHaveClass(/error/);
 await page.locator('#code-editor').fill('f z');
 expect(await page.evaluate(() => completedLevels.size)).toBe(1);
 await page.reload();
 expect(await page.evaluate(() => completedLevels.size)).toBe(1);
 await page.locator('#next-level').click();
 expect(await page.evaluate(() => currentLevel)).toBe(1);
});

test('old completion records are rechecked without discarding drafts or preferences', async ({ page }) => {
 await page.addInitScript(() => {
  if (!localStorage.getItem('zth_progress')) localStorage.setItem('zth_progress', JSON.stringify({
   completed: [0,1,2], optimal: [0,1], bypassCount: 2, currentLevel: 2, showIntro: false,
   iconMode: true, geckoOn: false, connectionVersion: 1,
   editorContents: { 0: 'zeroToHero z = f z', 1: 'zeroToHero z = mkHero $ runZero z', 2: 'zeroToHero z = f2 z' }
  }));
 });
 await page.goto(URL);
 const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('zth_progress')));
 expect(saved.completed).toEqual([0,1]);
 expect(saved.optimal).toBeUndefined();
 expect(saved.completionVersion).toBe(5);
 expect(saved.editorContents[3]).toBe('zeroToHero z = f2 z');
 expect(saved.iconMode).toBe(true); expect(saved.geckoOn).toBe(false);
 await expect(page.locator('#status-output')).toContainText('Unknown identifier: f2');
});
