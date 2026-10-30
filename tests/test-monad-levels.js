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

  // Select by the current lesson group and validate the complete puzzle rules,
  // including unary steps, exact supplies and the final use of z.
  const results = await p.evaluate(() => {
    return LEVELS.filter(level => ['flatten-wrappers', 'bind', 'map-wrapper', 'chain-wrapped', 'shared-input'].includes(level.id)).map(level => {
      const result = checkSolution(level, level.solution);
      const inferred = liveInfer(level, level.solution);
      return {
        level: level.level,
        name: level.name,
        solution: level.solution,
        typeCheck: result,
        inferred: inferred.valid ? inferred.typeSig : inferred.error
      };
    });
  });

  let allPassed = true;
  for (const r of results) {
    const pass = r.typeCheck.ok;
    console.log(`${pass ? 'PASS' : 'FAIL'} L${r.level} "${r.name}": ${r.solution}`);
    console.log(`  typeCheck: ${r.typeCheck.ok ? 'OK' : r.typeCheck.msg}`);
    console.log(`  inferred: ${r.inferred}`);
    if (!pass) allPassed = false;
  }

  // Open the flattening puzzle directly in the test fixture.
  console.log('\n--- UI test: flattening puzzle ---');
  await p.evaluate(() => {
    currentLevel = LEVELS.findIndex(level => level.id === 'flatten-wrappers');
    iconMode = false; showIntro = false; render();
  });
  {
    const editor = p.locator('#code-editor');
    await editor.fill(await p.evaluate(() => LEVELS[currentLevel].solution));
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
