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
// Each supplied function copy is a leaf in the construction tree. N copies
// need N-1 construction slots plus one fixed application to the starting value.
function rowSlotCount(level) {
  return level.funcs.reduce((count, func) => count + (func.uses ?? 1), 0);
}
function generatedUsage(rows) {
  return rows.slice(0, -1).map(row => {
    const used = rows.reduce((count, later) => {
      try { return count + RowProgram.names(RowProgram.parse(later.expr)).filter(name => name === row.id).length; }
      catch (_) { return count; }
    }, 0);
    return { name: row.id, limit: 1, used, remaining: Math.max(0, 1 - used) };
  });
}
function generatedUsageError(rows, requireAll = false) {
  const bad = generatedUsage(rows).find(entry => entry.used > 1 || requireAll && entry.used !== 1);
  return bad ? `Use generated function ${bad.name} exactly once; it is used ${bad.used} times.` : null;
}
function automaticRows(level, original) {
  const count = rowSlotCount(level), { env, params, input } = functionProgramContext(level);
  const rows = original.map(({ automaticInput, ...row }) => ({ ...row }));
  const last = rows.at(-1), call = last && RowProgram.call(last.expr);
  let final = rows.find(row => row.automatic);
  let construction = rows.filter(row => !row.automatic);
  // Recognize the final expression in saved/text programs without renaming it.
  if (!final && rows.length > 1 && (last.expr.trim() === '_' ||
      call?.args.length === 1 && call.args[0] === input && call.name === rows.at(-2).id)) {
    final = construction.pop();
  }
  const used = new Set(rows.flatMap(row => [row.id, ...(row.expr.match(/[a-zA-Z_][a-zA-Z0-9_']*/g) || [])]));
  function fresh() { let n = 1; while (used.has(`r${n}`)) n++; const id = `r${n}`; used.add(id); return { id, expr: '' }; }
  if (count === 1) {
    const row = construction[0] || final || fresh(), single = RowProgram.call(row.expr);
    if (single && !single.args.length) row.expr = RowProgram.setArgument(row.expr, 0, input);
    if (RowProgram.call(row.expr)?.args[0] === input) row.automaticInput = true;
    return [row];
  }
  construction = construction.slice(0, count - 1);
  while (construction.length < count - 1) construction.push(fresh());
  final = { ...(final || fresh()), expr: '', automatic: true };
  try {
    // Until every construction slot is complete, the final row stays a goal
    // preview and does not consume the latest generated function from the top.
    for (const row of construction) {
      if (functionRowError(row.expr, env, params)) return [...construction, final];
      env[row.id] = inferExpr(row.expr, env, params);
    }
    if (!generatedUsageError([...construction, final])) final.expr = `${construction.at(-1).id} ${input}`;
  } catch (_) { /* Incomplete/invalid steps stay in their original slots. */ }
  return [...construction, final];
}

// Clearing a producer also clears consumers, but never removes or renumbers a
// slot. Returning cards is derived from the resulting program, not a counter.
function clearedRows(rows, index, inputOnly = false) {
  const next = rows.map(row => ({ ...row })), affected = new Set([rows[index].id]);
  for (const row of next.slice(index + 1)) {
    const names = row.expr.match(/[a-zA-Z_][a-zA-Z0-9_']*/g) || [];
    if (names.some(name => affected.has(name))) affected.add(row.id);
  }
  for (const [i, row] of next.entries()) if (affected.has(row.id)) {
    row.expr = i === index && inputOnly ? RowProgram.setArgument(row.expr, 0, null) : '';
  }
  return next;
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
    const generatedError = generatedUsageError(rows, true);
    if (generatedError) return { ok: false, msg: generatedError };
    return { ok: true, msg: 'Level complete! The result matches the goal and every function is used exactly as many times as supplied.' };
  } catch (error) { return { ok: false, msg: error.message }; }
}
function finalRowName(bindings) {
  const names = new Set(bindings.map(row => row.id));
  let name = 'result';
  while (names.has(name)) name += '_';
  return name;
}
