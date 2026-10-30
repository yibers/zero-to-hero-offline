// Text mode edits the complete RHS, including let bindings and the in expression.
// Keep the draft verbatim until the player changes the corresponding icon rows.
const textHistory = new Map();
function getTextSource() {
  if (textDrafts[currentLevel] !== undefined) return textDrafts[currentLevel];
  const rows = getRows();
  // Preparing a fixed grid can preserve an oversized legacy program as a draft.
  return textDrafts[currentLevel] ?? RowProgram.source(rows);
}
function getTextError() {
  try {
    const source = getTextSource(), program = RowProgram.parseLet(source);
    const rows = program ? [...program.bindings, { id: finalRowName(program.bindings), expr: program.final }] : [{ id: 'r1', expr: source }];
    const errors = RowProgram.validate(rows, LEVELS[currentLevel]);
    const index = errors.findIndex(Boolean);
    if (index < 0) return generatedContinuationError(LEVELS[currentLevel], rows);
    const where = program && index < rows.length - 1 ? `Binding ${rows[index].id}` : 'Final expression';
    return `${where}: ${errors[index]}`;
  } catch (e) { return e.message; }
}
function mountTextEditor() {
  rowEditorCleanup?.();
  const controller = new AbortController();
  const listen = (node, event, fn, options = {}) => node.addEventListener(event, fn, { ...options, signal: controller.signal });
  const editor = document.getElementById('code-editor'), overlay = document.getElementById('editor-overlay');
  const undo = document.getElementById('undo-rows'), redo = document.getElementById('redo-rows');
  const level = LEVELS[currentLevel];
  const functions = new Set(level.funcs.flatMap(f => [f.name, f.name.replace(/^\(|\)$/g, '')]));
  const params = new Set(level.lhs.split('=')[0].trim().split(/\s+/).slice(1));
  const history = textHistory.get(currentLevel) || { undo: [], redo: [] };
  textHistory.set(currentLevel, history);
  editor.value = getTextSource();
  const snapshot = () => ({ value: editor.value, start: editor.selectionStart, end: editor.selectionEnd });
  let last = snapshot(), beforeInput = null, drag = null, ghost = null, nativeName = '';
  function paint() {
    overlay.innerHTML = editor.value.replace(/[a-zA-Z_][a-zA-Z0-9_']*|[!@#$%^&*\-+=<>?/|~:.\\]+|[^\w]/g, token => {
      const cls = token === 'let' || token === 'in' ? 'source-keyword'
        : params.has(token) ? 'source-param' : functions.has(token) ? 'source-function' : '';
      return cls ? `<span class="${cls}">${escHtml(token)}</span>` : escHtml(token);
    }) + '\n';
    overlay.scrollTop = editor.scrollTop;
    overlay.scrollLeft = editor.scrollLeft;
    undo.disabled = !history.undo.length;
    redo.disabled = !history.redo.length;
    clearTimeout(liveCheckTimer);
    runLiveCheck();
    last = snapshot();
  }
  function save() {
    textDrafts[currentLevel] = editor.value;
    editorContents[currentLevel] = level.lhs.trim() + ' ' + editor.value;
    delete rowPrograms[currentLevel];
    rowHistory.delete(currentLevel);
    saveProgress();
    paint();
  }
  function commit(before) {
    if (before.value !== editor.value) {
      history.undo.push(before);
      if (history.undo.length > 100) history.undo.shift();
      history.redo = [];
      save();
    }
  }
  function replace(text, start = editor.selectionStart, end = editor.selectionEnd) {
    const before = snapshot();
    editor.setRangeText(text, start, end, 'end');
    commit(before);
  }
  function historyMove(direction) {
    const from = history[direction];
    if (!from.length) return;
    history[direction === 'undo' ? 'redo' : 'undo'].push(snapshot());
    const next = from.pop();
    editor.value = next.value;
    editor.setSelectionRange(next.start, next.end);
    save();
    editor.focus({ preventScroll: true });
  }
  listen(editor, 'beforeinput', () => { beforeInput = snapshot(); });
  listen(editor, 'input', () => { commit(beforeInput || last); beforeInput = null; });
  listen(editor, 'scroll', () => { overlay.scrollTop = editor.scrollTop; overlay.scrollLeft = editor.scrollLeft; });
  listen(editor, 'keydown', e => {
    if ((e.ctrlKey || e.metaKey) && /^(z|y)$/i.test(e.key)) {
      e.preventDefault(); historyMove(e.key.toLowerCase() === 'y' || e.shiftKey ? 'redo' : 'undo'); return;
    }
    if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
    const start = editor.selectionStart, lineStart = editor.value.lastIndexOf('\n', start - 1) + 1;
    const line = editor.value.slice(lineStart, start), indent = line.match(/^\s*/)[0];
    if (e.key === 'Enter') {
      e.preventDefault(); replace('\n' + indent + (/^(let|in)$/.test(line.trim()) ? '  ' : ''));
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        const remove = Math.min(2, indent.length);
        if (remove) {
          const before = snapshot();
          editor.setRangeText('', lineStart, lineStart + remove, 'preserve');
          commit(before);
        }
      } else replace('  ');
    }
  });
  listen(undo, 'click', () => historyMove('undo'));
  listen(redo, 'click', () => historyMove('redo'));

  // Drop cards at the actual line and column; ordinary text selection stays native.
  function caretAt(point) {
    const rect = editor.getBoundingClientRect(), style = getComputedStyle(editor);
    const lines = editor.value.split('\n');
    const line = Math.max(0, Math.min(lines.length - 1,
      Math.floor((point.clientY - rect.top - parseFloat(style.paddingTop) + editor.scrollTop) / parseFloat(style.lineHeight))));
    const context = document.createElement('canvas').getContext('2d');
    context.font = style.font;
    const column = Math.max(0, Math.min(lines[line].length,
      Math.round((point.clientX - rect.left - parseFloat(style.paddingLeft) + editor.scrollLeft) / context.measureText('M').width)));
    return lines.slice(0, line).reduce((length, text) => length + text.length + 1, 0) + column;
  }
  function insert(name, position) {
    const left = editor.value.slice(0, position), right = editor.value.slice(position);
    const insertion = (left && !/[\s(]$/.test(left) ? ' ' : '') + name + (right && !/^[\s)]/.test(right) ? ' ' : '');
    const error = cardUsageIncreaseError(level, editor.value, left + insertion + right);
    document.getElementById('row-notice').textContent = error || '';
    if (!error) replace(insertion, position, position);
  }
  function overEditor(point) { return document.elementFromPoint(point.clientX, point.clientY) === editor; }
  let suppressCardClick = false;
  function tapCard(event) {
    if (suppressCardClick) return;
    const card = event.target.closest('#function-palette [data-func-name]');
    if (!card) return;
    if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
    event.preventDefault(); insert(card.dataset.funcName, editor.selectionStart);
  }
  listen(document, 'click', tapCard);
  listen(document, 'keydown', tapCard);
  listen(document, 'dragstart', e => {
    const card = e.target.closest('[data-func-name]');
    if (!card) return;
    if (card.dataset.cardKind === 'transformation') { e.preventDefault(); return; }
    nativeName = card.dataset.funcName;
    e.dataTransfer.setData('text/plain', nativeName);
  });
  listen(editor, 'dragover', e => { if (nativeName) e.preventDefault(); });
  listen(editor, 'drop', e => {
    if (!nativeName) return;
    e.preventDefault(); insert(nativeName, caretAt(e)); nativeName = '';
    editor.focus({ preventScroll: true });
  });
  listen(document, 'dragend', () => { nativeName = ''; });
  function cleanupDrag() {
    if (drag) drag.card.draggable = true;
    drag = null; ghost?.remove(); ghost = null;
  }
  function moveGhost(e) {
    ghost.style.left = Math.max(4, Math.min(innerWidth - ghost.offsetWidth - 4, e.clientX - ghost.offsetWidth / 2)) + 'px';
    ghost.style.top = Math.max(4, e.clientY - ghost.offsetHeight - 24) + 'px';
  }
  listen(document, 'pointerdown', e => {
    if (drag && drag.id !== e.pointerId) { cleanupDrag(); return; }
    if (e.pointerType === 'mouse' || e.button !== 0 || e.target.closest('dialog')) return;
    const card = e.target.closest('[data-func-name]');
    if (!card || card.dataset.cardKind === 'transformation') return;
    e.preventDefault(); card.draggable = false;
    drag = { card, name: card.dataset.funcName, id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    ghost = document.createElement('div'); ghost.id = 'touch-drag-ghost'; ghost.className = 'drag-ghost'; ghost.textContent = drag.name;
    document.body.append(ghost); moveGhost(e);
  });
  listen(document, 'touchstart', e => { if (drag && e.cancelable) e.preventDefault(); }, { passive: false });
  listen(document, 'pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;
    e.preventDefault();
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5) drag.moved = true;
    moveGhost(e);
  }, { passive: false });
  listen(document, 'pointerup', e => {
    if (!drag || drag.id !== e.pointerId) return;
    suppressCardClick = true; setTimeout(() => { suppressCardClick = false; }, 0);
    if (drag.moved && overEditor(e)) insert(drag.name, caretAt(e));
    else if (!drag.moved) insert(drag.name, editor.selectionStart);
    cleanupDrag();
  });
  listen(document, 'pointercancel', cleanupDrag);
  listen(window, 'blur', cleanupDrag);
  listen(document, 'visibilitychange', () => { if (document.hidden) cleanupDrag(); });
  rowEditorCleanup = () => { cleanupDrag(); controller.abort(); rowEditorCleanup = null; };
  paint();
}
