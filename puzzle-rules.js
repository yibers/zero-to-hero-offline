// Count placed cards, including function-valued arguments. Reusing a
// binding's result does not consume another card. Count unfinished drafts too,
// so a temporarily invalid expression cannot refill the palette.
function placedCardUsage(cards, code) {
  const expressions = code.replace(/\b[a-z][A-Za-z0-9_']*\s*=(?!=)/g, '');
  const counts = new Map();
  for (const token of expressions.match(/[a-zA-Z_][a-zA-Z0-9_']*|[!@#$%^&*\-+=<>?/|~:.\\]+/g) || []) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return cards.map(f => {
    const used = counts.get(f.name.replace(/^\(|\)$/g, '')) || 0, limit = f.uses ?? 1;
    return { name: f.name, limit, used, remaining: Math.max(0, limit - used) };
  });
}
function functionUsage(level, code) { return placedCardUsage(level.funcs, code); }
function parameterUsage(level, code) {
  const names = level.lhs.split('=')[0].trim().split(/\s+/).slice(1);
  return placedCardUsage(names.map(name => ({ name, uses: level.parameterUses?.[name] ?? 1 })), code);
}
function cardUsage(level, code) { return [...functionUsage(level, code), ...parameterUsage(level, code)]; }
function cardUsageIncreaseError(level, before, after) {
  const previous = cardUsage(level, before);
  const excess = cardUsage(level, after).filter((entry, i) => entry.used > entry.limit && entry.used > previous[i].used);
  return excess.length ? `No copies left: ${excess.map(f => f.name).join(', ')}. Remove a copy from the program before adding another.` : null;
}

// The one ordinary input belongs to the automatic final application. Other
// parameters (such as bd) are functions and remain available for construction.
function functionProgramContext(level) {
  const env = {}, params = {}, target = parseType(level.target), subst = {};
  for (const f of level.funcs) env[f.name.replace(/^\(|\)$/g, '')] = parseType(f.sig);
  for (const name of findVars(target)) subst[name] = { tag: 'con', name: `SKOLEM${name}` };
  let goal = applySubst(subst, target), input;
  for (const name of level.lhs.split('=')[0].trim().split(/\s+/).slice(1)) {
    params[name] = goal.from;
    if (goal.from.tag !== 'fun') input = name;
    goal = goal.to;
  }
  return { env, params, input, goal };
}
function acceptsFunction(type) {
  return type?.tag === 'fun' && !!unify(type.from,
    { tag: 'fun', from: { tag: 'var', name: '_inputFrom' }, to: { tag: 'var', name: '_inputTo' } }, {});
}
function functionRowError(expr, env, params, allowPending = false) {
  try {
    const call = RowProgram.call(expr);
    if (!call || call.args.length > 1) return 'Each row applies exactly one function to one function.';
    const head = inferExpr(RowProgram.print({ kind: 'name', name: call.name }), env, params);
    if (!acceptsFunction(head)) return 'This function takes a value. Use it as a function argument; the starting value is applied automatically at the end.';
    if (!call.args.length || call.args[0] === '_') return allowPending ? null : 'Choose one function for this input.';
    const argument = inferExpr(RowProgram.print({ kind: 'name', name: call.args[0] }), env, params);
    if (argument?.tag !== 'fun') return 'Intermediate rows accept a function, not the starting value.';
    if (inferExpr(expr, env, params)?.tag !== 'fun') return 'Each intermediate row must return a function.';
    return null;
  } catch (error) { return normalizeTypeError(error.message); }
}
// Keep the generated final application in the ordinary Haskell source, with
// metadata only to distinguish it from editable construction rows in icon mode.
// Old explicit final rows are recognized without changing their binding names.
function automaticRows(level, original) {
  const { env, params, input } = functionProgramContext(level);
  const rows = original.filter(row => !row.automatic).map(({ automaticInput, ...row }) => ({ ...row }));
  const oldFinal = original.find(row => row.automatic);
  if (!rows.length) return [{ id: original[0]?.id || 'r1', expr: '' }];
  const last = rows.at(-1), call = RowProgram.call(last.expr);
  if (call?.args.length === 1 && call.args[0] === input) {
    if (rows.length > 1 && call.name === rows.at(-2).id) {
      last.automatic = true;
      return rows;
    }
    // A directly supplied transformation (including the introductory wrap).
    last.automaticInput = true;
    return rows;
  }
  delete last.automaticInput;
  try {
    for (const row of rows.slice(0, -1)) {
      if (functionRowError(row.expr, env, params)) return rows;
      env[row.id] = inferExpr(row.expr, env, params);
    }
    if (!call) return rows;
    const type = inferExpr(last.expr, env, params);
    if (!call.args.length && type?.tag === 'fun' && !acceptsFunction(type)
      && unify(type.from, params[input], {})) {
      last.expr = RowProgram.setArgument(last.expr, 0, input);
      last.automaticInput = true;
    } else if (call.args.length === 0 && type?.from?.tag === 'var' && type.to?.tag !== 'fun'
      && unify(type.from, params[input], {})) {
      // A polymorphic wrapper accepts the concrete starting value directly.
      last.expr = RowProgram.setArgument(last.expr, 0, input);
      last.automaticInput = true;
    } else if (!functionRowError(last.expr, env, params)) {
      const used = new Set(rows.flatMap(row => [row.id, ...(row.expr.match(/[a-zA-Z_][a-zA-Z0-9_']*/g) || [])]));
      let n = 1; while (used.has(`r${n}`)) n++;
      const id = oldFinal && !used.has(oldFinal.id) ? oldFinal.id : `r${n}`;
      rows.push({ id, expr: `${last.id} ${input}`, automatic: true });
    }
  } catch (_) { /* Preserve incomplete or invalid drafts for correction. */ }
  return rows;
}

// Learning requirements are separate from type inference: the exact supplied
// copies must contribute to the final expression; unused rows cannot fill gaps.
function checkSolution(level, code) {
  try {
    const program = RowProgram.parseLet(code);
    const rows = program ? [...program.bindings, { id: finalRowName(program.bindings), expr: program.final }]
      : [{ id: 'result', expr: code }];
    const errors = RowProgram.validate(rows, level);
    const index = errors.findIndex(Boolean);
    if (index >= 0) return { ok: false, msg: `Row ${index + 1}: ${errors[index]}` };
    const excess = cardUsage(level, code).filter(f => f.used > f.limit);
    if (excess.length) return { ok: false, excess: excess.map(f => f.name),
      msg: `Too many copies: ${excess.map(f => `${f.name} (${f.used} used, ${f.limit} supplied)`).join(', ')}. Remove the extra copies.` };
    const context = functionProgramContext(level);
    if (context.input) {
      const last = RowProgram.call(rows.at(-1).expr);
      const earlierUse = rows.slice(0, -1).some(row => RowProgram.names(RowProgram.parse(row.expr)).includes(context.input));
      if (earlierUse || last?.args.length !== 1 || last.args[0] !== context.input) {
        return { ok: false, msg: `Build the transformation first, then pass ${context.input} once in the final row.` };
      }
    }
    for (const [index, row] of rows.slice(0, -1).entries()) {
      const error = functionRowError(row.expr, context.env, context.params);
      if (error) return { ok: false, msg: `Row ${index + 1}: ${error}` };
      context.env[row.id] = inferExpr(row.expr, context.env, context.params);
    }
    const typed = typeCheck(level, code);
    if (!typed.ok) return typed;
    const bindings = new Map((program?.bindings || []).map(row => [row.id, RowProgram.parse(row.expr)]));
    const used = new Map(), visited = new Set();
    function visit(tree) {
      for (const name of RowProgram.names(tree)) {
        if (bindings.has(name)) {
          if (!visited.has(name)) { visited.add(name); visit(bindings.get(name)); }
        } else used.set(name, (used.get(name) || 0) + 1);
      }
    }
    visit(RowProgram.parse(program ? program.final : code));
    const missing = level.funcs.filter(f => (used.get(f.name.replace(/^\(|\)$/g, '')) || 0) < (f.uses ?? 1)).map(f => f.name);
    if (missing.length) return { ok: false, missing,
      msg: `Use every supplied copy in the steps that produce the final result. Still needed: ${missing.join(', ')}. Unused rows do not count.` };
    return { ok: true, msg: 'Level complete! The result matches the goal and every function is used exactly as many times as supplied.' };
  } catch (error) { return { ok: false, msg: error.message }; }
}
function finalRowName(bindings) {
  const names = new Set(bindings.map(row => row.id));
  let name = 'result';
  while (names.has(name)) name += '_';
  return name;
}
