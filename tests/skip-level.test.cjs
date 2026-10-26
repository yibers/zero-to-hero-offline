const { test } = require('node:test');
const assert = require('node:assert/strict');
const { game } = require('./helpers/game-harness.cjs');

for (const icons of [true, false]) {
  test(`skipping preserves unsolved work and navigation after refresh in ${icons ? 'icon' : 'text'} mode`, () => {
    const app = game();
    app.run(`iconMode = ${icons}; currentLevel = 1; setEditorContent('(.)');
      rowPrograms[1] = [{id: 'r1', expr: '(.)'}]; textDrafts[1] = '(.)';
      completedLevels.add(0); skipLevel();`);
    assert.equal(app.run('LEVELS[currentLevel].level'), 4);
    assert.deepEqual(app.read('[...completedLevels]'), [0]);
    assert.equal(app.run('showComplete'), false);
    const restored = game(app.saved());
    assert.equal(restored.run('LEVELS[currentLevel].level'), 4);
    restored.run('prevLevel();');
    assert.equal(restored.run('LEVELS[currentLevel].level'), 3);
    assert.equal(restored.run('getCodeFromEditor()'), icons ? 'let\n  r1 = (.)\nin\n  _' : '(.)');
    assert.equal(restored.run('completedLevels.has(currentLevel)'), false);
    assert.match(restored.nodes.app.innerHTML, /id="skip-level"[^>]*>Skip level/);
    assert.doesNotMatch(restored.nodes.app.innerHTML, /id="skip-level"[^>]*hidden/);
    assert.doesNotMatch(restored.nodes.app.innerHTML, /title="Solved"/);
  });
}

test('skip follows displayed order, never solves a level, and stops at the final puzzle', () => {
  const app = game();
  for (let number = 2; number <= 16; number++) {
    app.run('skipLevel();');
    assert.equal(app.run('LEVELS[currentLevel].level'), number);
    assert.equal(app.run('completedLevels.size'), 0);
  }
  app.run('skipLevel();');
  assert.equal(app.run('LEVELS[currentLevel].level'), 16);
  assert.equal(app.run('showComplete'), false);
  assert.match(app.nodes.app.innerHTML, /id="skip-level"[^>]*disabled/);
});

test('solving replaces skip with normal next navigation and keeps prior achievements', () => {
  const app = game();
  app.run('render(); setEditorContent("wrap value"); runLiveCheck();');
  assert.equal(app.nodes['skip-level'].hidden, true);
  assert.equal(app.nodes['next-level'].hidden, false);
  app.run('skipLevel();');
  assert.equal(app.run('LEVELS[currentLevel].level'), 1);
  assert.equal(app.run('completedLevels.size'), 1);
  app.run('nextLevel();');
  assert.equal(app.run('LEVELS[currentLevel].level'), 2);
});

test('finishing the last puzzle returns to skipped work instead of celebrating an incomplete game', () => {
  const app = game();
  app.run(`currentLevel = LEVEL_ORDER.at(-1); completedLevels = new Set(LEVEL_ORDER);
    completedLevels.delete(1); completedLevels.delete(5); render();`);
  assert.equal(app.run('nextLevelLabel()'), 'Unsolved levels');
  app.run('nextLevel();');
  assert.equal(app.run('LEVELS[currentLevel].level'), 3);
  assert.equal(app.run('showComplete'), false);
  assert.equal(app.run('completedLevels.has(1)'), false);
  app.run(`completedLevels = new Set(LEVEL_ORDER); currentLevel = LEVEL_ORDER.at(-1); nextLevel();`);
  assert.equal(app.run('showComplete'), true);
});
