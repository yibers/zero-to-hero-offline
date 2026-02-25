// Minimal type checker test - runs in Node

function tokenize(sig) {
  const tokens = [];
  let i = 0;
  while (i < sig.length) {
    if (sig[i] === ' ') { i++; continue; }
    if (sig[i] === '(' && sig[i+1] === ')') { tokens.push('()'); i += 2; continue; }
    if (sig[i] === '(') {
      if (sig[i+1] === ',') {
        let j = i + 1;
        while (j < sig.length && sig[j] === ',') j++;
        if (sig[j] === ')') { tokens.push(sig.slice(i, j+1)); i = j+1; continue; }
      }
      tokens.push('('); i++; continue;
    }
    if (sig[i] === ')') { tokens.push(')'); i++; continue; }
    if (sig[i] === ',') { tokens.push(','); i++; continue; }
    if (sig[i] === '-' && sig[i+1] === '>') { tokens.push('->'); i += 2; continue; }
    if (/[A-Za-z_]/.test(sig[i])) {
      let j = i;
      while (j < sig.length && /[A-Za-z0-9_]/.test(sig[j])) j++;
      tokens.push(sig.slice(i, j)); i = j; continue;
    }
    i++;
  }
  return tokens;
}

function parseType(sig) {
  const tokens = tokenize(sig);
  let pos = 0;
  function peek() { return tokens[pos]; }
  function consume(t) { if (tokens[pos] === t) { pos++; return true; } return false; }
  function next() { return tokens[pos++]; }
  function parseArrow() {
    const left = parseApp();
    if (peek() === '->') { next(); return { tag: 'fun', from: left, to: parseArrow() }; }
    return left;
  }
  function parseApp() {
    let base = parseAtom();
    if (!base) return null;
    while (pos < tokens.length && peek() !== ')' && peek() !== ',' && peek() !== '->') {
      const arg = parseAtom();
      if (!arg) break;
      base = { tag: 'app', con: base, arg };
    }
    return base;
  }
  function parseAtom() {
    const t = peek();
    if (!t || t === ')' || t === ',' || t === '->') return null;
    if (t === '(') {
      next();
      const inner = parseArrow();
      if (peek() === ',') {
        const elems = [inner];
        while (consume(',')) elems.push(parseArrow());
        consume(')');
        return makeTuple(elems);
      }
      consume(')');
      return inner;
    }
    if (t === '()') { next(); return { tag: 'con', name: '()' }; }
    next();
    if (t[0] >= 'A' && t[0] <= 'Z') return { tag: 'con', name: t };
    return { tag: 'var', name: t };
  }
  function makeTuple(elems) {
    let t = { tag: 'con', name: `(${','.repeat(elems.length - 1)})` };
    for (const e of elems) t = { tag: 'app', con: t, arg: e };
    return t;
  }
  return parseArrow();
}

