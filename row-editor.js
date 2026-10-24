// Multi-row editing, result references and shared mouse/touch interactions.
const rowHistory = new Map();
let rowDiagnostics = [];
let rowEditorCleanup = null;
function clearRowHistory() { rowHistory.clear(); }
function getRows() {
  if (!rowPrograms[currentLevel]) rowPrograms[currentLevel] = RowProgram.migrate(textDrafts[currentLevel] ?? getEditorContent());
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
    const label = name + ': ' + rowTypeSignatures([diagram.type])[0];
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
function rowTypeSignatures(types) {
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
function diagnoseCall(code, env, params, compositionLimit = null) {
  const model = RowProgram.call(code);
  if (!model) return null;
  try {
    const headType = inferExpr(RowProgram.print({ kind: 'name', name: model.name }), env, params);
    let type = headType;
    const inputs = [], actuals = [];
    while (type?.tag === 'fun' && (compositionLimit === null || inputs.length < compositionLimit)) {
      inputs.push(type.from); type = type.to;
    }
    if (!inputs.length || model.args.length > inputs.length) return null;
    let subst = {};
    model.args.forEach((name, i) => {
      if (name === '_') return;
      try {
        const actual = inferExpr(RowProgram.print({ kind: 'name', name }), env, params);
        actuals[i] = actual;
        subst = unify(inputs[i], actual, subst) || subst;
      } catch (_) { /* Keep editable slots even when an input is invalid. */ }
    });
    // Keep the original generic shapes around their assigned types. Templates
    // are display metadata only; inference continues to use the resolved type.
    const variableMap = new Map([...findVars(headType)].map((name, i) => [name, i]));
    for (const [name, marker] of [...variableMap]) {
      const resolved = applySubst(subst, { tag: 'var', name });
      if (resolved.tag === 'var' && !variableMap.has(resolved.name)) variableMap.set(resolved.name, marker);
    }
    for (const actual of actuals) if (actual) {
      for (const name of findVars(applySubst(subst, actual))) {
        if (!variableMap.has(name)) variableMap.set(name, Math.max(-1, ...variableMap.values()) + 1);
      }
    }
    const variables = [...variableMap];
    let remaining = headType;
    for (const _ of model.args) remaining = remaining.to;
    return { ...model, inputs: rowTypeSignatures(inputs.map(input => applySubst(subst, input))),
      inputDiagrams: inputs.map(input => ({ type: applySubst(subst, input), variables, template: input })),
      // Show only the output, specializing it as each supplied input constrains
      // the template. Unfilled inputs leave the remaining placeholders generic.
      expected: { type: applySubst(subst, type), variables, template: type },
      diagram: { type: applySubst(subst, headType), variables, arity: inputs.length, template: headType },
      arguments: actuals.map((actual, i) => actual && ({ type: applySubst(subst, actual), variables, template: inputs[i], isValue: true })),
      result: { type: applySubst(subst, remaining), variables } };
  } catch (_) { return null; }
}
function diagnoseRows() {
  const level = LEVELS[currentLevel], rows = getRows();
  const errors = RowProgram.validate(rows, level);
  const compositionLimits = RowProgram.compositionInputs(rows);
  const env = {}, params = {};
  for (const f of level.funcs) env[f.name.replace(/^\(|\)$/g, '')] = parseType(f.sig);
  const target = parseType(level.target), subst = {};
  for (const name of findVars(target)) subst[name] = { tag: 'con', name: `SKOLEM${name}` };
  let remaining = applySubst(subst, target);
  for (const name of level.lhs.split('=')[0].trim().split(/\s+/).slice(1)) {
    params[name] = remaining.from; remaining = remaining.to;
  }
  substCounter = 0;
  rowDiagnostics = rows.map((row, index) => {
    const call = diagnoseCall(row.expr, env, params, compositionLimits[index]);
    try {
      if (errors[index]) throw Error(errors[index]);
      const type = inferExpr(row.expr, env, params);
      if (!type) throw Error('Incomplete expression.');
      env[row.id] = type;
      return { type, signature: rowTypeSignatures([type])[0], diagram: call?.result || { type },
        expected: { ...(call?.expected || { type }), isValue: !call || call.args.length === call.inputs.length }, call };
    } catch (e) {
      return { error: errors[index] || normalizeTypeError(e.message), expected: call?.expected, call };
    }
  });
}
function mountRowEditor() {
  rowEditorCleanup?.();
  const controller = new AbortController(), options = { signal: controller.signal };
  const container = document.getElementById('program-rows');
  if (!container) return;
  const level = LEVELS[currentLevel];
  const funcs = new Set(level.funcs.flatMap(f => [f.name, f.name.replace(/^\(|\)$/g, '')]));
  const params = new Set(level.lhs.split('=')[0].trim().split(/\s+/).slice(1));
  let goalType = parseType(level.target);
  for (const _ of params) goalType = goalType.to;
  const goalSignature = typeToString(goalType);
  const fixedGoalType = fixedSemanticType(goalType);
  const operators = level.funcs.filter(f => isOperatorName(f.name));
  const sourceRows = new Set();
  const editors = () => [...container.querySelectorAll('textarea')];
  const listen = (el, event, fn, extra = {}) => el.addEventListener(event, fn, { ...options, ...extra });
  const notice = text => { document.getElementById('row-notice').textContent = text; };
  let drag = null, ghost = null, nativeName = '', suppressClick = false, scrollFrame = null, lastPoint = null;
  let lastScrollTime = 0, scrollEdge = null, closeDeletePreview = null, readyRowState = null;
  const refNames = () => new Set(getRows().map(r => r.id));
  function tokens(text) {
    return [...text.matchAll(/\((?:\$|\.|<\$>|<\*>|>>=)\)|[a-zA-Z_][a-zA-Z0-9_']*|[!@#$%^&*\-+=<>?/|~:.\\]+|[^\s]/g)]
      .map(t => ({ name: t[0], start: t.index, end: t.index + t[0].length }));
  }
  function drawOverlay(editor) {
    const overlay = editor.previousElementSibling;
    if (editor.closest('.editor-container').hidden) { overlay.replaceChildren(); return; }
    const text = editor.value;
    let end = 0, html = '';
    for (const token of tokens(text)) {
      html += escHtml(text.slice(end, token.start));
      const bare = token.name.replace(/^\((.+)\)$/, '$1');
      const cls = funcs.has(bare) ? 'token-func' : params.has(bare) ? 'token-param' : refNames().has(bare) || /^r\d+$/.test(bare) ? 'token-ref' : 'token-unknown';
      const content = bare === 'undefined' && iconMode ? '' : (funcs.has(bare) || params.has(bare) || refNames().has(bare) || /^r\d+$/.test(bare))
        ? rowSymbol(bare, token.name.length) : escHtml(token.name);
      html += `<span class="${cls}" data-start="${token.start}" data-end="${token.end}" data-name="${escHtml(token.name)}">${content}</span>`;
      end = token.end;
    }
    overlay.innerHTML = html + escHtml(text.slice(end));
    editor.style.height = '0px';
    editor.style.height = Math.max(iconMode ? 80 : 40, editor.scrollHeight) + 'px';
    overlay.scrollTop = editor.scrollTop;
    overlay.scrollLeft = editor.scrollLeft;
  }
  function activate(index) {
    activeRow = Math.max(0, Math.min(index, getRows().length - 1));
    container.querySelectorAll('.program-row').forEach((el, i) => el.classList.toggle('active-row', i === activeRow));
  }
  function paintInputs(row, call, index) {
    const holder = row.querySelector('.function-block');
    const structured = iconMode && !!call && !sourceRows.has(getRows()[index].id);
    holder.hidden = !structured;
    holder.classList.toggle('function-head', structured);
    row.querySelector('.editor-container').hidden = structured;
    row.querySelector('.row-call').classList.toggle('structured-call', structured);
    if (!structured) { holder.replaceChildren(); return; }
    const ts = tokens(getRows()[index].expr).filter(t => t.name !== '(' && t.name !== ')');
    const head = ts[call.infix ? 1 : 0];
    Object.assign(holder.dataset, { row: index, start: head.start, end: head.end, name: head.name });
    holder.setAttribute('role', 'group');
    holder.setAttribute('aria-label', `Function ${call.name} in row ${index + 1}`);
    holder.title = `${call.name}. Drag the blue border to move or remove this function.`;
    holder.innerHTML = '<div class="input-slots">' + call.inputs.map((_, slot) => {
      const name = call.args[slot], filled = name && name !== '_';
      const token = filled ? ts[call.infix ? slot * 2 : slot + 1] : null;
      const picture = filled ? rowSymbol(name, null, call.arguments[slot])
        : rowSymbol(`Input ${slot + 1} of ${call.name}`, null, call.inputDiagrams[slot]);
      return `<button type="button" class="argument-slot${filled ? ' filled' : ''}" data-slot="${slot}" data-row="${index}"${token ? ` data-start="${token.start}" data-end="${token.end}" data-name="${escHtml(token.name)}"` : ''} aria-label="Input ${slot + 1} of ${escHtml(call.name)}${filled ? ': ' + escHtml(name) : ': empty'}" title="${filled ? escHtml(name) : 'Drop an argument here'}">
        <span class="input-picture">${picture}</span></button>`;
    }).join('') + '</div>';
  }
  function paint() {
    const rows = getRows();
    diagnoseRows();
    editors().forEach((editor, i) => {
      if (editor.value !== rows[i].expr) editor.value = rows[i].expr;
      const row = editor.closest('.program-row');
      const feedback = row.querySelector('.row-feedback'), diagnostic = rowDiagnostics[i];
      paintInputs(row, diagnostic.call, i);
      drawOverlay(editor);
      row.classList.toggle('row-invalid', !!diagnostic.error && !!rows[i].expr.trim());
      const expected = diagnostic.expected;
      const picture = expected ? renderSemanticType(expected.type,
        (expected.isValue ? 'Result ' : 'Expected result ') + rows[i].id + ': ' + rowTypeSignatures([expected.type])[0], expected.variables, expected.template, expected.isValue) : '';
      feedback.innerHTML = diagnostic.error
        ? (picture ? `<div class="row-result-preview" title="Expected result; complete this row before reusing it">${picture}</div>` : '')
        : `<button type="button" class="row-result" draggable="true" data-func-name="${rows[i].id}" aria-label="Drag result ${rows[i].id}: ${escHtml(diagnostic.signature)}" title="Drag this result into an input in a later row">${picture}</button><span class="row-type">${colorizeType(diagnostic.signature)}</span>`;
      row.querySelector('.row-error').textContent = rows[i].expr.trim() ? diagnostic.error || '' : '';
    });
    paintReadyRow();
    fitSemanticDiagrams();
    const history = rowHistory.get(currentLevel);
    document.getElementById('undo-rows').disabled = !history?.undo.length;
    document.getElementById('redo-rows').disabled = !history?.redo.length;
    clearTimeout(liveCheckTimer);
    runLiveCheck();
  }
  function paintReadyRow() {
    const rows = getRows();
    const last = rows.at(-1), diagnostic = rowDiagnostics.at(-1);
    const state = JSON.stringify([rows.length, last.id, last.expr, diagnostic?.expected?.type, diagnostic?.signature, diagnostic?.error]);
    const changed = state !== readyRowState;
    readyRowState = state;
    const solved = rowDiagnostics.every(row => !row.error)
      && checkSolution(level, RowProgram.source(rows)).ok;
    // Unfilled inputs leave the output polymorphic. Keep the goal here while
    // that output can still become the target, without constraining the inputs
    // from the answer or treating compatibility as a completed solution.
    const canMatchGoal = diagnostic?.expected?.type
      && !!unify(diagnostic.expected.type, fixedGoalType, {});
    container.querySelectorAll('.program-row:not(.ready-row)').forEach((row, index) => {
      row.classList.toggle('final-row', solved && index === rows.length - 1);
    });
    let ready = container.querySelector('.ready-row');
    if (!last.expr.trim() || solved || canMatchGoal) { ready?.remove(); paintGoal(solved); return; }
    const created = !ready;
    // An incompatible output needs another step. Keep that empty step out of
    // the source until it is used,
    // so it cannot replace the result or affect validation, scoring or undo.
    if (!ready) {
      ready = document.createElement('section');
      ready.className = 'program-row ready-row';
      ready.tabIndex = -1;
      ready.innerHTML = '<div class="row-heading"><span class="row-number"></span></div><div class="row-flow"><div class="row-call"><button type="button" class="empty-row-drop" aria-label="New function row">Drop a function here</button></div></div>';
      container.append(ready);
    }
    ready.dataset.row = rows.length;
    ready.setAttribute('aria-label', `Row ${rows.length + 1}`);
    ready.querySelector('.row-number').textContent = rows.length + 1;
    paintGoal(false);
    // Row outputs can grow after a drop. Reveal the next target after layout,
    // without moving keyboard focus or interrupting an earlier-row edit.
    if (changed || created) requestAnimationFrame(() => {
      if (ready.isConnected && !controller.signal.aborted) ready.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }
  function paintGoal(solved) {
    container.querySelectorAll('.goal-output').forEach(node => node.remove());
    const lastRow = container.querySelector('.program-row:last-child');
    if (solved) {
      const result = lastRow.querySelector('.row-result');
      result.classList.add('puzzle-goal', 'goal-reached');
      result.title = `Goal reached: ${goalSignature}`;
      result.insertAdjacentHTML('beforeend', '<span class="goal-badge" aria-label="Goal reached">✓</span>');
    } else {
      // The pending final row shows the fixed puzzle goal once. It is not yet
      // a computed result that can be picked up or reused.
      lastRow.querySelector('.row-feedback')?.replaceChildren();
      const goal = document.createElement('div');
      goal.className = 'goal-output';
      goal.innerHTML = `<div class="goal-picture puzzle-goal" title="${escHtml('Goal: ' + goalSignature)}">${renderSemanticType(fixedGoalType, 'Goal: ' + goalSignature)}<svg class="goal-badge" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 14V2m0 0h10v7H3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3 2h3v3H3zm6 0h4v3H9zM6 5h3v4H6z" fill="currentColor"/></svg></div>`;
      lastRow.querySelector('.row-flow').append(goal);
    }
  }
  function nextRowId(rows) {
    // A removed row may still be referenced by unfinished steps. Never silently
    // reconnect those inputs to an unrelated new row with the same name.
    const used = new Set(rows.flatMap(row => [row.id, ...tokens(row.expr).map(token => token.name)]));
    let n = 1;
    while (used.has(`r${n}`)) n++;
    return `r${n}`;
  }
  function removeEmptyRows() {
    const rows = getRows(), selected = rows[activeRow]?.id;
    const remaining = rows.filter(row => row.expr.trim());
    // Keep a starting drop area when the whole program is empty. Otherwise
    // paintReadyRow supplies the one spare row without adding it to the source.
    if (!remaining.length) remaining.push(rows[activeRow] || rows[0]);
    if (remaining.length === rows.length) return false;
    const kept = new Set(remaining.map(row => row.id));
    rows.forEach(row => { if (!kept.has(row.id)) sourceRows.delete(row.id); });
    rowPrograms[currentLevel] = remaining;
    const selectedIndex = remaining.findIndex(row => row.id === selected);
    activeRow = selectedIndex >= 0 ? selectedIndex : Math.min(activeRow, remaining.length - 1);
    return true;
  }
  function build() {
    const rows = getRows();
    activeRow = Math.min(activeRow, rows.length - 1);
    container.innerHTML = rows.map((row, index) => `<section class="program-row${index === activeRow ? ' active-row' : ''}${index === rows.length - 1 ? ' final-row' : ''}" data-row="${index}" tabindex="-1" aria-label="Row ${index + 1}">
      <div class="row-heading"><span class="row-number">${index + 1}</span><span class="row-role">${index === rows.length - 1 ? 'Final answer' : 'Intermediate result'}</span>
      <button type="button" class="row-delete" data-action="remove" aria-label="Delete row ${index + 1}" title="Delete row">×</button></div>
      <div class="row-flow"><div class="row-call"><div class="editor-container"><div class="editor-area"><div class="editor-overlay"${index === 0 ? ' id="editor-overlay"' : ''}></div><textarea class="editor row-editor code"${index === 0 ? ' id="code-editor"' : ''} data-row="${index}" rows="1" inputmode="none" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Row ${index + 1} expression" aria-describedby="row-feedback-${index} row-error-${index}"></textarea></div></div><div class="function-block" hidden></div></div>
      <div class="row-feedback" id="row-feedback-${index}" aria-live="polite"></div><div class="row-error" id="row-error-${index}" aria-live="polite"></div></div></section>`).join('');
    paint();
  }
  function commit(rebuild = false, keepNewDropArea = false) {
    const removed = !keepNewDropArea && removeEmptyRows();
    persistRows(); notice('');
    rebuild || removed ? build() : paint();
  }
  function newRow(at) {
    rememberRows();
    const rows = getRows();
    rows.splice(at, 0, { id: nextRowId(rows), expr: '' });
    activeRow = at; commit(true, true);
    editors()[at].closest('.program-row').scrollIntoView({ block: 'nearest' });
    focusRow(at);
  }
  function confirmRowDeletion(index) {
    closeDeletePreview?.();
    const rows = getRows(), snapshot = rowSnapshot(), previewLevel = currentLevel;
    const affected = new Set([rows[index].id]);
    // Include indirect dependents as well as direct uses, with exact token names.
    let changed;
    do {
      changed = false;
      rows.slice(index + 1).forEach(row => {
        if (!affected.has(row.id) && tokens(row.expr).some(token => affected.has(token.name))) {
          affected.add(row.id); changed = true;
        }
      });
    } while (changed);
    const impacted = rows.map((row, i) => ({ ...row, index: i })).filter(row => affected.has(row.id));
    const count = impacted.length, dependentCount = count - 1;
    const title = `Delete ${count} ${count === 1 ? 'row' : 'rows'}?`;
    const summary = dependentCount
      ? `Row ${index + 1} and ${dependentCount} dependent ${dependentCount === 1 ? 'row' : 'rows'} will be deleted.`
      : `Row ${index + 1} will be deleted.`;
    const dialog = document.createElement('dialog');
    dialog.className = 'connection-picker row-delete-dialog';
    dialog.setAttribute('aria-labelledby', 'row-delete-title');
    dialog.setAttribute('aria-describedby', 'row-delete-summary');
    dialog.innerHTML = `<h2 id="row-delete-title">${title}</h2><p id="row-delete-summary">${summary}</p>
      <ol class="delete-preview-list" aria-label="Rows to delete">${impacted.map(row => {
        const used = new Set(tokens(row.expr).map(token => token.name));
        const dependencies = impacted.filter(other => used.has(other.id)).map(other => other.index + 1);
        const reason = row.index === index ? 'Selected row' : `Uses ${dependencies.length === 1 ? 'row' : 'rows'} ${dependencies.join(', ')}`;
        const expression = tokens(row.expr).map(token => rowSymbol(token.name.replace(/^\((.+)\)$/, '$1'))).join(' ');
        return `<li class="delete-preview-item" data-delete-index="${row.index}"><div class="delete-preview-heading"><strong>Row ${row.index + 1}</strong><span>${reason}</span></div><div class="delete-preview-expression" role="img" aria-label="${escHtml(row.expr || 'Empty row')}">${expression || '<span>Empty row</span>'}</div></li>`;
      }).join('')}</ol>
      <p>You can undo this.</p><div class="delete-actions"><button type="button" class="delete-cancel">Cancel</button><button type="button" class="delete-confirm">Delete ${count === 1 ? 'row' : count + ' rows'}</button></div>`;
    container.querySelectorAll('.program-row:not(.ready-row)').forEach((node, i) => node.classList.toggle('delete-preview', affected.has(rows[i].id)));
    const close = () => {
      container.querySelectorAll('.delete-preview').forEach(node => node.classList.remove('delete-preview'));
      dialog.close(); dialog.remove(); closeDeletePreview = null;
    };
    closeDeletePreview = close;
    dialog.querySelector('.delete-cancel').onclick = close;
    dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
    dialog.querySelector('.delete-confirm').onclick = () => {
      close();
      if (currentLevel !== previewLevel || rowSnapshot() !== snapshot) {
        notice('The rows changed. Review the deletion again.'); return;
      }
      rememberRows();
      const remaining = rows.filter(row => !affected.has(row.id));
      rowPrograms[currentLevel] = remaining.length ? remaining : [{ id: 'r1', expr: '' }];
      affected.forEach(id => sourceRows.delete(id));
      activeRow = Math.min(index, getRows().length - 1);
      commit(true);
      container.querySelectorAll('.row-delete')[activeRow]?.focus({ preventScroll: true });
    };
    document.body.append(dialog); dialog.showModal(); fitSemanticDiagrams(dialog);
    dialog.querySelector('.delete-cancel').focus();
  }
  function historyMove(direction) {
    const history = rowHistory.get(currentLevel), from = history?.[direction];
    if (!from?.length) return;
    history[direction === 'undo' ? 'redo' : 'undo'].push(rowSnapshot());
    rowPrograms[currentLevel] = JSON.parse(from.pop());
    commit(true);
    focusRow(activeRow);
  }
  function focusRow(index) {
    const row = editors()[index]?.closest('.program-row');
    row?.focus({ preventScroll: true });
  }
  function removal(text, range, connectors = false) {
    if (range.slot !== undefined) {
      const changed = RowProgram.setArgument(text, range.slot, null);
      let start = 0, end = text.length, changedEnd = changed.length;
      while (start < end && start < changedEnd && text[start] === changed[start]) start++;
      while (end > start && changedEnd > start && text[end - 1] === changed[changedEnd - 1]) { end--; changedEnd--; }
      return { start, end, text: changed, delta: text.length - changed.length };
    }
    let { start, end } = connectors ? functionRemovalRange(text, range, level) : range;
    if (start > 0 && /\s/.test(text[start - 1])) start--;
    else if (end < text.length && /\s/.test(text[end])) end++;
    return { start, end, text: text.slice(0, start) + text.slice(end), delta: end - start };
  }
  function inserted(text, position, name) {
    if (text.trim() === 'undefined') text = '';
    let pos = Math.min(position, text.length);
    while (pos < text.length && /\s/.test(text[pos])) pos++;
    const prefix = pos && !/\s/.test(text[pos - 1]) ? ' ' : '';
    const suffix = pos < text.length && !/\s/.test(text[pos]) ? ' ' : '';
    // Operators used as values need parentheses; between operands they are infix.
    if (isOperatorName(name) && text.slice(0, pos).trim()) name = name.slice(1, -1);
    return text.slice(0, pos) + prefix + name + suffix + text.slice(pos);
  }
  function stockAllows(next) {
    const error = cardUsageIncreaseError(level, RowProgram.source(getRows()), RowProgram.source(next));
    if (error) notice(error);
    return !error;
  }
  function mutateDrop(name, rowIndex, pos, source, connector) {
    const next = structuredClone(getRows());
    const createsRow = rowIndex === next.length;
    if (createsRow) next.push({ id: nextRowId(next), expr: '' });
    if (refNames().has(name) || /^r\d+$/.test(name)) {
      const from = next.findIndex(r => r.id === name);
      if (from < 0 || from >= rowIndex) { notice('Use a result only in a row below it.'); return; }
    }
    if (source) {
      const original = next[source.index].expr;
      if (source.index === rowIndex && pos >= source.start && pos <= source.end && !connector) return;
      const removed = removal(original, source, !!connector);
      next[source.index].expr = removed.text;
      if (source.index === rowIndex) {
        if (connector && connector.start < removed.end && connector.end > removed.start) {
          notice('Move this argument into an input slot or another row.'); return;
        }
        if (pos >= removed.end) pos -= removed.delta;
        if (connector && connector.start >= removed.end) {
          connector = { ...connector, start: connector.start - removed.delta, end: connector.end - removed.delta };
        }
      }
    }
    if (connector) {
      const text = next[rowIndex].expr, target = text.slice(connector.start, connector.end);
      const left = connector.swapped ? name : target, right = connector.swapped ? target : name;
      next[rowIndex].expr = text.slice(0, connector.start) + `${left} ${connector.op ? connector.op + ' ' : ''}${right}` + text.slice(connector.end);
    } else next[rowIndex].expr = inserted(next[rowIndex].expr, pos, name);
    if (!stockAllows(next)) return;
    rememberRows(); rowPrograms[currentLevel] = next; activeRow = rowIndex; commit(createsRow); activate(activeRow);
  }
  function slotAt(point) {
    const slot = document.elementFromPoint(point.clientX, point.clientY)?.closest('.argument-slot');
    return slot && container.contains(slot) ? slot : null;
  }
  function sourceForSlot(slot) {
    const index = Number(slot.dataset.row), position = Number(slot.dataset.slot), call = RowProgram.call(getRows()[index].expr);
    const name = call?.args[position];
    if (!name || name === '_') return null;
    const ts = tokens(getRows()[index].expr).filter(t => t.name !== '(' && t.name !== ')');
    const token = ts[call.infix ? position * 2 : position + 1];
    if (!token) return null;
    return { ...token, name: RowProgram.print({ kind: 'name', name }), index, slot: position, node: slot };
  }
  function fillSlot(name, index, position, source) {
    const next = structuredClone(getRows()), call = RowProgram.call(next[index].expr);
    if (!call || !rowDiagnostics[index]?.call?.inputs[position]) return;
    const value = name ? name.replace(/^\((.+)\)$/, '$1') : null;
    if (value && !funcs.has(value) && !params.has(value) && !refNames().has(value)) return;
    if (value && (refNames().has(value) || /^r\d+$/.test(value))) {
      const from = next.findIndex(row => row.id === value);
      if (from < 0 || from >= index) { notice('Use a result only in a row below it.'); return; }
      if (rowDiagnostics[from]?.error) { notice('Complete that row before using its result.'); return; }
    }
    if (source) {
      // A source token shown in the expression and its input slot are the same value.
      const slotSource = source.slot !== undefined ? source : [...container.querySelectorAll(`.argument-slot[data-row="${source.index}"]`)]
        .map(sourceForSlot).find(input => input && input.start === source.start && input.end === source.end);
      if (source.index === index && slotSource?.slot === position) return;
      if (source.index === index && !slotSource) { notice('Keep the function in place. Drag an argument or an earlier result into its input.'); return; }
      next[source.index].expr = removal(next[source.index].expr, slotSource || source, true).text;
    }
    next[index].expr = RowProgram.setArgument(next[index].expr, position, value ? RowProgram.print({ kind: 'name', name: value }) : null);
    if (JSON.stringify(next) === rowSnapshot()) return;
    if (!stockAllows(next)) return;
    rememberRows(); rowPrograms[currentLevel] = next; activeRow = index; commit(); activate(activeRow);
  }
  function chooseArgument(slot) {
    const index = Number(slot.dataset.row), position = Number(slot.dataset.slot), snapshot = rowSnapshot();
    const call = rowDiagnostics[index]?.call;
    if (!call) return;
    activate(index);
    const dialog = document.createElement('dialog'); dialog.className = 'connection-picker argument-picker';
    dialog.setAttribute('aria-label', `Choose input ${position + 1} of ${call.name}`);
    dialog.innerHTML = `<h2>Choose input ${position + 1}</h2><p>For ${rowSymbol(call.name)}. Functions can be inputs too.</p><div class="argument-choices"></div><button type="button" class="connection-cancel">Cancel</button>`;
    const close = () => { dialog.close(); dialog.remove(); };
    const stock = functionUsage(level, RowProgram.source(getRows()));
    const available = stock.filter(f => f.remaining || f.name.replace(/^\(|\)$/g, '') === call.args[position]).map(f => f.name);
    const availableParams = parameterUsage(level, RowProgram.source(getRows()))
      .filter(p => p.remaining || p.name === call.args[position]).map(p => p.name);
    const choices = [...availableParams, ...getRows().slice(0, index).filter((_, i) => !rowDiagnostics[i]?.error).map(row => row.id), ...available];
    for (const name of [...choices, null]) {
      if (!name && !call.args[position]) continue;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'argument-choice';
      button.innerHTML = name ? rowSymbol(name.replace(/^\((.+)\)$/, '$1')) : 'Clear input';
      button.setAttribute('aria-label', name ? `Use input ${name}` : 'Clear input');
      button.onclick = () => { close(); if (rowSnapshot() === snapshot) fillSlot(name, index, position); };
      dialog.querySelector('.argument-choices').append(button);
    }
    dialog.querySelector('.connection-cancel').onclick = close;
    dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
    document.body.append(dialog); dialog.showModal(); fitSemanticDiagrams(dialog);
  }
  function rowAt(point) {
    const hit = document.elementFromPoint(point.clientX, point.clientY);
    const row = hit?.closest('.program-row, .ready-row');
    return row && container.contains(row) ? Number(row.dataset.row) : null;
  }
  function hitToken(index, point) {
    for (const node of visibleTokens(index)) {
      const r = node.getBoundingClientRect();
      if (point.clientX >= r.left && point.clientX <= r.right && point.clientY >= r.top && point.clientY <= r.bottom) return {
        ...(node.matches('.argument-slot') ? sourceForSlot(node) : {}),
        index, start: Number(node.dataset.start), end: Number(node.dataset.end), name: node.dataset.name, node, rect: r, head: node.matches('.function-head')
      };
    }
    return null;
  }
  function visibleTokens(index) {
    const editor = editors()[index];
    if (!editor) return [];
    return editor.closest('.editor-container').hidden
      ? editor.closest('.program-row').querySelectorAll('.function-head, .argument-slot.filled')
      : editor.previousElementSibling.children;
  }
  function caret(index, point) {
    const editor = editors()[index];
    const style = getComputedStyle(editor), rect = editor.getBoundingClientRect();
    const height = parseFloat(style.lineHeight);
    const nodes = visibleTokens(index);
    const stops = nodes.length ? [] : [{ pos: 0, x: rect.left + parseFloat(style.paddingLeft), y: rect.top + parseFloat(style.paddingTop), height }];
    for (const node of nodes) {
      const r = node.getBoundingClientRect();
      stops.push({ pos: Number(node.dataset.start), x: r.left, y: r.top, height: r.height }, { pos: Number(node.dataset.end), x: r.right, y: r.top, height: r.height });
    }
    return stops.reduce((best, stop) => {
      const distance = s => Math.abs(point.clientY - s.y - s.height / 2) * 1000 + Math.abs(point.clientX - s.x);
      return distance(stop) < distance(best) ? stop : best;
    });
  }
  function targetFor(name, index, point, source) {
    if (!operators.length || isOperatorName(name) || operators.some(f => f.name.slice(1, -1) === name)) return null;
    const target = hitToken(index, point);
    if (!target || (source?.index === index && source.start === target.start)) return null;
    if (!funcs.has(target.name) && !params.has(target.name) && !refNames().has(target.name)) return null;
    const edge = target.rect.width * .25;
    return point.clientX > target.rect.left + edge && point.clientX < target.rect.right - edge ? target : null;
  }
  function clearIntent() {
    document.getElementById('drop-caret')?.remove();
    container.querySelectorAll('.connection-target, .drag-over, .slot-target').forEach(n => n.classList.remove('connection-target', 'drag-over', 'slot-target'));
  }
  function showIntent(name, point, source) {
    clearIntent();
    if (document.elementFromPoint(point.clientX, point.clientY)?.closest('.goal-output')) {
      ghost?.classList.remove('removing'); return;
    }
    const index = rowAt(point);
    ghost?.classList.toggle('removing', index === null && !!source);
    if (index === null) return;
    if (index === getRows().length) {
      container.querySelector('.ready-row')?.classList.add('drag-over'); return;
    }
    const slot = slotAt(point);
    if (slot) { slot.classList.add('slot-target'); return; }
    const target = targetFor(name, index, point, source);
    if (target) target.node.classList.add('connection-target');
    else {
      const stop = caret(index, point), el = document.createElement('div');
      el.id = 'drop-caret'; el.className = 'drop-caret';
      Object.assign(el.style, { left: stop.x + 'px', top: stop.y + 'px', height: stop.height + 'px' });
      document.body.append(el);
    }
    editors()[index].closest('.program-row').classList.add('drag-over');
  }
  function picker(name, target, source) {
    const snapshot = rowSnapshot(), index = target.index;
    const dialog = document.createElement('dialog');
    dialog.id = 'connection-picker'; dialog.className = 'connection-picker';
    dialog.setAttribute('aria-labelledby', 'connection-title');
    dialog.innerHTML = '<h2 id="connection-title">Choose an operator</h2><p>Connect these inputs in this row.</p><div class="connection-order"><span id="connection-order-label"></span><button type="button" id="connection-swap">Swap order</button></div><div class="connection-options"></div><button type="button" class="connection-cancel">Cancel</button>';
    document.body.append(dialog);
    let swapped = false;
    const close = () => { dialog.close(); dialog.remove(); };
    function choices() {
      const left = swapped ? name : target.name, right = swapped ? target.name : name;
      dialog.querySelector('#connection-order-label').innerHTML = rowSymbol(left) + ' → ' + rowSymbol(right);
      const holder = dialog.querySelector('.connection-options'); holder.replaceChildren();
      const available = new Set(functionUsage(level, RowProgram.source(getRows())).filter(f => f.remaining).map(f => f.name));
      for (const op of [...operators.filter(f => available.has(f.name)).map(f => f.name.slice(1, -1)), '']) {
        const button = document.createElement('button');
        button.className = 'connection-option'; button.dataset.operator = op;
        button.setAttribute('aria-label', op ? `Use ${op}` : 'Insert without operator');
        let text = getRows()[index].expr, start = target.start, end = target.end;
        if (source?.index === index) {
          const removed = removal(text, source, true); text = removed.text;
          if (removed.end <= start) { start -= removed.delta; end -= removed.delta; }
        }
        const preview = text.slice(0, start) + `${left} ${op ? op + ' ' : ''}${right}` + text.slice(end);
        button.innerHTML = `<span class="connection-option-title">${op ? rowSymbol(op) : 'No operator'}</span><span class="connection-preview">${iconMode ? tokens(preview).map(token => rowSymbol(token.name)).join(' ') : `<code>${escHtml(preview)}</code>`}</span>`;
        button.onclick = () => {
          close();
          if (rowSnapshot() === snapshot) mutateDrop(name, index, target.start, source, { ...target, op, swapped });
        };
        holder.append(button);
      }
    }
    dialog.querySelector('#connection-swap').onclick = () => { swapped = !swapped; choices(); fitSemanticDiagrams(dialog); };
    dialog.querySelector('.connection-cancel').onclick = close;
    dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
    choices(); dialog.showModal(); fitSemanticDiagrams(dialog);
  }
  function isRowHead(source) {
    if (!source || source.slot !== undefined) return false;
    if (source.head) return true;
    // The same function can also be dragged from the row's Edit code view.
    const text = getRows()[source.index].expr, call = RowProgram.call(text);
    if (!call) return false;
    const head = tokens(text).filter(t => t.name !== '(' && t.name !== ')')[call.infix ? 1 : 0];
    return head?.start === source.start && head?.end === source.end;
  }
  function drop(name, point, source) {
    if (document.elementFromPoint(point.clientX, point.clientY)?.closest('.goal-output')) return;
    const slot = slotAt(point);
    if (slot) { fillSlot(name, Number(slot.dataset.row), Number(slot.dataset.slot), source); return; }
    const index = rowAt(point);
    if (index === null) {
      if (source) {
        rememberRows();
        const row = getRows()[source.index];
        row.expr = isRowHead(source) ? '' : removal(row.expr, source, true).text;
        commit();
      }
      return;
    }
    if (index === getRows().length) { mutateDrop(name, index, 0, source); return; }
    const target = targetFor(name, index, point, source);
    if (target) picker(name, target, source);
    else mutateDrop(name, index, caret(index, point).pos, source);
  }
  function moveGhost(point) {
    if (!ghost) return;
    // The preview's center is the drop point. An elevated or edge-clamped
    // preview appears to hit a different row/input from the pointer below it.
    ghost.style.left = point.clientX + 'px';
    ghost.style.top = point.clientY + 'px';
  }
  function autoScroll(time) {
    if (!drag?.moved || !lastPoint) return;
    const r = container.getBoundingClientRect();
    const hovered = rowAt(lastPoint);
    const onSlot = slotAt(lastPoint);
    const onToken = onSlot || hovered !== null && hitToken(hovered, lastPoint);
    const onDropArea = document.elementFromPoint(lastPoint.clientX, lastPoint.clientY)
      ?.closest('.empty-row-drop, textarea.row-editor');
    const delta = !onToken && !onDropArea && lastPoint.clientX >= r.left && lastPoint.clientX <= r.right
      ? lastPoint.clientY < r.top + 36 ? -14 : lastPoint.clientY > r.bottom - 36 ? 14 : 0 : 0;
    const row = hovered === null ? null : container.querySelector(`.program-row[data-row="${hovered}"]`);
    const bounds = row?.getBoundingClientRect();
    const across = bounds && !onSlot && !onDropArea
      ? lastPoint.clientX < bounds.left + 24 && row.scrollLeft > 0 ? -14
        : lastPoint.clientX > bounds.right - 24 && row.scrollLeft + row.clientWidth < row.scrollWidth ? 14 : 0
      : 0;
    // A visible input or empty row must not scroll out from under a drop.
    // Scroll only when the player rests the already-dragging finger at the edge.
    if (!delta && !across) scrollEdge = null;
    else if (!scrollEdge || scrollEdge.delta !== delta || scrollEdge.across !== across || scrollEdge.row !== row || Math.hypot(lastPoint.clientX - scrollEdge.x, lastPoint.clientY - scrollEdge.y) > 12) {
      scrollEdge = { x: lastPoint.clientX, y: lastPoint.clientY, delta, across, row, since: time };
    } else if (time - scrollEdge.since >= 200 && time - lastScrollTime > 30) {
      container.scrollTop += delta;
      if (across) row.scrollLeft += across;
      showIntent(drag.name, lastPoint, drag.source); lastScrollTime = time;
    }
    scrollFrame = requestAnimationFrame(autoScroll);
  }
  function cleanupDrag() {
    if (scrollFrame) cancelAnimationFrame(scrollFrame);
    scrollFrame = null; lastPoint = null; scrollEdge = null;
    ghost?.remove(); ghost = null;
    if (drag?.card) drag.card.draggable = true;
    drag = null;
    clearIntent();
    document.querySelectorAll('.dragging, .drag-source').forEach(el => el.classList.remove('dragging', 'drag-source'));
  }
  listen(container, 'focusin', e => {
    if (e.target.matches('textarea')) activate(Number(e.target.dataset.row));
  });
  function normalizeInput(value) {
    const known = new Set([...funcs, ...params, ...refNames()]);
    return value.replace(/\s+/g, ' ').trimStart()
      .replace(/([a-zA-Z0-9_'])([!@#$%^&*\-+=<>?/|~:.\\]+)/g, '$1 $2')
      .replace(/([!@#$%^&*\-+=<>?/|~:.\\]+)([a-zA-Z_])/g, '$1 $2')
      .replace(/[a-zA-Z_][a-zA-Z0-9_']*/g, word => {
        if (known.has(word)) return word;
        const parts = []; let rest = word;
        while (rest) {
          const match = [...known].filter(n => /^[a-zA-Z_]/.test(n) && rest.startsWith(n)).sort((a, b) => b.length - a.length)[0];
          if (!match) return word;
          parts.push(match); rest = rest.slice(match.length);
        }
        return parts.join(' ');
      });
  }
  listen(container, 'input', e => {
    if (!e.target.matches('textarea')) return;
    rememberRows();
    const index = Number(e.target.dataset.row);
    sourceRows.add(getRows()[index].id);
    const cursor = normalizeInput(e.target.value.slice(0, e.target.selectionStart)).length;
    getRows()[index].expr = normalizeInput(e.target.value);
    activeRow = index; commit();
    e.target.setSelectionRange(cursor, cursor);
  });
  listen(container, 'scroll', e => {
    if (e.target.matches('textarea')) { e.target.previousElementSibling.scrollTop = e.target.scrollTop; e.target.previousElementSibling.scrollLeft = e.target.scrollLeft; }
  }, { capture: true });
  listen(container, 'keydown', e => {
    if (!e.target.matches('textarea') && (e.ctrlKey || e.metaKey) && /^(z|y)$/i.test(e.key)) {
      e.preventDefault(); historyMove(e.key.toLowerCase() === 'y' || e.shiftKey ? 'redo' : 'undo'); return;
    }
    if (!e.target.matches('textarea')) return;
    const editor = e.target, index = Number(editor.dataset.row), start = editor.selectionStart, end = editor.selectionEnd;
    if ((e.ctrlKey || e.metaKey) && /^(z|y)$/i.test(e.key)) {
      e.preventDefault(); historyMove(e.key.toLowerCase() === 'y' || e.shiftKey ? 'redo' : 'undo'); return;
    }
    if (e.key === 'Enter') { e.preventDefault(); newRow(index + 1); return; }
    if (start !== end || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const ts = tokens(editor.value);
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const atPunctuation = e.key === 'Backspace' && /[()]/.test(editor.value[start] || ' ') ? ts.find(t => t.start === start) : null;
      const token = atPunctuation || (e.key === 'Backspace' ? ts.filter(t => t.start < start).at(-1) : ts.find(t => t.end > start));
      if (!token) return;
      e.preventDefault(); rememberRows();
      const removed = removal(editor.value, token);
      getRows()[index].expr = removed.text; commit();
      editor.setSelectionRange(removed.start, removed.start);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const token = e.key === 'ArrowLeft' ? ts.filter(t => t.start < start).at(-1) : ts.find(t => t.end > start);
      if (token) { e.preventDefault(); const pos = e.key === 'ArrowLeft' ? token.start : token.end; editor.setSelectionRange(pos, pos); }
    }
  });
  listen(container, 'click', e => {
    if (e.target.closest('.goal-output')) return;
    if (e.target.closest('.ready-row')) {
      if (!suppressClick) newRow(getRows().length);
      return;
    }
    const slot = e.target.closest('.argument-slot');
    if (slot) { if (!suppressClick) chooseArgument(slot); return; }
    const button = e.target.closest('[data-action]');
    if (!button) return;
    const index = Number(button.closest('.program-row').dataset.row), action = button.dataset.action;
    if (action === 'remove') confirmRowDeletion(index);
  });
  listen(document.getElementById('add-row'), 'click', () => newRow(getRows().length));
  listen(document.getElementById('undo-rows'), 'click', () => historyMove('undo'));
  listen(document.getElementById('redo-rows'), 'click', () => historyMove('redo'));
  listen(document, 'click', e => {
    const card = e.target.closest('[data-func-name]');
    if (!card || card.tagName !== 'BUTTON' || suppressClick) return;
    const editor = editors()[activeRow];
    mutateDrop(card.dataset.funcName, activeRow, document.activeElement === editor ? editor.selectionStart : editor.value.length);
  });
  listen(document, 'dragstart', e => {
    const card = e.target.closest('[data-func-name]');
    if (!card) return;
    nativeName = card.dataset.funcName; e.dataTransfer.setData('text/plain', nativeName);
    const bounds = card.getBoundingClientRect();
    e.dataTransfer.setDragImage(card, bounds.width / 2, bounds.height / 2);
    card.classList.add('dragging');
  });
  listen(container, 'dragover', e => { e.preventDefault(); showIntent(nativeName, e); });
  listen(container, 'drop', e => { e.preventDefault(); drop(e.dataTransfer.getData('text/plain'), e); cleanupDrag(); nativeName = ''; if (!document.getElementById('connection-picker')) focusRow(activeRow); });
  listen(document, 'dragend', () => { nativeName = ''; cleanupDrag(); });
  listen(document, 'pointerdown', e => {
    if (drag && e.pointerId !== drag.id) { cleanupDrag(); return; }
    if (e.button !== 0 || e.target.closest('dialog')) return;
    // Mobile browsers may retarget a border touch to a nearby input button.
    // Use the actual contact point to distinguish the function from its inputs.
    const target = e.target.closest('.function-block')
      ? document.elementFromPoint(e.clientX, e.clientY) || e.target : e.target;
    const card = target.closest('[data-func-name]');
    const editor = target.closest('textarea.row-editor');
    const slot = target.closest('.argument-slot');
    const head = target.closest('.function-head');
    if (!card && !editor && !slot && !head) return;
    if (card && e.pointerType === 'mouse') return; // native HTML drag on desktop cards
    const index = Number((editor || slot || head)?.dataset.row);
    const source = slot ? sourceForSlot(slot) : editor || head ? hitToken(index, e) : null;
    if (!card && !source) return; // empty space is available for scrolling/editing
    e.preventDefault();
    if (editor || slot || head) activate(index);
    if (card) card.draggable = false;
    drag = { card, id: e.pointerId, name: card?.dataset.funcName || source.name, source, x: e.clientX, y: e.clientY, moved: false, snapshot: rowSnapshot() };
    ghost = document.createElement('div'); ghost.id = e.pointerType === 'touch' ? 'touch-drag-ghost' : 'drag-out-ghost'; ghost.className = 'drag-ghost row-drag-ghost';
    const picture = isRowHead(source) ? rowSymbol(source.name, null, rowDiagnostics[source.index]?.call?.diagram, true)
      : source?.node?.querySelector('svg.semantic-diagram')?.outerHTML;
    ghost.innerHTML = (picture || rowSymbol(drag.name.replace(/^\((.+)\)$/, '$1'))) + `<span class="drag-action">${isRowHead(source) ? 'Release outside to clear row' : 'Release outside to remove'}</span>`;
    document.body.append(ghost); fitSemanticDiagrams(ghost); moveGhost(e);
    source?.node.classList.add('drag-source'); card?.classList.add('dragging');
  });
  // Claim the touch sequence too: otherwise the browser may start its own
  // HTML drag and consume the next tap when it cancels that native gesture.
  listen(document, 'touchstart', e => { if (drag && e.cancelable) e.preventDefault(); }, { passive: false });
  listen(document, 'pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;
    if (rowSnapshot() !== drag.snapshot) { cleanupDrag(); return; }
    e.preventDefault();
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5) drag.moved = true;
    moveGhost(e);
    if (drag.moved) {
      lastPoint = { clientX: e.clientX, clientY: e.clientY };
      showIntent(drag.name, e, drag.source);
      if (!scrollFrame) scrollFrame = requestAnimationFrame(autoScroll);
    }
  }, { passive: false });
  listen(document, 'pointerup', e => {
    if (!drag || drag.id !== e.pointerId) return;
    const state = drag;
    suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
    if (state.moved) {
      if (state.snapshot === rowSnapshot()) drop(state.name, e, state.source);
    } else if (state.source?.slot !== undefined) {
      chooseArgument(state.source.node);
    } else if (state.source?.head) {
      focusRow(state.source.index);
    } else if (state.source) {
      const editor = editors()[state.source.index]; editor.focus({ preventScroll: true });
      const pos = caret(state.source.index, e).pos; editor.setSelectionRange(pos, pos);
    } else if (state.card?.tagName === 'BUTTON') {
      mutateDrop(state.name, activeRow, editors()[activeRow].value.length);
    }
    // Taps retain caret behavior; dragging never needs a hold.
    cleanupDrag();
  });
  listen(document, 'pointercancel', cleanupDrag);
  listen(window, 'blur', cleanupDrag);
  listen(document, 'visibilitychange', () => { if (document.hidden) cleanupDrag(); });
  listen(document, 'contextmenu', e => { if (drag) e.preventDefault(); });
  listen(window, 'resize', () => editors().forEach(drawOverlay));
  const diagramObserver = new ResizeObserver(() => fitSemanticDiagrams());
  document.querySelectorAll('.left-panel, .right-panel').forEach(panel => diagramObserver.observe(panel));
  rowEditorCleanup = () => { diagramObserver.disconnect(); closeDeletePreview?.(); cleanupDrag(); controller.abort(); document.querySelector('.argument-picker')?.remove(); rowEditorCleanup = null; };
  if (removeEmptyRows()) persistRows();
  build();
  document.fonts.ready.then(() => { if (!controller.signal.aborted) editors().forEach(drawOverlay); });
}
