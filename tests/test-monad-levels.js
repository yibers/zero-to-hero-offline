// Test monad level solutions via direct typeCheck calls
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  const url = `file:///${path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/')}`;
  await p.goto(url);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForTimeout(300);

  // Dismiss intro
  const ok = p.locator('button', { hasText: 'OK' });
  if (await ok.isVisible({ timeout: 500 }).catch(() => false)) await ok.click();
  await p.waitForTimeout(200);

  const tests = [
    { level: 12, solution: 'join $ wrap z' },
    { level: 13, solution: 'f z >>= dup' },
    { level: 14, solution: 'swap <$> f z' },
    { level: 15, solution: 'f z >>= dup >>= nest' },
    { level: 16, solution: 'pair <$> g z <*> f z' },
  ];

  // Test each solution by calling typeCheck directly
  const results = await p.evaluate((tests) => {
    return tests.map(t => {
      const level = LEVELS[t.level - 1];
      const result = typeCheck(level, t.solution);
      // Also test liveInfer
      const inferred = liveInfer(level, t.solution);
      return {
        level: t.level,
        name: level.name,
        solution: t.solution,
        typeCheck: result,
        inferred: inferred.valid ? inferred.typeSig : inferred.error
      };
    });
  }, tests);

  let allPassed = true;
  for (const r of results) {
    const pass = r.typeCheck.ok;
    console.log(`${pass ? 'PASS' : 'FAIL'} L${r.level} "${r.name}": ${r.solution}`);
    console.log(`  typeCheck: ${r.typeCheck.ok ? 'OK' : r.typeCheck.msg}`);
    console.log(`  inferred: ${r.inferred}`);
    if (!pass) allPassed = false;
  }

  // Also test via UI for level 12 to verify full flow
  // Grant bypass points via evaluate so we can skip to level 12
  console.log('\n--- UI test: bypass to L12 and solve ---');
  await p.evaluate(() => {
    bypassCount = 11;
    saveProgress();
  });
  await p.reload();
  await p.waitForTimeout(300);
  // Dismiss intro if shown
  const introBtn = p.locator('button', { hasText: 'OK' });
  if (await introBtn.isVisible({ timeout: 500 }).catch(() => false)) await introBtn.click();
  await p.waitForTimeout(200);

  {
    const bypassBtn = p.locator('button', { hasText: 'Bypass' });
    for (let i = 0; i < 11; i++) {
      await bypassBtn.click();
      await p.waitForTimeout(100);
    }

    const editor = p.locator('#code-editor');
    await editor.fill('zeroToHero z = join $ wrap z');
    await p.waitForTimeout(500);
    const inferred = await p.locator('#inferred-type').textContent();
    console.log('Inferred type:', inferred);

    // Run the live check via evaluate to avoid race
    await p.evaluate(() => runLiveCheck());
    await p.waitForTimeout(800);
    const status = await p.locator('#status-bar').textContent();
    console.log('Status:', status);
    console.log(status.includes('Success') ? 'UI PASS' : 'UI FAIL');
  }

  console.log(allPassed ? '\nAll monad levels PASSED!' : '\nSome levels FAILED!');

  await browser.close();
  process.exit(allPassed ? 0 : 1);
})();