let substCounter = 0;
function freshVar() { return { tag: 'var', name: `_t${substCounter++}` }; }
function freshen(type, mapping = {}) {
  switch (type.tag) {
    case 'var': if (!mapping[type.name]) mapping[type.name] = freshVar(); return mapping[type.name];
    case 'con': return type;
    case 'app': return { tag: 'app', con: freshen(type.con, mapping), arg: freshen(type.arg, mapping) };
    case 'fun': return { tag: 'fun', from: freshen(type.from, mapping), to: freshen(type.to, mapping) };
  }
}
function applySubst(subst, type) {
  switch (type.tag) {
    case 'var': if (subst[type.name]) return applySubst(subst, subst[type.name]); return type;
    case 'con': return type;
    case 'app': return { tag: 'app', con: applySubst(subst, type.con), arg: applySubst(subst, type.arg) };
    case 'fun': return { tag: 'fun', from: applySubst(subst, type.from), to: applySubst(subst, type.to) };
  }
}
function occursIn(name, type, subst) {
  type = applySubst(subst, type);
  switch (type.tag) {
    case 'var': return type.name === name;
    case 'con': return false;
    case 'app': return occursIn(name, type.con, subst) || occursIn(name, type.arg, subst);
    case 'fun': return occursIn(name, type.from, subst) || occursIn(name, type.to, subst);
  }
}
function unify(a, b, subst) {
  a = applySubst(subst, a); b = applySubst(subst, b);
  if (a.tag === 'var') {
    if (a.name === b.name) return subst;
    if (occursIn(a.name, b, subst)) return null;
    return { ...subst, [a.name]: b };
  }
  if (b.tag === 'var') {
    if (occursIn(b.name, a, subst)) return null;
    return { ...subst, [b.name]: a };
  }
  if (a.tag === 'con' && b.tag === 'con') return a.name === b.name ? subst : null;
  if (a.tag === 'app' && b.tag === 'app') {
    subst = unify(a.con, b.con, subst); if (!subst) return null;
    return unify(a.arg, b.arg, subst);
  }
  if (a.tag === 'fun' && b.tag === 'fun') {
    subst = unify(a.from, b.from, subst); if (!subst) return null;
    return unify(a.to, b.to, subst);
  }
  if ((a.tag === 'fun') !== (b.tag === 'fun')) {
    function funToApp(t) {
      if (t.tag === 'fun') return { tag: 'app', con: { tag: 'app', con: { tag: 'con', name: '->' }, arg: t.from }, arg: t.to };
      return t;
    }
    return unify(funToApp(a), funToApp(b), subst);
  }
  return null;
}
function typeToString(type) {
  switch (type.tag) {
    case 'var': return type.name;
    case 'con': return type.name;
    case 'fun': {
      const from = type.from.tag === 'fun' ? `(${typeToString(type.from)})` : typeToString(type.from);
      return `${from} -> ${typeToString(type.to)}`;
    }
    case 'app': {
      const flat = flattenApp(type);
      if (flat.head.tag === 'con' && flat.head.name.startsWith('(') && flat.head.name.endsWith(')')) {
        const commas = (flat.head.name.match(/,/g) || []).length;
        if (commas + 1 === flat.args.length) return `(${flat.args.map(typeToString).join(', ')})`;
      }
      const argStr = type.arg.tag === 'app' || type.arg.tag === 'fun' ? `(${typeToString(type.arg)})` : typeToString(type.arg);
      return `${typeToString(type.con)} ${argStr}`;
    }
  }
}
function flattenApp(type) {
  const args = [];
  let cur = type;
  while (cur.tag === 'app') { args.unshift(cur.arg); cur = cur.con; }
  return { head: cur, args };
}
function findVars(type) {
  const vars = new Set();
  (function go(t) {
    switch (t.tag) {
      case 'var': vars.add(t.name); break;
      case 'con': break;
      case 'app': go(t.con); go(t.arg); break;
      case 'fun': go(t.from); go(t.to); break;
    }
  })(type);
  return vars;
}

