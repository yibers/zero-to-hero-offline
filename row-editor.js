// Multi-row editing, result references and shared mouse/touch interactions.
const rowHistory = new Map();
let rowDiagnostics = [];
let rowEditorCleanup = null;
const preparedRowPrograms = new WeakSet();
function clearRowHistory() { rowHistory.clear(); }
function getRows() {
  if (!rowPrograms[currentLevel]) rowPrograms[currentLevel] = RowProgram.migrate(textDrafts[currentLevel] ?? getEditorContent());
  if (!preparedRowPrograms.has(rowPrograms[currentLevel])) {
    const before = RowProgram.source(rowPrograms[currentLevel]);
    rowPrograms[currentLevel] = automaticRows(LEVELS[currentLevel], rowPrograms[currentLevel]);
    preparedRowPrograms.add(rowPrograms[currentLevel]);
    const after = RowProgram.source(rowPrograms[currentLevel]);
    const overflow = rowPrograms[currentLevel].length && RowProgram.migrate(before).length > rowSlotCount(LEVELS[currentLevel]);
    if (overflow && textDrafts[currentLevel] === undefined) textDrafts[currentLevel] = before;
    if (!overflow && before !== after && textDrafts[currentLevel] !== undefined && rowPrograms[currentLevel].at(-1).expr.trim()) {
      delete textDrafts[currentLevel];
      textHistory.delete(currentLevel);
      editorContents[currentLevel] = LEVELS[currentLevel].lhs.trim() + ' ' + after;
      saveProgress();
    }
  }
  return rowPrograms[currentLevel];
}
function rowSnapshot() { return JSON.stringify(getRows()); }
function rememberRows() {
  const history = rowHistory.get(currentLevel) || { undo: [], redo: [] };
  const snapshot = rowSnapshot();
  if (history.undo.at(-1) !== snapshot) history.undo.push(snapshot);
  if (history.undo.length > 100) history.undo.shift();
  history.redo = [];
  rowHistory.set(currentLevel, history);
}
function persistRows() {
  delete textDrafts[currentLevel];
  textHistory.delete(currentLevel);
  editorContents[currentLevel] = LEVELS[currentLevel].lhs.trim() + ' ' + RowProgram.source(getRows());
  saveProgress();
}
function getRowError() {
  if (!iconMode) return getTextError();
  const errors = RowProgram.validate(getRows(), LEVELS[currentLevel]);
  const index = errors.findIndex(Boolean);
  return index < 0 ? null : `Row ${index + 1}: ${errors[index]}`;
}
function rowSymbol(name, width, diagram = null, inputsOnly = false) {
  if (iconMode && diagram) {
    const label = name + ': ' + rowTypeSignatures([diagram.type], diagram.variables)[0];
    const picture = diagram.arity === undefined
      ? renderSemanticType(diagram.type, label, diagram.variables, diagram.template, diagram.isValue)
      : renderSemanticTransformation(diagram.type, label, diagram.arity, diagram.variables, inputsOnly, diagram.template);
    const reference = /^r\d+$/.test(name) ? ' row-ref rendered-ref' : '';
    return `<span class="icon-sym semantic-icon${reference}" title="${escHtml(label)}">${picture}</span>`;
  }
  const reference = getRows().findIndex(row => row.id === name);
  if (reference >= 0 || /^r\d+$/.test(name)) {
    const diagnostic = rowDiagnostics[reference];
    if (iconMode) {
      const label = name + ': ' + (diagnostic?.signature || 'result unavailable');
      const picture = diagnostic?.signature ? renderSemanticType(diagnostic.diagram.type, label, diagnostic.diagram.variables, null, true)
        : `<svg viewBox="0 0 40 40" role="img" aria-label="${escHtml(label)}"><rect x="6" y="6" width="28" height="28" rx="5" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="4 3"/></svg>`;
      return `<span class="icon-sym row-ref rendered-ref" title="${escHtml(label)}"${width ? ` style="width:${width}ch"` : ''}>${picture}</span>`;
    }
    return `<span class="icon-sym row-ref" title="${escHtml(name)}"${width ? ` style="width:${width}ch"` : ''}><span>${escHtml(name)}</span></span>`;
  }
  const functionIcon = iconMode && FUNCTION_CARD_ICONS[LEVELS[currentLevel].level]?.[name];
  if (functionIcon) return `<span class="icon-sym semantic-icon horizontal-function" title="${escHtml(name)}"${width ? ` style="width:${width}ch"` : ''}>${functionIcon}</span>`;
  return symbolDisplay(name, null, width);
}
function rowTypeSignatures(types, variables = null) {
  if (variables) {
    const markers = new Map(variables);
    function named(type) {
      if (type.tag === 'var' && markers.has(type.name)) {
        const marker = markers.get(type.name);
        return { ...type, name: marker < 26 ? String.fromCharCode(97 + marker) : `t${marker + 1}` };
      }
      if (type.tag === 'fun') return { ...type, from: named(type.from), to: named(type.to) };
      if (type.tag === 'app') return { ...type, con: named(type.con), arg: named(type.arg) };
      return type;
    }
    return types.map(type => typeToString(named(type)).replace(/SKOLEM/g, ''));
  }
  const signatures = types.map(type => typeToString(type).replace(/SKOLEM/g, ''));
  const used = new Set(signatures.join(' ').match(/\b[a-z]\b/g) || []), renamed = {};
  let char = 97;
  return signatures.map(signature => signature.replace(/_t\d+/g, variable => {
    if (!renamed[variable]) {
      while (used.has(String.fromCharCode(char))) char++;
      renamed[variable] = String.fromCharCode(char++); used.add(renamed[variable]);
    }
    return renamed[variable];
  }));
}
// Freshen a type for unification while retaining its display identities. This
// metadata stays out of the checker and never changes argument/tuple order.
function freshDiagram(name, env, params, diagrams) {
  const original = env[name] || params[name];
  if (!original) throw Error('Unknown identifier: ' + name);
  const mapping = {}, type = env[name] ? freshen(original, mapping) : original;
  const live = findVars(original);
  const variables = semanticVariables(original, (diagrams[name]?.variables || []).filter(([name]) => live.has(name)));
  return { type, variables: variables.map(([name, shape]) => [mapping[name]?.name || name, shape]) };
}
function callVariables(head, actuals, subst) {
  const variables = new Map(), occupied = new Set();
  function assign(name, preferred) {
    if (variables.has(name)) return;
    let marker = preferred;
    if (occupied.has(marker)) { marker = 0; while (occupied.has(marker)) marker++; }
    variables.set(name, marker); occupied.add(marker);
  }
  // Prefer the function actually supplied. Its leaves should look the same as
  // the card the player dragged. A remaining independent type takes a free
  // shape, rather than renaming all the supplied function's types.
  for (const diagram of [...actuals.filter(Boolean), head]) {
    for (const [name, marker] of diagram.variables) {
      const resolved = applySubst(subst, { tag: 'var', name });
      if (resolved.tag === 'var') assign(resolved.name, marker);
    }
  }
  // Generic input templates can retain aliases of the same unified variable.
  // A slot assigned a whole compound type needs its own distinct outer shape.
  for (const diagram of [head, ...actuals.filter(Boolean)]) {
    for (const [name, marker] of diagram.variables) {
      const resolved = applySubst(subst, { tag: 'var', name });
      if (resolved.tag === 'var') variables.set(name, variables.get(resolved.name));
      else assign(name, marker);
    }
  }
  return [...variables];
}
function diagnoseCall(code, env, params, diagrams = {}) {
  const model = RowProgram.call(code);
  if (!model) return null;
  try {
    const head = freshDiagram(model.name, env, params, diagrams), headType = head.type;
    let type = headType;
    const inputs = [], actuals = [], actualDiagrams = [];
    if (type?.tag === 'fun') {
      inputs.push(type.from); type = type.to;
    }
    if (!inputs.length || model.args.length > inputs.length) return null;
    let subst = {};
    model.args.forEach((name, i) => {
      if (name === '_') return;
      try {
        actualDiagrams[i] = freshDiagram(name, env, params, diagrams);
        const actual = actualDiagrams[i].type;
        actuals[i] = actual;
        subst = unify(inputs[i], actual, subst) || subst;
      } catch (_) { /* Keep editable slots even when an input is invalid. */ }
    });
    const variables = callVariables(head, actualDiagrams, subst);
    let remaining = headType;
    for (const _ of model.args) remaining = remaining.to;
    return { ...model, inputs: rowTypeSignatures(inputs.map(input => applySubst(subst, input)), variables),
      inputDiagrams: inputs.map(input => ({ type: applySubst(subst, input), variables, template: input })),
      // Show only the output, specializing it as each supplied input constrains
      // the template. Known output values are filled even in previews; unfilled
      // inputs leave the remaining placeholders generic.
      expected: { type: applySubst(subst, type), variables, template: type, isValue: true },
      diagram: { type: applySubst(subst, headType), variables, arity: inputs.length, template: headType },
      arguments: actuals.map((actual, i) => actual && ({ type: applySubst(subst, actual), variables, template: inputs[i], isValue: true })),
      result: { type: applySubst(subst, remaining), variables } };
  } catch (_) { return null; }
}
function diagnoseRows() {
  const level = LEVELS[currentLevel], rows = getRows();
  const errors = RowProgram.validate(rows, level);
  const env = {}, params = {}, diagrams = {};
  for (const f of level.funcs) env[f.name.replace(/^\(|\)$/g, '')] = parseType(f.sig);
  const target = parseType(level.target), subst = {};
  for (const name of findVars(target)) subst[name] = { tag: 'con', name: `SKOLEM${name}` };
  let remaining = applySubst(subst, target);
  for (const name of level.lhs.split('=')[0].trim().split(/\s+/).slice(1)) {
    params[name] = remaining.from; remaining = remaining.to;
  }
  substCounter = 0;
  rowDiagnostics = rows.map((row, index) => {
    if (!row.expr.trim()) return { error: row.automatic ? 'Finish the transformation first.' : 'Choose a function.' };
    const call = diagnoseCall(row.expr, env, params, diagrams);
    try {
      if (errors[index]) throw Error(errors[index]);
      if (!row.automatic && !row.automaticInput) {
        const error = functionRowError(row.expr, env, params);
        if (error) throw Error(error);
      }
      const type = inferExpr(row.expr, env, params);
      if (!type) throw Error('Incomplete expression.');
      // Keep the exact variable identities paired with this result's diagram.
      // inferExpr above still validates the expression through the real checker.
      env[row.id] = call?.result.type || type;
      diagrams[row.id] = call?.result || { type };
      return { type, signature: rowTypeSignatures([env[row.id]], diagrams[row.id].variables)[0], diagram: diagrams[row.id],
        expected: call?.expected || { type, isValue: true }, call };
    } catch (e) {
      return { error: errors[index] || normalizeTypeError(e.message), expected: call?.expected, call };
    }
  });
}

