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
            currentLevel = index; setEditorContent(level.best); render();
            for (const atom of document.querySelectorAll('.type-atom')) {
              const box = atom.getBoundingClientRect();
              if (Math.abs(box.width - 15) > .01 || Math.abs(box.height - 15) > .01)
                failures.push({ level: level.level, type: atom.dataset.type, width: box.width, height: box.height });
              for (const selector of ['.func-card', '.parameter-icon', '.function-head', '.argument-slot', '.row-result'])
                if (atom.closest(selector)) locations.add(selector);
            }
            if (document.documentElement.scrollWidth > document.documentElement.clientWidth)
              failures.push({ level: level.level, overflow: document.documentElement.scrollWidth });
          });
        }
        return { failures, locations: [...locations].sort() };
      });
      expect(checks.failures).toEqual([]);
      expect(checks.locations).toEqual(['.argument-slot', '.func-card', '.function-head', '.parameter-icon', '.row-result']);
    });

    test('wrappers grow around nested values and wide rows can reveal their full output', async ({ page }) => {
      await page.goto(URL);
      const sizes = await page.evaluate(() => {
        showIntro = false; iconMode = true; geckoOn = false; currentLevel = 13;
        setEditorContent(LEVELS[currentLevel].best); render();
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
        return { callCenter: call.y + call.height / 2, resultCenter: result.y + result.height / 2 };
      });
      expect(positions.callCenter).toBeCloseTo(positions.resultCenter, 1);
    });
  });
}
