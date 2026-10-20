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
    await locator.scrollIntoViewIfNeeded();
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
    const end = await center(page.locator('#code-editor'));
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

  test('move icon tokens and drag them out to remove them', async ({ page }) => {
    await page.evaluate(() => { iconMode = true; geckoOn = false; render(); });
    const touch = await gestures(page);
    const editor = page.locator('#code-editor');
    const tile = name => page.locator(`#editor-overlay > span:has([title="${name}"])`);
    await editor.fill('z f');
    await editor.blur();
    const target = await tile('z').boundingBox();
    await touch.drag(await center(tile('f')), { x: target.x + 1, y: target.y + target.height / 2 });
    await expect(editor).toHaveValue('f z');
    await touch.drag(await center(tile('z')), { x: 20, y: 80 });
    await expect(editor).toHaveValue('f');
    await touch.drag(await center(tile('f')), { x: 20, y: 80 });
    await expect(editor).toHaveValue('');
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
    await icons.nth(2).scrollIntoViewIfNeeded();
    const second = await icons.nth(2).boundingBox();
    expect(second.y).toBeGreaterThan(first.y);
    await touch.drag(await center(page.locator('[data-func-name="f2"]')), {
      x: second.x + 1, y: second.y + second.height / 2,
    });
    await expect(editor).toHaveValue('f1 f2 f3 $ f1 f2 f3 $ f1 f2 f2 f3 z');
    await noDragUI(page);
  });

  test('icon drops follow scrolled rows without adding indentation', async ({ page }) => {
    await page.evaluate(() => { currentLevel = 2; iconMode = true; geckoOn = false; render(); });
    const touch = await gestures(page);
    for (let i = 0; i < 5; i++) {
      if (i) await page.getByRole('button', { name: '+ Add row', exact: true }).tap();
      await page.locator('textarea.row-editor').nth(i).fill('f2 z');
    }
    const editor = page.locator('textarea.row-editor').last();
    await editor.blur();
    const token = page.locator('.program-row:not(.ready-row)').last().locator('[data-name="f2"]');
    await token.scrollIntoViewIfNeeded();
    expect(await page.locator('#program-rows').evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    const point = await token.boundingBox();
    await touch.drag(await center(page.locator('[data-func-name="f3"]')), { x: point.x + 1, y: point.y + point.height / 2 });
    await expect(editor).toHaveValue('f3 f2 z');
    await expect(page.locator('textarea.row-editor').first()).toHaveValue('f2 z');
    await noDragUI(page);
  });

  test('large icon tiles immediately show the picked-up icon, reorder, and explain removal', async ({ page }) => {
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
    const ghost = page.locator('#touch-drag-ghost');
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
    await touch.move({ x: 20, y: 80 });
    await expect(ghost.locator('[title="f1"] svg')).toBeVisible();
    await expect(ghost).toHaveClass(/removing/);
    await expect(ghost).toContainText('Release outside to remove');
    await touch.end();
    await expect(editor).toHaveValue('z f2');
    await noDragUI(page);
    await touch.start(await center(tile('f2')));
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
    await expect(page.locator('#touch-drag-ghost [title="runZero"] svg')).toBeVisible();
    await touch.move(await center(editor));
    await touch.end();
    await expect(editor).toHaveValue('runZero');
    await noDragUI(page);
    await page.locator('.function-head[data-name="runZero"]').scrollIntoViewIfNeeded();
    const tile = await page.locator('.function-head[data-name="runZero"]').boundingBox();
    const area = await page.locator('.function-block').boundingBox();
    expect(tile.x).toBeGreaterThanOrEqual(area.x);
    expect(tile.x + tile.width).toBeLessThanOrEqual(area.x + area.width);
    await touch.drag({ x: tile.x + tile.width / 2, y: tile.y + tile.height / 2 }, { x: 20, y: 80 });
    await expect(editor).toHaveValue('');
  });

  test('adjacent touch insertion and reordering never add implicit connections', async ({ page }) => {
    await page.evaluate(() => { currentLevel = 2; iconMode = true; geckoOn = false; render(); });
    const touch = await gestures(page);
    const editor = page.locator('#code-editor');
    const tile = name => page.locator(`#editor-overlay > span:has([title="${name}"])`);
    await editor.fill('f1 z');
    await editor.blur();
    await page.waitForTimeout(200);
    let first = await tile('f1').boundingBox();
    await touch.drag(await center(page.locator('[data-func-name="f3"]')), { x: first.x + 2, y: first.y + first.height / 2 });
    await expect(editor).toHaveValue('f3 f1 z');
    expect(await page.evaluate(() => getCodeFromEditor())).toBe('f3 f1 z');
    expect(await page.evaluate(() => typeCheck(LEVELS[currentLevel], getCodeFromEditor()).ok)).toBe(false);
    first = await tile('f3').boundingBox();
    await touch.drag(await center(tile('f1')), { x: first.x + 2, y: first.y + first.height / 2 });
    await expect(editor).toHaveValue('f1 f3 z');
    expect(await page.evaluate(() => getCodeFromEditor())).toBe('f1 f3 z');
    await touch.drag(await center(tile('f3')), { x: 20, y: 80 });
    await expect(editor).toHaveValue('f1 z');
    expect(await page.evaluate(() => getCodeFromEditor())).toBe('f1 z');
    await noDragUI(page);
  });

  test('phone center drop offers operators, swaps order, and saves the selected connection', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.evaluate(() => { currentLevel = 2; iconMode = true; geckoOn = false; render(); });
    const touch = await gestures(page);
    const editor = page.locator('#code-editor');
    const tile = name => page.locator(`#editor-overlay > span:has([title="${name}"])`);
    await editor.fill('f1 z');
    await editor.blur();
    await touch.start(await center(page.locator('[data-func-name="f3"]')));
    await touch.move(await center(tile('f1')));
    await expect(tile('f1')).toHaveClass(/connection-target/);
    await expect(page.locator('#drop-caret')).toHaveCount(0);
    await touch.end();
    const picker = page.getByRole('dialog', { name: 'Choose an operator' });
    await expect(picker).toBeVisible();
    await expect(editor).toHaveValue('f1 z');
    await noDragUI(page);
    const bounds = await picker.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(800);
    await picker.getByRole('button', { name: 'Swap order' }).tap();
    const dollar = picker.getByRole('button', { name: 'Use $', exact: true });
    expect(await dollar.locator('.connection-preview > .icon-sym').evaluateAll(icons => icons.map(icon => icon.getAttribute('title'))))
      .toEqual(['f3', '$', 'f1', 'z']);
    expect((await dollar.boundingBox()).height).toBeGreaterThanOrEqual(48);
    await dollar.tap();
    await expect(editor).toHaveValue('f3 $ f1 z');
    await expect(editor).not.toBeFocused();
    expect(await page.evaluate(() => typeCheck(LEVELS[currentLevel], getCodeFromEditor()).ok)).toBe(true);
    await page.reload();
    await expect(editor).toHaveValue('f3 $ f1 z');
    // Use one application in the row when checking a move between functions.
    // The saved nested expression above is retained, with a row validation error.
    await expect(page.locator('.row-feedback')).toContainText('One operation per row');
    await editor.fill('f3 f1');
    await editor.blur();
    // Moving an existing function offers a choice without editing until chosen.
    await touch.drag(await center(tile('f1')), await center(tile('f3')));
    await expect(picker).toBeVisible();
    await picker.getByRole('button', { name: 'Cancel', exact: true }).tap();
    await expect(editor).toHaveValue('f3 f1');
    await noDragUI(page);
    await touch.drag(await center(tile('f1')), await center(tile('f3')));
    await picker.getByRole('button', { name: 'Use .', exact: true }).tap();
    await expect(editor).toHaveValue('f3 . f1');
  });

  test('dragging functions out removes one adjacent explicit connector', async ({ page }) => {
    await page.evaluate(() => { currentLevel = 2; iconMode = true; geckoOn = false; render(); });
    const touch = await gestures(page);
    const editor = page.locator('#code-editor');
    for (const [code, token, expected] of [
      ['f3 $ f1 z', 'f3', 'f1 z'],
      ['f3 $ f1 z', 'f1', 'f3 z'],
      ['f3 . f2 $ f1 z', 'f2', 'f3 . f1 z'],
      ['f3 . f1 z', 'f3', 'f1 z'],
      ['f3 $ f1 z', 'z', 'f3 $ f1'],
    ]) {
      await editor.fill(code);
      await editor.blur();
      await page.waitForTimeout(200);
      await touch.drag(await center(page.locator(`#editor-overlay > span:has([title="${token}"])`)), { x: 20, y: 80 });
      await expect(editor).toHaveValue(expected);
      await noDragUI(page);
    }
    await page.evaluate(() => toggleIconMode());
    await editor.fill('f3 $ f1 z');
    await editor.evaluate(el => { el.focus(); el.setSelectionRange(0, 5); });
    await editor.press('Backspace');
    await expect(editor).toHaveValue('f1 z');
  });

  test('dropping a card outside the editor does not change the solution', async ({ page }) => {
    const touch = await gestures(page);
    await touch.drag(await center(page.locator('[data-func-name="f"]')), { x: 20, y: 80 });
    await expect(page.locator('#code-editor')).toHaveValue('');
    await noDragUI(page);
  });

  test('cancelled or multi-finger drags make no edit and allow a later drag', async ({ page }) => {
    const touch = await gestures(page);
    const source = await center(page.locator('[data-func-name="f"]'));
    const target = await center(page.locator('#code-editor'));
    await touch.start(source);
    await touch.move(target);
    await touch.cancel();
    await noDragUI(page);
    await touch.start(source);
    await touch.secondFinger(source, { x: 20, y: 80 });
    await touch.end();
    await expect(page.locator('#code-editor')).toHaveValue('');
    await noDragUI(page);
    await touch.drag(source, target);
    await expect(page.locator('#code-editor')).toHaveValue('f');
    await page.waitForTimeout(200);
    await touch.start(await editorPoint(page, 0));
    await touch.move({ x: 20, y: 80 });
    await touch.cancel();
    await expect(page.locator('#code-editor')).toHaveValue('f');
    await noDragUI(page);
  });

  test('taps and tiny movements do not insert or remove tokens', async ({ page }) => {
    await page.evaluate(() => { iconMode = true; geckoOn = false; render(); });
    const touch = await gestures(page);
    const editor = page.locator('#code-editor');
    const card = page.locator('[data-func-name="f"]');
    await card.tap();
    await expect(editor).toHaveValue('');
    await noDragUI(page);
    await editor.fill('f z');
    await editor.blur();
    await page.waitForTimeout(200);
    const token = await center(page.locator('#editor-overlay > span:has([title="f"])'));
    await page.touchscreen.tap(token.x, token.y);
    await expect(editor).toBeFocused();
    await expect(editor).toHaveValue('f z');
    await noDragUI(page);
    await editor.blur();
    await touch.start(token);
    await touch.move({ x: token.x + 2, y: token.y + 1 });
    await touch.end();
    await expect(editor).toHaveValue('f z');
    await noDragUI(page);
  });

  test('background swipes scroll the cards without starting a drag', async ({ page }) => {
    // A later level has enough real cards to overflow the phone viewport.
    await page.evaluate(() => { currentLevel = 9; render(); });
    const touch = await gestures(page);
    const panel = page.locator('.right-panel');
    const r = await panel.boundingBox();
    const from = { x: r.x + r.width - 3, y: r.y + r.height - 50 };
    expect(await page.evaluate(p => !!document.elementFromPoint(p.x, p.y).closest('.func-card'), from)).toBe(false);
    await touch.start(from);
    for (let i = 1; i <= 6; i++) await touch.move({ x: from.x, y: from.y - i * 30 });
    await touch.end();
    await expect.poll(() => panel.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    await expect(page.locator('#code-editor')).toHaveValue('');
    await noDragUI(page);
  });

  test('tapping still focuses the editor, and a render cancels an active drag', async ({ page }) => {
    const editor = page.locator('#code-editor');
    await editor.tap();
    await expect(editor).toBeFocused();
    await editor.blur();
    const touch = await gestures(page);
    await touch.start(await center(page.locator('[data-func-name="f"]')));
    await page.evaluate(() => toggleGecko());
    await touch.end();
    await noDragUI(page);
    await touch.drag(await center(page.locator('[data-func-name="f"]')), await center(page.locator('#code-editor')));
    await expect(editor).toHaveValue('f');
  });
});
