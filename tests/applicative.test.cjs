const { test } = require('node:test');
const assert = require('node:assert/strict');
const { game } = require('./helpers/game-harness.cjs');

function checker() {
  const app = game();
  app.run(`const apEnv = {
    '<*>': parseType('Applicative f => f (a -> b) -> f a -> f b'),
    '.': parseType('(b -> c) -> (a -> b) -> a -> c')
  };`);
  const infer = (code, params = {}) => app.run(`typeToString(inferExpr(${JSON.stringify(code)}, apEnv,
    Object.fromEntries(Object.entries(${JSON.stringify(params)}).map(([name, sig]) => [name, parseType(sig)]))))`);
  return { app, infer };
}

test('standard Applicative application specializes to Hero and shared-input functions', () => {
  const { infer } = checker();
  const hero = { hf: 'Hero (A -> B)', hv: 'Hero A' };
  assert.equal(infer('(<*>) hf', hero), 'Hero A -> Hero B');
  assert.equal(infer('(<*>) hf hv', hero), 'Hero B');
  assert.equal(infer('hf <*> hv', hero), 'Hero B');
  const reader = { ff: 'R -> A -> B', fv: 'R -> A', x: 'R' };
  assert.equal(infer('(<*>) ff', reader), '(R -> A) -> R -> B');
  assert.equal(infer('(<*>) ff fv', reader), 'R -> B');
  assert.equal(infer('(<*>) ff fv x', reader), 'B');
  assert.equal(infer('(ff <*> fv) x', reader), 'B');
  assert.equal(infer('let ap = (<*>) in ap ff fv x', reader), 'B');
});

test('Applicative constraints survive composition, aliases and partial application', () => {
  const { infer } = checker();
  for (const code of ['(.) (<*>) mk', 'let compose = (.) (<*>) in compose mk',
    'let ap = (<*>); compose = (.) ap in compose mk']) {
    assert.equal(infer(code, { mk: 'R -> Hero (A -> B)' }), 'R -> Hero A -> Hero B');
    assert.equal(infer(code, { mk: 'R -> S -> A -> B' }), 'R -> (S -> A) -> S -> B');
    assert.throws(() => infer(code, { mk: 'R -> Zero (A -> B)' }), /Type mismatch/);
  }
  for (const code of ['(<*>) hf hv', 'let ap = (<*>) in ap hf hv', 'let partial = (<*>) hf in partial hv']) {
    for (const params of [
      { hf: 'Zero (A -> B)', hv: 'Zero A' },
      { hf: 'Other (A -> B)', hv: 'Other A' },
      { hf: 'Hero (A -> B)', hv: 'Zero A' },
      { hf: 'Hero (A -> B)', hv: 'Hero C' },
      { hf: 'Hero R (A -> B)', hv: 'Hero R A' },
      { hf: 'R -> A -> B', hv: 'S -> A' },
      { hf: 'R -> A -> B', hv: 'R -> C' },
      { hf: 'A -> B', hv: 'A' }
    ]) assert.throws(() => infer(code, params), /Type mismatch/, `${code}: ${JSON.stringify(params)}`);
  }
});

test('unification retains a class constraint when a context is renamed before specialization', () => {
  const { app } = checker();
  app.run(`const constrained = parseType('Applicative f => f a');
    const renamed = unify(constrained, parseType('g b'), {});`);
  assert.equal(app.run("unify(parseType('g b'), parseType('Zero A'), renamed)"), null);
  assert.equal(app.run("!!unify(parseType('g b'), parseType('Hero A'), renamed)"), true);
  assert.equal(app.run("!!unify(parseType('g b'), parseType('R -> A'), renamed)"), true);
});

test('generic context pictures resolve into shared-input functions without losing curried boxes', () => {
  const app = game();
  assert.match(app.run("FUNCTION_CARD_ICONS[8]['(<**>)']"), /class="applicative-context"/);
  app.run('currentLevel = 6; setEditorContent(LEVELS[6].solution); diagnoseRows();');
  assert.deepEqual(app.read('rowDiagnostics.filter(row => row.error)'), []);
  for (const index of [0,1,2,3]) {
    const svg = app.run(`rowSymbol('specialized', null, rowDiagnostics[${index}].expected)`);
    assert.doesNotMatch(svg, /class="applicative-context"|NaN|undefined/);
    assert.match(svg, /class="function-value"/);
  }
  assert.match(app.run("typeToString(rowDiagnostics[1].type)"), /^Zero .* -> /);
  assert.match(app.run("typeToString(rowDiagnostics[3].type)"), /^Zero .* -> Hero /);
  assert.equal(app.run("typeToString(rowDiagnostics[4].type)"), 'Hero SKOLEMc');
});

test('text mode retains the Applicative constraint separator', () => {
  const app = game();
  app.run('iconMode = false;');
  const signature = app.run("colorizeType('Applicative f => f (a -> b) -> f a -> f b')");
  assert.match(signature, /Applicative/);
  assert.match(signature, /&rArr;/);
});
