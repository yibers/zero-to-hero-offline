const { test } = require('node:test');
const assert = require('node:assert/strict');
const { game } = require('./helpers/game-harness.cjs');
const markers = svg => [...svg.matchAll(/data-marker="(\d+)"/g)].map(match => match[1]);
const atoms = svg => [...svg.matchAll(/data-type="([^"]+)"/g)].map(match => match[1]);

test('generic types are dotted, concrete types are hollow, and values are filled', () => {
  const app = game();
  const palette = app.run('FUNCTION_CARD_ICONS[19].pair');
  assert.deepEqual(markers(palette), ['1', '2', '1', '2']);
  assert.match(palette, /class="generic-outline" fill="none"/);
  assert.match(palette, /<ellipse /);
  assert.match(palette, /<rect /);
  assert.doesNotMatch(palette, /<circle[^>]*r="1\.7"/);
  const value = app.run('LEVEL_ICONS[1].value');
  assert.deepEqual(atoms(value), ['a']);
  assert.deepEqual(markers(value), []);
  assert.match(value, /<circle[^>]*fill="#d97706"[^>]*stroke="#d97706"/);
  const type = app.run("renderSemanticType(fixedSemanticType('a'))");
  assert.match(type, /<circle[^>]*fill="none"[^>]*stroke="#d97706"/);
  const fn = app.run("renderSemanticType(fixedSemanticType('a -> b'), 'Function value', [], null, true)");
  assert.doesNotMatch(fn, /fill="#[^"]+"/);
  assert.deepEqual(atoms(fn), ['a', 'b']);
});

test('automatic starting values replace generic slots and completed results stay filled', () => {
  const app = game();
  const draw = source => {
    app.run(`setEditorContent(${JSON.stringify(source)}); diagnoseRows();`);
    return app.run(`(() => {
      const call = rowDiagnostics[0].call;
      return { input: rowSymbol('input', null, call.arguments[0] || call.inputDiagrams[0]),
        output: rowSymbol('output', null, rowDiagnostics[0].expected) };
    })()`);
  };
  const before = draw('wrap');
  assert.deepEqual(markers(before.input), []);
  assert.deepEqual(atoms(before.input), ['a']);
  assert.equal(app.run('getRows()[0].automaticInput'), true);
  const filled = draw('wrap value');
  for (const svg of [filled.input, filled.output]) {
    assert.deepEqual(markers(svg), []);
    assert.deepEqual(atoms(svg), ['a']);
    assert.doesNotMatch(svg, /class="type-binding"/);
    assert.match(svg, /<circle[^>]*fill="#d97706"/);
    assert.match(svg, /data-diagram-template=/);
    assert.doesNotMatch(svg, /class="type-placeholder"/);
  }
  assert.equal(app.run('getRowError()'), null);
  assert.equal(app.run('checkSolution(LEVELS[currentLevel], getCodeFromEditor()).ok'), true);
  app.run('persistRows();');
  const restored = game(app.saved());
  restored.run('diagnoseRows();');
  assert.equal(restored.run("rowSymbol('input', null, rowDiagnostics[0].call.arguments[0])"), filled.input);
  assert.equal(draw('wrap').input, before.input);
  assert.equal(draw('wrap').output, before.output);
  // One supplied argument returns a boxed function. Its inner signature
  // keeps concrete type outlines and unknown generic placeholders.
  app.run('currentLevel = 14; setEditorContent("pair z"); diagnoseRows();');
  assert.equal(app.run('rowDiagnostics[0].expected.isValue'), true);
  const partial = app.run("rowSymbol('output', null, rowDiagnostics[0].expected)");
  assert.ok(atoms(partial).length);
  assert.match(partial, /class="function-value"/);
  assert.match(partial, /fill="none" stroke="#d97706"/);
  assert.match(partial, /class="type-placeholder"/);
  assert.doesNotMatch(partial, /class="type-binding"/);
  app.run('currentLevel = 0; setEditorContent("f z"); diagnoseRows();');
  const reused = app.run("rowSymbol('r1')");
  assert.match(reused, /<circle[^>]*fill="#d97706"/);
  assert.deepEqual(markers(reused), []);
});

