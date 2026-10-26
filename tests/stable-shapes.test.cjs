const { test } = require('node:test');
const assert = require('node:assert/strict');
const { game } = require('./helpers/game-harness.cjs');
const markers = svg => [...svg.matchAll(/data-marker="(\d+)"/g)].map(match => Number(match[1]));

test('named generic types have the same shape in every palette regardless of encounter order', () => {
  const app = game();
  const failures = app.read(`LEVELS.flatMap(level => level.funcs.flatMap(func => {
    const svg = FUNCTION_CARD_ICONS[level.level][func.name];
    return [...svg.matchAll(/data-variable="([a-z])" data-marker="(\\d+)"/g)]
      .filter(match => Number(match[2]) !== match[1].charCodeAt(0) - 96)
      .map(match => [level.level, func.name, match[1], match[2]]);
  }))`);
  assert.deepEqual(failures, []);
  assert.deepEqual(markers(app.run("FUNCTION_CARD_ICONS[3]['(.)']")), [2, 3, 1, 2, 1, 3]);
  assert.deepEqual(markers(app.run('FUNCTION_CARD_ICONS[9].fmap')), [3, 4, 1, 2, 3, 1, 2, 4]);
});

test('a placed function keeps its shapes and its result carries them through later uses', () => {
  const app = game();
  app.run("currentLevel = 1; setEditorContent('(.) mkHero'); diagnoseRows();");
  assert.deepEqual(markers(app.run("rowSymbol('mkHero', null, rowDiagnostics[0].call.arguments[0])")),
    markers(app.run('FUNCTION_CARD_ICONS[3].mkHero')));
  const result = markers(app.run("rowSymbol('r1', null, rowDiagnostics[0].diagram)"));
  assert.equal(app.run('rowDiagnostics[0].signature'), '(b -> a) -> b -> Hero a');
  assert.deepEqual(result, [2, 1, 2, 1]); // The existing circle stays; the new domain gets a square.
  app.run("rowPrograms[1] = placeInFixedRow(LEVELS[1], getRows(), 1, 'r1').rows; diagnoseRows();");
  assert.deepEqual(markers(app.run("rowSymbol('r1', null, rowDiagnostics[1].call.result)")), result);
  app.run("rowPrograms[1] = placeInFixedRow(LEVELS[1], getRows(), 1, 'runZero', true).rows; diagnoseRows();");
  assert.deepEqual(markers(app.run("rowSymbol('r2', null, rowDiagnostics[1].diagram)")), [1, 1]);
  assert.equal(app.run('checkSolution(LEVELS[1], getCodeFromEditor()).ok'), true);
});

test('independent edits and refresh cannot shuffle an existing branch through fresh-variable numbering', () => {
  const app = game();
  app.run('currentLevel = 13; setEditorContent(LEVELS[13].solution); diagnoseRows();');
  const before = markers(app.run("rowSymbol('r6', null, rowDiagnostics[5].diagram)"));
  const oldType = app.run('typeToString(rowDiagnostics[5].diagram.type)');
  app.run('rowPrograms[13] = automaticRows(LEVELS[13], clearedRows(getRows(), 0)); diagnoseRows(); persistRows();');
  assert.notEqual(app.run('typeToString(rowDiagnostics[5].diagram.type)'), oldType);
  assert.deepEqual(markers(app.run("rowSymbol('r6', null, rowDiagnostics[5].diagram)")), before);
  const restored = game(app.saved()); restored.run('diagnoseRows();');
  assert.deepEqual(markers(restored.run("rowSymbol('r6', null, rowDiagnostics[5].diagram)")), before);
});

test('distinct unresolved types never share a shape within a result in any level', () => {
  const app = game();
  const failures = app.read(`LEVELS.flatMap((level, index) => {
    currentLevel = index; setEditorContent(level.solution); diagnoseRows();
    return rowDiagnostics.flatMap((diagnostic, row) => {
      const variables = new Map(diagnostic.diagram.variables || []);
      const shapes = [...findVars(diagnostic.diagram.type)].map(name => variables.get(name));
      return shapes.some(shape => shape === undefined) || new Set(shapes).size !== shapes.length ? [[level.level, row]] : [];
    });
  })`);
  assert.deepEqual(failures, []);
});

test('actual swaps and rotations remain visible while unrelated type positions stay stable', () => {
  const app = game();
  assert.deepEqual(markers(app.run('FUNCTION_CARD_ICONS[14].swap')), [1, 2, 2, 1]);
  assert.deepEqual(markers(app.run('FUNCTION_CARD_ICONS[9].f1')), [1, 2, 3, 3, 1, 2]);
  app.run('currentLevel = 7; setEditorContent(LEVELS[7].solution); diagnoseRows();');
  for (const index of [2, 4, 6, 8]) {
    // The input to each progressively composed transformation stays circle,
    // concrete square, diamond. Rotations affect the output, not these names.
    assert.deepEqual(markers(app.run(`rowSymbol('transform', null, rowDiagnostics[${index}].diagram)`)).slice(0, 2), [1, 3]);
  }
  assert.deepEqual(markers(app.run("rowSymbol('final transform', null, rowDiagnostics[8].diagram)")), [1, 3, 1, 3]);
  assert.equal(app.run('rowDiagnostics[8].signature'), 'Zero a B c -> Hero a D c');
  assert.equal(app.run('checkSolution(LEVELS[7], getCodeFromEditor()).ok'), true);
});
