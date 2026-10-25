const { test } = require('node:test');
const assert = require('node:assert/strict');
const { game } = require('./helpers/game-harness.cjs');
const previousLevels = require('./fixtures/levels-before-functions-first.json');

const renamedIndex = index => index > 1 ? index - 1 : index;
function legacySave(levels, icons) {
  const source = game();
  return {
    currentLevel: 15, completed: levels.map((_, index) => index), iconMode: icons, geckoOn: false,
    rowVersion: 1, curryingVersion: 1, connectionVersion: 1, completionVersion: 5,
    levelOrderVersion: 1, applicativeVersion: 1,
    editorContents: Object.fromEntries(levels.map((level, index) => [index, level.lhs + ' ' + level.solution])),
    textDrafts: Object.fromEntries(levels.map((level, index) => [index, level.solution])),
    rowPrograms: Object.fromEntries(levels.map((level, index) => [index, source.read(`RowProgram.migrate(${JSON.stringify(level.solution)})`)]))
  };
}

test('all sixteen reference solutions use only functions until one final value application', () => {
  const app = game();
  assert.deepEqual(app.read('LEVEL_ORDER.map(index => LEVELS[index].level)'), Array.from({length: 16}, (_, i) => i + 1));
  assert.equal(app.run("LEVELS.some(level => level.name === 'Assembly required')"), false);
  assert.equal(app.run("LEVELS.find(level => level.level === 3).name"), 'Assembly by composition');
  const failures = app.read(`LEVELS.flatMap((level, index) => {
    currentLevel = index; setEditorContent(level.solution); diagnoseRows();
    const rows = getRows(), final = rows.at(-1), call = RowProgram.call(final.expr);
    const value = level.level === 1 ? 'value' : 'z';
    const resultCounts = rows.slice(0, -1).map(row => rows.reduce((count, later) =>
      count + RowProgram.names(RowProgram.parse(later.expr)).filter(name => name === row.id).length, 0));
    const intermediateError = rowDiagnostics.slice(0, -1).some(row => row.error || row.type.tag !== 'fun'
      || row.call.arguments.length !== 1 || row.call.arguments[0].type.tag !== 'fun');
    return !checkSolution(level, level.solution).ok || intermediateError
      || rows.slice(0, -1).some(row => RowProgram.names(RowProgram.parse(row.expr)).includes(value))
      || call.args[0] !== value || parameterUsage(level, level.solution).find(p => p.name === value).used !== 1
      || resultCounts.some(count => count !== 1) || functionUsage(level, level.solution).some(f => f.used !== f.limit)
      ? [level.name] : [];
  })`);
  assert.deepEqual(failures, []);
});

test('the final five lessons retain their goals and require z only in the final row', () => {
  const app = game();
  for (const old of previousLevels.filter(level => level.level >= 13)) {
    app.run(`currentLevel = LEVELS.findIndex(level => level.name === ${JSON.stringify(old.name)});`);
    assert.equal(app.run('LEVELS[currentLevel].target'), old.target);
    assert.equal(app.run('LEVELS[currentLevel].finalInput'), 'z');
    assert.equal(app.run('LEVELS[currentLevel].parameterUses.z'), 1);
    assert.equal(app.run(`checkSolution(LEVELS[currentLevel], ${JSON.stringify(old.solution)}).ok`), false);
    const solution = app.run('LEVELS[currentLevel].solution');
    const early = solution.replace('let\n', 'let\n  input = z\n').replace(/ z$/, ' input');
    assert.equal(app.run(`typeCheck(LEVELS[currentLevel], ${JSON.stringify(early)}).ok`), true);
    assert.match(app.run(`checkSolution(LEVELS[currentLevel], ${JSON.stringify(early)}).msg`), /pass z once in the final row/);
    for (const icons of [true, false]) {
      app.run(`iconMode = ${icons}; setEditorContent(LEVELS[currentLevel].solution); render(); runLiveCheck();`);
      assert.equal(app.run('completedLevels.has(currentLevel)'), true);
      assert.equal(app.nodes['next-level'].hidden, false);
      assert.deepEqual(app.read('cardUsage(LEVELS[currentLevel], getCodeFromEditor()).filter(card => card.remaining)'), []);
      const restored = game(app.saved()); restored.run('render(); runLiveCheck();');
      assert.equal(restored.run('getCodeFromEditor()'), solution);
      assert.equal(restored.nodes['next-level'].hidden, false);
    }
  }
});

