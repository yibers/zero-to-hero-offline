// Stable display names, independent of inference's fresh-variable counters.
// Named a/b/c/d use circle/square/diamond/triangle across every level. Explicit
// mappings carry a generated function's shapes into its later uses.
function semanticVariables(type, preferred = []) {
  const variables = new Map(preferred.map((entry, i) => Array.isArray(entry) ? entry : [entry, i]));
  const names = [];
  function visit(type) {
    if (!type) return;
    if (type.tag === 'var' && !names.includes(type.name)) names.push(type.name);
    if (type.tag === 'fun') { visit(type.from); visit(type.to); }
    if (type.tag === 'app') { visit(type.con); visit(type.arg); }
  }
  visit(type);
  const used = new Set(variables.values());
  // Reserve the conventional shapes before assigning any anonymous variables.
  for (const name of names.filter(name => /^[a-z]$/.test(name))) {
    const marker = name.charCodeAt(0) - 97;
    if (!variables.has(name) && !used.has(marker)) { variables.set(name, marker); used.add(marker); }
  }
  for (const name of names) if (!variables.has(name)) {
    let marker = 0; while (used.has(marker)) marker++;
    variables.set(name, marker); used.add(marker);
  }
  return [...variables];
}

// Pictograms describe the puzzle's type transformations. No runtime behavior is
// inferred beyond the supplied signatures. Dotted gray shapes identify generic
// slots; colored outlines show fixed types. Filled shapes represent values of
// those types, without claiming to show their runtime contents.
function createSemanticIcons(levels, parseType, flattenApp, typeToString) {
  const escape = text => String(text).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const shield = '<path d="M12 2 4 6v7c0 4.5 3.3 7.4 8 9 4.7-1.6 8-4.5 8-9V6Z"/>';
  const hedgehog = '<path d="m16.5 2 2 4c1.6 1.3 2.1 3.1 2 5.2l2 .8v2l-2 .3C19 19.5 15.7 21 11.2 19.7L6 22l1.1-4.4L2 18.5l3.2-4.6L1 12.5l5-3.4L3 6h7.2c1.8-1.2 3.4-1.3 4.8-.5Z"/>';
  const outline = (body, width = 1.8) => `<g fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
  // Lay diagrams out from their leaves outward, then use one display scale:
  // wrappers can grow, but a value never shrinks when it is nested or reused.
  const iconScale = 0.75;
  const svg = (label, body, width, height = width) => {
    const displayWidth = width * iconScale, displayHeight = height * iconScale;
    return `<svg class="semantic-diagram" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${displayWidth}" height="${displayHeight}" style="width:${displayWidth}px;height:${displayHeight}px;max-width:none;flex-shrink:0" role="img" aria-label="${escape(label)}"><title>${escape(label)}</title>${body}</svg>`;
  };
  const move = (body, x, y) => `<g transform="translate(${x} ${y})">${body}</g>`;
  const variableMap = names => new Map(names.map((name, i) => Array.isArray(name) ? name : [name, i]));
  const marks = {
    a: '<circle cx="12" cy="12" r="10" fill="none" stroke="#d97706" stroke-width="2"/>',
    b: '<rect x="2" y="2" width="20" height="20" rx="2" fill="none" stroke="#0284c7" stroke-width="2"/>',
    c: '<path d="m12 2 10 10-10 10L2 12Z" fill="none" stroke="#9333ea" stroke-width="2"/>',
    d: '<path d="M12 2 22 22H2Z" fill="none" stroke="#059669" stroke-width="2"/>',
  };
  function fixedType(type) {
    if (typeof type === 'string') type = parseType(type);
    if (type.tag === 'var') return { tag: 'con', name: 'SKOLEM' + type.name };
    if (type.tag === 'fun') return { ...type, from: fixedType(type.from), to: fixedType(type.to) };
    if (type.tag === 'app') return { ...type, con: fixedType(type.con), arg: fixedType(type.arg) };
    return type;
  }
  function genericSlot(name, variables, type = null, maxWidth = Infinity, isValue = false) {
    if (!variables.has(name)) variables.set(name, Math.max(-1, ...variables.values()) + 1);
    const index = variables.get(name), count = index + 1;
    const factor = index === 0 ? 1.6 : index === 1 ? 1 : 2;
    const padding = index === 0 ? 10 : 16;
    const content = type ? layout(type, Math.max(24, (maxWidth - padding) / factor), variables, null, isValue)
      : { width: 24, height: 24, body: '' };
    // Empty placeholders match the 24-unit footprint of concrete types/values.
    // Only an explicitly nested specialization needs a larger enclosing shape.
    const width = type ? content.width * factor + padding : 24;
    const height = type ? content.height * factor + padding : 24;
    let shape;
    if (index === 0) shape = `<ellipse cx="${width / 2}" cy="${height / 2}" rx="${width / 2 - 2}" ry="${height / 2 - 2}"/>`;
    else if (index === 1) shape = `<rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="3"/>`;
    else if (index === 2) shape = `<path d="M${width / 2} 2 ${width - 2} ${height / 2} ${width / 2} ${height - 2} 2 ${height / 2}Z"/>`;
    else if (index === 3) shape = `<path d="M${width / 2} 2 ${width - 2} ${height - 2} 2 ${height - 2}Z"/>`;
    else {
      const sides = index + 1;
      const points = Array.from({ length: sides }, (_, i) => {
        const angle = -Math.PI / 2 + i * 2 * Math.PI / sides;
        return `${width / 2 + (width / 2 - 2) * Math.cos(angle)},${height / 2 + (height / 2 - 2) * Math.sin(angle)}`;
      }).join(' ');
      shape = `<polygon points="${points}"/>`;
    }
    const label = type ? `Type slot ${count}: assigned ${typeToString(type).replace(/SKOLEM/g, '')}`
      : `Type placeholder ${count}: any type; matching gray shapes use the same type`;
    return { width, height, body: `<g class="${type ? 'type-binding' : 'type-placeholder'}" data-variable="${escape(name)}" data-marker="${count}"><title>${escape(label)}</title>` +
      `<g class="generic-outline" fill="none" stroke="#7c8797" stroke-width="1.8" stroke-dasharray="0.1 3.4" stroke-linecap="round" stroke-linejoin="round">${shape}</g>` +
      move(content.body, (width - content.width) / 2, index === 3 ? height / 2 : (height - content.height) / 2) + '</g>' };
  }
  const arrow = y => outline(`<path d="M4 ${y}H20m-5-5 5 5-5 5"/>`, 1.8);
  function parts(type, limit = Infinity) {
    const args = [];
    while (type.tag === 'fun' && args.length < limit) { args.push(type.from); type = type.to; }
    return { args, result: type };
  }
  function row(children, gap = 6, maxWidth = Infinity) {
    const lines = []; let line = [], width = 0;
    for (const child of children) {
      if (line.length && width + gap + child.width > maxWidth) {
        lines.push(line); line = []; width = 0;
      }
      width += (line.length ? gap : 0) + child.width;
      line.push(child);
    }
    if (line.length) lines.push(line);
    let y = 0, widest = 0;
    const body = lines.map((items, index) => {
      const height = Math.max(24, ...items.map(child => child.height));
      let x = 0;
      const content = items.map(child => {
        const placed = move(child.body, x, y + (height - child.height) / 2);
        x += child.width + gap;
        return placed;
      }).join('');
      widest = Math.max(widest, x - gap);
      y += height + (index < lines.length - 1 ? 8 : 0);
      return content;
    }).join('');
    return { width: widest, height: Math.max(24, y), body };
  }
  function frame(content, padding, shape) {
    const width = content.width + padding.x * 2, height = content.height + padding.y * 2;
    return { width, height, body: outline(shape(width, height)) + move(content.body, padding.x, padding.y) };
  }
  const rectangle = (w, h) => `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="4"/>`;
  function flow(args, result, maxWidth = Infinity, variables = new Map(), inputsOnly = false, template = null) {
    const pattern = template ? parts(template, args.length) : null;
    const inputs = row(args.map((type, i) => layout(type, maxWidth, variables, pattern?.args[i])), 6, maxWidth);
    // Row heads share their output with the separate result card. Preserve
    // complete diagrams within inputs that are themselves functions.
    if (inputsOnly) return { ...inputs, body: `<g class="icon-inputs">${inputs.body}</g>` };
    const output = layout(result, maxWidth, variables, pattern?.result);
    if (inputs.width + 28 + output.width > maxWidth) {
      const width = Math.max(inputs.width, output.width);
      const center = width / 2, arrowTop = inputs.height + 4;
      return { width, height: inputs.height + 24 + output.height,
        body: `<g class="icon-inputs">${move(inputs.body, (width - inputs.width) / 2, 0)}</g>` +
          outline(`<path d="M${center} ${arrowTop}v16m-5-5 5 5 5-5"/>`) +
          `<g class="icon-output">${move(output.body, (width - output.width) / 2, inputs.height + 24)}</g>` };
    }
    const height = Math.max(inputs.height, output.height);
    return { width: inputs.width + 28 + output.width, height,
      body: `<g class="icon-inputs">${move(inputs.body, 0, (height - inputs.height) / 2)}</g>` +
        move(arrow(height / 2), inputs.width + 2, 0) +
        `<g class="icon-output">${move(output.body, inputs.width + 28, (height - output.height) / 2)}</g>` };
  }
  function layout(type, maxWidth = Infinity, variables = new Map(), template = null, isValue = false) {
    // A placed value carries its own structure, not the generic slot it filled.
    if (isValue) template = null;
    if (template?.tag === 'var') return genericSlot(template.name, variables, type.tag === 'var' ? null : type, maxWidth, isValue);
    if (type.tag === 'var') return genericSlot(type.name, variables);
    if (type.tag === 'con' && (type.name.startsWith('SKOLEM') || /^(B|D)$/.test(type.name))) {
      const name = type.name.startsWith('SKOLEM') ? type.name.slice(6) : type.name.toLowerCase();
      let mark = marks[name] || outline('<circle cx="12" cy="12" r="10"/>');
      if (isValue) mark = mark.replace('fill="none"', `fill="${mark.match(/stroke="([^"]+)"/)[1]}"`);
      return { width: 24, height: 24, body: `<g class="type-atom" data-type="${escape(name)}">${mark}</g>` };
    }
    if (type.tag === 'fun') {
      // A function value is pictured by its signature: these inner shapes
      // describe input/output types, not values that have already been supplied.
      const pattern = template?.tag === 'fun' ? template : null;
      const { args, result } = parts(type, 1);
      const boxed = frame(flow(args, result, Math.max(24, maxWidth - 12), variables, false, pattern), { x: 6, y: 6 }, rectangle);
      return { ...boxed, body: `<g class="function-value">${boxed.body}</g>` };
    }
    const { head, args } = type.tag === 'app' ? flattenApp(type) : { head: type, args: [] };
    if (head.name === '()') return { width: 24, height: 24,
      body: outline(`<circle cx="12" cy="12" r="8"${isValue ? ' fill="currentColor"' : ''}/><path d="M8 12h8"${isValue ? ' stroke="white"' : ''}/>`) };
    const inset = head.name === 'Hero' ? 28 : head.name === 'Zero' ? 20 : head.tag === 'var' ? 16 : 12;
    const innerWidth = Math.max(24, maxWidth - inset);
    const pattern = template?.tag === 'app' ? flattenApp(template) : null;
    const contents = row(args.map((type, i) => layout(type, innerWidth, variables,
      pattern?.head.name === head.name ? pattern.args[i] : null, isValue)), 6, innerWidth);
    if (head.tag === 'var') {
      // Unknown Applicative context: a dotted container, distinct from a
      // boxed function. Specialization replaces it with Hero or an arrow box.
      const width = contents.width + 16, height = contents.height + 16;
      return { width, height, body: `<g class="applicative-context" data-context="${escape(head.name)}">` +
        `<g fill="none" stroke="#7c8797" stroke-width="1.8" stroke-dasharray="0.1 3.4" stroke-linecap="round"><rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="10"/></g>` +
        move(contents.body, 8, 8) + '</g>' };
    }
    if (head.name.startsWith('(')) return frame(contents, { x: 6, y: 6 }, rectangle);
    if (head.name === 'Zero') return frame(contents, { x: 10, y: 10 }, (w, h) =>
      `<path d="M${w / 2} 1 1 9v${h - 27}Q1 ${h - 7} ${w / 2} ${h - 1}Q${w - 1} ${h - 7} ${w - 1} ${h - 18}V9Z"/>`);
    if (head.name === 'Hero') return frame(contents, { x: 14, y: 14 }, (w, h) =>
      `<path d="M${w - 16} 2l4 7q6 4 5 11l5 2v4l-5 1q-2 ${h - 35} -14 ${h - 35}L8 ${h - 2}l3-8-9 3L8 ${h / 2 + 7} 1 ${h / 2 + 2} 9 ${h / 2 - 6} 4 10H${w - 24}q5-5 9-1Z"/>`);
    throw new Error('No pictogram for type constructor ' + head.name);
  }
  function picture(label, diagram, className = '', type = null, arity = null, variables = new Map(), inputsOnly = false, template = null, isValue = false) {
    const attributes = type ? ` data-diagram-type="${escape(typeToString(type))}" data-diagram-variables="${escape(JSON.stringify([...variables]))}"${arity === null ? '' : ` data-diagram-arity="${arity}"`}${template ? ` data-diagram-template="${escape(typeToString(template))}"` : ''}` : '';
    return svg(label, `<g${className ? ` class="${className}"` : ''}>${move(diagram.body, 2, 2)}</g>`, diagram.width + 4, diagram.height + 4)
      .replace('<svg ', `<svg${attributes}${isValue ? ' data-diagram-value="true"' : ''}${inputsOnly ? ' data-diagram-inputs-only="true"' : ''} `);
  }
  function transformation(signature, label, arity = 1, variableNames = [], inputsOnly = false, template = null) {
    const type = typeof signature === 'string' ? parseType(signature) : signature;
    arity = 1;
    const { args, result } = parts(type, arity), variables = variableMap(semanticVariables(type, variableNames));
    return picture(label, flow(args, result, Infinity, variables, inputsOnly, template), '', type, arity, variables, inputsOnly, template);
  }
  const parsedTypes = new Map();
  function fit(root = document) {
    const contentWidth = element => {
      const style = getComputedStyle(element);
      return element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    };
    for (const node of root.querySelectorAll('svg[data-diagram-type]')) {
      let holder, reserve = 0;
      if (node.closest('.drag-ghost')) holder = node.closest('.drag-ghost');
      else if (node.closest('.function-block')) {
        const block = node.closest('.function-block'), style = getComputedStyle(block);
        holder = block.closest('.row-flow');
        reserve = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + 4 + (node.closest('.argument-slot') ? 8 : 0);
        const dependency = holder.querySelector('.row-dependency:not([hidden])');
        if (dependency) reserve += dependency.getBoundingClientRect().width + (parseFloat(getComputedStyle(holder).columnGap) || 0);
        const choice = block.querySelector('.pending-head-choice');
        if (choice) reserve += choice.getBoundingClientRect().width + (parseFloat(style.columnGap) || 0);
      }
      else if (node.closest('.row-result, .row-result-preview, .goal-picture')) { holder = node.closest('.row-flow'); reserve = 36; }
      else if (node.closest('.parameter-icon')) {
        holder = node.closest('.parameter-prefix');
        const badge = node.closest('.parameter-icon').querySelector('.function-stock');
        reserve = 2 + (badge ? badge.getBoundingClientRect().width + 4 : 0);
      }
      else if (node.closest('.right-panel .func-card')) {
        const card = node.closest('.func-card'), style = getComputedStyle(card);
        holder = card.parentElement;
        const badge = card.querySelector('.function-stock');
        // Cards keep their natural width. Use the palette's width as the limit
        // so a wrapped diagram can expand again when more space is available.
        reserve = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
          + (badge ? badge.getBoundingClientRect().width + parseFloat(style.columnGap) : 0);
      }
      else if (node.closest('.func-card')) holder = node.closest('.function-card-content') || node.closest('.func-card');
      else if (node.closest('.argument-choice')) { holder = node.closest('.argument-choices'); reserve = 26; }
      else if (node.closest('.delete-preview-expression')) holder = node.closest('.delete-preview-expression');
      else if (node.closest('.connection-picker')) { holder = node.closest('.connection-picker'); reserve = 26; }
      else if (node.closest('.editor-overlay')) { holder = node.closest('.row-call'); reserve = 34; }
      if (!holder || !holder.clientWidth) continue;
      const budget = Math.max(24, Math.floor((contentWidth(holder) - reserve) / iconScale) - 4);
      if (node.dataset.diagramBudget === String(budget)) continue;
      node.dataset.diagramBudget = String(budget);
      const signature = node.dataset.diagramType;
      if (!parsedTypes.has(signature)) parsedTypes.set(signature, parseType(signature));
      const type = parsedTypes.get(signature), arity = node.getAttribute('data-diagram-arity');
      const pattern = node.dataset.diagramTemplate;
      if (pattern && !parsedTypes.has(pattern)) parsedTypes.set(pattern, parseType(pattern));
      const template = pattern ? parsedTypes.get(pattern) : null;
      const { args, result } = arity === null ? {} : parts(type, Number(arity));
      const variables = variableMap(JSON.parse(node.dataset.diagramVariables));
      const diagram = arity === null ? layout(type, budget, variables, template, node.dataset.diagramValue === 'true')
        : flow(args, result, budget, variables, node.dataset.diagramInputsOnly === 'true', template);
      const width = diagram.width + 4, height = diagram.height + 4;
      const className = node.querySelector('.result-shape') ? 'result-shape' : '';
      node.innerHTML = `<title>${escape(node.getAttribute('aria-label'))}</title><g class="${className}">${move(diagram.body, 2, 2)}</g>`;
      node.setAttribute('viewBox', `0 0 ${width} ${height}`);
      node.setAttribute('width', width * iconScale); node.setAttribute('height', height * iconScale);
      node.style.width = width * iconScale + 'px'; node.style.height = height * iconScale + 'px';
    }
  }
  const data = {
    'wrap-value': { wrap: ['Wrap a value', 'Put a value inside Zero, keeping the same value and its type.'] },
    'change-wrapper': { f: ['Change Zero to Hero', 'Change Zero to Hero, keeping the same value.'] },
    'compose-two': {
      runZero: ['Unwrap Zero', 'Unwrap Zero and take its value.'],
      mkHero: ['Wrap in Hero', 'Put a value inside Hero.'],
    },
    'make-pair': {
      f1: ['Zero → Hero', 'Change Zero to Hero, keeping its value.'],
      f2: ['Unwrap and duplicate', 'Take Zero’s value and duplicate it into a pair.'],
      f3: ['Duplicate inside Hero', 'Duplicate Hero’s value into a pair inside Hero.'],
    },
    'match-types': {
      f1: ['Swap; make Hero', 'Swap the two slots and change Zero to Hero.'],
      f2: ['Matching slots → Hero', 'Change Zero to Hero when both slots have the same type.'],
      f3: ['Swap slots', 'Swap the two slots inside Zero.'],
      f4: ['Repeat second slot', 'Replace the first slot with a copy of the second.'],
    },
    'nested-pairs': {
      fst: ['Take left item', 'Take the first item of a pair.'],
      snd: ['Take right item', 'Take the second item of a pair.'],
      f1: ['Pair in second slot', 'Keep Zero’s first slot and put both original values into a pair in its second slot.'],
      f2: ['Reversed pair in Hero', 'Put Zero’s two values into Hero as a reversed pair.'],
      f3: ['Split into two Heroes', 'Put each Zero slot into its own Hero, returning a pair of Heroes.'],
    },
    'rearrange-slots': {
      f1: ['Swap first and last', 'Swap Zero’s first and last slots; keep the middle slot.'],
      f2: ['Repeat last slot', 'Keep the first slot and replace the middle slot with a copy of the last.'],
      f3: ['Last two → Hero', 'Keep Zero’s last two slots and put them in Hero.'],
    },
    'reverse-applicative': {
      f1: ['Use first to make second', 'Use Zero to produce a function from its first slot type to its second.'],
      f2: ['Second → Hero third', 'Use Zero to produce a function from its second slot type to Hero of its third.'],
      f3: ['Take first slot', 'Take the first value out of Zero.'],
    },
    'map-middle': {
      bd: ['Square to triangle', 'Convert the concrete square type B to the concrete triangle type D.'],
      fmap: ['Map the last slot', 'Apply the supplied function to Zero’s last slot; keep the first two slots.'],
      f1: ['Last slot to front', 'Rotate Zero’s last slot to the front.'],
      f2: ['Zero → Hero', 'Change Zero to Hero, keeping all three slots.'],
    },
    'longer-composition': {
      f1: ['Duplicate first two', 'Keep the first two slots and duplicate each: a, a, b, b.'],
      f2: ['Duplicate last two', 'Put copies of Zero’s last two slots in Hero: c, c, d, d.'],
      f3: ['Reverse four slots', 'Reverse the order of all four Zero slots.'],
    },
    'curried-application': {
      f1: ['Apply first to second', 'Apply the function in slot 1 to slot 2. Replace slot 1 with (), and slot 2 with the result.'],
      f2: ['First slot to end', 'Rotate Zero’s first slot to the end.'],
      f3: ['Last slot → Hero', 'Take Zero’s last slot and put it in Hero.'],
    },
    'flatten-wrappers': {
      wrap: ['Two Hero layers', 'Move Zero’s value inside two nested Hero layers.'],
      join: ['Flatten Hero layers', 'Flatten two nested Hero layers into one.'],
    },
    'bind': {
      f: ['Zero → Hero', 'Change Zero to Hero, keeping its value.'],
      dup: ['Duplicate into Hero', 'Duplicate a value into a pair inside Hero.'],
    },
    'map-wrapper': {
      f: ['Pair inside Hero', 'Put Zero’s two slots into Hero as an ordered pair.'],
      swap: ['Swap pair items', 'Swap the first and second items of a pair.'],
    },
    'chain-wrapped': {
      f: ['Zero → Hero', 'Change Zero to Hero, keeping its value.'],
      dup: ['Duplicate into Hero', 'Duplicate a value into a pair inside Hero.'],
      nest: ['Nested pair in Hero', 'Make a Hero containing a value and a nested pair, all of the same type.'],
    },
    'shared-input': {
      f: ['Take first slot', 'Take the first value out of Zero.'],
      g: ['Take second slot', 'Take the second value out of Zero.'],
      pair: ['Pair inside Hero', 'Combine two arguments into an ordered pair inside Hero.'],
    },
    'compose-three': {
      runZero: ['Unwrap Zero', 'Unwrap Zero and take its value.'],
      mkHero: ['Wrap in Hero', 'Put a value inside Hero.'],
      dup: ['Duplicate inside Hero', 'Duplicate Hero’s value into a pair inside Hero.'],
    },
    'select-pair': { snd: ['Take right item', 'Take the second item of a pair.'] },
    'concrete-conversion': { bd: ['Square to triangle', 'Convert the concrete square type B to the concrete triangle type D.'] },
    'compose-forward': {
      bd: ['Square to triangle', 'Convert the concrete square type B to the concrete triangle type D.'],
    },
    'map-last': {
      bd: ['Square to triangle', 'Convert the concrete square type B to the concrete triangle type D.'],
      fmap: ['Map the last slot', 'Apply the supplied function to Zero’s last slot; keep the first two slots.'],
    },
    'stored-application': {
      apply: ['Apply stored function', 'Apply the function in Zero’s first slot to its second slot. Keep the result in the second slot; () marks the emptied first slot.'],
      finish: ['Last slot → Hero', 'Take Zero’s last slot and put it in Hero.'],
    },
    'map-function': {
      runZero: ['Unwrap Zero', 'Unwrap Zero and take its value.'],
      mkHero: ['Wrap in Hero', 'Put a value inside Hero.'],
    },
    'reverse-arguments': {
      runZero: ['Unwrap Zero', 'Unwrap Zero and take its value.'],
      mkHero: ['Wrap in Hero', 'Put a value inside Hero.'],
    },
    'compose-wrapped': {
      f: ['Zero → Hero', 'Change Zero to Hero, keeping its value.'],
      dup: ['Duplicate into Hero', 'Duplicate a value into a pair inside Hero.'],
    },
  };
  const operatorData = {
    flip: ['Reverse inputs', 'Return a function that accepts its first two inputs in the opposite order.'],
    '$': ['Apply', 'Apply the function on the left to the argument on the right.'],
    '.': ['Compose', 'Combine two functions: apply the right function first, then the left.'],
    '>>>': ['Compose forward', 'Run the first transformation, then the second.'],
    '>=>': ['Compose through Hero', 'Run the first transformation, then feed its Hero value into the second.'],
    '<**>': ['Apply forward', 'Combine shared-input functions, taking the value-producing function first.'],
    fmap: ['Map', 'Transform a wrapped value, or the result of a function.'],
    '<$>': ['Map', 'Transform a wrapped value, or the result of a function.'],
    '<*>': ['Applicative apply', 'Apply inside Hero, or combine two functions that share the same input.'],
    '>>=': ['Bind', 'Feed Hero’s value into a function that returns Hero.'],
  };
  const zero = svg('Zero wrapper', outline(shield), 24);
  const hero = svg('Hero wrapper', outline(hedgehog), 24);
  const icons = {}, cardIcons = {}, captions = {}, descriptions = {};
  for (const level of levels) {
    const map = icons[level.level] = { Zero: zero, Ze: zero, Hero: hero, He: hero,
      '()': picture('Unit: an empty slot', layout({tag:'con', name:'()'})) };
    const cards = cardIcons[level.level] = {};
    const labels = captions[level.level] = {}, details = descriptions[level.level] = {};
    for (const func of level.funcs) {
      const bare = func.name.replace(/^\((.*)\)$/, '$1');
      const info = data[level.id]?.[bare] || operatorData[bare];
      if (!info) throw new Error(`Missing icon description: level ${level.level}, ${bare}`);
      labels[bare] = labels[func.name] = info[0];
      details[bare] = details[func.name] = info[1];
      const label = `${bare}: ${info[1]} Type: ${func.sig}`;
      cards[bare] = cards[func.name] = transformation(func.sig, label);
      map[bare] = map[func.name] = cards[bare];
    }
    const names = level.lhs.split('=')[0].trim().split(/\s+/).slice(1);
    const {args} = parts(parseType(level.target), names.length);
    names.forEach((name, i) => {
      const type = args[i];
      const info = type.tag === 'fun' ? `Function from ${typeToString(type.from)} to ${typeToString(type.to)}.`
        : level.id === 'curried-application' ? 'Zero holding a function and three arguments.'
        : `Your starting value of type ${typeToString(type)}.`;
      labels[name] = details[name] = info;
      map[name] = renderType(fixedType(type), `${name}: ${info} Type: ${typeToString(type)}`, [], null, true);
    });
  }
  function renderType(signature, label = signature, variableNames = [], template = null, isValue = false) {
    const type = typeof signature === 'string' ? parseType(signature) : signature;
    const variables = variableMap(semanticVariables(type, variableNames));
    return picture(label, layout(type, Infinity, variables, template, isValue), 'result-shape', type, null, variables, false, template, isValue);
  }
  return {icons, cardIcons, captions, descriptions, renderType, transformation, fixedType, fit};
}
