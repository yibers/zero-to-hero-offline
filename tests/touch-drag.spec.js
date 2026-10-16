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
