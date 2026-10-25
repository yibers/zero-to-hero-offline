const { test } = require('node:test');
const assert = require('node:assert/strict');
const { game } = require('./helpers/game-harness.cjs');

test('the introduction wraps one value while preserving its type and enforcing its supplies', () => {
  const app = game();
  assert.equal(app.run('LEVELS[currentLevel].level'), 1);
  assert.equal(app.run('levelProgressLabel()'), 'Level 1 / 17');
  assert.equal(app.run('LEVELS[currentLevel].target'), 'a -> Zero a');
  assert.deepEqual(app.read('LEVELS[currentLevel].parameterUses'), { value: 1 });
  assert.equal(app.run('checkSolution(LEVELS[currentLevel], "wrap value").ok'), true);
  for (const code of ['value', 'wrap', 'wrap (wrap value)', 'let unused = wrap value in wrap value']) {
    assert.equal(app.run(`checkSolution(LEVELS[currentLevel], ${JSON.stringify(code)}).ok`), false, code);
  }
  assert.match(app.run('LEVEL_ICONS[1].value'), /data-diagram-type="SKOLEMa"/);
  assert.match(app.run('LEVEL_ICONS[1].value'), /data-type="a"/);
  app.run('setEditorContent("wrap"); diagnoseRows();');
  assert.equal(app.run('rowDiagnostics[0].call.inputDiagrams[0].type.tag'), 'var');
  app.run('setEditorContent("wrap value"); diagnoseRows();');
  assert.equal(app.run('typeToString(rowDiagnostics[0].expected.type)'), 'Zero SKOLEMa');
  assert.equal(app.run('typeToString(rowDiagnostics[0].call.arguments[0].type)'), 'SKOLEMa');
  assert.equal(app.run('getRowError()'), null);
});

test('completion, refresh, next, previous and reset follow the introductory order', () => {
  const app = game();
  app.run('nextLevel();');
  assert.equal(app.run('LEVELS[currentLevel].level'), 1);
  app.run('setEditorContent("wrap value"); runLiveCheck();');
  assert.equal(app.nodes['next-level'].hidden, false);
  assert.match(app.nodes['level-badge'].innerHTML, /Level 1 \/ 17/);
  assert.equal(app.run('completedLevels.size'), 1);
  app.run('runLiveCheck();');
  assert.equal(app.run('completedLevels.size'), 1);
  const restored = game(app.saved());
  assert.equal(restored.run('getCodeFromEditor()'), 'wrap value');
  assert.equal(restored.run('completedLevels.has(currentLevel)'), true);
  restored.run('nextLevel();');
  assert.equal(restored.run('LEVELS[currentLevel].name'), 'Trial');
  assert.equal(restored.run('levelProgressLabel()'), 'Level 2 / 17');
  restored.run('nextLevel();');
  assert.equal(restored.run('LEVELS[currentLevel].level'), 2);
  restored.run('prevLevel();');
  assert.equal(restored.run('LEVELS[currentLevel].level'), 1);
  restored.run('prevLevel();');
  assert.equal(restored.run('LEVELS[currentLevel].level'), 1);
  restored.run('nextLevel();');
  assert.equal(restored.run('LEVELS[currentLevel].level'), 2);
  restored.run('currentLevel = LEVEL_ORDER.at(-1); completedLevels.add(currentLevel); nextLevel();');
  assert.equal(restored.run('showComplete'), true);
  assert.equal(restored.run('LEVELS[currentLevel].level'), 17);
  restored.run('resetGame();');
  assert.equal(restored.run('LEVELS[currentLevel].level'), 1);
  assert.equal(restored.run('showComplete'), false);
  assert.equal(restored.run('completedLevels.size'), 0);
});

test('all puzzles retain valid solutions and icons, with the introduction first in navigation', () => {
  const app = game();
  assert.deepEqual(app.read('LEVEL_ORDER.map(index => LEVELS[index].level)'), Array.from({ length: 17 }, (_, i) => i + 1));
  assert.deepEqual(app.read(`LEVELS.filter(level => !checkSolution(level, level.solution).ok
    || level.funcs.some(f => !FUNCTION_CARD_ICONS[level.level][f.name])).map(level => level.level)`), []);
  app.run('iconMode = false; render();');
  assert.match(app.nodes.app.innerHTML, /wrapValue/);
  assert.match(app.nodes.app.innerHTML, /wrapValue value =/);
});

test('existing saved puzzle indices, drafts, achievements and settings remain unchanged', () => {
  const original = game();
  const levels = original.read('LEVELS.filter(level => level.level > 1)');
  const saved = {
    currentLevel: 7, completed: levels.map((_, i) => i), bypassCount: 4,
    showIntro: false, iconMode: false, geckoOn: false,
    rowVersion: 1, connectionVersion: 1, completionVersion: 5, levelOrderVersion: 1,
    editorContents: Object.fromEntries(levels.map((level, i) => [i, level.lhs + ' ' + level.solution])),
    rowPrograms: Object.fromEntries(levels.map((level, i) => [i, original.read(`RowProgram.migrate(${JSON.stringify(level.solution)})`)])),
    textDrafts: Object.fromEntries(levels.map((level, i) => [i, level.solution]))
  };
  const restored = game(saved);
  assert.equal(restored.run('LEVELS[currentLevel].name'), 'TIE fighter');
  assert.equal(restored.run('levelProgressLabel()'), 'Level 9 / 17');
  assert.equal(restored.run('completedLevels.has(LEVEL_ORDER[0])'), false);
  restored.run('saveProgress();');
  const { bypassCount: legacyPoints, showIntro: legacyIntro, ...expected } = saved;
  assert.deepEqual(restored.saved(), expected);
  assert.equal(restored.run('typeof bypass'), 'undefined');
  restored.run('render();');
  assert.doesNotMatch(restored.nodes.app.innerHTML, /Bypass|bypass-button/);
  const again = game(restored.saved());
  again.run('saveProgress();');
  assert.deepEqual(again.saved(), expected);
});

