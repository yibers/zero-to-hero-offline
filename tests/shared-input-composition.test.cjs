const { test } = require('node:test');
const assert = require('node:assert/strict');
const { game } = require('./helpers/game-harness.cjs');
const { solveIconLevel } = require('./helpers/solve-icon-level.cjs');

const oldSolution = 'let afterMap = fmap pair; paired = afterMap g; shared = (<*>) paired; result = shared f in result z';

function oldSave(code, icons = true) {
  const seed = game();
  seed.run('currentLevel=LEVELS.findIndex(l=>l.id==="shared-input");saveProgress();');
  const index = seed.run('currentLevel'), saved = seed.saved();
  delete saved.sharedInputVersion;
  saved.iconMode = icons;
  saved.completed = [0, index];
  saved.editorContents[index] = 'zeroToHero z = ' + code;
  saved.textDrafts[index] = code;
  saved.rowPrograms[index] = seed.read(`RowProgram.migrate(${JSON.stringify(code)})`);
  saved.editorContents[0] = 'zeroToHero z = f z';
  return { saved, index };
}

test('level 19 teaches applicative application with forward composition and five fixed rows', () => {
  const app = game(), index = app.run('LEVELS.findIndex(l=>l.id==="shared-input")');
  assert.deepEqual(app.read(`LEVELS[${index}].funcs.map(f=>f.name)`), ['f', 'g', 'pair', '(>>>)', '(<*>)']);
  assert.equal(app.run(`rowSlotCount(LEVELS[${index}])`), 5);
  assert.equal(app.run(`automaticCombinator(LEVELS[${index}])`), null);
  assert.deepEqual(solveIconLevel(app, index).failures, []);
});

for (const icons of [true, false]) test(`completed fmap solutions migrate once in ${icons ? 'icon' : 'text'} mode`, () => {
  const { saved, index } = oldSave(oldSolution, icons), app = game(saved);
  assert.equal(app.run('currentLevel'), index);
  assert.equal(app.run('iconMode'), icons);
  assert.deepEqual(app.read('[...completedLevels]'), [0, index]);
  assert.equal(app.run('checkSolution(LEVELS[currentLevel],getCodeFromEditor()).ok'), true);
  assert.match(app.run('getCodeFromEditor()'), /\(>>>\) g/);
  assert.doesNotMatch(app.run('getCodeFromEditor()'), /fmap/);
  assert.equal(app.saved().editorContents[0], saved.editorContents[0]);
  assert.equal(app.saved().sharedInputVersion, 1);
  const again = game(app.saved()); again.run('saveProgress();');
  assert.deepEqual(again.saved(), app.saved());
});

test('unfinished old work remains a text draft while the new icon palette is usable', () => {
  const code = 'let r1 = fmap pair in _', { saved, index } = oldSave(code);
  const app = game(saved);
  assert.equal(app.run('getRows().every(row=>!row.expr)'), true);
  assert.equal(app.saved().textDrafts[index], code);
  assert.deepEqual(app.read('[...completedLevels]'), [0]);
  app.run('iconMode=false;');
  assert.equal(app.run('getTextSource()'), code);
  app.run('iconMode=true;setEditorContent("(>>>) g");getRows();saveProgress();');
  const again = game(app.saved());
  assert.equal(again.run('getRows()[0].expr'), '(>>>) g');
  assert.equal(again.saved().textDrafts[index], undefined);
});

test('compatible new saves and unsolved old solutions keep their existing achievement state', () => {
  const seed = game();
  const solution = seed.run('LEVELS.find(l=>l.id==="shared-input").solution');
  const { saved, index } = oldSave(solution);
  const app = game(saved);
  assert.deepEqual(app.saved().rowPrograms[index], saved.rowPrograms[index]);
  assert.equal(app.saved().textDrafts[index], solution);
  const unfinished = oldSave(oldSolution); unfinished.saved.completed = [0];
  assert.deepEqual(game(unfinished.saved).read('[...completedLevels]'), [0]);
});
