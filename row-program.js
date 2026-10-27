// The game uses a restricted let-normal form (LNF): named operands, one unary
// application per row, and acyclic let bindings that reference earlier rows.
// Keep parsing separate from the UI so migration, validation and scoring agree.
const RowProgram = (() => {
  const ops = { '$': [0, 'right'], '>>=': [1, 'left'], '<$>': [4, 'left'], '<*>': [4, 'left'], '.': [9, 'right'] };
  const reserved = new Set(['case', 'class', 'data', 'default', 'deriving', 'do', 'else',
    'foreign', 'if', 'import', 'in', 'infix', 'infixl', 'infixr', 'instance', 'let',
    'module', 'newtype', 'of', 'then', 'type', 'where']);
  const atom = name => ({ kind: 'name', name });
  const app = (fn, args) => fn.kind === 'app'
    ? { kind: 'app', fn: fn.fn, args: [...fn.args, ...args] }
    : { kind: 'app', fn, args };
  function parse(code) {
    const tokens = tokenizeExpr(code);
    let i = 0;
    const startsAtom = t => t === '(' || (t && typeof t === 'object' && t.type === 'ident');
    function primary() {
      const t = tokens[i++];
      if (t && t.type === 'ident') return atom(t.name);
      if (t === '(') {
        if (ops[tokens[i]] && tokens[i + 1] === ')') {
          const name = tokens[i]; i += 2; return atom(name);
        }
        const result = expression(0);
        if (tokens[i++] !== ')') throw Error('Expected closing parenthesis.');
        return result;
      }
      throw Error('Incomplete expression.');
    }
    function expression(min) {
      let left = primary();
      while (startsAtom(tokens[i])) left = app(left, [primary()]);
      while (ops[tokens[i]] && ops[tokens[i]][0] >= min) {
        const op = tokens[i++], [priority, assoc] = ops[op];
        const right = expression(priority + (assoc === 'left' ? 1 : 0));
        left = { kind: 'op', op, left, right };
      }
      return left;
    }
    const tree = expression(0);
    if (i !== tokens.length) throw Error('Unexpected token. Check the row expression.');
    return tree;
  }
  const atomic = tree => tree.kind === 'name';
  function print(tree) {
    if (atomic(tree)) return ops[tree.name] ? `(${tree.name})` : tree.name;
    const child = t => atomic(t) ? print(t) : `(${print(t)})`;
    if (tree.kind === 'app') return [child(tree.fn), ...tree.args.map(child)].join(' ');
    return `${child(tree.left)} ${tree.op} ${child(tree.right)}`;
  }
  function count(tree) {
    if (atomic(tree)) return 0;
    if (tree.kind === 'app') return tree.args.length + count(tree.fn) + tree.args.reduce((n, t) => n + count(t), 0);
    return (tree.op === '$' ? 1 : 2) + count(tree.left) + count(tree.right);
  }
  function names(tree) {
    if (atomic(tree)) return [tree.name];
    if (tree.kind === 'app') return [...names(tree.fn), ...tree.args.flatMap(names)];
    return [tree.op, ...names(tree.left), ...names(tree.right)];
  }
  // An LNF slot references a named value (including a function), never a nested call.
  function call(code) {
    try {
      const tree = parse(code);
      if (atomic(tree)) return { name: tree.name, args: [], infix: false };
      if (count(tree) !== 1) return null;
      return tree.kind === 'op'
        ? { name: tree.op, args: [tree.left.name, tree.right.name], infix: true }
        : { name: tree.fn.name, args: tree.args.map(arg => arg.name), infix: false };
    } catch (_) { return null; }
  }
  function setArgument(code, index, name) {
    const model = call(code);
    if (!model || index !== 0) throw Error('Each row accepts one argument. Apply the returned function in a new row.');
    if (name) {
      const value = parse(name);
      if (!atomic(value)) throw Error('Use an earlier result instead of a nested call.');
      name = value.name;
    }
    while (model.args.length <= index) model.args.push('_');
    model.args[index] = name || '_';
    while (model.args.at(-1) === '_') model.args.pop();
    if (model.infix && model.args.length === 2) return print({ kind: 'op', op: model.name, left: atom(model.args[0]), right: atom(model.args[1]) });
    return print(model.args.length ? app(atom(model.name), model.args.map(atom)) : atom(model.name));
  }
  // This deliberately accepts only the explicit, non-recursive let form emitted
  // by the editor. It is not a general Haskell layout/recursive-let parser.
  function parseLet(code) {
    if (!/^let\b/.test(code.trim())) return null;
    const match = code.trim().match(/^let\s+([\s\S]*?)\bin\s+([\s\S]+)$/);
    if (!match) throw Error('Incomplete let expression.');
    const bindings = match[1].trim().split(/\n|;/).filter(s => s.trim()).map(line => {
      const binding = line.trim().match(/^([a-z][A-Za-z0-9_']*)\s*=\s*(.+)$/);
      if (!binding) throw Error('Each let row needs a name and an expression.');
      return { id: binding[1], expr: binding[2] };
    });
    if (new Set(bindings.map(r => r.id)).size !== bindings.length) throw Error('Row names must be unique.');
    return { bindings, final: match[2].trim() };
  }
  function source(rows) {
    // Empty fixed slots are layout, not Haskell bindings. Keep a hole in the
    // final expression while its automatic application is still pending.
    if (rows.at(-1)?.automatic) {
      const bindings = rows.slice(0, -1).filter(row => row.expr.trim());
      if (!bindings.length && !rows.at(-1).expr.trim()) return '';
      rows = [...bindings, { ...rows.at(-1), expr: rows.at(-1).expr.trim() || '_' }];
    }
    if (rows.length === 1) return rows[0].expr.trim();
    return 'let\n' + rows.slice(0, -1).map(r => `  ${r.id} = ${r.expr.trim()}`).join('\n') + '\nin\n  ' + rows.at(-1).expr.trim();
  }
  // Expand applications without renaming existing results. Reserve every name,
  // including unresolved references, so generated rows cannot capture a name.
  function curryRows(rows) {
    const used = new Set(rows.flatMap(row => [row.id, ...(row.expr.match(/[a-zA-Z_][a-zA-Z0-9_']*/g) || [])]));
    let next = 1;
    function fresh() {
      while (used.has(`r${next}`)) next++;
      const id = `r${next++}`; used.add(id); return id;
    }
    function normalize(tree) {
      if (atomic(tree)) return tree;
      if (tree.kind === 'app') return app(normalize(tree.fn), tree.args.map(normalize));
      const left = normalize(tree.left), right = normalize(tree.right);
      return tree.op === '$' ? app(left, [right]) : app(atom(tree.op), [left, right]);
    }
    return rows.flatMap(row => {
      try {
        const original = parse(row.expr), tree = normalize(original);
        if (count(tree) <= 1) return [original.kind === 'op' ? { ...row, expr: print(tree) } : row];
        const expanded = [];
        function lower(tree, finalId = null) {
          if (atomic(tree)) return tree;
          let fn = lower(tree.fn);
          tree.args.forEach((argument, i) => {
            const value = lower(argument), id = i === tree.args.length - 1 && finalId ? finalId : fresh();
            expanded.push({ id, expr: print(app(fn, [value])) });
            fn = atom(id);
          });
          return fn;
        }
        lower(tree, row.id);
        return expanded;
      } catch (_) { return [row]; } // Preserve incomplete drafts verbatim.
    });
  }
  function migrate(code) {
    if (!code.trim() || code.trim() === 'undefined') return [{ id: 'r1', expr: '' }];
    try {
      const program = parseLet(code);
      if (program) {
        const used = new Set(code.match(/[a-zA-Z_][a-zA-Z0-9_']*/g) || []);
        let n = 1; while (used.has(`r${n}`)) n++;
        return curryRows([...program.bindings, { id: `r${n}`, expr: program.final }]);
      }
      return curryRows([{ id: 'r1', expr: code }]);
    } catch (_) { return [{ id: 'r1', expr: code }]; }
  }
  function currySource(code) {
    try {
      const program = parseLet(code);
      const expressions = program ? [...program.bindings.map(row => row.expr), program.final] : [code];
      if (!expressions.some(expr => { const tree = parse(expr); return count(tree) > 1 || tree.kind === 'op'; })) return code;
      return source(migrate(code));
    } catch (_) { return code; }
  }
  function validate(rows, level) {
    const available = new Set([
      ...level.funcs.map(f => f.name.replace(/^\(|\)$/g, '')),
      ...level.lhs.split('=')[0].trim().split(/\s+/).slice(1)
    ]);
    return rows.map((row, index) => {
      let error = null;
      try {
        if (!/^[a-z][A-Za-z0-9_']*$/.test(row.id)) throw Error('Use a lowercase name for each binding.');
        if (reserved.has(row.id)) throw Error(`LNF: ${row.id} is a Haskell keyword, not a binding name.`);
        if (available.has(row.id)) throw Error('A binding cannot shadow an available name.');
        if (!row.expr.trim() || row.expr.trim() === 'undefined') throw Error('Add an expression to this row.');
        if (/\bundefined\b/.test(row.expr)) throw Error('Using undefined is not allowed.');
        const words = row.expr.match(/[a-zA-Z_][a-zA-Z0-9_']*/g) || [];
        if (words.includes('where')) throw Error('LNF: use let ... in for intermediate bindings; where is not supported.');
        if (/[\\λ]/.test(row.expr)) throw Error('LNF: use a named function from the palette or an earlier row; anonymous functions are not supported in this game.');
        if (row.expr.includes('`')) throw Error('LNF: use named functions in prefix notation, one argument per row.');
        if (words.some(word => reserved.has(word))) throw Error('LNF: each row uses named functions and arguments; nested bindings and control expressions are not supported.');
        const tree = parse(row.expr);
        if (count(tree) > 1) throw Error('One argument per row. LNF requires naming each intermediate call in a separate let row.');
        if (tree.kind === 'op') throw Error('LNF: use a parenthesized operator name in prefix notation, one argument per row.');
        if (names(tree).includes('_')) throw Error('Fill the empty input slot before using this result.');
        for (const name of names(tree)) {
          if (!available.has(name)) throw Error(/^r\d+$/.test(name)
            ? `${name} is not an earlier result. Use a row above this one.`
            : `Unknown identifier: ${name}. Choose an available function or parameter.`);
        }
      } catch (e) { error = e.message; }
      available.add(row.id);
      return error;
    });
  }
  function score(code) {
    const program = parseLet(code);
    const rows = program ? [...program.bindings, { expr: program.final }] : migrate(code);
    return rows.reduce((n, row) => n + count(parse(row.expr)), 0);
  }
  return { parse, print, count, names, call, setArgument, parseLet, source, migrate, curryRows, currySource, validate, score };
})();
