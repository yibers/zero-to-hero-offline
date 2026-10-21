// Pictograms describe the puzzle's type transformations. No runtime behavior is
// inferred beyond the supplied signatures. Generic variables use matching dashed tiles; rigid puzzle types keep solid shapes.
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
  const marks = {
    a: '<circle cx="12" cy="12" r="10" fill="#fbbf24" stroke="#92400e" stroke-width="2"/>',
    b: '<rect x="2" y="2" width="20" height="20" rx="2" fill="#38bdf8" stroke="#075985" stroke-width="2"/>',
    c: '<path d="m12 2 10 10-10 10L2 12Z" fill="#c084fc" stroke="#6b21a8" stroke-width="2"/>',
    d: '<path d="M12 2 22 22H2Z" fill="#6ee7b7" stroke="#065f46" stroke-width="2"/>',
  };
  function fixedType(type) {
    if (typeof type === 'string') type = parseType(type);
    if (type.tag === 'var') return { tag: 'con', name: 'SKOLEM' + type.name };
    if (type.tag === 'fun') return { ...type, from: fixedType(type.from), to: fixedType(type.to) };
    if (type.tag === 'app') return { ...type, con: fixedType(type.con), arg: fixedType(type.arg) };
    return type;
  }
  function placeholder(name, variables) {
    if (!variables.has(name)) variables.set(name, variables.size);
    const index = variables.get(name), count = index + 1;
    const dice = [[[12, 12]], [[8, 8], [16, 16]], [[7, 7], [12, 12], [17, 17]],
      [[7, 7], [17, 7], [7, 17], [17, 17]], [[7, 7], [17, 7], [12, 12], [7, 17], [17, 17]],
      [[7, 6], [17, 6], [7, 12], [17, 12], [7, 18], [17, 18]]];
    const columns = Math.ceil(Math.sqrt(count));
    const dots = dice[index] || Array.from({ length: count }, (_, i) =>
      [5 + (i % columns) * 14 / (columns - 1), 5 + Math.floor(i / columns) * 14 / (columns - 1)]);
    return `<g class="type-placeholder" data-variable="${escape(name)}" data-marker="${count}"><title>Type placeholder ${count}: any type; matching marks use the same type</title>` +
      '<rect x="2" y="2" width="20" height="20" rx="4" fill="#f8fafc" stroke="#64748b" stroke-width="1.6" stroke-dasharray="3 2"/>' +
      dots.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.7" fill="#475569"/>`).join('') + '</g>';
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
  function flow(args, result, maxWidth = Infinity, variables = new Map()) {
    const inputs = row(args.map(type => layout(type, maxWidth, variables)), 6, maxWidth), output = layout(result, maxWidth, variables);
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
  function layout(type, maxWidth = Infinity, variables = new Map()) {
    if (type.tag === 'var') return { width: 24, height: 24, body: placeholder(type.name, variables) };
    if (type.tag === 'con' && type.name.startsWith('SKOLEM')) {
      const name = type.name.slice(6);
      const mark = marks[name] || outline('<circle cx="12" cy="12" r="10"/>');
      return { width: 24, height: 24, body: `<g class="type-atom" data-type="${escape(name)}">${mark}</g>` };
    }
    if (type.tag === 'fun') {
      const { args, result } = parts(type);
      return frame(flow(args, result, Math.max(24, maxWidth - 12), variables), { x: 6, y: 6 }, rectangle);
    }
    const { head, args } = type.tag === 'app' ? flattenApp(type) : { head: type, args: [] };
    if (head.name === '()') return { width: 24, height: 24,
      body: outline('<circle cx="12" cy="12" r="8"/><path d="M8 12h8"/>') };
    const inset = head.name === 'Hero' ? 28 : head.name === 'Zero' ? 20 : 12;
    const innerWidth = Math.max(24, maxWidth - inset);
    const contents = row(args.map(type => layout(type, innerWidth, variables)), 6, innerWidth);
    if (head.name.startsWith('(')) return frame(contents, { x: 6, y: 6 }, rectangle);
    if (head.name === 'Zero') return frame(contents, { x: 10, y: 10 }, (w, h) =>
      `<path d="M${w / 2} 1 1 9v${h - 27}Q1 ${h - 7} ${w / 2} ${h - 1}Q${w - 1} ${h - 7} ${w - 1} ${h - 18}V9Z"/>`);
    if (head.name === 'Hero') return frame(contents, { x: 14, y: 14 }, (w, h) =>
      `<path d="M${w - 16} 2l4 7q6 4 5 11l5 2v4l-5 1q-2 ${h - 35} -14 ${h - 35}L8 ${h - 2}l3-8-9 3L8 ${h / 2 + 7} 1 ${h / 2 + 2} 9 ${h / 2 - 6} 4 10H${w - 24}q5-5 9-1Z"/>`);
    throw new Error('No pictogram for type constructor ' + head.name);
  }
  function picture(label, diagram, className = '', type = null, arity = null, variables = new Map()) {
    const attributes = type ? ` data-diagram-type="${escape(typeToString(type))}" data-diagram-variables="${escape(JSON.stringify([...variables.keys()]))}"${arity === null ? '' : ` data-diagram-arity="${arity}"`}` : '';
    return svg(label, `<g${className ? ` class="${className}"` : ''}>${move(diagram.body, 2, 2)}</g>`, diagram.width + 4, diagram.height + 4)
      .replace('<svg ', `<svg${attributes} `);
  }
  function transformation(signature, label, arity = Infinity, variableNames = []) {
    const type = typeof signature === 'string' ? parseType(signature) : signature;
    const { args, result } = parts(type, arity), variables = new Map(variableNames.map((name, i) => [name, i]));
    return picture(label, flow(args, result, Infinity, variables), '', type, arity, variables);
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
      }
      else if (node.closest('.row-result, .row-result-preview, .goal-picture')) { holder = node.closest('.row-flow'); reserve = 36; }
      else if (node.closest('.parameter-icon')) { holder = node.closest('.parameter-prefix'); reserve = 2; }
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
      const { args, result } = arity === null ? {} : parts(type, Number(arity));
      const variables = new Map(JSON.parse(node.dataset.diagramVariables).map((name, i) => [name, i]));
      const diagram = arity === null ? layout(type, budget, variables) : flow(args, result, budget, variables);
      const width = diagram.width + 4, height = diagram.height + 4;
      const className = node.querySelector('.result-shape') ? 'result-shape' : '';
      node.innerHTML = `<title>${escape(node.getAttribute('aria-label'))}</title><g class="${className}">${move(diagram.body, 2, 2)}</g>`;
      node.setAttribute('viewBox', `0 0 ${width} ${height}`);
      node.setAttribute('width', width * iconScale); node.setAttribute('height', height * iconScale);
      node.style.width = width * iconScale + 'px'; node.style.height = height * iconScale + 'px';
    }
  }
  const data = {
    1: { f: ['Change Zero to Hero', 'Change Zero to Hero, keeping the same value.'] },
    2: {
      runZero: ['Unwrap Zero', 'Unwrap Zero and take its value.'],
      mkHero: ['Wrap in Hero', 'Put a value inside Hero.'],
    },
    3: {
      runZero: ['Unwrap Zero', 'Unwrap Zero and take its value.'],
      mkHero: ['Wrap in Hero', 'Put a value inside Hero.'],
    },
    4: {
      f1: ['Zero → Hero', 'Change Zero to Hero, keeping its value.'],
      f2: ['Unwrap and duplicate', 'Take Zero’s value and duplicate it into a pair.'],
      f3: ['Duplicate inside Hero', 'Duplicate Hero’s value into a pair inside Hero.'],
    },
    5: {
      f1: ['Swap; make Hero', 'Swap the two slots and change Zero to Hero.'],
      f2: ['Matching slots → Hero', 'Change Zero to Hero when both slots have the same type.'],
      f3: ['Swap slots', 'Swap the two slots inside Zero.'],
      f4: ['Repeat second slot', 'Replace the first slot with a copy of the second.'],
    },
    6: {
      fst: ['Take left item', 'Take the first item of a pair.'],
      snd: ['Take right item', 'Take the second item of a pair.'],
      f1: ['Pair in second slot', 'Keep Zero’s first slot and put both original values into a pair in its second slot.'],
      f2: ['Reversed pair in Hero', 'Put Zero’s two values into Hero as a reversed pair.'],
      f3: ['Split into two Heroes', 'Put each Zero slot into its own Hero, returning a pair of Heroes.'],
    },
    7: {
      f1: ['Swap first and last', 'Swap Zero’s first and last slots; keep the middle slot.'],
      f2: ['Repeat last slot', 'Keep the first slot and replace the middle slot with a copy of the last.'],
      f3: ['Last two → Hero', 'Keep Zero’s last two slots and put them in Hero.'],
    },
    8: {
      f1: ['Hero holding a → b', 'Produce a Hero containing a function from a to b.'],
      f2: ['Hero holding b → c', 'Produce a Hero containing a function from b to c.'],
      f3: ['First slot → Hero', 'Take Zero’s first slot and put it in Hero.'],
    },
    9: {
      fmap: ['Map the last slot', 'Apply the supplied function to Zero’s last slot; keep the first two slots.'],
      f1: ['Last slot to front', 'Rotate Zero’s last slot to the front.'],
      f2: ['Zero → Hero', 'Change Zero to Hero, keeping all three slots.'],
    },
    10: {
      f1: ['Duplicate first two', 'Keep the first two slots and duplicate each: a, a, b, b.'],
      f2: ['Duplicate last two', 'Put copies of Zero’s last two slots in Hero: c, c, d, d.'],
      f3: ['Reverse four slots', 'Reverse the order of all four Zero slots.'],
    },
    11: {
      f1: ['Apply first to second', 'Apply the function in slot 1 to slot 2. Replace slot 1 with (), and slot 2 with the result.'],
      f2: ['First slot to end', 'Rotate Zero’s first slot to the end.'],
      f3: ['Last slot → Hero', 'Take Zero’s last slot and put it in Hero.'],
    },
    12: {
      wrap: ['Two Hero layers', 'Move Zero’s value inside two nested Hero layers.'],
      join: ['Flatten Hero layers', 'Flatten two nested Hero layers into one.'],
    },
    13: {
      f: ['Zero → Hero', 'Change Zero to Hero, keeping its value.'],
      dup: ['Duplicate into Hero', 'Duplicate a value into a pair inside Hero.'],
    },
    14: {
      f: ['Pair inside Hero', 'Put Zero’s two slots into Hero as an ordered pair.'],
      swap: ['Swap pair items', 'Swap the first and second items of a pair.'],
    },
    15: {
      f: ['Zero → Hero', 'Change Zero to Hero, keeping its value.'],
      dup: ['Duplicate into Hero', 'Duplicate a value into a pair inside Hero.'],
      nest: ['Nested pair in Hero', 'Make a Hero containing a value and a nested pair, all of the same type.'],
    },
    16: {
      f: ['First slot → Hero', 'Take Zero’s first slot and put it in Hero.'],
      g: ['Second slot → Hero', 'Take Zero’s second slot and put it in Hero.'],
      pair: ['Make a pair', 'Combine two arguments into an ordered pair.'],
    },
  };
  const operatorData = {
    '$': ['Apply', 'Apply the function on the left to the argument on the right.'],
    '.': ['Compose', 'Combine two functions: apply the right function first, then the left.'],
    '<$>': ['Map inside Hero', 'Apply a function to the value inside Hero.'],
    '<*>': ['Apply inside Hero', 'Apply the Hero-wrapped function to the Hero-wrapped argument.'],
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
      const info = data[level.level][bare] || operatorData[bare];
      if (!info) throw new Error(`Missing icon description: level ${level.level}, ${bare}`);
      labels[bare] = labels[func.name] = info[0];
      details[bare] = details[func.name] = info[1];
      const label = `${bare}: ${info[1]} Type: ${func.sig}`;
      const arity = bare === '.' ? 2 : Infinity;
      cards[bare] = cards[func.name] = transformation(func.sig, label, arity);
      map[bare] = map[func.name] = cards[bare];
    }
    const names = level.lhs.split('=')[0].trim().split(/\s+/).slice(1);
    const {args} = parts(parseType(level.target), names.length);
    names.forEach((name, i) => {
      const type = args[i];
      const info = name === 'z' ? (level.level === 11 ? 'Zero holding a function and three arguments.' : 'Your starting Zero value.') : `Function from ${typeToString(type.from)} to ${typeToString(type.to)}.`;
      labels[name] = details[name] = info;
      map[name] = renderType(fixedType(type), `${name}: ${info} Type: ${typeToString(type)}`);
    });
  }
  function renderType(signature, label = signature, variableNames = []) {
    const type = typeof signature === 'string' ? parseType(signature) : signature;
    const variables = new Map(variableNames.map((name, i) => [name, i]));
    return picture(label, layout(type, Infinity, variables), 'result-shape', type, null, variables);
  }
  return {icons, cardIcons, captions, descriptions, renderType, transformation, fixedType, fit};
}