function tokenizeExpr(code) {
  const tokens = [];
  let i = 0;
  while (i < code.length) {
    if (code[i] === ' ' || code[i] === '\n' || code[i] === '\r' || code[i] === '\t') { i++; continue; }
    if (code[i] === '(') { tokens.push('('); i++; continue; }
    if (code[i] === ')') { tokens.push(')'); i++; continue; }
    if (code[i] === '$' && (i+1 >= code.length || code[i+1] === ' ')) { tokens.push('$'); i++; continue; }
    if (code[i] === '.' && (i+1 >= code.length || code[i+1] === ' ')) { tokens.push('.'); i++; continue; }
    if (code.slice(i, i+3) === '<$>') { tokens.push('<$>'); i += 3; continue; }
    if (code.slice(i, i+3) === '<*>') { tokens.push('<*>'); i += 3; continue; }
    if (/[A-Za-z_]/.test(code[i])) {
      let j = i;
      while (j < code.length && /[A-Za-z0-9_']/.test(code[j])) j++;
      const word = code.slice(i, j);
      if (word === 'undefined') tokens.push({ type: 'undefined' });
      else tokens.push({ type: 'ident', name: word });
      i = j; continue;
    }
    i++;
  }
  return tokens;
}

function inferExpr(code, env, paramTypes) {
  const tokens = tokenizeExpr(code);
  let pos = 0;
  function peek() { return tokens[pos]; }
  function next() { return tokens[pos++]; }
  function parseExprFull() { return parseDollar(); }
  function parseDollar() {
    let left = parseOps();
    while (peek() === '$') { next(); const right = parseDollar(); left = applyFuncType(left, right); }
    return left;
  }
  function parseOps() {
    let left = parseAppChain();
    while (true) {
      const t = peek();
      if (t === '<$>') {
        next(); const right = parseAppChain();
        left = applyBinOp(freshen(env['<$>'] || env['(<$>)']), left, right);
      } else if (t === '<*>') {
        next(); const right = parseAppChain();
        left = applyBinOp(freshen(env['<*>'] || env['(<*>)']), left, right);
      } else if (t === '.') {
        next(); const right = parseOps();
        left = applyBinOp(freshen(env['.'] || env['(.)']), left, right);
      } else break;
    }
    return left;
  }
  function parseAppChain() {
    let func = parseAtomExpr();
    if (!func) return null;
    while (pos < tokens.length) {
      const t = peek();
      if (!t || t === '$' || t === '.' || t === '<$>' || t === '<*>' || t === ')') break;
      const arg = parseAtomExpr();
      if (!arg) break;
      func = applyFuncType(func, arg);
    }
    return func;
  }
  function parseAtomExpr() {
    const t = peek();
    if (!t) return null;
    if (t === '(') {
      next();
      const inner = peek();
      if (inner === ')') { next(); return null; }
      if (inner === '.' || inner === '$' || inner === '<$>' || inner === '<*>') {
        const opName = next();
        if (peek() === ')') {
          next();
          const opType = env[opName] || env[`(${opName})`];
          if (opType) return freshen(opType);
          throw new Error(`Unknown operator: ${opName}`);
        }
      }
      const expr = parseExprFull();
      if (peek() === ')') next();
      return expr;
    }
    if (typeof t === 'object' && t.type === 'ident') {
      next();
      if (paramTypes[t.name]) return paramTypes[t.name];
      if (env[t.name]) return freshen(env[t.name]);
      throw new Error(`Unknown identifier: ${t.name}`);
    }
    if (typeof t === 'object' && t.type === 'undefined') { next(); return freshVar(); }
    if (typeof t === 'string' && t !== ')' && t !== '$' && t !== '.' && t !== '<$>' && t !== '<*>') { next(); return freshVar(); }
    return null;
  }
  function applyFuncType(funcType, argType) {
    const a = freshVar(), b = freshVar();
    const subst = unify(funcType, { tag: 'fun', from: a, to: b }, {});
    if (!subst) throw new Error(`Cannot apply: not a function type\n  ${typeToString(funcType)}`);
    const paramType = applySubst(subst, a);
    const subst2 = unify(paramType, argType, subst);
    if (!subst2) throw new Error(`Type mismatch in application`);
    return applySubst(subst2, b);
  }
  function applyBinOp(opType, left, right) {
    return applyFuncType(applyFuncType(opType, left), right);
  }
  return parseExprFull();
}

function typeCheck(levelData, code) {
  substCounter = 0;
  if (!code.trim()) return { ok: false, msg: 'No changes.' };
  const env = {};
  for (const f of levelData.funcs) {
    env[f.name] = parseType(f.sig);
    const bare = f.name.replace(/^\(/, '').replace(/\)$/, '');
    if (bare !== f.name) env[bare] = parseType(f.sig);
  }
  const lhsParts = levelData.lhs.replace('=', '').trim().split(/\s+/);
  const paramNames = lhsParts.slice(1);
  const targetType = parseType(levelData.target);
  const skolemSubst = {};
  for (const v of findVars(targetType)) skolemSubst[v] = { tag: 'con', name: `SKOLEM${v}` };
  let skolemRemaining = applySubst(skolemSubst, targetType);
  const skolemParamTypes = {};
  for (const p of paramNames) {
    if (skolemRemaining.tag === 'fun') {
      skolemParamTypes[p] = skolemRemaining.from;
      skolemRemaining = skolemRemaining.to;
    }
  }
  try {
    const inferredType = inferExpr(code, env, skolemParamTypes);
    if (!inferredType) return { ok: false, msg: 'Could not infer type.' };
    const subst = unify(inferredType, skolemRemaining, {});
    if (!subst) return { ok: false, msg: `Type mismatch:\n  Expected: ${typeToString(skolemRemaining)}\n  Got:      ${typeToString(applySubst({}, inferredType))}` };
    return { ok: true, msg: 'Success!' };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}

// ─── Level Data ───
const LEVELS = [
  { level:1, target:"Zero a -> Hero a", lhs:"zeroToHero z =",
    funcs:[{name:"f",sig:"Zero a -> Hero a"}] },
  { level:2, target:"Zero a -> Hero a", lhs:"zeroToHero z =",
    funcs:[{name:"runZero",sig:"Zero a -> a"},{name:"mkHero",sig:"a -> Hero a"},{name:"($)",sig:"(a -> b) -> a -> b"}] },
  { level:3, target:"Zero a -> Hero (a, a)", lhs:"zeroToHero z =",
    funcs:[{name:"f1",sig:"Zero a -> Hero a"},{name:"f2",sig:"Zero a -> (a, a)"},{name:"f3",sig:"Hero a -> Hero (a, a)"},{name:"($)",sig:"(a -> b) -> a -> b"},{name:"(.)",sig:"(b -> c) -> (a -> b) -> a -> c"}] },
  { level:4, target:"Zero a b -> Hero b b", lhs:"zeroToHero z =",
    funcs:[{name:"f1",sig:"Zero a b -> Hero b a"},{name:"f2",sig:"Zero a a -> Hero a a"},{name:"f3",sig:"Zero a b -> Zero b a"},{name:"f4",sig:"Zero a b -> Zero b b"},{name:"($)",sig:"(a -> b) -> a -> b"},{name:"(.)",sig:"(b -> c) -> (a -> b) -> a -> c"}] },
  { level:5, target:"Zero a b -> Hero (a, b)", lhs:"zeroToHero z =",
    funcs:[{name:"fst",sig:"(a, b) -> a"},{name:"snd",sig:"(a, b) -> b"},{name:"f1",sig:"Zero a b -> Zero a (a, b)"},{name:"f2",sig:"Zero a b -> Hero (b, a)"},{name:"f3",sig:"Zero a b -> (Hero a, Hero b)"},{name:"($)",sig:"(a -> b) -> a -> b"},{name:"(.)",sig:"(b -> c) -> (a -> b) -> a -> c"}] },
  { level:6, target:"Zero a b c -> Hero c a", lhs:"zeroToHero z =",
    funcs:[{name:"f1",sig:"Zero a b c -> Zero c b a"},{name:"f2",sig:"Zero a b c -> Zero a c c"},{name:"f3",sig:"Zero a b c -> Hero b c"},{name:"($)",sig:"(a -> b) -> a -> b"},{name:"(.)",sig:"(b -> c) -> (a -> b) -> a -> c"}] },
  { level:7, target:"Zero a b c -> Hero c", lhs:"zeroToHero z =",
    funcs:[{name:"f1",sig:"Zero a b c -> Hero (a -> b)"},{name:"f2",sig:"Zero a b c -> Hero (b -> c)"},{name:"f3",sig:"Zero a b c -> Hero a"},{name:"(<$>)",sig:"(a -> b) -> Hero a -> Hero b"},{name:"(<*>)",sig:"Hero (a -> c) -> Hero a -> Hero c"},{name:"($)",sig:"(a -> b) -> a -> b"},{name:"(.)",sig:"(b -> c) -> (a -> b) -> a -> c"}] },
  { level:8, target:"(a -> d) -> (b -> d) -> (c -> d) -> Zero a b c -> Hero a d c", lhs:"zeroToHero ad bd cd z =",
    funcs:[{name:"fmap",sig:"(c -> d) -> Zero a b c -> Zero a b d"},{name:"f1",sig:"Zero a b c -> Zero c a b"},{name:"f2",sig:"Zero a b c -> Hero a b c"},{name:"($)",sig:"(a -> b) -> a -> b"},{name:"(.)",sig:"(b -> c) -> (a -> b) -> a -> c"}] },
  { level:9, target:"Zero a b c d -> Hero d d d d", lhs:"zeroToHero z =",
    funcs:[{name:"f1",sig:"Zero a b c d -> Zero a a b b"},{name:"f2",sig:"Zero a b c d -> Hero c c d d"},{name:"f3",sig:"Zero a b c d -> Zero d c b a"},{name:"($)",sig:"(a -> b) -> a -> b"},{name:"(.)",sig:"(b -> c) -> (a -> b) -> a -> c"}] },
  { level:10, target:"Zero (a -> b -> c -> d) a b c -> Hero d", lhs:"zeroToHero z =",
    funcs:[{name:"f1",sig:"Zero (a -> b) a c d -> Zero () b c d"},{name:"f2",sig:"Zero a b c d -> Zero b c d a"},{name:"f3",sig:"Zero a b c d -> Hero d"},{name:"($)",sig:"(a -> b) -> a -> b"},{name:"(.)",sig:"(b -> c) -> (a -> b) -> a -> c"}] },
];

const tests = [
  // L1: f :: Zero a -> Hero a. Just apply f.
  { level: 1, code: "f z", expect: true },
  { level: 1, code: "z", expect: false },
  // L2: runZero unwraps, mkHero wraps.
  { level: 2, code: "mkHero $ runZero z", expect: true },
  { level: 2, code: "mkHero (runZero z)", expect: true },
  // L3: f3 . f1 composes Hero a -> Hero (a,a) with Zero a -> Hero a
  { level: 3, code: "f3 $ f1 z", expect: true },
  { level: 3, code: "f3 (f1 z)", expect: true },
  { level: 3, code: "f1 z", expect: false },
  // L4: f4 makes Zero b b, f2 takes Zero a a -> Hero a a
  { level: 4, code: "f2 $ f4 z", expect: true },
  // L5: f1 z :: Zero a (a,b), f3 gives (Hero a, Hero (a,b)), snd extracts Hero (a,b)
  { level: 5, code: "snd $ f3 $ f1 z", expect: true },
  { level: 5, code: "snd (f3 (f1 z))", expect: true },
  { level: 5, code: "f2 $ f1 z", expect: false },
  // L6: f2 z :: Zero a c c, f1 gives Zero c c a, f3 gives Hero c a
  { level: 6, code: "f3 $ f1 $ f2 z", expect: true },
  { level: 6, code: "f3 (f1 (f2 z))", expect: true },
  // L7: f1 z <*> f3 z :: Hero b, then f2 z <*> that :: Hero c
  { level: 7, code: "f2 z <*> (f1 z <*> f3 z)", expect: true },
  // L8: rotate, fmap bd, rotate twice, f2
  { level: 8, code: "f2 $ f1 $ f1 $ fmap bd $ f1 z", expect: true },
  // L9: f3 z reverses, f1 twice makes all d, f2 extracts
  { level: 9, code: "f2 $ f1 $ f1 $ f3 z", expect: true },
  // L10: apply f then rotate, repeat 3 times, then position d and extract
  { level: 10, code: "f3 $ f2 $ f2 $ f1 $ f2 $ f1 $ f2 $ f1 z", expect: true },
];

let pass = 0, fail = 0;
for (const t of tests) {
  const r = typeCheck(LEVELS[t.level - 1], t.code);
  const ok = r.ok === t.expect;
  console.log(`${ok ? 'PASS' : 'FAIL'} L${t.level} "${t.code}" -> ${r.ok ? 'pass' : 'fail'}${r.ok ? '' : ` (${r.msg})`}`);
  if (ok) pass++; else fail++;
}
console.log(`\n${pass}/${tests.length} passed, ${fail} failed`);
