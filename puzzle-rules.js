// Learning requirements are separate from type inference: a well-typed answer
// must also use every supplied function in the path to the final expression.
function checkSolution(level, code) {
  try {
    const program = RowProgram.parseLet(code);
    const rows = program ? [...program.bindings, { id: finalRowName(program.bindings), expr: program.final }]
      : [{ id: 'result', expr: code }];
    const errors = RowProgram.validate(rows, level);
    const index = errors.findIndex(Boolean);
    if (index >= 0) return { ok: false, msg: `Row ${index + 1}: ${errors[index]}` };
    const typed = typeCheck(level, code);
    if (!typed.ok) return typed;
    const bindings = new Map((program?.bindings || []).map(row => [row.id, RowProgram.parse(row.expr)]));
    const used = new Set(), visited = new Set();
    function visit(tree) {
      for (const name of RowProgram.names(tree)) {
        if (bindings.has(name)) {
          if (!visited.has(name)) { visited.add(name); visit(bindings.get(name)); }
        } else used.add(name);
      }
    }
    visit(RowProgram.parse(program ? program.final : code));
    const missing = level.funcs.filter(f => !used.has(f.name.replace(/^\(|\)$/g, ''))).map(f => f.name);
    if (missing.length) return { ok: false, missing,
      msg: `Use every available function in the steps that produce the final result. Still needed: ${missing.join(', ')}. Unused rows do not count.` };
    return { ok: true, msg: 'Level complete! The result matches the goal and every available function is used.' };
  } catch (error) { return { ok: false, msg: error.message }; }
}
function finalRowName(bindings) {
  const names = new Set(bindings.map(row => row.id));
  let name = 'result';
  while (names.has(name)) name += '_';
  return name;
}
