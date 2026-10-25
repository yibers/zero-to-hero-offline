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
    if (level.finalInput) {
      const last = RowProgram.call(rows.at(-1).expr);
      const earlierUse = rows.slice(0, -1).some(row => RowProgram.names(RowProgram.parse(row.expr)).includes(level.finalInput));
      if (earlierUse || last?.args.length !== 1 || last.args[0] !== level.finalInput) {
        return { ok: false, msg: `Build the transformation first, then pass ${level.finalInput} once in the final row.` };
      }
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
