// Multi-row editing, result references and shared mouse/touch interactions.
const rowHistory = new Map();
let rowDiagnostics = [];
let rowEditorCleanup = null;
function clearRowHistory() { rowHistory.clear(); }
function getRows() {
  if (!rowPrograms[currentLevel]) rowPrograms[currentLevel] = RowProgram.migrate(getEditorContent());
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
  editorContents[currentLevel] = LEVELS[currentLevel].lhs.trim() + ' ' + RowProgram.source(getRows());
  saveProgress();
}
function getRowError() {
  const errors = RowProgram.validate(getRows(), LEVELS[currentLevel]);
  const index = errors.findIndex(Boolean);
  return index < 0 ? null : `Row ${index + 1}: ${errors[index]}`;
}
function rowSymbol(name, width) {
  if (/^r\d+$/.test(name)) {
    const diagnostic = rowDiagnostics[getRows().findIndex(row => row.id === name)];
    if (iconMode && diagnostic?.signature) return `<span class="icon-sym row-ref rendered-ref" title="${escHtml(name + ': ' + diagnostic.signature)}"${width ? ` style="width:${width}ch"` : ''}>${renderSemanticType(diagnostic.signature, name + ': ' + diagnostic.signature)}<small>${name}</small></span>`;
    return `<span class="icon-sym row-ref" title="${escHtml(name)}"${width ? ` style="width:${width}ch"` : ''}><span>${escHtml(name)}</span></span>`;
  }
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
function diagnoseCall(code, env, params) {
  const model = RowProgram.call(code);
  if (!model) return null;
  try {
    let type = inferExpr(RowProgram.print({ kind: 'name', name: model.name }), env, params);
    const inputs = [];
    while (type?.tag === 'fun') { inputs.push(type.from); type = type.to; }
    if (!inputs.length || model.args.length > inputs.length) return null;
    let subst = {};
    model.args.forEach((name, i) => {
      if (name === '_') return;
      try {
        const actual = inferExpr(RowProgram.print({ kind: 'name', name }), env, params);
        subst = unify(inputs[i], actual, subst) || subst;
      } catch (_) { /* Keep editable slots even when an input is invalid. */ }
    });
    return { ...model, inputs: rowTypeSignatures(inputs.map(input => applySubst(subst, input))) };
  } catch (_) { return null; }
}
function diagnoseRows() {
  const level = LEVELS[currentLevel], rows = getRows();
  const errors = RowProgram.validate(rows, level);
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
    const call = diagnoseCall(row.expr, env, params);
    try {
      if (errors[index]) throw Error(errors[index]);
      const type = inferExpr(row.expr, env, params);
      if (!type) throw Error('Incomplete expression.');
      env[row.id] = type;
      return { type, signature: rowTypeSignatures([type])[0], call };
    } catch (e) {
      return { error: errors[index] || normalizeTypeError(e.message), call };
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
  const operators = level.funcs.filter(f => isOperatorName(f.name));
  const sourceRows = new Set();
  const editors = () => [...container.querySelectorAll('textarea')];
  const listen = (el, event, fn, extra = {}) => el.addEventListener(event, fn, { ...options, ...extra });
  const notice = text => { document.getElementById('row-notice').textContent = text; };
  let drag = null, ghost = null, nativeName = '', suppressClick = false, scrollFrame = null, lastPoint = null;
  let lastScrollTime = 0;
  const results = document.createElement('section');
  results.id = 'available-results';
  document.querySelector('.right-panel').prepend(results);
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
      const cls = funcs.has(bare) ? 'token-func' : params.has(bare) ? 'token-param' : /^r\d+$/.test(bare) ? 'token-ref' : 'token-unknown';
      const content = bare === 'undefined' && iconMode ? '' : (funcs.has(bare) || params.has(bare) || /^r\d+$/.test(bare))
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
    updateResults();
  }
  function updateResults() {
    const rows = getRows();
    results.innerHTML = `<h2>Earlier results · row ${activeRow + 1}</h2><p class="results-hint">${activeRow ? 'Drag or tap a result to use it in this row.' : 'Add a row to use this result as an input.'}</p>` + rows.slice(0, activeRow).map((row, i) =>
      `<button type="button" class="func-card result-card" ${rowDiagnostics[i]?.signature ? `draggable="true" data-func-name="${row.id}"` : 'disabled'} aria-label="Use result ${row.id}">${rowSymbol(row.id)}<span>${rowDiagnostics[i]?.signature ? colorizeType(rowDiagnostics[i].signature) : 'Complete this row first'}</span></button>`).join('');
  }
  function paintInputs(row, call, index) {
    const holder = row.querySelector('.function-block');
    const structured = iconMode && !!call && !sourceRows.has(getRows()[index].id);
    holder.hidden = !structured;
    row.querySelector('.editor-container').hidden = structured;
    row.querySelector('.row-call').classList.toggle('structured-call', structured);
    const toggle = row.querySelector('.row-code-toggle');
    toggle.hidden = !iconMode || !call;
    toggle.textContent = structured ? 'Edit code' : 'Show block';
    toggle.setAttribute('aria-label', `${structured ? 'Edit code' : 'Show block'} for row ${index + 1}`);
    if (!structured) { holder.replaceChildren(); return; }
    const ts = tokens(getRows()[index].expr).filter(t => t.name !== '(' && t.name !== ')');
    const head = ts[call.infix ? 1 : 0];
    holder.innerHTML = `<button type="button" class="function-head" data-row="${index}" data-start="${head.start}" data-end="${head.end}" data-name="${escHtml(head.name)}" aria-label="Function ${escHtml(call.name)} in row ${index + 1}" title="${escHtml(ICON_CAPTIONS[level.level]?.[call.name] || call.name)}">${rowSymbol(call.name)}<code>${escHtml(call.name)}</code></button><div class="input-slots">` + call.inputs.map((signature, slot) => {
      const name = call.args[slot], filled = name && name !== '_';
      const token = filled ? ts[call.infix ? slot * 2 : slot + 1] : null;
      return `<button type="button" class="argument-slot${filled ? ' filled' : ''}" data-slot="${slot}" data-row="${index}"${token ? ` data-start="${token.start}" data-end="${token.end}" data-name="${escHtml(token.name)}"` : ''} aria-label="Input ${slot + 1} of ${escHtml(call.name)}${filled ? ': ' + escHtml(name) : ': empty'}" title="${escHtml(signature)}">
        <span class="input-number">${slot + 1}</span><span class="input-picture">${filled ? rowSymbol(name) : renderSemanticType(signature, 'Expected input: ' + signature)}</span><span class="input-caption">${filled ? escHtml(name) : 'Drop here'}</span></button>`;
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
      const handle = row.querySelector('.result-handle');
      handle.disabled = !!diagnostic.error;
      if (diagnostic.error) handle.removeAttribute('data-func-name');
      else handle.dataset.funcName = rows[i].id;
      row.classList.toggle('row-invalid', !!diagnostic.error && !!rows[i].expr.trim());
      feedback.innerHTML = diagnostic.error
        ? `<span>${escHtml(rows[i].expr.trim() ? diagnostic.error : 'Drop or type an expression here.')}</span>`
        : `<button type="button" class="row-result" draggable="true" data-func-name="${rows[i].id}" aria-label="Drag result ${rows[i].id}: ${escHtml(diagnostic.signature)}" title="Drag this result into an input in a later row"><span class="result-caption">Result · ${rows[i].id}</span>${renderSemanticType(diagnostic.signature, 'Result ' + rows[i].id + ': ' + diagnostic.signature)}</button><span class="row-type">${colorizeType(diagnostic.signature)}</span>`;
    });
    updateResults();
    document.getElementById('haskell-source').textContent = level.lhs.trim() + '\n  ' + RowProgram.source(rows).replace(/\n/g, '\n  ');
    const history = rowHistory.get(currentLevel);
    document.getElementById('undo-rows').disabled = !history?.undo.length;
    document.getElementById('redo-rows').disabled = !history?.redo.length;
    clearTimeout(liveCheckTimer);
    runLiveCheck();
  }
  function build() {
    const rows = getRows();
    activeRow = Math.min(activeRow, rows.length - 1);
    container.innerHTML = rows.map((row, index) => `<section class="program-row${index === activeRow ? ' active-row' : ''}" data-row="${index}" aria-label="Row ${index + 1}">
      <div class="row-heading"><span class="row-number">${index + 1}</span><button type="button" class="result-handle" draggable="true" data-func-name="${row.id}" title="Drag ${row.id} into a later row">${escHtml(row.id)}</button><span class="row-role">${index === rows.length - 1 ? 'Final answer' : 'Intermediate result'}</span>
      <details class="row-menu"><summary aria-label="Actions for row ${index + 1}">⋯</summary><div class="row-actions"><button type="button" data-action="insert" title="Insert a row above" aria-label="Insert row above ${index + 1}">+</button><button type="button" data-action="up" aria-label="Move row ${index + 1} up" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-action="down" aria-label="Move row ${index + 1} down" ${index === rows.length - 1 ? 'disabled' : ''}>↓</button><button type="button" data-action="remove" aria-label="Remove row ${index + 1}">×</button></div></details></div>
      <button type="button" class="row-code-toggle" data-action="code" hidden></button>
      <div class="row-call"><div class="editor-container"><div class="editor-area"><div class="editor-overlay"${index === 0 ? ' id="editor-overlay"' : ''}></div><textarea class="editor row-editor code"${index === 0 ? ' id="code-editor"' : ''} data-row="${index}" rows="1" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Row ${index + 1} expression" aria-describedby="row-feedback-${index}"></textarea></div></div><div class="function-block" hidden></div></div>
      <div class="row-feedback" id="row-feedback-${index}" aria-live="polite"></div></section>`).join('');
    paint();
  }
  function commit(rebuild = false) { persistRows(); notice(''); rebuild ? build() : paint(); }
  function newRow(at) {
    rememberRows();
    const rows = getRows(); let n = 1;
    while (rows.some(r => r.id === `r${n}`)) n++;
    rows.splice(at, 0, { id: `r${n}`, expr: '' });
    activeRow = at; commit(true);
    editors()[at].scrollIntoView({ block: 'nearest' });
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
    const editor = editors()[index];
    if (editor.closest('.editor-container').hidden) editor.closest('.program-row').querySelector('.function-head').focus({ preventScroll: true });
    else { editor.focus({ preventScroll: true }); editor.setSelectionRange(editor.value.length, editor.value.length); }
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
  function mutateDrop(name, rowIndex, pos, source, connector) {
    const next = structuredClone(getRows());
    if (/^r\d+$/.test(name)) {
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
    rememberRows(); rowPrograms[currentLevel] = next; activeRow = rowIndex; commit(); activate(rowIndex);
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
    if (value && /^r\d+$/.test(value)) {
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
    rememberRows(); rowPrograms[currentLevel] = next; activeRow = index; commit(); activate(index);
  }
  function chooseArgument(slot) {
    const index = Number(slot.dataset.row), position = Number(slot.dataset.slot), snapshot = rowSnapshot();
    const call = rowDiagnostics[index]?.call;
    if (!call) return;
    activate(index);
    const dialog = document.createElement('dialog'); dialog.className = 'connection-picker argument-picker';
    dialog.setAttribute('aria-label', `Choose input ${position + 1} of ${call.name}`);
    dialog.innerHTML = `<h2>Choose input ${position + 1}</h2><p>For <code>${escHtml(call.name)}</code>. Functions can be inputs too.</p><div class="argument-choices"></div><button type="button" class="connection-cancel">Cancel</button>`;
    const close = () => { dialog.close(); dialog.remove(); };
    const choices = [...params, ...getRows().slice(0, index).filter((_, i) => !rowDiagnostics[i]?.error).map(row => row.id), ...level.funcs.map(f => f.name)];
    for (const name of [...choices, null]) {
      if (!name && !call.args[position]) continue;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'argument-choice';
      button.innerHTML = name ? `${rowSymbol(name.replace(/^\((.+)\)$/, '$1'))}<code>${escHtml(name)}</code>` : 'Clear input';
      button.setAttribute('aria-label', name ? `Use input ${name}` : 'Clear input');
      button.onclick = () => { close(); if (rowSnapshot() === snapshot) fillSlot(name, index, position); };
      dialog.querySelector('.argument-choices').append(button);
    }
    dialog.querySelector('.connection-cancel').onclick = close;
    dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
    document.body.append(dialog); dialog.showModal();
  }
  function rowAt(point) {
    const hit = document.elementFromPoint(point.clientX, point.clientY);
    const row = hit?.closest('.program-row');
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
    const index = rowAt(point);
    ghost?.classList.toggle('removing', index === null && !!source);
    if (index === null) return;
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
      for (const op of [...operators.map(f => f.name.slice(1, -1)), '']) {
        const button = document.createElement('button');
        button.className = 'connection-option'; button.dataset.operator = op;
        button.setAttribute('aria-label', op ? `Use ${op}` : 'Insert without operator');
        let text = getRows()[index].expr, start = target.start, end = target.end;
        if (source?.index === index) {
          const removed = removal(text, source, true); text = removed.text;
          if (removed.end <= start) { start -= removed.delta; end -= removed.delta; }
        }
        const preview = text.slice(0, start) + `${left} ${op ? op + ' ' : ''}${right}` + text.slice(end);
        button.innerHTML = `<span class="connection-option-title">${op ? rowSymbol(op) + ' ' + escHtml(op) : 'No operator'}</span><code>${escHtml(preview)}</code>`;
        button.onclick = () => {
          close();
          if (rowSnapshot() === snapshot) mutateDrop(name, index, target.start, source, { ...target, op, swapped });
        };
        holder.append(button);
      }
    }
    dialog.querySelector('#connection-swap').onclick = () => { swapped = !swapped; choices(); };
    dialog.querySelector('.connection-cancel').onclick = close;
    dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
    choices(); dialog.showModal();
  }
  function drop(name, point, source) {
    const slot = slotAt(point);
    if (slot) { fillSlot(name, Number(slot.dataset.row), Number(slot.dataset.slot), source); return; }
    const index = rowAt(point);
    if (index === null) {
      if (source) { rememberRows(); getRows()[source.index].expr = removal(getRows()[source.index].expr, source, true).text; commit(); }
      return;
    }
    const target = targetFor(name, index, point, source);
    if (target) picker(name, target, source);
    else mutateDrop(name, index, caret(index, point).pos, source);
  }
  function moveGhost(point) {
    if (!ghost) return;
    ghost.style.left = Math.max(4, Math.min(point.clientX - ghost.offsetWidth / 2, innerWidth - ghost.offsetWidth - 4)) + 'px';
    ghost.style.top = Math.max(4, point.clientY - ghost.offsetHeight - 24) + 'px';
  }
  function autoScroll(time) {
    if (!drag?.moved || !lastPoint) return;
    const r = container.getBoundingClientRect();
    const hovered = rowAt(lastPoint);
    const onToken = slotAt(lastPoint) || hovered !== null && hitToken(hovered, lastPoint);
    if (!onToken && lastPoint.clientX >= r.left && lastPoint.clientX <= r.right && time - lastScrollTime > 30) {
      const delta = lastPoint.clientY < r.top + 36 ? -14 : lastPoint.clientY > r.bottom - 36 ? 14 : 0;
      if (delta) { container.scrollTop += delta; showIntent(drag.name, lastPoint, drag.source); }
      lastScrollTime = time;
    }
    scrollFrame = requestAnimationFrame(autoScroll);
  }
  function cleanupDrag() {
    if (scrollFrame) cancelAnimationFrame(scrollFrame);
    scrollFrame = null; lastPoint = null;
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
    if (e.key === 'Enter') { e.preventDefault(); newRow(index + 1); editors()[index + 1].focus(); return; }
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
    const slot = e.target.closest('.argument-slot');
    if (slot) { if (!suppressClick) chooseArgument(slot); return; }
    const button = e.target.closest('[data-action]');
    if (!button) return;
    const index = Number(button.closest('.program-row').dataset.row), rows = getRows(), action = button.dataset.action;
    if (action === 'code') {
      if (sourceRows.has(rows[index].id)) sourceRows.delete(rows[index].id);
      else sourceRows.add(rows[index].id);
      activeRow = index; paint(); focusRow(index); activate(index); return;
    }
    if (action === 'insert') { newRow(index); return; }
    const depends = (row, id) => tokens(row.expr).some(t => t.name === id);
    if (action === 'remove') {
      if (rows.some((row, i) => i !== index && depends(row, rows[index].id))) { notice(`${rows[index].id} is used by another row. Remove those references first.`); return; }
      rememberRows();
      if (rows.length === 1) rows[0].expr = '';
      else rows.splice(index, 1);
    } else {
      const other = index + (action === 'up' ? -1 : 1);
      if (other < 0 || other >= rows.length) return;
      const earlier = Math.min(index, other), later = Math.max(index, other);
      if (depends(rows[later], rows[earlier].id)) { notice('Keep a result above the rows that use it.'); return; }
      rememberRows(); [rows[index], rows[other]] = [rows[other], rows[index]]; activeRow = other;
    }
    commit(true);
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
    nativeName = card.dataset.funcName; e.dataTransfer.setData('text/plain', nativeName); card.classList.add('dragging');
  });
  listen(container, 'dragover', e => { e.preventDefault(); showIntent(nativeName, e); });
  listen(container, 'drop', e => { e.preventDefault(); drop(e.dataTransfer.getData('text/plain'), e); cleanupDrag(); nativeName = ''; if (!document.getElementById('connection-picker')) focusRow(activeRow); });
  listen(document, 'dragend', () => { nativeName = ''; cleanupDrag(); });
  listen(document, 'pointerdown', e => {
    if (drag && e.pointerId !== drag.id) { cleanupDrag(); return; }
    if (e.button !== 0 || e.target.closest('dialog')) return;
    const card = e.target.closest('[data-func-name]');
    const editor = e.target.closest('textarea.row-editor');
    const slot = e.target.closest('.argument-slot');
    const head = e.target.closest('.function-head');
    if (!card && !editor && !slot && !head) return;
    if (card && e.pointerType === 'mouse') return; // native HTML drag on desktop cards
    const index = Number((editor || slot || head)?.dataset.row);
    const source = slot ? sourceForSlot(slot) : editor || head ? hitToken(index, e) : null;
    if (!card && !source) return; // empty space is available for scrolling/editing
    e.preventDefault();
    if (editor || slot || head) activate(index);
    if (card) card.draggable = false;
    drag = { card, id: e.pointerId, name: card?.dataset.funcName || source.name, source, x: e.clientX, y: e.clientY, moved: false, snapshot: rowSnapshot() };
    ghost = document.createElement('div'); ghost.id = e.pointerType === 'touch' ? 'touch-drag-ghost' : 'drag-out-ghost'; ghost.className = 'drag-ghost';
    ghost.innerHTML = rowSymbol(drag.name.replace(/^\((.+)\)$/, '$1')) + '<span class="drag-action">Release outside to remove</span>';
    document.body.append(ghost); moveGhost(e);
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
  rowEditorCleanup = () => { cleanupDrag(); controller.abort(); results.remove(); document.querySelector('.argument-picker')?.remove(); rowEditorCleanup = null; };
  build();
  document.fonts.ready.then(() => { if (!controller.signal.aborted) editors().forEach(drawOverlay); });
}
