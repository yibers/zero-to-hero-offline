const { test } = require('node:test');
const assert = require('node:assert/strict');
const { game } = require('./helpers/game-harness.cjs');

const solution = `let
  r1 = (.) (<*>)
  r2 = r1 f1
  r3 = (<*>) r2
  r4 = r3 f3
  r5 = (.) (<*>)
  r6 = r5 f2
  r7 = (<*>) r6
  r8 = r7 r4
in
  r8 z`;
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
      [['f1', 1, 0], ['f2', 1, 0], ['f3', 1, 0], ['(<*>)', 4, 0], ['(.)', 2, 0], ['z', 1, 0]]);
    assert.equal(app.run('completedLevels.has(currentLevel)'), true);
    assert.equal(app.nodes['next-level'].hidden, false);
    assert.equal(app.run("FUNCTION_CARD_ICONS[8]['(<$>)']"), undefined);
    const restored = game(app.saved()); restored.run('render(); runLiveCheck();');
    assert.equal(restored.run('getCodeFromEditor()'), app.run('getCodeFromEditor()'));
    assert.equal(restored.run('completedLevels.has(currentLevel)'), true);
    assert.equal(restored.nodes['next-level'].hidden, false);
  }
});

test('TIE fighter enforces the new supplies, final input and useful copies', () => {
  const app = game();
  app.run('currentLevel = 6;');
  assert.deepEqual(app.read(`checkSolution(LEVELS[6], RowProgram.currySource(${JSON.stringify(oldSolution)})).excess`), ['z']);
  // Even a reusable operator must use every supplied copy in contributing rows.
  const fewer = solution.replace('r5 = (.) (<*>)', 'r5 = r1');
  assert.deepEqual(app.read(`checkSolution(LEVELS[6], ${JSON.stringify(fewer)}).missing`), ['(<*>)', '(.)']);
  const dead = fewer.replace('let\n', 'let\n  unused = (.) (<*>)\n');
  assert.deepEqual(app.read(`checkSolution(LEVELS[6], ${JSON.stringify(dead)}).missing`), ['(<*>)', '(.)']);
  const early = solution.replace('let\n', 'let\n  input = z\n').replace('r8 z', 'r8 input');
  assert.equal(app.run(`typeCheck(LEVELS[6], ${JSON.stringify(early)}).ok`), true);
  assert.match(app.run(`checkSolution(LEVELS[6], ${JSON.stringify(early)}).msg`), /pass z once in the final row/);
  assert.equal(app.run('cardUsageIncreaseError(LEVELS[6], "f1 z", "let r1 = f1 z in f2 z") !== null'), true);
  assert.deepEqual(app.read("LEVELS.filter(level => level.funcs.some(f => f.name === '(<$>)')).map(level => level.level)"), [14, 16]);
});

test('old TIE fighter work survives refresh and only its outdated completion is removed', () => {
  const source = game();
  const old = source.run(`RowProgram.currySource(${JSON.stringify(oldSolution)})`);
  for (const icons of [true, false]) {
    const saved = {
      currentLevel: 6, completed: [0, 6, 14], iconMode: icons, geckoOn: false,
      rowVersion: 1, connectionVersion: 1, completionVersion: 5, levelOrderVersion: 2, curryingVersion: 1, transformationsVersion: 1,
      editorContents: { 6: 'zeroToHero z = ' + old }, textDrafts: { 6: old, 2: 'let unfinished =' },
      rowPrograms: { 6: source.read(`RowProgram.migrate(${JSON.stringify(old)})`) }
    };
    const restored = game(saved);
    assert.deepEqual(restored.read('[...completedLevels]'), [0, 14]);
    assert.equal(restored.run('currentLevel'), 6);
    assert.equal(restored.run('iconMode'), icons);
    assert.deepEqual(restored.saved().editorContents, saved.editorContents);
    assert.deepEqual(restored.saved().textDrafts, saved.textDrafts);
    assert.deepEqual(restored.saved().rowPrograms, saved.rowPrograms);
    assert.equal(restored.saved().applicativeVersion, 1);
    const again = game(restored.saved()); again.run('saveProgress();');
    assert.deepEqual(again.saved(), restored.saved());
  }
});