test('flip specializes bind without needing an intermediate Hero value', () => {
  const app = game();
  app.run(`currentLevel = LEVELS.findIndex(level => level.name === 'Bind them all');
    setEditorContent(LEVELS[currentLevel].solution); diagnoseRows();`);
  assert.match(app.run('rowDiagnostics[0].signature'), /^\(a -> Hero b\) -> Hero a -> Hero b$/);
  assert.equal(app.run('rowDiagnostics[1].signature'), 'Hero a -> Hero (a, a)');
  assert.equal(app.run('rowDiagnostics[3].signature'), 'Zero a -> Hero (a, a)');
  assert.match(app.run('FUNCTION_CARD_ICONS[13].flip'), /Reverse|opposite order/);
});

for (const icons of [true, false]) {
  test(`old saved work follows its puzzle after removal in ${icons ? 'icon' : 'text'} mode`, () => {
    const saved = legacySave(previousLevels, icons);
    const app = game(saved);
    assert.equal(app.run('currentLevel'), 14);
    assert.equal(app.run('LEVELS[currentLevel].name'), 'Applicative hero');
    assert.equal(app.run('iconMode'), icons);
    assert.deepEqual(app.read('[...completedLevels]'), [...Array.from({length: 10}, (_, i) => i), 15]);
    for (const field of ['editorContents', 'rowPrograms', 'textDrafts']) {
      const expected = Object.fromEntries(Object.entries(saved[field]).filter(([index]) => Number(index) !== 1)
        .map(([index, value]) => [renamedIndex(Number(index)), value]));
      if (field === 'editorContents') expected[7] = expected[7].replace('zeroToHero ad bd cd z =', 'zeroToHero z =');
      assert.deepEqual(app.saved()[field], expected);
    }
    assert.equal(app.saved().levelOrderVersion, 2);
    assert.equal(app.saved().transformationsVersion, 1);
    const again = game(app.saved()); again.run('saveProgress();');
    assert.deepEqual(again.saved(), app.saved());
  });
}

test('pre-composition saves run both ordering migrations exactly once', () => {
  const levels = previousLevels.filter(level => level.level > 1 && level.name !== 'Assembly by composition');
  const saved = legacySave(levels, true);
  delete saved.levelOrderVersion;
  delete saved.curryingVersion;
  delete saved.applicativeVersion;
  saved.currentLevel = 6;
  const app = game(saved);
  assert.equal(app.run('currentLevel'), 6);
  assert.equal(app.run('LEVELS[currentLevel].name'), 'TIE fighter');
  assert.equal(app.run('completedLevels.has(1)'), false); // Newly introduced composition lesson.
  assert.equal(app.run('completedLevels.has(15)'), false); // Wrapping introduction was not in that save.
  for (const [index, level] of levels.entries()) {
    if (index === 1) continue; // Removed Assembly required.
    assert.equal(app.run(`textDrafts[${index}]`), level.solution);
  }
  assert.equal(app.saved().levelOrderVersion, 2);
  const again = game(app.saved()); again.run('saveProgress();');
  assert.deepEqual(again.saved(), app.saved());
});

test('players on the removed level continue at composition without inheriting its old answer', () => {
  const app = game({ currentLevel: 1, completed: [0, 1], iconMode: true,
    levelOrderVersion: 1, completionVersion: 5, rowVersion: 1,
    editorContents: {1: 'zeroToHero z = mkHero (runZero z)'},
    rowPrograms: {1: [{id: 'r1', expr: 'runZero z'}, {id: 'r2', expr: 'mkHero r1'}]},
    textDrafts: {1: 'let r1 = runZero z in mkHero r1'} });
  assert.equal(app.run('LEVELS[currentLevel].name'), 'Assembly by composition');
  assert.deepEqual(app.read('[...completedLevels]'), [0]);
  assert.equal(app.run('getCodeFromEditor()'), '');
});

test('unfinished drafts are retained while changed lessons lose outdated completion', () => {
  const saved = legacySave(previousLevels, false);
  saved.textDrafts[14] = 'let unfinished =';
  const app = game(saved);
  assert.equal(app.run('textDrafts[13]'), 'let unfinished =');
  assert.equal(app.run('completedLevels.has(13)'), false);
  assert.equal(app.saved().transformationsVersion, 1);
});
