const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('url');
const path = require('path');
const URL = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
async function open(page, level, code) {
  await page.goto(URL);
  await page.evaluate(({ level, code }) => {
    localStorage.clear(); showIntro = false; iconMode = true; geckoOn = false;
    currentLevel = level; rowPrograms = {}; textDrafts = {}; editorContents = {};
    setEditorContent(code); render();
  }, { level, code });
  await page.evaluate(() => document.fonts.ready);
}
async function point(locator, x = .5, y = .5) {
  await locator.scrollIntoViewIfNeeded();
  const r = await locator.boundingBox();
  return { x: r.x + r.width * x, y: r.y + r.height * y };
}
async function alignedGhost(page, at) {
  const r = await page.locator('.drag-ghost').boundingBox();
  expect(Math.abs(r.x + r.width / 2 - at.x)).toBeLessThan(1);
  expect(Math.abs(r.y + r.height / 2 - at.y)).toBeLessThan(1);
}

test('mouse editor drag preview is centered on its drop point, including the lower target edge', async ({ page }) => {
  await open(page, 14, 'pair f g');
  const from = await point(page.locator('.argument-slot').first());
  const to = await point(page.locator('.argument-slot').nth(1), .5, .9);
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await alignedGhost(page, to);
  await expect(page.locator('.argument-slot').nth(1)).toHaveClass(/slot-target/);
  await page.mouse.up();
  await expect(page.locator('textarea.row-editor')).toHaveValue('pair _ f');
});

test('native palette drag centers its image regardless of where the card was grabbed', async ({ page }) => {
  await open(page, 0, 'f');
  await page.evaluate(() => {
    const original = DataTransfer.prototype.setDragImage;
    DataTransfer.prototype.setDragImage = function(node, x, y) {
      window.dragImage = { x, y, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height };
      return original.call(this, node, x, y);
    };
  });
  const from = await point(page.locator('#editor-prefix [data-func-name="z"]'), .5, .1);
  const to = await point(page.locator('.argument-slot'), .5, .9);
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(from.x + 8, from.y + 8);
  await page.mouse.move(to.x, to.y, { steps: 8 }); await page.mouse.move(to.x, to.y);
  const image = await page.evaluate(() => window.dragImage);
  expect(image).toBeTruthy();
  expect(Math.abs(image.x - image.width / 2)).toBeLessThan(1);
  expect(Math.abs(image.y - image.height / 2)).toBeLessThan(1);
  await page.mouse.up();
  await expect(page.locator('textarea.row-editor')).toHaveValue('f z');
});

test.describe('phone drop targets', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  async function touch(page) {
    const cdp = await page.context().newCDPSession(page);
    return (type, at) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: at ? [{ ...at, id: 1 }] : [] });
  }
  test('the whole input accepts touch drops and the preview matches the highlighted target', async ({ page }) => {
    await open(page, 7, 'fmap');
    const send = await touch(page);
    for (const [x, y] of [[.5,.1], [.5,.5], [.5,.9], [.1,.9], [.9,.9]]) {
      await page.evaluate(() => { setEditorContent('fmap'); render(); });
      const to = await point(page.locator('.argument-slot').first(), x, y);
      const from = await point(page.locator('#editor-prefix [data-func-name="bd"]'));
      await send('touchStart', from); await send('touchMove', to);
      await alignedGhost(page, to);
      await expect(page.locator('.argument-slot').first()).toHaveClass(/slot-target/);
      await send('touchEnd');
      await expect(page.locator('textarea.row-editor')).toHaveValue('fmap bd');
    }
  });
  test('the lower edge of a spare row stays a valid target while holding near the scroll boundary', async ({ page }) => {
    await open(page, 7, 'let r1 = fmap bd z; r2 = f1 r1; r3 = f1 r2; r4 = f1 r3 in f1 r4');
    const send = await touch(page);
    const target = page.locator('.empty-row-drop');
    const to = await point(target, .5, .95);
    const from = await point(page.locator('.right-panel [data-func-name="f2"]'));
    await send('touchStart', from); await send('touchMove', to);
    await alignedGhost(page, to);
    await expect(page.locator('.ready-row')).toHaveClass(/drag-over/);
    // The drag autoscroller has a 200 ms dwell: a real target should stay put.
    await page.waitForTimeout(400);
    await expect(page.locator('.ready-row')).toHaveClass(/drag-over/);
    const r = await target.boundingBox();
    expect(to.y).toBeLessThanOrEqual(r.y + r.height);
    await send('touchEnd');
    await expect(page.locator('textarea.row-editor').last()).toHaveValue('f2');
    await expect(page.locator('#touch-drag-ghost')).toHaveCount(0);
  });
});
