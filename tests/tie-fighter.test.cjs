const { test } = require('node:test');
const assert = require('node:assert/strict');
const { game } = require('./helpers/game-harness.cjs');

const solution = `let
  r1 = (<**>) f3
  r2 = r1 f1
  r3 = (<**>) r2
  r4 = r3 f2
in
  r4 z`;
const oldSolution = `let
  r1 = (.) (<*>) f2
  r2 = f1 z
  r3 = f3 z
  r4 = (<*>) r2 r3
in
  r1 z r4`;

test('TIE fighter builds the transformation and supplies z once at the end, in either mode and after refresh', () => {
  for (const icons of [true, false]) {
    const app = game();
    app.run(`currentLevel = 6; iconMode = ${icons}; setEditorContent(${JSON.stringify(solution)}); render(); runLiveCheck();`);
    assert.equal(app.run('checkSolution(LEVELS[currentLevel], getCodeFromEditor()).ok'), true);
    assert.deepEqual(app.read('cardUsage(LEVELS[currentLevel], getCodeFromEditor()).map(card => [card.name, card.used, card.remaining])'),
      [['f1', 1, 0], ['f2', 1, 0], ['f3', 1, 0], ['(<**>)', 2, 0], ['z', 1, 0]]);
    assert.equal(app.run('completedLevels.has(currentLevel)'), true);
    assert.equal(app.nodes['next-level'].hidden, false);
    assert.equal(app.run("FUNCTION_CARD_ICONS[20]['(<$>)']"), undefined);
    const restored = game(app.saved()); restored.run('render(); runLiveCheck();');
    assert.equal(restored.run('getCodeFromEditor()'), app.run('getCodeFromEditor()'));
    assert.equal(restored.run('completedLevels.has(currentLevel)'), true);
    assert.equal(restored.nodes['next-level'].hidden, false);
  }
});

test('TIE fighter enforces the new supplies, final input and useful copies', () => {
  const app = game();
  app.run('currentLevel = 6;');
  assert.equal(app.run(`checkSolution(LEVELS[6], RowProgram.currySource(${JSON.stringify(oldSolution)})).ok`), false);
  // Reusing the first application cannot replace the second supplied copy.
  const fewer = solution.replace('  r3 = (<**>) r2\n', '').replace('r4 = r3 f2', 'r4 = r1 f2');
  assert.equal(app.run(`checkSolution(LEVELS[6], ${JSON.stringify(fewer)}).ok`), false);
  const early = solution.replace('let\n', 'let\n  input = z\n').replace('r4 z', 'r4 input');
  assert.equal(app.run(`typeCheck(LEVELS[6], ${JSON.stringify(early)}).ok`), true);
  assert.match(app.run(`checkSolution(LEVELS[6], ${JSON.stringify(early)}).msg`), /pass z once in the final row/);
  assert.equal(app.run('cardUsageIncreaseError(LEVELS[6], "f1 z", "let r1 = f1 z in f2 z") !== null'), true);
  assert.deepEqual(app.read("LEVELS.filter(level => level.funcs.some(f => f.name === '(<$>)')).map(level => level.level)"), []);
});

test('old TIE fighter work survives refresh and only its outdated completion is removed', () => {
  const source = game();
  const old = source.run(`RowProgram.currySource(${JSON.stringify(oldSolution)})`);
  for (const icons of [true, false]) {
    const saved = {
      currentLevel: 6, completed: [0, 6, 12], iconMode: icons, geckoOn: false,
      rowVersion: 1, connectionVersion: 1, completionVersion: 5, levelOrderVersion: 2, curryingVersion: 1, transformationsVersion: 1,
      editorContents: { 6: 'zeroToHero z = ' + old }, textDrafts: { 6: old, 2: 'let unfinished =' },
      rowPrograms: { 6: source.read(`RowProgram.migrate(${JSON.stringify(old)})`) }
    };
    const restored = game(saved);
    assert.deepEqual(restored.read('[...completedLevels]'), [0]);
    assert.equal(restored.run('currentLevel'), 6);
    assert.equal(restored.run('iconMode'), icons);
    assert.deepEqual(restored.saved().editorContents[6], saved.editorContents[6]);
    assert.deepEqual(restored.saved().textDrafts[6], saved.textDrafts[6]);
    assert.deepEqual(restored.saved().rowPrograms[6], saved.rowPrograms[6]);
    assert.equal(restored.saved().applicativeVersion, 1);
    const again = game(restored.saved()); again.run('saveProgress();');
    assert.deepEqual(again.saved(), restored.saved());
  }
});