test('pre-composition saves still migrate once without treating the introduction as an old puzzle', () => {
  const source = game();
  const oldLevels = source.read('LEVELS.filter(level => level.level > 1 && level.level !== 4)');
  const saved = {
    currentLevel: 7, completed: oldLevels.map((_, i) => i), bypassCount: 3,
    showIntro: false, iconMode: true, geckoOn: false,
    rowVersion: 1, connectionVersion: 1, completionVersion: 5,
    textDrafts: Object.fromEntries(oldLevels.map((level, i) => [i, level.solution]))
  };
  const restored = game(saved);
  assert.equal(restored.run('LEVELS[currentLevel].name'), 'The middle man');
  assert.equal(restored.run('completedLevels.size'), 15);
  assert.equal(restored.run('completedLevels.has(LEVEL_ORDER[0])'), false);
  for (const [i, level] of oldLevels.entries()) {
    assert.equal(restored.run(`textDrafts[${i < 2 ? i : i + 1}]`), level.solution);
  }
  const migrated = restored.saved();
  assert.equal(migrated.levelOrderVersion, 1);
  const again = game(migrated);
  again.run('saveProgress();');
  assert.deepEqual(again.saved(), migrated);
});

for (const icons of [true, false]) {
  test(`clear level resets only the current puzzle in ${icons ? 'icon' : 'text'} mode`, () => {
    const app = game();
    app.run(`
      iconMode = ${icons};
      setEditorContent('f z', 0); completedLevels.add(0);
      rowPrograms[0] = [{ id: 'r1', expr: 'f z' }];
      textDrafts[0] = 'f z';
      rowHistory.set(0, { undo: ['other row'], redo: [] });
      textHistory.set(0, { undo: ['other text'], redo: [] });
      setEditorContent('wrap value'); runLiveCheck();
      textDrafts[currentLevel] = 'wrap value';
      rowPrograms[currentLevel] = [{ id: 'r1', expr: 'wrap value' }];
      rowHistory.set(currentLevel, { undo: ['current row'], redo: [] });
      textHistory.set(currentLevel, { undo: ['current text'], redo: [] });
      activeRow = 4;
      clearLevel();
    `);
    assert.equal(app.run('LEVELS[currentLevel].level'), 1);
    assert.equal(app.run('activeRow'), 0);
    assert.equal(app.run('iconMode'), icons);
    assert.equal(app.run('completedLevels.has(currentLevel)'), false);
    assert.deepEqual(app.read('[...completedLevels]'), [0]);
    assert.deepEqual(app.read('getRows()'), [{ id: 'r1', expr: '' }]);
    assert.equal(app.run('textDrafts[currentLevel]'), undefined);
    assert.equal(app.run('rowHistory.has(currentLevel) || textHistory.has(currentLevel)'), false);
    assert.equal(app.run('rowHistory.has(0) && textHistory.has(0)'), true);
    assert.equal(app.saved().editorContents[0], 'zeroToHero z = f z');
    assert.deepEqual(app.saved().rowPrograms[0], [{ id: 'r1', expr: 'f z' }]);
    assert.equal(app.saved().textDrafts[0], 'f z');
    assert.equal(app.run('functionUsage(LEVELS[currentLevel], "")[0].remaining'), 1);
    assert.equal(app.run('parameterUsage(LEVELS[currentLevel], "")[0].remaining'), 1);
    assert.doesNotMatch(app.nodes.app.innerHTML, /intro-dialog|Welcome to Zero to Hero/);
    assert.match(app.nodes.app.innerHTML, /id="clear-level"/);
    assert.match(app.nodes.app.innerHTML, /id="next-level"[^>]*hidden/);
    const restored = game(app.saved());
    restored.run('render();');
    assert.deepEqual(restored.read('getRows()'), [{ id: 'r1', expr: '' }]);
    assert.deepEqual(restored.read('[...completedLevels]'), [0]);
    assert.doesNotMatch(restored.nodes.app.innerHTML, /intro-dialog/);
  });
}

test('new players and legacy welcome preferences open directly into the puzzle', () => {
  for (const app of [game(), game({ currentLevel: 16, levelOrderVersion: 1, showIntro: true })]) {
    app.run('render();');
    assert.doesNotMatch(app.nodes.app.innerHTML, /intro-dialog|Welcome to Zero to Hero/);
    assert.match(app.nodes.app.innerHTML, /Wrap a value/);
  }
});
