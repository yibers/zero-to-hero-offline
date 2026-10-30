const { test } = require('node:test');
const assert = require('node:assert/strict');
const { game } = require('./helpers/game-harness.cjs');

test('every level starts with exactly one fixed slot per supplied copy and stays fixed through every placement', () => {
  const app = game();
  const failures = app.read(`LEVELS.flatMap((level, index) => {
    currentLevel = index; rowPrograms[index] = [{id:'r1', expr:''}];
    const count = level.funcs.reduce((n, f) => n + f.uses, 0);
    const ids = getRows().map(row => row.id);
    if (getRows().length !== count || getCodeFromEditor() !== '') return [level.name + ': initial slots'];
    const reference = RowProgram.migrate(level.solution);
    for (const [i, row] of reference.entries()) {
      if (count > 1 && i === count - 1) break;
      const call = RowProgram.call(row.expr);
      for (const [name, slot] of [[call.name, false], ...(count > 1 ? [[call.args[0], true]] : [])]) {
        const placement = placeInFixedRow(level, getRows(), i, RowProgram.print({kind:'name', name}), slot);
        if (placement.error) return [level.name + ': ' + placement.error];
        rowPrograms[index] = placement.rows; diagnoseRows();
        if (getRows().length !== count || JSON.stringify(ids) !== JSON.stringify(getRows().map(r => r.id))) return [level.name + ': slots moved'];
        if (i < count - 2 && getRows().at(-1).expr) return [level.name + ': premature final application'];
        const remaining = availableGeneratedFunctions();
        if (remaining.some(card => generatedUsage(getRows()).find(f => f.name === card.name).used)) return [level.name + ': consumed result available'];
      }
    }
    return getCodeFromEditor() !== level.solution || !checkSolution(level, getCodeFromEditor()).ok
      || availableGeneratedFunctions().length ? [level.name + ': completion'] : [];
  })`);
  assert.deepEqual(failures, []);
});

test('generated functions appear at the top once complete and stay consumed by linked heads', () => {
  const app = game();
  app.nodes['function-palette'] = { dataset: {}, innerHTML: '', querySelectorAll: () => [] };
  app.run("currentLevel = 1; setEditorContent('(.)'); diagnoseRows(); runLiveCheck();");
  assert.deepEqual(app.read('availableGeneratedFunctions()'), []);
  app.run("rowPrograms[1] = placeInFixedRow(LEVELS[1], getRows(), 0, 'mkHero', true).rows; diagnoseRows(); runLiveCheck();");
  assert.deepEqual(app.read('availableGeneratedFunctions().map(card => card.name)'), []);
  // Generated combinators never become manual cards, even in a legacy draft;
  // mounting the icon editor attaches the result to the next row.
  assert.doesNotMatch(app.nodes['function-palette'].innerHTML, /aria-label="Combinators"/);
  app.run("rowPrograms[1] = placeInFixedRow(LEVELS[1], getRows(), 1, 'r1').rows; diagnoseRows(); runLiveCheck();");
  assert.deepEqual(app.read('availableGeneratedFunctions()'), []);
  assert.doesNotMatch(app.nodes['function-palette'].innerHTML, /data-func-name="r1"/);
  assert.match(app.run("placeInFixedRow(LEVELS[1], getRows(), 1, 'r1', true).error"), /exactly once/);
  app.run('rowPrograms[1] = automaticRows(LEVELS[1], clearedRows(getRows(), 1)); diagnoseRows(); runLiveCheck();');
  assert.deepEqual(app.read('availableGeneratedFunctions()'), []);
  assert.equal(app.run('getRows()[1].expr'), 'r1');
  assert.equal(app.run('getRows().length'), 3);
});