function availableGeneratedFunctions() {
  const rows = getRows(), stock = generatedUsage(rows);
  return stock.flatMap((entry, index) => {
    const diagnostic = rowDiagnostics[index];
    return entry.remaining && diagnostic && !diagnostic.error && diagnostic.type?.tag === 'fun'
      ? [{ ...entry, index, signature: diagnostic.signature, diagram: diagnostic.diagram }] : [];
  });
}

// One placement changes one existing slot. Keeping this independent from DOM
// events makes pointer, keyboard and tap interactions follow identical rules.
function placeInFixedRow(level, rows, index, name, inputSlot = false) {
  if (index < 0 || index >= rows.length || rows[index].automatic) return { error: 'The final row runs automatically.' };
  const bare = name.replace(/^\((.+)\)$/, '$1'), context = functionProgramContext(level);
  const producer = rows.findIndex(row => row.id === bare);
  if (producer >= index) return { error: 'Use a generated function in a row below its producer.' };
  const next = rows.map(row => ({ ...row }));
  if (inputSlot) {
    const call = RowProgram.call(next[index].expr);
    if (!call || next[index].automaticInput) return { error: 'Choose a function for this row first.' };
    next[index].expr = RowProgram.setArgument(next[index].expr, 0, name);
  } else {
    if (next[index].expr.trim()) return { error: 'Clear this row before placing another function.' };
    next[index].expr = RowProgram.print({ kind: 'name', name: bare });
  }
  let prepared = automaticRows(level, next);
  const stockError = cardUsageIncreaseError(level, RowProgram.source(rows), RowProgram.source(prepared))
    || generatedUsageError(prepared);
  if (stockError) return { error: stockError };
  for (const [i, row] of prepared.entries()) {
    if (!row.expr.trim()) continue;
    if (i === index && !row.automaticInput) {
      const error = functionRowError(row.expr, context.env, context.params, true);
      if (error) return { error };
    }
    try { context.env[row.id] = inferExpr(row.expr, context.env, context.params); }
    catch (error) { if (i === index) return { error: normalizeTypeError(error.message) }; }
  }
  return { rows: prepared };
}

