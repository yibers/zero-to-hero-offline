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

    // Inferred type should show the full signature with unicode arrow
    // (auto-retries until live inference debounce fires)
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
    await page.getByText('Gecko Graph').click();
    await page.waitForTimeout(100);
    // Gecko blocks should not be visible
    await expect(page.locator('.gecko-wrap')).toHaveCount(0);
    // Toggle back on
    await page.getByText('Gecko Graph').click();
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

  test('rejects expression with unexpected characters', async ({ page }) => {
    const editor = page.locator('#code-editor');
    await editor.fill('zeroToHero z = f z !!!');
    await page.waitForTimeout(200);
    await expect(page.locator('#syntax-hint')).toHaveClass(/invalid/);
  });

  test('rejects unbalanced parentheses (missing closing)', async ({ page }) => {
    const editor = page.locator('#code-editor');
    await editor.fill('zeroToHero z = (f z');
    await page.waitForTimeout(200);
    await expect(page.locator('#syntax-hint')).toHaveClass(/invalid/);
  });

  test('rejects trailing tokens after valid expression', async ({ page }) => {
    const editor = page.locator('#code-editor');
    await editor.fill('zeroToHero z = f z)');
    await page.waitForTimeout(200);
    await expect(page.locator('#syntax-hint')).toHaveClass(/invalid/);
  });

  test('rejects undefined used inside expression', async ({ page }) => {
    const editor = page.locator('#code-editor');
    await editor.fill('zeroToHero z = f undefined');
    await page.waitForTimeout(200);
    await expect(page.locator('#syntax-hint')).toHaveClass(/invalid/);
    await expect(page.locator('#syntax-hint')).toContainText('undefined is not allowed');
  });

  test('Attempt rejects undefined inside expression', async ({ page }) => {
    const editor = page.locator('#code-editor');
    await editor.fill('zeroToHero z = f undefined');
    await page.waitForTimeout(200);
    await page.locator('button', { hasText: 'Attempt' }).click();
    await page.waitForTimeout(300);
    await expect(page.locator('#status-bar')).toContainText('Failed');
  });

  test('bypass button decrements count', async ({ page }) => {
    // Solve level 1 to earn 1 bypass point
    const editor = page.locator('#code-editor');
    await editor.fill('zeroToHero z = f z');
    await page.locator('button', { hasText: 'Attempt' }).click();
    await page.waitForTimeout(300);
    await page.locator('button', { hasText: 'Next level' }).click();
    await page.waitForTimeout(200);

    // Should have 1 bypass point — use it
    const bypassBtn = page.locator('button', { hasText: 'Bypass' });
    await expect(bypassBtn).toContainText('1');
    await bypassBtn.click();
    await page.waitForTimeout(200);

    // Bypass count should now be 0 and button disabled
    const bypassBtn2 = page.locator('button', { hasText: 'Bypass' });
    await expect(bypassBtn2).toContainText('0');
    await expect(bypassBtn2).toBeDisabled();
  });

  test('cursor remains visible in editor after dragging a function in', async ({ page }) => {
    // Navigate to level 4 by solving levels 1-3
    const editor = page.locator('#code-editor');

    // Solve level 1
    await editor.fill('zeroToHero z = f z');
    await page.locator('button', { hasText: 'Attempt' }).click();
    await page.waitForTimeout(300);
    await page.locator('button', { hasText: 'Next level' }).click();
    await page.waitForTimeout(200);

    // Solve level 2
    await editor.fill('zeroToHero z = mkHero $ runZero z');
    await page.locator('button', { hasText: 'Attempt' }).click();
    await page.waitForTimeout(300);
    await page.locator('button', { hasText: 'Next level' }).click();
    await page.waitForTimeout(200);

    // Solve level 3
    await editor.fill('zeroToHero z = f3 $ f1 z');
    await page.locator('button', { hasText: 'Attempt' }).click();
    await page.waitForTimeout(300);
    await page.locator('button', { hasText: 'Next level' }).click();
    await page.waitForTimeout(200);

    // Now on level 4: "A repeating pattern"
    await expect(page.locator('nav')).toContainText('Level 4');

    // Click editor to place cursor
    await editor.click();
    await page.waitForTimeout(100);

    // Drag f4 from func card into the editor
    const f4Card = page.locator('.func-card', { hasText: 'f4' });
    await f4Card.dragTo(editor);
    await page.waitForTimeout(200);

    // f4 should be in the editor value
    await expect(editor).toHaveValue(/f4/);

    // After drop, editor must have focus
    const hasFocus = await editor.evaluate(el => document.activeElement === el);
    expect(hasFocus).toBe(true);

    // caret-color must not be transparent (cursor must be visible)
    const caretColor = await editor.evaluate(el => getComputedStyle(el).caretColor);
    expect(caretColor).not.toBe('transparent');
    expect(caretColor).not.toBe('rgba(0, 0, 0, 0)');

    // Verify typing works after drop (proves cursor is active)
    await editor.press('End');
    await page.keyboard.type(' z');
    await page.waitForTimeout(100);
    await expect(editor).toHaveValue(/f4.*z/);
  });

  test('no extra spaces after drag-in, drag-out, drag-in cycle', async ({ page }) => {
    // Navigate to level 5 by solving levels 1-4
    const editor = page.locator('#code-editor');

    // Solve level 1
    await editor.fill('zeroToHero z = f z');
    await page.locator('button', { hasText: 'Attempt' }).click();
    await page.waitForTimeout(300);
    await page.locator('button', { hasText: 'Next level' }).click();
    await page.waitForTimeout(200);

    // Solve level 2
    await editor.fill('zeroToHero z = mkHero $ runZero z');
    await page.locator('button', { hasText: 'Attempt' }).click();
    await page.waitForTimeout(300);
    await page.locator('button', { hasText: 'Next level' }).click();
    await page.waitForTimeout(200);

    // Solve level 3
    await editor.fill('zeroToHero z = f3 $ f1 z');
    await page.locator('button', { hasText: 'Attempt' }).click();
    await page.waitForTimeout(300);
    await page.locator('button', { hasText: 'Next level' }).click();
    await page.waitForTimeout(200);

    // Solve level 4
    await editor.fill('zeroToHero z = f2 $ f4 z');
    await page.locator('button', { hasText: 'Attempt' }).click();
    await page.waitForTimeout(300);
    await page.locator('button', { hasText: 'Next level' }).click();
    await page.waitForTimeout(200);

    // Now on level 5
    await expect(page.locator('nav')).toContainText('Level 5');

    // Step 1: Drag f1 into the editor
    const f1Card = page.locator('.func-card', { hasText: 'f1' }).first();
    await f1Card.dragTo(editor);
    await page.waitForTimeout(200);
    const afterFirstDragIn = await editor.inputValue();
    expect(afterFirstDragIn).toMatch(/f1/);

    // Step 2: Drag f1 out of the editor (select and drag outside)
    // Simulate by using fill to reset to "undefined" state, matching drag-out behavior
    // Actually: use the real drag-out mechanism via mousedown on the token
    // Since Playwright can't easily simulate the custom drag-out, we simulate the
    // effect programmatically: remove f1, which should restore "undefined"
    await editor.evaluate(el => {
      const rhsStart = el.value.indexOf('=') + 1;
      // Select everything after = sign
      const rhs = el.value.slice(rhsStart).trim();
      const tokenStart = el.value.indexOf(rhs, rhsStart);
      el.setSelectionRange(tokenStart, tokenStart + rhs.length);
      document.execCommand('insertText', false, '');
      // Simulate the "restore undefined" logic from drag-out
      const newRhs = el.value.slice(rhsStart).trim();
      if (!newRhs) {
        const insertAt = el.value.length;
        el.setSelectionRange(insertAt, insertAt);
        document.execCommand('insertText', false, ' undefined');
      }
    });
    await page.waitForTimeout(200);
    const afterDragOut = await editor.inputValue();
    expect(afterDragOut).toMatch(/undefined/);

    // Step 3: Drag f1 in again
    await f1Card.dragTo(editor);
    await page.waitForTimeout(200);
    const afterSecondDragIn = await editor.inputValue();

    // The editor value should not have multiple consecutive spaces
    expect(afterSecondDragIn).not.toMatch(/  /);
    // Should be the same as after the first drag-in
    expect(afterSecondDragIn).toBe(afterFirstDragIn);
  });

  test('drag-in/backspace-delete/drag-in cycle does not shift token rightward', async ({ page }) => {
    // Navigate to level 5 by solving levels 1-4
    const editor = page.locator('#code-editor');

    await editor.fill('zeroToHero z = f z');
    await page.locator('button', { hasText: 'Attempt' }).click();
    await page.waitForTimeout(300);
    await page.locator('button', { hasText: 'Next level' }).click();
    await page.waitForTimeout(200);

    await editor.fill('zeroToHero z = mkHero $ runZero z');
    await page.locator('button', { hasText: 'Attempt' }).click();
    await page.waitForTimeout(300);
    await page.locator('button', { hasText: 'Next level' }).click();
    await page.waitForTimeout(200);

    await editor.fill('zeroToHero z = f3 $ f1 z');
    await page.locator('button', { hasText: 'Attempt' }).click();
    await page.waitForTimeout(300);
    await page.locator('button', { hasText: 'Next level' }).click();
    await page.waitForTimeout(200);

    await editor.fill('zeroToHero z = f2 $ f4 z');
    await page.locator('button', { hasText: 'Attempt' }).click();
    await page.waitForTimeout(300);
    await page.locator('button', { hasText: 'Next level' }).click();
    await page.waitForTimeout(200);

    await expect(page.locator('nav')).toContainText('Level 5');

    const f1Card = page.locator('.func-card', { hasText: 'f1' }).first();

    // Cycle 1: drag f1 in
    await f1Card.dragTo(editor);
    await page.waitForTimeout(200);
    const baseline = await editor.inputValue();

    // Run 3 cycles: backspace to clear RHS, then simulate the drop handler
    // with _dropPos at rhsStart (right after "="). This is what happens when
    // the user drops near the left edge of the RHS area.
    for (let i = 0; i < 3; i++) {
      await editor.click();
      await editor.press('End');
      await editor.press('Backspace'); // delete '1'
      await editor.press('Backspace'); // delete 'f'
      await page.waitForTimeout(200);

      // Set _dropPos to rhsStart then fire a synthetic drop event
      // so the actual app drop handler runs (not a copy of the logic)
      await editor.evaluate(el => {
        el._dropPos = el.value.indexOf('=') + 1;
        const dt = new DataTransfer();
        dt.setData('text/plain', 'f1');
        const dropEvent = new DragEvent('drop', {
          bubbles: true, cancelable: true, dataTransfer: dt
        });
        el.dispatchEvent(dropEvent);
      });
      await page.waitForTimeout(100);
      const current = await editor.inputValue();
      expect(current).toBe(baseline);
    }
  });

  test('backspace deletes whole token and preserves LHS', async ({ page }) => {
    const editor = page.locator('#code-editor');
    await editor.fill('zeroToHero z = mkHero');
    await page.waitForTimeout(100);
    await editor.click();
    await editor.press('End');

    // One backspace deletes entire "mkHero" token
    await editor.press('Backspace');
    const after = await editor.inputValue();
    expect(after).toBe('zeroToHero z = ');

    // One more backspace — blocked by LHS protection
    await editor.press('Backspace');
    const afterExtra = await editor.inputValue();
    expect(afterExtra).toBe('zeroToHero z = ');
  });

  test('Ctrl+Backspace does not damage LHS', async ({ page }) => {
    const editor = page.locator('#code-editor');
    await editor.fill('zeroToHero z = mkHero $ runZero z');
    await page.waitForTimeout(100);
    await editor.click();
    await editor.press('End');

    // Ctrl+Backspace deletes word by word
    await page.keyboard.press('Control+Backspace');
    const after1 = await editor.inputValue();
    await page.keyboard.press('Control+Backspace');
    const after2 = await editor.inputValue();
    await page.keyboard.press('Control+Backspace');
    const after3 = await editor.inputValue();
    await page.keyboard.press('Control+Backspace');
    const after4 = await editor.inputValue();

    // After all Ctrl+Backspaces, LHS must still be intact
    expect(after4).toMatch(/^zeroToHero z = /);

    // Mash Ctrl+Backspace a few more times — LHS must survive
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Control+Backspace');
    }
    const afterMash = await editor.inputValue();
    expect(afterMash).toMatch(/^zeroToHero z = /);
  });

  test('selecting all RHS then backspace leaves clean LHS', async ({ page }) => {
    const editor = page.locator('#code-editor');
    await editor.fill('zeroToHero z = f z');
    await page.waitForTimeout(100);

    // Ctrl+A selects only RHS, then backspace
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(100);

    const afterSelectAll = await editor.inputValue();
    // LHS + one space must remain, nothing else
    expect(afterSelectAll).toBe('zeroToHero z = ');
  });

  test('backspace with cursor mid-expression leaves correct state', async ({ page }) => {
    const editor = page.locator('#code-editor');
    await editor.fill('zeroToHero z = f z');
    await page.waitForTimeout(100);

    // Place cursor between 'f' and ' z' (position 16)
    await editor.evaluate(el => {
      el.focus();
      el.setSelectionRange(16, 16);
    });

    // Backspace should delete 'f'; the resulting double space auto-collapses
    await editor.press('Backspace');
    const after = await editor.inputValue();
    expect(after).toBe('zeroToHero z = z');

    // One more — blocked by LHS protection (cursor at boundary)
    await editor.press('Backspace');
    const after2 = await editor.inputValue();
    expect(after2).toBe('zeroToHero z = z');
  });

  test('repeated backspace never produces double spaces in RHS', async ({ page }) => {
    const editor = page.locator('#code-editor');
    await editor.fill('zeroToHero z = f z');
    await page.waitForTimeout(100);
    await editor.click();
    await editor.press('End');

    // Backspace 10 times from end
    for (let i = 0; i < 10; i++) {
      await editor.press('Backspace');
      const val = await editor.inputValue();
      // LHS must always be intact
      expect(val).toMatch(/^zeroToHero z =/);
      // No double spaces allowed (except possibly right after = where "= " is the boundary)
      const rhs = val.slice(val.indexOf('=') + 1);
      expect(rhs.trimStart()).not.toMatch(/  /);
    }
  });

  test('no space drift after Ctrl+A backspace then drag-in cycle', async ({ page }) => {
    // Use level 1 (no need to navigate far) — simpler repro
    const editor = page.locator('#code-editor');

    // Drag f into editor
    const fCard = page.locator('.func-card[data-func-name="f"]');
    await fCard.dragTo(editor);
    await page.waitForTimeout(200);
    const baseline = await editor.inputValue();

    for (let i = 0; i < 3; i++) {
      // Ctrl+A selects only RHS (intercepted by keydown handler)
      await editor.click();
      await page.keyboard.press('Control+a');
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(200);
      const afterDelete = await editor.inputValue();

      // Fire synthetic drop with _dropPos at rhsStart
      await editor.evaluate(el => {
        el._dropPos = el.value.indexOf('=') + 1;
        const dt = new DataTransfer();
        dt.setData('text/plain', 'f');
        el.dispatchEvent(new DragEvent('drop', {
          bubbles: true, cancelable: true, dataTransfer: dt
        }));
      });
      await page.waitForTimeout(100);
      const current = await editor.inputValue();
      expect(current).toBe(baseline);
    }
  });

  test('backspace deletes entire token, not single character', async ({ page }) => {
    const editor = page.locator('#code-editor');

    // Multi-char identifier: backspace should delete whole "mkHero"
    await editor.fill('zeroToHero z = mkHero');
    await editor.click();
    await editor.press('End');
    await editor.press('Backspace');
    const after1 = await editor.inputValue();
    expect(after1).toBe('zeroToHero z = ');

    // Operator token: backspace should delete whole "$"
    await editor.fill('zeroToHero z = f $ z');
    await editor.evaluate(el => { el.focus(); el.setSelectionRange(18, 18); }); // right after "$"
    await editor.press('Backspace');
    const after2 = await editor.inputValue();
    // "$" and surrounding spaces removed → "f z"
    expect(after2).toBe('zeroToHero z = f z');

  });

  test('arrow keys navigate by token, not by character', async ({ page }) => {
    const editor = page.locator('#code-editor');
    await editor.fill('zeroToHero z = mkHero $ runZero z');
    await editor.click();
    await editor.press('End'); // cursor at end (pos 33)

    // Left arrow: should jump to start of "z" (from pos 33 to 32)
    await editor.press('ArrowLeft');
    const pos1 = await editor.evaluate(el => el.selectionStart);
    expect(pos1).toBe(32); // start of "z"

    // Left again: should jump over space to start of "runZero" (pos 24 -> skip space -> pos 24)
    await editor.press('ArrowLeft');
    const pos2 = await editor.evaluate(el => el.selectionStart);
    expect(pos2).toBe(24); // start of "runZero"

    // Left again: should jump over " $ " to start of "$" or to start of "mkHero"
    await editor.press('ArrowLeft');
    const pos3 = await editor.evaluate(el => el.selectionStart);
    expect(pos3).toBe(22); // start of "$"

    // Left again: should jump to start of "mkHero"
    await editor.press('ArrowLeft');
    const pos4 = await editor.evaluate(el => el.selectionStart);
    expect(pos4).toBe(15); // start of "mkHero" (right after "= ")

    // Right arrow from start of "mkHero": jump to end of "mkHero"
    await editor.press('ArrowRight');
    const pos5 = await editor.evaluate(el => el.selectionStart);
    expect(pos5).toBe(21); // end of "mkHero"

    // Right again: jump to end of "$"
    await editor.press('ArrowRight');
    const pos6 = await editor.evaluate(el => el.selectionStart);
    expect(pos6).toBe(23); // end of "$"
  });

  test('arrow keys navigate through parentheses token by token', async ({ page }) => {
    // Jump directly to level 12 (index 11) which has parens and >>= operator
    await page.evaluate(() => { currentLevel = 11; render(); });
    await expect(page.locator('.level-badge')).toContainText('Level 12');
    const editor = page.locator('#code-editor');
    // Type: (f z) >>= dup
    const lhs = await editor.evaluate(el => el.value.split('=')[0] + '= ');
    await editor.fill(lhs + '(f z) >>= dup');
    await editor.click();
    await editor.press('End');
    const lhsLen = lhs.length;

    // RHS: ( f   z )   > > = d u p
    //      +0+1 +2+3+4 +5+6+7+8+9  +10+11+12
    // Navigate left — should visit start of each token:
    // dup(+10), >>=(+6), )(+4), z(+3), f(+1), ((+0)
    const expectedLeft = [lhsLen+10, lhsLen+6, lhsLen+4, lhsLen+3, lhsLen+1, lhsLen+0];
    for (let i = 0; i < expectedLeft.length; i++) {
      await editor.press('ArrowLeft');
      const pos = await editor.evaluate(el => el.selectionStart);
      expect(pos, `ArrowLeft #${i+1}`).toBe(expectedLeft[i]);
    }
  });

  test('undo works after Ctrl+Backspace damages and restores LHS', async ({ page }) => {
    const editor = page.locator('#code-editor');
    await editor.fill('zeroToHero z = f z');
    await page.waitForTimeout(100);
    await editor.click();
    await editor.press('End');

    // Ctrl+Backspace multiple times to go past LHS boundary
    // This triggers LHS restoration in onEditorInput (editor.value = ...)
    await page.keyboard.press('Control+Backspace'); // deletes "z"
    await page.keyboard.press('Control+Backspace'); // deletes "f"
    await page.keyboard.press('Control+Backspace'); // deletes into LHS, triggers restoration
    await page.waitForTimeout(100);
    const afterCtrlBS = await editor.inputValue();
    expect(afterCtrlBS).toMatch(/^zeroToHero z = /);

    // Ctrl+Z should be able to undo back to original
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(100);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(100);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(100);
    const afterUndo = await editor.inputValue();
    // Should restore to "f z" or at least contain "f"
    expect(afterUndo).toMatch(/f/);
  });

  test('backspace near parenthesis removes only the paren, not adjacent f2', async ({ page }) => {
    const editor = page.locator('#code-editor');

    // Variant 1: f2( with no space — cursor right after (
    await editor.fill('zeroToHero z = f2( $ f2');
    await page.waitForTimeout(100);
    await editor.evaluate(el => { el.focus(); el.setSelectionRange(18, 18); });
    await editor.press('Backspace');
    await page.waitForTimeout(100);
    expect(await editor.inputValue()).toBe('zeroToHero z = f2$ f2');

    // Variant 2: f2 ( with space — cursor at left side of (
    // The whitespace-skip in backspace handler must NOT jump past the space
    // and delete f2 — it should find and delete ( instead.
    await editor.fill('zeroToHero z = f2 ( $ f2');
    await page.waitForTimeout(100);
    await editor.evaluate(el => { el.focus(); el.setSelectionRange(18, 18); }); // left of (
    await editor.press('Backspace');
    await page.waitForTimeout(100);
    const afterSpaceVariant = await editor.inputValue();
    // f2 must survive — only ( should be removed
    expect(afterSpaceVariant).toMatch(/f2/);
    expect(afterSpaceVariant).not.toContain('(');
  });

  test('typing adjacent tokens auto-inserts spaces between them', async ({ page }) => {
    const editor = page.locator('#code-editor');

    // Type ident+op+ident without spaces: f2$f1
    await editor.fill('zeroToHero z = ');
    await page.waitForTimeout(100);
    await editor.click();
    await editor.press('End');
    await page.keyboard.type('f2$f1');
    await page.waitForTimeout(200);
    const val = await editor.inputValue();

    // Editor should auto-space between different token classes
    expect(val).toBe('zeroToHero z = f2 $ f1');
  });

  test('typing chars one-at-a-time before operator merges into single token', async ({ page }) => {
    const editor = page.locator('#code-editor');

    // Start with "$ f3 z" in the RHS — cursor at left of $
    await editor.fill('zeroToHero z = $ f3 z');
    await page.waitForTimeout(100);
    await editor.click();
    // Place cursor right before $
    await editor.press('Home');
    // Home goes to start of RHS (after "zeroToHero z = ")
    await page.waitForTimeout(50);

    // Type 'f' then '2' — should merge into 'f2', not 'f 2'
    await page.keyboard.type('f', { delay: 50 });
    await page.waitForTimeout(150);
    await page.keyboard.type('2', { delay: 50 });
    await page.waitForTimeout(150);

    const val = await editor.inputValue();
    expect(val).toBe('zeroToHero z = f2 $ f3 z');
  });

  test('icon mode preference persists across reloads', async ({ page }) => {
    // Icon mode should be off by default
    const toggle = page.getByText('Icons');
    await expect(toggle).toBeVisible();

    // Toggle icon mode on
    await toggle.click();
    await page.waitForTimeout(200);

    // Verify icon mode is on (toggle track has 'on' class)
    await expect(page.locator('.gecko-toggle-track.on')).toHaveCount(2); // Gecko + Icons

    // Reload the page
    await page.reload();
    const okBtn = page.locator('button', { hasText: 'OK' });
    if (await okBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await okBtn.click();
    }
    await page.waitForTimeout(200);

    // Icon mode should still be on after reload
    await expect(page.locator('.gecko-toggle-track.on')).toHaveCount(2);
  });

  test('re-solving completed level does not grant additional bypass points', async ({ page }) => {
    // Solve level 1
    const editor = page.locator('#code-editor');
    await editor.fill('zeroToHero z = f z');
    await page.locator('button', { hasText: 'Attempt' }).click();
    await page.waitForTimeout(300);

    // Should have 1 bypass point
    await expect(page.locator('button', { hasText: 'Bypass' })).toContainText('1');

    // Go to L2 then back to L1
    await page.locator('button', { hasText: 'Next level' }).click();
    await page.waitForTimeout(200);
    await page.locator('button', { hasText: 'Prev' }).click();
    await page.waitForTimeout(200);

    // Re-solve level 1
    await page.locator('#code-editor').fill('zeroToHero z = f z');
    await page.locator('button', { hasText: 'Attempt' }).click();
    await page.waitForTimeout(300);

    // Should still have 1 bypass point, not 2
    await expect(page.locator('button', { hasText: 'Bypass' })).toContainText('1');
  });
});
