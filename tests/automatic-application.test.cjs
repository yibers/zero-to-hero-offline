const { test } = require('node:test');
const assert = require('node:assert/strict');
const { game } = require('./helpers/game-harness.cjs');

test('all levels finish automatically from function-only construction, using the value once', () => {
  const app = game();
  const failures = app.read(`LEVELS.flatMap((level, index) => {
    currentLevel = index;
    const reference = RowProgram.migrate(level.solution);
    const construction = reference.length === 1
      ? [{ id: reference[0].id, expr: RowProgram.call(reference[0].expr).name }]
      : reference.slice(0, -1);
    rowPrograms[index] = construction;
    const code = getCodeFromEditor(), rows = getRows();
    diagnoseRows(); runLiveCheck();
    const value = functionProgramContext(level).input;
    return code !== level.solution || !checkSolution(level, code).ok || rowDiagnostics.some(row => row.error)
      || !completedLevels.has(index) || !(rows.at(-1).automatic || rows.at(-1).automaticInput)
      || parameterUsage(level, code).find(card => card.name === value).used !== 1
      ? [level.name] : [];
  })`);
  assert.deepEqual(failures, []);
});

test('partial functions wait for one function; only completed rows expose reusable results', () => {
  const app = game();
  app.run(`currentLevel = 1; setEditorContent('(.)'); diagnoseRows();`);
  assert.equal(app.run('getRows().length'), 1);
  assert.match(app.run('rowDiagnostics[0].error'), /Choose one function/);
  assert.equal(app.run('checkSolution(LEVELS[1], getCodeFromEditor()).ok'), false);
  app.run(`setEditorContent('(.) mkHero'); diagnoseRows();`);
  assert.equal(app.run('getRows().length'), 2);
  assert.equal(app.run('getRows()[1].automatic'), true);
  assert.equal(app.run('rowDiagnostics[0].type.tag'), 'fun');
  assert.equal(app.run('rowDiagnostics[0].error'), undefined);
  assert.equal(app.run('checkSolution(LEVELS[1], getCodeFromEditor()).ok'), false);
});

test('the final application follows edits, disappears when its producer is cleared, and survives refresh', () => {
  const app = game();
  app.run(`currentLevel = 1; setEditorContent(LEVELS[1].solution); getRows(); persistRows();`);
  const saved = app.saved();
  const restored = game(saved); restored.run('diagnoseRows(); runLiveCheck();');
  assert.equal(restored.run('getCodeFromEditor()'), app.run('LEVELS[1].solution'));
  assert.equal(restored.run('getRows().filter(row => row.automatic).length'), 1);
  assert.equal(restored.nodes['next-level'].hidden, false);
  restored.run(`rowPrograms[1][1].expr = 'r1'; rowPrograms[1] = automaticRows(LEVELS[1], rowPrograms[1]); diagnoseRows();`);
  assert.equal(restored.run('getRows().some(row => row.automatic)'), false);
  assert.match(restored.run('rowDiagnostics[1].error'), /Choose one function/);
  assert.equal(restored.run('checkSolution(LEVELS[1], getCodeFromEditor()).ok'), false);
  restored.run(`rowPrograms[1] = [{id: 'r1', expr: ''}];`);
  assert.equal(restored.run('getCodeFromEditor()'), '');
});

test('a runnable transformation with the wrong result does not solve the level', () => {
  const app = game();
  app.run(`currentLevel = 1; setEditorContent('runZero'); diagnoseRows(); runLiveCheck();`);
  assert.equal(app.run('getCodeFromEditor()'), 'runZero z');
  assert.equal(app.run('getRows()[0].automaticInput'), true);
  assert.equal(app.run('rowDiagnostics[0].signature'), 'a');
  assert.equal(app.run('completedLevels.has(currentLevel)'), false);
  assert.equal(app.nodes['next-level'].hidden, true);
});

test('function-only rules reject value steps, bare aliases, and functions that return values in either mode', () => {
  const app = game();
  app.run(`currentLevel = 1;`);
  for (const code of [
    'let r1 = runZero z in mkHero r1',
    'let r1 = (.)\n r2 = r1 mkHero\n r3 = r2 runZero in r3 z'
  ]) {
    assert.equal(app.run(`typeCheck(LEVELS[1], ${JSON.stringify(code)}).ok`), true);
    assert.equal(app.run(`checkSolution(LEVELS[1], ${JSON.stringify(code)}).ok`), false);
  }
  assert.match(app.run(`(() => {
    const {env, params} = functionProgramContext(LEVELS[11]);
    return functionRowError('dup f', env, params);
  })()`), /must return a function/);
  assert.match(app.run(`(() => {
    const {env, params} = functionProgramContext(LEVELS[1]);
    return functionRowError('runZero', env, params, true);
  })()`), /takes a value/);
});

test('the level 9 converter comes from the palette while the only input is automatic', () => {
  const app = game();
  app.run(`currentLevel = 7; setEditorContent('fmap bd'); diagnoseRows();`);
  assert.equal(app.run('functionProgramContext(LEVELS[7]).input'), 'z');
  assert.equal(app.run('rowDiagnostics[0].error'), undefined);
  assert.equal(app.run('rowDiagnostics[0].call.arguments[0].type.tag'), 'fun');
  assert.equal(app.run('getRows().at(-1).expr'), 'r1 z');
});


test('text mode exposes the generated final application after constructing icons', () => {
  const app = game();
  app.run(`currentLevel = 1; iconMode = false;
    textDrafts[1] = 'let r1 = (.) mkHero in r1 runZero';
    iconMode = true; getRows(); runLiveCheck(); iconMode = false;`);
  assert.equal(app.run('getTextSource()'), app.run('LEVELS[1].solution'));
  assert.equal(app.run('checkSolution(LEVELS[1], getTextSource()).ok'), true);
  assert.equal(app.run('textDrafts[1]'), undefined);
});