// Continue only the step the player just completed. The inserted head stays
// attached to its producer; clearing that producer removes the dependent steps.
function placeWithContinuation(level, rows, index, name, inputSlot = false) {
  const placed = placeInFixedRow(level, rows, index, name, inputSlot);
  if (placed.error) return placed;
  const next = placed.rows[index + 1], row = placed.rows[index];
  const result = { ...placed, activeRow: index };
  if (row.automatic || row.automaticInput || !next || next.automatic || next.expr.trim()) return result;
  if (generatedUsage(placed.rows).find(entry => entry.name === row.id)?.used) return result;
  const { env, params } = functionProgramContext(level);
  for (const earlier of placed.rows.slice(0, index)) {
    try {
      if (!functionRowError(earlier.expr, env, params)) env[earlier.id] = inferExpr(earlier.expr, env, params);
    } catch (_) { /* An unrelated unfinished branch does not block this one. */ }
  }
  try {
    if (functionRowError(row.expr, env, params) || !isRowCombinator(inferExpr(row.expr, env, params))) return result;
    const continued = placeInFixedRow(level, placed.rows, index + 1, row.id);
    return continued.error ? result : { ...continued, activeRow: index + 1 };
  } catch (_) { return result; }
}

function mountRowEditor() {
  rowEditorCleanup?.();
  const controller = new AbortController(), options = { signal: controller.signal };
  const container = document.getElementById('program-rows');
  if (!container) return;
  const level = LEVELS[currentLevel], context = functionProgramContext(level);
  const fixedGoalType = fixedSemanticType(context.goal), goalSignature = typeToString(context.goal).replace(/SKOLEM/g, '');
  const listen = (node, event, fn, extra = {}) => node.addEventListener(event, fn, { ...options, ...extra });
  const notice = text => { document.getElementById('row-notice').textContent = text; };
  let drag = null, ghost = null, nativeName = '', suppressClick = false, scrollFrame = null, lastPoint = null, closeDialog = null;
  const sections = () => [...container.querySelectorAll('.program-row')];
  const isFinal = index => index === rowSlotCount(level) - 1;
  const editable = index => !getRows()[index]?.automatic;
  function activate(index) {
    activeRow = Math.max(0, Math.min(index, getRows().length - 1));
    sections().forEach((row, i) => row.classList.toggle('active-row', i === activeRow));
  }
  function paint() {
    diagnoseRows();
    const rows = getRows(), solved = checkSolution(level, RowProgram.source(rows)).ok;
    sections().forEach((section, index) => {
      const row = rows[index], diagnostic = rowDiagnostics[index], call = diagnostic.call;
      const linked = !!continuationSource(rows, index);
      section.classList.toggle('continuation-row', linked);
      section.classList.toggle('continuation-source', !!continuationSource(rows, index + 1));
      section.querySelector('.row-dependency').hidden = !linked;
      const final = isFinal(index), automatic = final && !!(row.automatic || row.automaticInput);
      const holder = section.querySelector('.function-block'), empty = section.querySelector('.empty-row-drop');
      const feedback = section.querySelector('.row-feedback'), goal = section.querySelector('.goal-output');
      empty.hidden = !!row.expr.trim() || !!row.automatic;
      if (final && !row.automatic) empty.innerHTML = `<span class="automatic-input" role="img" aria-label="Starting value ${escHtml(context.input)} will be applied automatically">${symbolDisplay(context.input)}</span><span aria-hidden="true">＋</span>`;
      holder.hidden = !row.expr.trim() && !row.automatic;
      holder.classList.toggle('function-head', !!row.expr.trim() && !row.automatic && !linked);
      holder.classList.toggle('linked-head', linked);
      holder.classList.toggle('automatic-pending', !!row.automatic && !row.expr.trim());
      holder.tabIndex = row.expr.trim() && !row.automatic && !linked ? 0 : -1;
      holder.title = row.automatic ? 'The starting value is applied after the whole transformation is ready.'
        : linked ? 'Continues the previous row. Change the previous row to change this function.'
        : 'Tap the blue border to return this row’s functions to the top.';
      holder.setAttribute('aria-label', call ? `Function ${call.name} in row ${index + 1}` : 'Automatic final application');
      if (row.automatic && !call) {
        holder.innerHTML = `<span class="automatic-input" role="img" aria-label="Starting value ${escHtml(context.input)} will be applied automatically">${symbolDisplay(context.input)}</span>`;
      } else if (call) {
        holder.innerHTML = '<div class="input-slots">' + call.inputs.map((_, slot) => {
          const name = call.args[slot], filled = name && name !== '_';
          const picture = filled ? rowSymbol(name, null, call.arguments[slot])
            : rowSymbol(`Input of ${call.name}`, null, call.inputDiagrams[slot]);
          return automatic
            ? `<span class="automatic-input" role="img" aria-label="Starting value ${escHtml(name)} is applied automatically">${picture}</span>`
            : `<button type="button" class="argument-slot${filled ? ' filled' : ''}" data-row="${index}" aria-label="Input 1 of ${escHtml(call.name)}: ${filled ? escHtml(name) : 'empty'}" title="${filled ? 'Tap to clear this input' : 'Drag a function here from the top, or select this input and tap a card'}"><span class="input-picture">${picture}</span></button>`;
        }).join('') + '</div>';
      } else {
        // Retain malformed saved drafts for repair in text mode, without an
        // icon-mode text cursor or a hidden drag source inside the row.
        holder.innerHTML = `<span class="invalid-row-draft">${escHtml(row.expr)}</span>`;
      }
      const expected = diagnostic.expected;
      const picture = expected ? renderSemanticType(expected.type,
        `${diagnostic.error ? 'Expected result' : 'Result'} ${row.id}: ${rowTypeSignatures([expected.type], expected.variables)[0]}`,
        expected.variables, expected.template, expected.isValue) : '';
      feedback.innerHTML = picture ? `<div class="${diagnostic.error ? 'row-result-preview' : 'row-result'}" role="img" aria-label="${automatic ? 'Automatic result' : 'Result ' + row.id}: ${escHtml(diagnostic.signature || 'pending')}">${picture}</div>` : '';
      const awaitingInput = call && !call.args.length;
      section.querySelector('.row-error').textContent = row.expr.trim() && !automatic && !awaitingInput ? diagnostic.error || '' : '';
      section.classList.toggle('row-invalid', !!row.expr.trim() && !!diagnostic.error && !awaitingInput);
      goal.replaceChildren();
      if (final) {
        if (solved) {
          const result = feedback.querySelector('.row-result');
          result.classList.add('puzzle-goal', 'goal-reached');
          result.insertAdjacentHTML('beforeend', '<span class="goal-badge" aria-label="Goal reached">✓</span>');
        } else {
          if (diagnostic.error || diagnostic.type?.tag === 'fun') feedback.replaceChildren();
          goal.innerHTML = `<div class="goal-picture puzzle-goal" title="${escHtml('Goal: ' + goalSignature)}">${renderSemanticType(fixedGoalType, 'Goal: ' + goalSignature, [], null, true)}<svg class="goal-badge" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 14V2m0 0h10v7H3" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></div>`;
        }
      }
      goal.hidden = !goal.childElementCount;
    });
    activate(activeRow);
    fitSemanticDiagrams();
    const history = rowHistory.get(currentLevel);
    document.getElementById('undo-rows').disabled = !history?.undo.length;
    document.getElementById('redo-rows').disabled = !history?.redo.length;
    clearTimeout(liveCheckTimer);
    runLiveCheck();
  }
  function commit(rows, index = activeRow) {
    rememberRows();
    rowPrograms[currentLevel] = automaticRows(level, rows);
    preparedRowPrograms.add(rowPrograms[currentLevel]);
    activeRow = index;
    persistRows(); notice(''); paint();
  }
  function place(name, index, inputSlot = false) {
    const result = placeWithContinuation(level, getRows(), index, name, inputSlot);
    if (result.error) { notice(result.error); return; }
    commit(result.rows, result.activeRow);
  }
  function clearStep(index, inputOnly = false) {
    const rows = getRows();
    if (!rows[index].expr.trim() || rows[index].automatic) return;
    if (!inputOnly && continuationSource(rows, index)) return;
    const next = clearedRows(rows, index, inputOnly);
    const affected = rows.map((row, i) => ({ ...row, index: i }))
      .filter(row => !row.automatic && row.expr !== next[row.index].expr);
    const snapshot = rowSnapshot();
    const apply = () => { if (rowSnapshot() === snapshot) commit(next, index); };
    if (affected.length === 1) { apply(); return; }
    closeDialog?.();
    const dialog = document.createElement('dialog'); dialog.className = 'connection-picker row-delete-dialog';
    dialog.setAttribute('aria-label', 'Return functions to the palette');
    dialog.innerHTML = `<h2>Clear ${inputOnly ? 'input' : 'row'}?</h2><p>${affected.length > 1 ? `${affected.length} steps will be cleared, including dependent steps.` : 'This step will be cleared.'} Their cards return to the top. The row slots stay in place.</p>
      <ol class="delete-preview-list">${affected.map(row => `<li class="delete-preview-item">Row ${row.index + 1}: <code>${escHtml(row.expr)}</code></li>`).join('')}</ol>
      <div class="delete-actions"><button type="button" class="delete-cancel">Cancel</button><button type="button" class="delete-confirm">Clear</button></div>`;
    affected.forEach(row => sections()[row.index].classList.add('delete-preview'));
    const close = () => { sections().forEach(row => row.classList.remove('delete-preview')); dialog.close(); dialog.remove(); closeDialog = null; };
    closeDialog = close;
    dialog.querySelector('.delete-cancel').onclick = close;
    dialog.querySelector('.delete-confirm').onclick = () => { close(); apply(); };
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    document.body.append(dialog); dialog.showModal(); dialog.querySelector('.delete-cancel').focus();
  }
  function historyMove(direction) {
    const history = rowHistory.get(currentLevel), from = history?.[direction];
    if (!from?.length) return;
    history[direction === 'undo' ? 'redo' : 'undo'].push(rowSnapshot());
    rowPrograms[currentLevel] = automaticRows(level, JSON.parse(from.pop()));
    preparedRowPrograms.add(rowPrograms[currentLevel]);
    persistRows(); notice(''); paint();
  }
  function placeCard(name, combinator = true) {
    const rows = getRows(), call = RowProgram.call(rows[activeRow]?.expr || '');
    if (call && !call.args.length && editable(activeRow)) { place(name, activeRow, true); return; }
    if (!combinator && rowSlotCount(level) > 1) {
      notice('Select an empty input inside a combinator, then tap this transformation.'); return;
    }
    const producer = rows.findIndex(row => row.id === name);
    const at = !rows[activeRow]?.expr.trim() && editable(activeRow) && activeRow > producer ? activeRow
      : rows.findIndex((row, i) => i > producer && !row.expr.trim() && !row.automatic);
    if (at < 0) { notice('Clear an existing step to return its functions to the top.'); return; }
    place(name, at);
  }
  function rowAt(point) {
    const node = document.elementFromPoint(point.clientX, point.clientY)?.closest('.program-row');
    return node && container.contains(node) ? Number(node.dataset.row) : null;
  }
  function clearIntent() {
    container.querySelectorAll('.drag-over, .slot-target').forEach(node => node.classList.remove('drag-over', 'slot-target'));
  }
  function showIntent(point) {
    clearIntent();
    const index = rowAt(point);
    if (index === null || !editable(index)) return;
    sections()[index].classList.add('drag-over');
    const slot = document.elementFromPoint(point.clientX, point.clientY)?.closest('.argument-slot');
    slot?.classList.add('slot-target');
  }
  function drop(name, point) {
    const index = rowAt(point);
    if (index === null || !editable(index)) return;
    const row = getRows()[index], call = RowProgram.call(row.expr);
    const slot = document.elementFromPoint(point.clientX, point.clientY)?.closest('.argument-slot');
    // The complete function rectangle accepts its one missing input, avoiding
    // tiny hit targets. Filled inputs remain replaceable at their own target.
    place(name, index, !!slot || !!call && !call.args.length);
  }
  function moveGhost(point) {
    ghost.style.left = point.clientX + 'px'; ghost.style.top = point.clientY + 'px';
  }
  let edgeSince = 0, edgeDirection = 0, lastScroll = 0;
  function autoScroll(time) {
    if (!drag?.moved || !lastPoint) return;
    const bounds = container.getBoundingClientRect();
    const direction = lastPoint.clientX >= bounds.left && lastPoint.clientX <= bounds.right
      ? lastPoint.clientY < bounds.top + 24 ? -1 : lastPoint.clientY > bounds.bottom - 24 ? 1 : 0 : 0;
    if (direction !== edgeDirection) { edgeSince = time; edgeDirection = direction; }
    if (direction && time - edgeSince > 250 && time - lastScroll > 30) {
      container.scrollTop += direction * 12; lastScroll = time; showIntent(lastPoint);
    }
    scrollFrame = requestAnimationFrame(autoScroll);
  }
  function cleanupDrag() {
    if (scrollFrame) cancelAnimationFrame(scrollFrame);
    scrollFrame = null; lastPoint = null; edgeDirection = 0;
    ghost?.remove(); ghost = null;
    if (drag?.card) { drag.card.draggable = true; drag.card.classList.remove('dragging'); }
    drag = null; clearIntent();
  }
  function paletteCard(target) {
    const card = target.closest('#function-palette [data-func-name]');
    return card && Number(card.dataset.remaining) > 0 ? card : null;
  }
  listen(container, 'click', event => {
    const section = event.target.closest('.program-row');
    if (!section || suppressClick) return;
    const index = Number(section.dataset.row); activate(index);
    const slot = event.target.closest('.argument-slot');
    if (slot) { if (slot.classList.contains('filled')) clearStep(index, true); return; }
    if (event.target.closest('.function-head')) clearStep(index);
  });
  listen(container, 'keydown', event => {
    if ((event.ctrlKey || event.metaKey) && /^(z|y)$/i.test(event.key)) {
      event.preventDefault(); historyMove(event.key.toLowerCase() === 'y' || event.shiftKey ? 'redo' : 'undo'); return;
    }
    if (event.target.matches('.function-head') && ['Enter', ' ', 'Delete', 'Backspace'].includes(event.key)) {
      event.preventDefault(); clearStep(Number(event.target.closest('.program-row').dataset.row));
    }
  });
  listen(document.getElementById('undo-rows'), 'click', () => historyMove('undo'));
  listen(document.getElementById('redo-rows'), 'click', () => historyMove('redo'));
  listen(document, 'click', event => { const card = paletteCard(event.target); if (card && !suppressClick) placeCard(card.dataset.funcName, card.dataset.cardKind === 'combinator'); });
  listen(document, 'keydown', event => {
    const card = paletteCard(event.target);
    if (card && ['Enter', ' '].includes(event.key)) { event.preventDefault(); placeCard(card.dataset.funcName, card.dataset.cardKind === 'combinator'); }
  });
  listen(document, 'dragstart', event => {
    const card = paletteCard(event.target);
    if (!card) { if (container.contains(event.target)) event.preventDefault(); return; }
    if (card.dataset.cardKind !== 'combinator') { event.preventDefault(); return; }
    nativeName = card.dataset.funcName;
    event.dataTransfer.setData('text/plain', nativeName);
  });
  listen(container, 'dragover', event => { if (nativeName) { event.preventDefault(); showIntent(event); } });
  listen(container, 'drop', event => {
    if (!nativeName) return;
    event.preventDefault(); drop(nativeName, event); nativeName = ''; cleanupDrag();
  });
  listen(document, 'dragend', () => { nativeName = ''; cleanupDrag(); });
  listen(document, 'pointerdown', event => {
    if (event.button !== 0 || event.target.closest('dialog')) return;
    const card = paletteCard(event.target);
    if (!card || card.dataset.cardKind !== 'combinator') return;
    if (drag) cleanupDrag();
    event.preventDefault(); card.draggable = false;
    drag = { card, name: card.dataset.funcName, id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, snapshot: rowSnapshot() };
    ghost = document.createElement('div'); ghost.className = 'drag-ghost row-drag-ghost'; ghost.id = 'touch-drag-ghost';
    ghost.innerHTML = card.querySelector('svg.semantic-diagram')?.outerHTML || escHtml(card.textContent);
    document.body.append(ghost); fitSemanticDiagrams(ghost); moveGhost(event); card.classList.add('dragging');
  });
  listen(document, 'touchstart', event => { if (drag && event.cancelable) event.preventDefault(); }, { passive: false });
  listen(document, 'pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    if (rowSnapshot() !== drag.snapshot) { cleanupDrag(); return; }
    event.preventDefault();
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 5) drag.moved = true;
    moveGhost(event);
    if (drag.moved) {
      lastPoint = { clientX: event.clientX, clientY: event.clientY };
      showIntent(event); if (!scrollFrame) scrollFrame = requestAnimationFrame(autoScroll);
    }
  }, { passive: false });
  listen(document, 'pointerup', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const state = drag;
    suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
    if (state.snapshot === rowSnapshot()) {
      if (state.moved) drop(state.name, event); else placeCard(state.name);
    }
    cleanupDrag();
  });
  listen(document, 'pointercancel', cleanupDrag);
  listen(window, 'blur', cleanupDrag);
  listen(document, 'visibilitychange', () => { if (document.hidden) cleanupDrag(); });
  listen(document, 'contextmenu', event => { if (drag) event.preventDefault(); });
  const observer = new ResizeObserver(() => fitSemanticDiagrams());
  document.querySelectorAll('.left-panel, .right-panel').forEach(panel => observer.observe(panel));
  rowEditorCleanup = () => { observer.disconnect(); closeDialog?.(); cleanupDrag(); controller.abort(); rowEditorCleanup = null; };
  // Build exactly once on mounting. Edits repaint content inside these slots.
  container.innerHTML = getRows().map((row, index) => `<section class="program-row${isFinal(index) ? ' final-row automatic-final-row' : ''}" data-row="${index}" tabindex="-1" aria-label="Row ${index + 1}"><div class="row-flow"><span class="row-dependency" role="img" aria-label="Continues the previous row; function is fixed" title="Continues the previous row. Change the previous row to change this function." hidden><svg viewBox="0 0 24 36" width="20" height="30" aria-hidden="true"><path d="M12 1v12m-4-4 4 4 4-4M8 24v-3a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><rect x="5" y="24" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/></svg></span><div class="row-call structured-call"><button type="button" class="empty-row-drop" aria-label="Function for row ${index + 1}"><span aria-hidden="true">＋</span></button><div class="function-block" role="group" hidden></div></div><div class="row-feedback" aria-live="polite"></div><div class="goal-output" hidden></div><div class="row-error" aria-live="polite"></div></div></section>`).join('');
  if (textDrafts[currentLevel] && RowProgram.migrate(textDrafts[currentLevel]).length > rowSlotCount(level)) notice('Your saved program has extra steps. Text mode keeps the full draft for review.');
  paint();
}
