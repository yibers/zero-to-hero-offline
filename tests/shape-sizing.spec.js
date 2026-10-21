const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
const URL = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;

for (const phone of [false, true]) {
  test.describe(phone ? 'phone shape sizes' : 'desktop shape sizes', () => {
    test.use({ viewport: { width: phone ? 390 : 1280, height: 900 }, isMobile: phone, hasTouch: phone });
    test('values retain their size across all levels, nested types and UI locations', async ({ page }) => {
      await page.goto(URL);
      const checks = await page.evaluate(() => {
        showIntro = false; iconMode = true; editorContents = {}; rowPrograms = {}; textDrafts = {};
        const failures = [], locations = new Set();
        for (const gecko of [false, true]) {
          geckoOn = gecko;
          LEVELS.forEach((level, index) => {
            for (const code of ['', level.solution]) {
              currentLevel = index; setEditorContent(code); render();
              for (const atom of document.querySelectorAll('.type-atom, .type-placeholder')) {
                const box = atom.getBoundingClientRect();
                if (Math.abs(box.width - 15) > .01 || Math.abs(box.height - 15) > .01)
                  failures.push({ level: level.level, type: atom.dataset.type, width: box.width, height: box.height });
                for (const selector of ['.func-card', '.parameter-icon', '.function-head', '.argument-slot', '.row-result'])
                  if (atom.closest(selector)) locations.add(selector);
              }
              if (document.documentElement.scrollWidth > document.documentElement.clientWidth)
                failures.push({ level: level.level, overflow: document.documentElement.scrollWidth });
              for (const container of document.querySelectorAll('.program-row, .function-block, .argument-slot, .parameter-prefix, .icon-palette .func-card')) {
                if (container.scrollWidth > container.clientWidth + 1)
                  failures.push({ level: level.level, gecko, container: container.className, overflow: container.scrollWidth - container.clientWidth });
              }
            }
          });
        }
        return { failures, locations: [...locations].sort() };
      });
      expect(checks.failures).toEqual([]);
      expect(checks.locations).toEqual(['.argument-slot', '.func-card', '.function-head', '.parameter-icon', '.row-result']);
    });

    test('wrappers grow around nested values and wide rows wrap to keep their full output visible', async ({ page }) => {
      await page.goto(URL);
      const sizes = await page.evaluate(() => {
        showIntro = false; iconMode = true; geckoOn = false; currentLevel = 14;
        setEditorContent(LEVELS[currentLevel].solution); render();
        return ['a', 'Hero a', 'Hero (Hero a)', 'Hero (a, (a, a))'].map(type => {
          const holder = document.createElement('div'); holder.innerHTML = renderSemanticType(type);
          const svg = holder.firstElementChild;
          return { width: Number(svg.getAttribute('width')), height: Number(svg.getAttribute('height')) };
        });
      });
      expect(sizes[1].width).toBeGreaterThan(sizes[0].width);
      expect(sizes[2].width).toBeGreaterThan(sizes[1].width);
      expect(sizes[2].height).toBeGreaterThan(sizes[1].height);
      expect(sizes[3].width).toBeGreaterThan(sizes[2].width);
      const goal = page.locator('.goal-reached');
      await goal.scrollIntoViewIfNeeded();
      await expect(goal).toBeInViewport({ ratio: .99 }); // Allow subpixel scroll rounding.
      const positions = await page.locator('.program-row').last().evaluate(row => {
        const call = row.querySelector('.function-block').getBoundingClientRect();
        const result = row.querySelector('.row-result').getBoundingClientRect();
        return { callCenter: call.y + call.height / 2, resultCenter: result.y + result.height / 2,
          callBottom: call.bottom, resultTop: result.top, rightInset: row.getBoundingClientRect().right - result.right };
      });
      // Specializing a placeholder to a nested type may wrap even on desktop.
      expect(Math.abs(positions.callCenter - positions.resultCenter) < .05 || positions.resultTop > positions.callBottom).toBe(true);
      expect(positions.rightInset).toBeLessThan(10);
    });
  });
}

test('wide palette diagrams reflow on phones and expand again on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(URL);
  await page.evaluate(() => {
    showIntro = false; iconMode = true; geckoOn = false; currentLevel = 10;
    setEditorContent(''); render();
  });
  const diagram = page.locator('.icon-palette [data-func-name="f1"] svg[data-diagram-type]');
  const wide = await diagram.boundingBox();
  await page.setViewportSize({ width: 320, height: 900 });
  await expect.poll(async () => (await diagram.boundingBox()).width).toBeLessThan(wide.width);
  expect((await diagram.boundingBox()).height).toBeGreaterThan(wide.height);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect.poll(async () => (await diagram.boundingBox()).width).toBe(wide.width);
  await expect.poll(async () => (await diagram.boundingBox()).height).toBe(wide.height);
});
