// Tests for Zero to Hero game
const { test, expect } = require('@playwright/test');
const path = require('path');

const PAGE_URL = `file:///${path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/')}`;

test.describe('Zero to Hero', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE_URL);
    // Clear localStorage to reset state
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    // Dismiss intro dialog if shown
    const okBtn = page.locator('button', { hasText: 'OK' });
    if (await okBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await okBtn.click();
    }
  });

  test('shows level 1 with correct UI elements', async ({ page }) => {
    await expect(page.locator('nav')).toContainText('Trial');
    await expect(page.locator('nav')).toContainText('Level 1 / 15');
    await expect(page.locator('body')).toContainText('To Implement');
    await expect(page.locator('body')).toContainText('Your Solution');
    await expect(page.locator('body')).toContainText('Code Editor');
    await expect(page.locator('body')).toContainText('Available Functions');
    await expect(page.locator('body')).toContainText('Gecko Graph');
    await expect(page.locator('body')).toContainText('Bypass');
    await expect(page.locator('textarea#code-editor')).toBeVisible();
    // Editor pre-filled with "zeroToHero z = undefined"
    await expect(page.locator('#code-editor')).toHaveValue(/zeroToHero z = undefined/);
  });

  test('shows initial inferred type as just "a"', async ({ page }) => {
    const inferredType = page.locator('#inferred-type');
    await expect(inferredType).toContainText('a');
    // Status should be "Init"
    await expect(page.locator('#status-bar')).toContainText('Status: Init');
    await expect(page.locator('#status-output')).toContainText('You did not make any changes.');
  });

  test('live type inference updates on typing - correct answer L1', async ({ page }) => {
    const editor = page.locator('#code-editor');
    const inferredType = page.locator('#inferred-type');
    const syntaxHint = page.locator('#syntax-hint');

    // Type correct solution (replace full editor content)
    await editor.fill('zeroToHero z = f z');
    await page.waitForTimeout(200);

    // Inferred type should show the full signature with unicode arrow
    await expect(inferredType).toContainText('Zero a');
    await expect(inferredType).toContainText('Hero');

    // Syntax hint should be green (valid)
    await expect(syntaxHint).toContainText('valid syntax');
    await expect(syntaxHint).not.toHaveClass(/invalid/);
  });

  test('live type inference shows valid but wrong type for "z"', async ({ page }) => {
    const editor = page.locator('#code-editor');
    const inferredType = page.locator('#inferred-type');
    const syntaxHint = page.locator('#syntax-hint');

    await editor.fill('zeroToHero z = z');
    await page.waitForTimeout(200);

    await expect(syntaxHint).toContainText('valid syntax');
    await expect(inferredType).toContainText('Zero');
  });

  test('live type inference shows error for unknown identifier', async ({ page }) => {
    const editor = page.locator('#code-editor');
    const syntaxHint = page.locator('#syntax-hint');

    await editor.fill('zeroToHero z = foo z');
    await page.waitForTimeout(200);

    await expect(syntaxHint).toHaveClass(/invalid/);
    await expect(syntaxHint).toContainText('not in the available functions');
  });

  test('live type inference shows error for undefined usage', async ({ page }) => {
    const editor = page.locator('#code-editor');

    await editor.fill('zeroToHero z = undefined');
    await page.waitForTimeout(200);

    await expect(page.locator('#status-output')).toContainText('did not make any changes');
  });

  test('Attempt button completes level 1 with correct answer', async ({ page }) => {
    const editor = page.locator('#code-editor');
    await editor.fill('zeroToHero z = f z');
    await page.waitForTimeout(200);

    await page.locator('button', { hasText: 'Attempt' }).click();
    await page.waitForTimeout(300);

    await expect(page.locator('body')).toContainText('Congratulations');
    await expect(page.locator('button', { hasText: 'Next level' })).toBeVisible();
  });

  test('Attempt button shows failure for wrong answer', async ({ page }) => {
    const editor = page.locator('#code-editor');
    await editor.fill('zeroToHero z = z');
    await page.waitForTimeout(200);

    await page.locator('button', { hasText: 'Attempt' }).click();
    await page.waitForTimeout(300);

    const statusBar = page.locator('#status-bar');
    await expect(statusBar).toContainText('Failed');
    await expect(page.locator('body')).not.toContainText('Congratulations');
  });

  test('can advance to level 2 after completing level 1', async ({ page }) => {
    const editor = page.locator('#code-editor');
    await editor.fill('zeroToHero z = f z');
    await page.locator('button', { hasText: 'Attempt' }).click();
    await page.waitForTimeout(300);

    await page.locator('button', { hasText: 'Next level' }).click();
    await page.waitForTimeout(200);

    await expect(page.locator('nav')).toContainText('Assembly required');
    await expect(page.locator('nav')).toContainText('Level 2 / 15');
  });

  test('level 2 correct solution: mkHero $ runZero z', async ({ page }) => {
    await page.locator('#code-editor').fill('zeroToHero z = f z');
    await page.locator('button', { hasText: 'Attempt' }).click();
    await page.waitForTimeout(300);
    await page.locator('button', { hasText: 'Next level' }).click();
    await page.waitForTimeout(200);

    await page.locator('#code-editor').fill('zeroToHero z = mkHero $ runZero z');
    await page.waitForTimeout(200);

    await expect(page.locator('#syntax-hint')).toContainText('valid syntax');

    await page.locator('button', { hasText: 'Attempt' }).click();
    await page.waitForTimeout(300);
    await expect(page.locator('body')).toContainText('Congratulations');
  });

  test('live check updates in real-time as user types', async ({ page }) => {
    const editor = page.locator('#code-editor');
    const inferredType = page.locator('#inferred-type');

    // Initial: "undefined" -> should show just 'a'
    await expect(inferredType).toContainText('a');

    // Type just 'f' (no argument)
    await editor.fill('zeroToHero z = f');
    await page.waitForTimeout(200);
    await expect(inferredType).toContainText('Zero');

    // Complete with 'f z'
    await editor.fill('zeroToHero z = f z');
    await page.waitForTimeout(200);
    await expect(inferredType).toContainText('Hero');
  });

  test('gecko graph blocks are rendered', async ({ page }) => {
    await expect(page.locator('.gecko-wrap').first()).toBeVisible();
    await expect(page.locator('.gecko-body').first()).toBeVisible();
  });

  test('gecko graph toggle works', async ({ page }) => {
    // Gecko should be on by default
    await expect(page.locator('.gecko-wrap').first()).toBeVisible();
    // Toggle off
    await page.locator('.gecko-toggle').click();
    await page.waitForTimeout(100);
    // Gecko blocks should not be visible
    await expect(page.locator('.gecko-wrap')).toHaveCount(0);
    // Toggle back on
    await page.locator('.gecko-toggle').click();
    await page.waitForTimeout(100);
    await expect(page.locator('.gecko-wrap').first()).toBeVisible();
  });

  test('line numbers are shown in editor', async ({ page }) => {
    const lineNums = page.locator('#line-numbers');
    await expect(lineNums).toBeVisible();
    await expect(lineNums).toContainText('1');
  });

  test('unicode arrow is used in type signatures', async ({ page }) => {
    // Should use → not ->
    const toImplement = page.locator('.code-block').first();
    await expect(toImplement).toContainText('\u2192');
  });
});
