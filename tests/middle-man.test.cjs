const { test } = require('node:test');
const assert = require('node:assert/strict');
const { game } = require('./helpers/game-harness.cjs');

test('level 9 has one starting value and exactly one concrete converter in the palette', () => {
  const app = game();
  app.run('currentLevel = LEVELS.findIndex(level => level.level === 9);');
  assert.deepEqual(app.read('LEVELS[currentLevel].parameterUses'), { z: 1 });
  assert.equal(app.run('LEVELS[currentLevel].lhs'), 'zeroToHero z =');
  assert.deepEqual(app.read('LEVELS[currentLevel].funcs.find(f => f.name === "bd")'), { name: 'bd', sig: 'B -> D', uses: 1 });
  assert.equal(app.run('typeCheck(LEVELS[currentLevel], "bd z").ok'), false);
  app.run('setEditorContent(LEVELS[currentLevel].solution); diagnoseRows(); runLiveCheck();');
  assert.equal(app.run('completedLevels.has(currentLevel)'), true);
  assert.deepEqual(app.read('cardUsage(LEVELS[currentLevel], getCodeFromEditor()).filter(card => card.remaining)'), []);
  assert.deepEqual(app.read('getRows().filter(row => /\\bz\\b/.test(row.expr)).map(row => row.expr)'), ['r9 z']);
  assert.equal(app.run('getRows().at(-1).automatic'), true);
  assert.match(app.run('FUNCTION_CARD_ICONS[9].bd'), /data-type="b"/);
  assert.match(app.run('FUNCTION_CARD_ICONS[9].bd'), /data-type="d"/);
});

for (const icons of [true, false]) {
  test(`level 9 migrates old saved definitions without losing valid work in ${icons ? 'icon' : 'text'} mode`, () => {
    const source = game();
    source.run(`currentLevel = 7; iconMode = ${icons}; setEditorContent(LEVELS[7].solution); runLiveCheck(); saveProgress();`);
    const saved = source.saved();
    delete saved.middleManVersion;
    saved.editorContents[7] = saved.editorContents[7].replace('zeroToHero z =', 'zeroToHero ad bd cd z =');
    const restored = game(saved);
    assert.equal(restored.run('completedLevels.has(7)'), true);
    assert.equal(restored.run('getEditorContent(7)'), source.run('getEditorContent(7)'));
    assert.equal(restored.saved().middleManVersion, 1);
    assert.deepEqual(restored.saved().rowPrograms, saved.rowPrograms);
    assert.deepEqual(restored.saved().textDrafts, saved.textDrafts);
    assert.equal(restored.run('checkSolution(LEVELS[7], getCodeFromEditor()).ok'), true);
  });
}

test('old drafts using removed parameter choices remain editable but cannot retain completion', () => {
  const source = game();
  source.run('currentLevel = 7; iconMode = false; setEditorContent(LEVELS[7].solution.replace("fmap bd", "fmap ad")); completedLevels.add(7); saveProgress();');
  const saved = source.saved();
  delete saved.middleManVersion;
  const app = game(saved);
  assert.equal(app.run('completedLevels.has(7)'), false);
  assert.match(app.run('getCodeFromEditor()'), /fmap ad/);
  assert.equal(app.run('checkSolution(LEVELS[7], getCodeFromEditor()).ok'), false);
});
