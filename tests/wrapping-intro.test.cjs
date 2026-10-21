// Exercise the real puzzle engine and saved progress without requiring a browser.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

function game(saved) {
  const storage = new Map(saved ? [['zth_progress', JSON.stringify(saved)]] : []);
  const nodes = Object.fromEntries(['app', 'status-bar', 'status-output', 'next-level', 'level-badge', 'bypass-button']
    .map(id => [id, { innerHTML: '', textContent: '', hidden: true }]));
  const context = {
    console, setTimeout, clearTimeout, addEventListener() {},
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    document: { getElementById: id => nodes[id] || null }
  };
  context.window = context;
  vm.createContext(context);
  for (const file of ['levels.js', 'semantic-icons.js', 'row-program.js', 'puzzle-rules.js', 'row-editor.js', 'text-editor.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInContext(source.replace(/\/\/ Initial render\s+render\(\);/, ''), context, { filename: 'index.html' });
  // Keep real templates and validation; DOM layout and pointer events belong to Playwright.
  vm.runInContext('mountRowEditor = () => {}; mountTextEditor = () => {};', context);
  const run = source => vm.runInContext(source, context);
  const read = source => JSON.parse(run(`JSON.stringify(${source})`));
  return { run, read, nodes, saved: () => JSON.parse(storage.get('zth_progress')) };
}

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

test('completion, refresh, next, previous, bypass and reset follow the introductory order', () => {
  const app = game();
  app.run('setEditorContent("wrap value"); runLiveCheck();');
  assert.equal(app.nodes['next-level'].hidden, false);
  assert.match(app.nodes['level-badge'].innerHTML, /Level 1 \/ 17/);
  assert.equal(app.run('bypassCount'), 1);
  app.run('runLiveCheck();');
  assert.equal(app.run('bypassCount'), 1);
  const restored = game(app.saved());
  assert.equal(restored.run('getCodeFromEditor()'), 'wrap value');
  assert.equal(restored.run('completedLevels.has(currentLevel)'), true);
  restored.run('nextLevel();');
  assert.equal(restored.run('LEVELS[currentLevel].name'), 'Trial');
  assert.equal(restored.run('levelProgressLabel()'), 'Level 2 / 17');
  restored.run('prevLevel();');
  assert.equal(restored.run('LEVELS[currentLevel].level'), 1);
  restored.run('prevLevel();');
  assert.equal(restored.run('LEVELS[currentLevel].level'), 1);
  restored.run('bypass();');
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
  app.run('iconMode = false; showIntro = false; render();');
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
  assert.deepEqual(restored.saved(), saved);
  const again = game(restored.saved());
  again.run('saveProgress();');
  assert.deepEqual(again.saved(), saved);
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
