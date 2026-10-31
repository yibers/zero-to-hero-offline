const { test } = require('node:test');
const assert = require('node:assert/strict');
const { game } = require('./helpers/game-harness.cjs');

function completedGame() {
  const app = game();
  app.run(`
    for (const [index, level] of LEVELS.entries()) {
      setEditorContent(level.solution, index);
      rowPrograms[index] = RowProgram.migrate(level.solution);
      textDrafts[index] = level.solution;
      completedLevels.add(index);
    }
    currentLevel = LEVEL_ORDER[7]; iconMode = false; saveProgress();
  `);
  return app.saved();
}

function expectClean(app) {
  assert.equal(app.run('LEVELS[currentLevel].level'), 1);
  assert.deepEqual(app.read('[...completedLevels]'), []);
  assert.deepEqual(app.read('[editorContents, rowPrograms, textDrafts]'), [{}, {}, {}]);
  assert.deepEqual(app.read('[iconMode, geckoOn, activeRow, showComplete, rowHistory.size, textHistory.size]'),
    [true, false, 0, false, 0, 0]);
}

test('test links start completely fresh and never overwrite normal progress', () => {
  const saved = completedGame();
  const app = game(saved, '?test=1');
  expectClean(app);
  app.run('setEditorContent("wrap value"); runLiveCheck(); nextLevel(); setEditorContent("f"); saveProgress();');
  assert.equal(app.run('LEVELS[currentLevel].level'), 2);
  assert.equal(app.run('completedLevels.size'), 1);
  app.events.beforeunload();
  assert.deepEqual(app.saved(), saved);
  expectClean(game(app.saved(), '?test=1'));
  const normal = game(app.saved());
  assert.equal(normal.run('LEVELS[currentLevel].level'), 8);
  assert.equal(normal.run('completedLevels.size'), 25);
  assert.equal(normal.run('iconMode'), false);
});

test('test-only play and resetting create no persistent progress', () => {
  const app = game(undefined, '?test=1');
  app.run('skipLevel(); toggleIconMode(); clearLevel(); resetGame(); saveProgress();');
  app.events.beforeunload();
  assert.equal(app.saved(), null);
  expectClean(game(app.saved(), '?test=1'));
});

test('test mode survives release parameters and reloads cached history entries', () => {
  const app = game(completedGame(), '?test=1&__update=123456789abc');
  expectClean(app);
  app.events.pageshow({ persisted: false });
  assert.equal(app.reloads(), 0);
  app.events.pageshow({ persisted: true });
  assert.equal(app.reloads(), 1);
});

test('ordinary URLs keep loading and saving progress', () => {
  const saved = completedGame();
  for (const search of ['', '?test=0', '?test=', '?v=123456789abc']) {
    const app = game(saved, search);
    assert.equal(app.run('LEVELS[currentLevel].level'), 8);
    assert.equal(app.events.pageshow, undefined);
    app.run('resetGame();');
    assert.deepEqual(app.saved().completed, []);
    assert.equal(app.saved().currentLevel, app.run('LEVEL_ORDER[0]'));
  }
});
