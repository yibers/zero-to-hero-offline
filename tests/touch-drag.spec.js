const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');

const PAGE_URL = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;

test.describe('Phone touch dragging', () => {
  test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE_URL);
    await page.getByRole('button', { name: 'OK', exact: true }).tap();
    await page.evaluate(() => document.fonts.ready);
  });

  // CDP dispatches actual browser touch input, exercising scrolling/default
  // actions as well as our handlers (unlike synthetic DOM drag events).
  async function gestures(page) {
    const cdp = await page.context().newCDPSession(page);
    const send = (type, points) => cdp.send('Input.dispatchTouchEvent', {
      type, touchPoints: points.map((p, i) => ({ ...p, id: i + 1 })),
    });
    return {
      start: p => send('touchStart', [p]),
      move: p => send('touchMove', [p]),
      end: () => send('touchEnd', []),
      cancel: () => send('touchCancel', []),
      secondFinger: (p, q) => send('touchStart', [p, q]),
      async drag(from, to) {
        await send('touchStart', [from]);
        await page.waitForTimeout(380);
        for (let i = 1; i <= 8; i++) {
          await send('touchMove', [{
            x: from.x + (to.x - from.x) * i / 8,
            y: from.y + (to.y - from.y) * i / 8,
          }]);
        }
        await send('touchEnd', []);
      },
    };
  }

  async function center(locator) {
    const r = await locator.boundingBox();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }

  async function editorPoint(page, position) {
    return page.locator('#code-editor').evaluate((el, pos) => {
      const rect = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      const span = document.createElement('span');
      span.style.font = s.font;
      span.style.whiteSpace = 'pre';
      span.textContent = 'MMMMMMMMMM';
      document.body.appendChild(span);
      const charWidth = span.getBoundingClientRect().width / 10;
      span.remove();
      return {
        x: rect.left + parseFloat(s.paddingLeft) + pos * charWidth - el.scrollLeft,
        y: rect.top + parseFloat(s.paddingTop) + parseFloat(s.lineHeight) / 2,
      };
    }, position);
  }

  async function noDragUI(page) {
    await expect(page.locator('#touch-drag-ghost, #drag-out-ghost, #drop-caret')).toHaveCount(0);
    await expect(page.locator('.dragging, .drag-over, .touch-dragging')).toHaveCount(0);
  }

  test('insert function and parameter, solve, and retain the solution after reload', async ({ page }) => {
    const touch = await gestures(page);
    const editor = page.locator('#code-editor');
    const end = await center(page.locator('.editor-wrap'));
    await touch.drag(await center(page.locator('[data-func-name="f"]')), end);
    await expect(editor).toHaveValue('f');
    await expect(editor).not.toBeFocused();
    await touch.drag(await center(page.locator('[data-func-name="z"]')), end);
    await expect(editor).toHaveValue('f z');
    await expect(page.locator('#inferred-type')).toContainText('Hero');
    await noDragUI(page);
    await page.getByRole('button', { name: 'Attempt', exact: true }).tap();
    await expect(page.locator('#level-dialog')).toBeVisible();
    await page.reload();
    await expect(editor).toHaveValue('f z');
  });

  test('insert at the start of the playground', async ({ page }) => {
    const touch = await gestures(page);
    const editor = page.locator('#code-editor');
    await editor.fill('z');
    await editor.blur();
    await page.waitForTimeout(200);
    await touch.drag(await center(page.locator('[data-func-name="f"]')), await editorPoint(page, 0));
    await expect(editor).toHaveValue('f z');
    await noDragUI(page);
  });

  test('move editor tokens and drag them out to remove them', async ({ page }) => {
    const touch = await gestures(page);
    const editor = page.locator('#code-editor');
    await editor.fill('z f');
    await editor.blur();
    // Let debounced type feedback settle before measuring token coordinates.
    await page.waitForTimeout(200);
    await touch.drag(await editorPoint(page, 2), await editorPoint(page, 0));
    await expect(editor).toHaveValue('f z');
    await touch.drag(await editorPoint(page, 2), { x: 20, y: 80 });
    await expect(editor).toHaveValue('f');
    await touch.drag(await editorPoint(page, 0), { x: 20, y: 80 });
    await expect(editor).toHaveValue('undefined');
    await noDragUI(page);
  });

  test('icon drops below the code use the horizontal start or middle position', async ({ page }) => {
    await page.evaluate(() => { currentLevel = 2; iconMode = true; geckoOn = false; render(); });
    const touch = await gestures(page);
    const editor = page.locator('#code-editor');
    const code = 'f3 f1 z';
    for (const [target, expected] of [
      ['f3', 'f2 f3 f1 z'],
      ['f1', 'f3 f2 f1 z'],
    ]) {
      await editor.fill(code);
      await editor.blur();
      await page.waitForTimeout(200);
      const icon = await page.locator(`#editor-overlay [title="${target}"]`).boundingBox();
      const area = await editor.boundingBox();
      await touch.drag(await center(page.locator('[data-func-name="f2"]')), {
        x: icon.x + 1, y: area.y + area.height - 12,
      });
      await expect(editor).toHaveValue(expected);
      await noDragUI(page);
    }
  });

  test('icon drops follow wrapped code rather than append to the end', async ({ page }) => {
    await page.evaluate(() => { currentLevel = 2; iconMode = true; geckoOn = false; render(); });
    const touch = await gestures(page);
    const editor = page.locator('#code-editor');
    await editor.fill('f1 f2 f3 $ f1 f2 f3 $ f1 f2 f3 z');
    await editor.blur();
    await page.waitForTimeout(200);
    const icons = page.locator('#editor-overlay [title="f3"]');
    const first = await icons.first().boundingBox();
    const second = await icons.nth(2).boundingBox();
    expect(second.y).toBeGreaterThan(first.y);
    await touch.drag(await center(page.locator('[data-func-name="f2"]')), {
      x: second.x + 1, y: second.y + second.height / 2,
    });
    await expect(editor).toHaveValue('f1 f2 f3 $ f1 f2 f3 $ f1 f2 f2 f3 z');
    await noDragUI(page);
  });

  test('icon drops follow scrolled lines without adding indentation', async ({ page }) => {
    await page.evaluate(() => { currentLevel = 2; iconMode = true; geckoOn = false; render(); });
    const touch = await gestures(page);
    const editor = page.locator('#code-editor');
    await editor.fill('f1\nf2\nf3\nf1\nf2 z');
    await editor.blur();
    await editor.evaluate(el => { el.scrollTop = el.scrollHeight; });
    await expect.poll(() => page.locator('#editor-overlay').evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    await page.waitForTimeout(200);
    const icon = await page.locator('#editor-overlay [title="f2"]').last().boundingBox();
    const area = await editor.boundingBox();
    expect(icon.y).toBeGreaterThanOrEqual(area.y);
    expect(icon.y + icon.height).toBeLessThanOrEqual(area.y + area.height);
    await touch.start(await center(page.locator('[data-func-name="f3"]')));
    await page.waitForTimeout(380);
    await touch.move({ x: icon.x + 1, y: icon.y + icon.height / 2 });
    const caret = await page.locator('#drop-caret').boundingBox();
    expect(caret.x).toBeCloseTo(icon.x, 0);
    expect(Math.abs(caret.y - icon.y)).toBeLessThan(12);
    await touch.end();
    await expect(editor).toHaveValue('f1\nf2\nf3\nf1\nf3 f2 z');
    await noDragUI(page);
  });

  test('large icon tiles show the held icon, reorder, and explain removal', async ({ page }) => {
    await page.evaluate(() => { currentLevel = 2; iconMode = true; geckoOn = false; render(); });
    const touch = await gestures(page);
    const editor = page.locator('#code-editor');
    await editor.fill('f1 f2 z');
    await editor.blur();
    await page.waitForTimeout(200);
    const tile = name => page.locator(`#editor-overlay > span:has([title="${name}"])`);
    for (const name of ['f1', 'f2', 'z']) {
      const r = await tile(name).boundingBox();
      expect(r.width).toBeGreaterThanOrEqual(44);
      expect(r.height).toBeGreaterThanOrEqual(44);
      const svg = await tile(name).locator('svg').boundingBox();
      expect(svg.width).toBeGreaterThanOrEqual(36);
    }
    // Grab the padding at the far edge, outside the small source character.
    const z = await tile('z').boundingBox();
    const source = { x: z.x + z.width - 2, y: z.y + z.height / 2 };
    await touch.start(source);
    await page.waitForTimeout(380);
    const ghost = page.locator('#drag-out-ghost');
    await expect(ghost.locator('[title="z"] svg')).toBeVisible();
    await expect(tile('z')).toHaveClass(/drag-source/);
    const preview = await ghost.boundingBox();
    expect(preview.y + preview.height).toBeLessThan(source.y - 10);
    const f1 = await tile('f1').boundingBox();
    await touch.move({ x: f1.x + 2, y: f1.y + f1.height / 2 });
    await expect(page.locator('#drop-caret')).toBeVisible();
    await expect(ghost).not.toHaveClass(/removing/);
    await touch.end();
    await expect(editor).toHaveValue('z f1 f2');
    await noDragUI(page);
    await touch.start(await center(tile('f1')));
    await page.waitForTimeout(380);
    await touch.move({ x: 20, y: 80 });
    await expect(ghost.locator('[title="f1"] svg')).toBeVisible();
    await expect(ghost).toHaveClass(/removing/);
    await expect(ghost).toContainText('Release to remove');
    await touch.end();
    await expect(editor).toHaveValue('z f2');
    await noDragUI(page);
    await touch.start(await center(tile('f2')));
    await page.waitForTimeout(380);
    await touch.move({ x: 20, y: 80 });
    await touch.cancel();
    await expect(editor).toHaveValue('z f2');
    await noDragUI(page);
    await expect(page.locator('.drag-source')).toHaveCount(0);
    await page.evaluate(() => toggleIconMode());
    await expect(editor).toHaveValue('z f2');
    await expect(page.locator('.editor-icons')).toHaveCount(0);
    expect(await editor.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBe(16);
  });

  test('icon card previews and long function tiles fit a narrow phone', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.evaluate(() => { currentLevel = 1; iconMode = true; geckoOn = false; render(); });
    const touch = await gestures(page);
    const editor = page.locator('#code-editor');
    await touch.start(await center(page.locator('[data-func-name="runZero"]')));
    await page.waitForTimeout(380);
    await expect(page.locator('#touch-drag-ghost [title="runZero"] svg')).toBeVisible();
    await touch.move(await center(editor));
    await touch.end();
    await expect(editor).toHaveValue('runZero');
    await noDragUI(page);
    const tile = await page.locator('#editor-overlay > span:has([title="runZero"])').boundingBox();
    const area = await editor.boundingBox();
    expect(tile.x).toBeGreaterThanOrEqual(area.x);
    expect(tile.x + tile.width).toBeLessThanOrEqual(area.x + area.width);
    await touch.drag({ x: tile.x + tile.width / 2, y: tile.y + tile.height / 2 }, { x: 20, y: 80 });
    await expect(editor).toHaveValue('undefined');
  });

  test('dropping a card outside the editor does not change the solution', async ({ page }) => {
    const touch = await gestures(page);
    await touch.drag(await center(page.locator('[data-func-name="f"]')), { x: 20, y: 80 });
    await expect(page.locator('#code-editor')).toHaveValue('undefined');
    await noDragUI(page);
  });

  test('cancelled or multi-finger drags make no edit and allow a later drag', async ({ page }) => {
    const touch = await gestures(page);
    const source = await center(page.locator('[data-func-name="f"]'));
    const target = await center(page.locator('.editor-wrap'));
    await touch.start(source);
    await page.waitForTimeout(380);
    await touch.move(target);
    await touch.cancel();
    await noDragUI(page);
    await touch.start(source);
    await page.waitForTimeout(380);
    await touch.secondFinger(source, { x: 20, y: 80 });
    await touch.end();
    await expect(page.locator('#code-editor')).toHaveValue('undefined');
    await noDragUI(page);
    await touch.drag(source, target);
    await expect(page.locator('#code-editor')).toHaveValue('f');
    await page.waitForTimeout(200);
    await touch.start(await editorPoint(page, 0));
    await page.waitForTimeout(380);
    await touch.move({ x: 20, y: 80 });
    await touch.cancel();
    await expect(page.locator('#code-editor')).toHaveValue('f');
    await noDragUI(page);
  });

  test('ordinary swipes scroll the cards without starting a drag', async ({ page }) => {
    // A later level has enough real cards to overflow the phone viewport.
    await page.evaluate(() => { currentLevel = 9; render(); });
    const touch = await gestures(page);
    const panel = page.locator('.right-panel');
    const r = await panel.boundingBox();
    const from = { x: r.x + r.width / 2, y: r.y + r.height - 50 };
    await touch.start(from);
    for (let i = 1; i <= 6; i++) await touch.move({ x: from.x, y: from.y - i * 30 });
    await touch.end();
    await expect.poll(() => panel.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    await expect(page.locator('#code-editor')).toHaveValue('undefined');
    await noDragUI(page);
  });

  test('tapping still focuses the editor, and a render cancels an active drag', async ({ page }) => {
    const editor = page.locator('#code-editor');
    await editor.tap();
    await expect(editor).toBeFocused();
    await editor.blur();
    const touch = await gestures(page);
    await touch.start(await center(page.locator('[data-func-name="f"]')));
    await page.waitForTimeout(380);
    await page.evaluate(() => toggleGecko());
    await touch.end();
    await noDragUI(page);
    await touch.drag(await center(page.locator('[data-func-name="f"]')), await center(page.locator('.editor-wrap')));
    await expect(editor).toHaveValue('f');
  });
});
