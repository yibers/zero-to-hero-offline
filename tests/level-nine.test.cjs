const { test } = require('node:test');
const assert = require('node:assert/strict');
const { game } = require('./helpers/game-harness.cjs');

const solution = `let
  r1 = (.) (<*>) f2
  r2 = f1 z
  r3 = f3 z
  r4 = (<*>) r2 r3
in
  r1 z r4`;

test('level 9 accepts the reported solution expanded into unary steps, in either mode and after refresh', () => {
  for (const icons of [true, false]) {
    const app = game();
    app.run(`currentLevel = LEVELS.findIndex(level => level.level === 9);
      iconMode = ${icons}; setEditorContent(RowProgram.currySource(${JSON.stringify(solution)})); render(); runLiveCheck();`);
    assert.equal(app.run('checkSolution(LEVELS[currentLevel], getCodeFromEditor()).ok'), true);
    assert.deepEqual(app.read('cardUsage(LEVELS[currentLevel], getCodeFromEditor()).filter(card => card.remaining)'), []);
    assert.equal(app.run('completedLevels.has(currentLevel)'), true);
    assert.equal(app.nodes['next-level'].hidden, false);
    assert.equal(app.run("FUNCTION_CARD_ICONS[9]['(<$>)']"), undefined);
    const restored = game(app.saved());
    restored.run('render(); runLiveCheck();');
    assert.equal(restored.run('getCodeFromEditor()'), app.run('getCodeFromEditor()'));
    assert.equal(restored.run('completedLevels.has(currentLevel)'), true);
    assert.equal(restored.nodes['next-level'].hidden, false);
  }
});

test('level 9 still requires composition; mapping remains available in its other lessons', () => {
  const app = game();
  app.run('currentLevel = LEVELS.findIndex(level => level.level === 9);');
  const manual = 'let r1 = f2 z; r2 = f1 z; r3 = f3 z; r4 = r2 <*> r3 in r1 <*> r4';
  assert.deepEqual(app.read(`checkSolution(LEVELS[currentLevel], RowProgram.currySource(${JSON.stringify(manual)})).missing`), ['(.)']);
  const removed = 'let r1 = f2 z in (<$>) (.) r1';
  assert.match(app.run(`checkSolution(LEVELS[currentLevel], RowProgram.currySource(${JSON.stringify(removed)})).msg`), /Unknown identifier: <\$>/);
  assert.deepEqual(app.read("LEVELS.filter(level => level.funcs.some(f => f.name === '(<$>)')).map(level => level.level)"), [15, 17]);
});