test('a generic slot can hold a whole compound type without losing its structure', () => {
  const app = game();
  const svg = app.run(`renderSemanticType(fixedSemanticType('Hero (a, b)'), 'Compound binding', ['x'], parseType('x'))`);
  assert.deepEqual(markers(svg), ['1']);
  assert.deepEqual(atoms(svg), ['a', 'b']);
  assert.match(svg, /class="type-binding"/);
  assert.match(svg, /data-diagram-type="Hero \(SKOLEMa, SKOLEMb\)"/);
  assert.match(svg, /data-diagram-template="x"/);
  const value = app.run(`renderSemanticType(fixedSemanticType('Hero (a, b)'), 'Compound value', ['x'], parseType('x'), true)`);
  assert.deepEqual(markers(value), []);
  assert.deepEqual(atoms(value), ['a', 'b']);
  assert.doesNotMatch(value, /class="type-binding"/);
  assert.match(value, /fill="#d97706"/);
  assert.match(value, /fill="#0284c7"/);
});

test('function values retain their generic signature without the receiving slot frame', () => {
  const app = game();
  app.run('currentLevel = 11; setEditorContent("let r1 = flip (>>=) in r1 dup"); diagnoseRows();');
  const svg = app.run("rowSymbol('dup', null, rowDiagnostics[1].call.arguments[0])");
  // dup keeps its a -> Hero (a, a) signature. The receiving b slot no longer
  // surrounds the pair, while the three generic a occurrences still match.
  assert.deepEqual(markers(svg), ['1', '1', '1']);
  assert.doesNotMatch(svg, /class="type-binding"/);
  assert.deepEqual(atoms(svg), []);
});

test('every reference solution renders its bound inputs and outputs without changing puzzle semantics', () => {
  const app = game();
  const failures = app.read(`LEVELS.flatMap((level, index) => {
    currentLevel = index; setEditorContent(level.solution); diagnoseRows();
    const pictures = rowDiagnostics.flatMap(row => [rowSymbol('result', null, row.expected),
      ...(row.call?.arguments || []).filter(Boolean).map(argument => rowSymbol('input', null, argument))]);
    return rowDiagnostics.some(row => row.error) || !checkSolution(level, level.solution).ok
      || pictures.some(svg => /NaN|undefined/.test(svg)) ? [level.level] : [];
  })`);
  assert.deepEqual(failures, []);
});

test('responsive refitting preserves bindings and keeps compound diagrams within a phone width', () => {
  const app = game();
  const failures = app.read(`(() => {
    getComputedStyle = () => ({ paddingLeft: '0', paddingRight: '0' });
    const decode = value => value.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    const markers = svg => [...svg.matchAll(/data-marker="(\\d+)"/g)].map(m => m[1]).join(',');
    const fills = svg => (svg.match(/fill="#[^"]+"/g) || []).join(',');
    const failures = [];
    for (const [index, level] of LEVELS.entries()) {
      currentLevel = index; setEditorContent(level.solution); diagnoseRows();
      const pictures = rowDiagnostics.flatMap(row => [rowSymbol('result', null, row.expected),
        ...(row.call?.arguments || []).filter(Boolean).map(argument => rowSymbol('input', null, argument))]);
      for (const svg of pictures) {
        const attributes = Object.fromEntries([...svg.match(/<svg[^>]*>/)[0].matchAll(/([\\w-]+)="([^"]*)"/g)].map(m => [m[1], decode(m[2])]));
        const holder = { clientWidth: 320 };
        const node = {
          dataset: { diagramType: attributes['data-diagram-type'], diagramTemplate: attributes['data-diagram-template'],
            diagramVariables: attributes['data-diagram-variables'], diagramValue: attributes['data-diagram-value'] }, style: {}, innerHTML: '',
          getAttribute: name => attributes[name] ?? null,
          setAttribute: (name, value) => attributes[name] = value,
          querySelector: () => ({}),
          closest: selector => selector === '.argument-choice' ? {} : selector === '.argument-choices' ? holder : null
        };
        for (const width of [320, 800, 320]) {
          holder.clientWidth = width; fitSemanticDiagrams({ querySelectorAll: () => [node] });
          if (markers(node.innerHTML) !== markers(svg) || fills(node.innerHTML) !== fills(svg) || Number(attributes.width) > width - 26 + 1
            || /NaN|undefined/.test(node.innerHTML)) failures.push([level.level, width, attributes.width]);
        }
      }
    }
    return failures;
  })()`);
  assert.deepEqual(failures, []);
});