test('clearing a producer clears its dependents and returns their supplies without renumbering any slot', () => {
  const app = game();
  app.run('currentLevel = 7; setEditorContent(LEVELS[7].solution); diagnoseRows(); const idsBefore = getRows().map(row => row.id);');
  app.run('rowPrograms[7] = automaticRows(LEVELS[7], clearedRows(getRows(), 0)); diagnoseRows();');
  assert.deepEqual(app.read('getRows().map(row => row.id)'), app.read('idsBefore'));
  assert.equal(app.run('getRows().length'), 10);
  assert.deepEqual(app.read('getRows().filter(row => row.expr).map(row => row.id)'), ['r4', 'r6', 'r8']);
  assert.deepEqual(app.read('functionUsage(LEVELS[7], getCodeFromEditor()).map(card => card.remaining)'), [1, 1, 1, 0, 1]);
});

test('holes keep their position through source conversion, mode switches and refresh', () => {
  const app = game();
  app.run("currentLevel = 7; rowPrograms[7] = [{id:'r1',expr:''}]; getRows(); rowPrograms[7][3].expr = 'fmap bd'; diagnoseRows(); persistRows();");
  const ids = app.read('getRows().map(row => row.id)');
  const saved = game(app.saved()); saved.run('diagnoseRows();');
  assert.deepEqual(saved.read('getRows().map(row => row.id)'), ids);
  assert.equal(saved.run('getRows()[0].expr'), '');
  assert.equal(saved.run('getRows()[3].expr'), 'fmap bd');
  assert.deepEqual(saved.read('availableGeneratedFunctions().map(card => card.name)'), ['r4']);
  assert.match(saved.run("placeInFixedRow(LEVELS[7], getRows(), 0, 'r4').error"), /below its producer/);
  saved.run('iconMode = false; const text = getTextSource(); iconMode = true;');
  assert.equal(saved.run('getCodeFromEditor()'), saved.run('text'));
  assert.equal(saved.run('getRows().length'), 10);
  const fromText = game(); fromText.run("currentLevel = 1; textDrafts[1] = 'let r1 = (.) mkHero in _'; diagnoseRows();");
  assert.equal(fromText.run('getRows()[1].expr'), '');
  assert.equal(fromText.run('getRows().at(-1).expr'), '');
});

test('single-use rules reject reused or discarded generated functions in text mode', () => {
  const app = game();
  const duplicate = 'let\n  r1 = (.) mkHero\n  r2 = r1 runZero\n  unused = r1 r2\nin\n  r2 z';
  assert.equal(app.run(`typeCheck(LEVELS[1], ${JSON.stringify(duplicate)}).ok`), true);
  assert.match(app.run(`checkSolution(LEVELS[1], ${JSON.stringify(duplicate)}).msg`), /generated function.*exactly once/);
  app.run(`currentLevel = 1; iconMode = false; setEditorContent(${JSON.stringify(duplicate)}); completedLevels.add(1); saveProgress();`);
  const saved = app.saved(); delete saved.fixedRowsVersion;
  const restored = game(saved);
  assert.equal(restored.run('completedLevels.has(1)'), false);
  assert.equal(restored.run('getCodeFromEditor()'), duplicate);
  restored.run('iconMode = true; getRows();');
  assert.equal(restored.run('getRows().length'), 3);
  restored.run('iconMode = false;');
  assert.equal(restored.run('getCodeFromEditor()'), duplicate);
});

test('clearing an input returns that card and dependent cards but preserves independent construction', () => {
  const app = game();
  app.run("currentLevel = 6; setEditorContent(LEVELS[6].solution); const original = getRows().map(row => ({...row})); rowPrograms[6] = automaticRows(LEVELS[6], clearedRows(getRows(), 0, true)); diagnoseRows();");
  assert.equal(app.run('getRows()[0].expr'), '(.)');
  assert.equal(app.run('getRows()[1].expr'), '');
  assert.equal(app.run('getRows()[4].expr'), app.run('original[4].expr'));
  assert.equal(app.run('getRows()[5].expr'), app.run('original[5].expr'));
  assert.equal(app.run('getRows().at(-1).expr'), '');
  assert.equal(app.run('getRows().length'), 9);
});
