const { test } = require('node:test');
const assert = require('node:assert/strict');
const { game } = require('./helpers/game-harness.cjs');

test('every palette function and every reference row expose exactly one input', () => {
  const app = game();
  const failures = app.read(`LEVELS.flatMap((level, index) => {
    currentLevel = index; setEditorContent(level.solution); diagnoseRows();
    const badCards = level.funcs.filter(f => !FUNCTION_CARD_ICONS[level.level][f.name].includes('data-diagram-arity="1"'));
    const badRows = rowDiagnostics.filter(row => row.error || row.call?.inputs.length !== 1 || row.call.args.length !== 1);
    return badCards.length || badRows.length || !checkSolution(level, level.solution).ok ? [level.level] : [];
  })`);
  assert.deepEqual(failures, []);
});

test('returned functions are nested boxes in the palette and in specialized row results', () => {
  const app = game();
  const palette = app.run('FUNCTION_CARD_ICONS[17].pair');
  assert.match(palette, /class="icon-output">[\s\S]*class="function-value"/);
  const nested = app.run("renderSemanticType(fixedSemanticType('a -> b -> c'))");
  assert.equal((nested.match(/class="function-value"/g) || []).length, 2);
  app.run('currentLevel = 15; setEditorContent("let first = pair z in first z"); diagnoseRows();');
  assert.equal(app.run('rowDiagnostics[0].expected.type.tag'), 'fun');
  assert.match(app.run("rowSymbol('first', null, rowDiagnostics[0].expected)"), /class="function-value"/);
  assert.equal(app.run('rowDiagnostics[1].expected.type.tag'), 'app');
  assert.doesNotMatch(app.run("rowSymbol('final', null, rowDiagnostics[1].expected)"), /class="function-value"/);
});

test('prefix, infix, aliased and nested multi-argument calls must be split in text mode', () => {
  const app = game();
  app.run('currentLevel = 2; iconMode = false;');
  for (const code of ['(.) mkHero runZero', 'mkHero . runZero', 'mkHero (runZero z)', 'let compose = (.) in compose mkHero runZero']) {
    app.run(`textDrafts[currentLevel] = ${JSON.stringify(code)};`);
    assert.match(app.run('getTextError()'), /One argument per row/);
    assert.match(app.run('checkSolution(LEVELS[currentLevel], getCodeFromEditor()).msg'), /One argument per row/);
  }
  app.run('textDrafts[currentLevel] = LEVELS[currentLevel].solution;');
  assert.equal(app.run('getTextError()'), null);
  assert.equal(app.run('checkSolution(LEVELS[currentLevel], getCodeFromEditor()).ok'), true);
});

test('splitting calls preserves result names, missing references, card counts and unfinished rows', () => {
  const app = game();
  const rows = [
    { id: 'r1', expr: '(.) mkHero runZero' },
    { id: 'r2', expr: 'r1 z' },
    { id: 'r3', expr: 'r4 z' },
    { id: 'r5', expr: '(.)' },
    { id: 'r6', expr: '(runZero' }
  ];
  app.run(`const originalRows = ${JSON.stringify(rows)}; const splitRows = RowProgram.curryRows(originalRows);`);
  const split = app.read('splitRows');
  assert.equal(split[0].id, 'r7');
  assert.equal(split[0].expr, '(.) mkHero');
  assert.deepEqual(split.slice(1), [{ id: 'r1', expr: 'r7 runZero' }, ...rows.slice(1)]);
  assert.deepEqual(app.read('RowProgram.curryRows(splitRows)'), split);
  assert.deepEqual(app.read('functionUsage(LEVELS[2], RowProgram.source(splitRows))'), app.read('functionUsage(LEVELS[2], RowProgram.source(originalRows))'));
  assert.match(app.run('RowProgram.validate(splitRows, LEVELS[2])[3]'), /r4 is not an earlier result/);
  assert.equal(app.run("RowProgram.currySource('runZero $ z')"), 'runZero z');
});

test('saved icon rows and text drafts convert once without losing progress or preferences', () => {
  const solution = 'let r1 = (.) mkHero runZero in r1 z';
  for (const icons of [true, false]) {
    const saved = {
      currentLevel: 2, completed: [0, 2], iconMode: icons, geckoOn: false,
      rowVersion: 1, connectionVersion: 1, completionVersion: 5, levelOrderVersion: 1,
      editorContents: { 2: 'zeroToHero z = ' + solution }, textDrafts: { 2: solution, 1: 'let unfinished =' },
      rowPrograms: { 2: [{ id: 'r1', expr: '(.) mkHero runZero' }, { id: 'r2', expr: 'r1 z' }] }
    };
    const app = game(saved);
    assert.equal(app.run('currentLevel'), 2);
    assert.equal(app.run('iconMode'), icons);
    assert.deepEqual(app.read('[...completedLevels]'), [0, 2]);
    assert.equal(app.run('textDrafts[1]'), 'let unfinished =');
    assert.equal(app.run('checkSolution(LEVELS[currentLevel], getCodeFromEditor()).ok'), true);
    assert.deepEqual(app.read('RowProgram.validate(getRows(), LEVELS[currentLevel])'), [null, null, null]);
    assert.equal(app.saved().curryingVersion, 1);
    const again = game(app.saved()); again.run('saveProgress();');
    assert.deepEqual(again.saved(), app.saved());
  }
});
