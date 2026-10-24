const { test } = require('node:test');
const assert = require('node:assert/strict');
const { game } = require('./helpers/game-harness.cjs');
const markers = svg => [...svg.matchAll(/data-marker="(\d+)"/g)].map(match => match[1]);
const atoms = svg => [...svg.matchAll(/data-type="([^"]+)"/g)].map(match => match[1]);

test('generic types use matching dotted outlines, while fixed types use hollow colored shapes', () => {
  const app = game();
  const palette = app.run('FUNCTION_CARD_ICONS[17].pair');
  assert.deepEqual(markers(palette), ['1', '2', '1', '2']);
  assert.match(palette, /class="generic-outline" fill="none"/);
  assert.match(palette, /<ellipse /);
  assert.match(palette, /<rect /);
  assert.doesNotMatch(palette, /<circle[^>]*r="1\.7"/);
  const value = app.run('LEVEL_ICONS[1].value');
  assert.deepEqual(atoms(value), ['a']);
  assert.deepEqual(markers(value), []);
  assert.match(value, /<circle[^>]*fill="none"[^>]*stroke="#d97706"/);
});

test('placing and clearing a value preserves the slot shape and specializes matching output slots', () => {
  const app = game();
  const draw = source => {
    app.run(`setEditorContent(${JSON.stringify(source)}); diagnoseRows();`);
    return app.run(`(() => {
      const call = rowDiagnostics[0].call;
      return { input: rowSymbol('input', null, call.arguments[0] || call.inputDiagrams[0]),
        output: rowSymbol('output', null, call.expected) };
    })()`);
  };
  const before = draw('wrap');
  assert.deepEqual(markers(before.input), ['1']);
  assert.deepEqual(atoms(before.input), []);
  const filled = draw('wrap value');
  for (const svg of [filled.input, filled.output]) {
    assert.deepEqual(markers(svg), ['1']);
    assert.deepEqual(atoms(svg), ['a']);
    assert.match(svg, /class="type-binding"/);
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
});

test('a generic slot can hold a whole compound type without losing its structure', () => {
  const app = game();
  const svg = app.run(`renderSemanticType(fixedSemanticType('Hero (a, b)'), 'Compound binding', ['x'], parseType('x'))`);
  assert.deepEqual(markers(svg), ['1']);
  assert.deepEqual(atoms(svg), ['a', 'b']);
  assert.match(svg, /class="type-binding"/);
  assert.match(svg, /data-diagram-type="Hero \(SKOLEMa, SKOLEMb\)"/);
  assert.match(svg, /data-diagram-template="x"/);
});

test('generic variables inside a supplied function keep their matching shapes across nested bindings', () => {
  const app = game();
  app.run('currentLevel = 14; setEditorContent("(>>=) _ dup"); diagnoseRows();');
  const svg = app.run("rowSymbol('dup', null, rowDiagnostics[0].call.arguments[1])");
  // a -> Hero b specializes to a -> Hero (a, a): b surrounds the pair,
  // and all three a occurrences still have the same circular outline.
  assert.deepEqual(markers(svg), ['1', '2', '1', '1']);
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
            diagramVariables: attributes['data-diagram-variables'] }, style: {}, innerHTML: '',
          getAttribute: name => attributes[name] ?? null,
          setAttribute: (name, value) => attributes[name] = value,
          querySelector: () => ({}),
          closest: selector => selector === '.argument-choice' ? {} : selector === '.argument-choices' ? holder : null
        };
        for (const width of [320, 800, 320]) {
          holder.clientWidth = width; fitSemanticDiagrams({ querySelectorAll: () => [node] });
          if (markers(node.innerHTML) !== markers(svg) || Number(attributes.width) > width - 26 + 1
            || /NaN|undefined/.test(node.innerHTML)) failures.push([level.level, width, attributes.width]);
        }
      }
    }
    return failures;
  })()`);
  assert.deepEqual(failures, []);
});
