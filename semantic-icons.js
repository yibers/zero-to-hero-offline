// Pictograms describe the puzzle's type transformations. No runtime behavior is
// inferred beyond the supplied signatures. Variable identities are local to an icon.
function createSemanticIcons(levels, parseType, flattenApp, typeToString) {
  const escape = text => String(text).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const shield = '<path d="M12 2 4 6v7c0 4.5 3.3 7.4 8 9 4.7-1.6 8-4.5 8-9V6Z"/>';
  const hedgehog = '<path d="m16.5 2 2 4c1.6 1.3 2.1 3.1 2 5.2l2 .8v2l-2 .3C19 19.5 15.7 21 11.2 19.7L6 22l1.1-4.4L2 18.5l3.2-4.6L1 12.5l5-3.4L3 6h7.2c1.8-1.2 3.4-1.3 4.8-.5Z"/>';
  const outline = (body, width = 1.8) => `<g fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
  const svg = (label, body, size = 64) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="1em" height="1em" role="img" aria-label="${escape(label)}"><title>${escape(label)}</title>${body}</svg>`;
  const place = (body, x, y, w, h) => `<g transform="translate(${x} ${y}) scale(${w / 24} ${h / 24})">${body}</g>`;
  const marks = {
    a: '<circle cx="12" cy="12" r="8" fill="#fbbf24" stroke="#92400e" stroke-width="2"/>',
    b: '<rect x="4" y="4" width="16" height="16" rx="2" fill="#38bdf8" stroke="#075985" stroke-width="2"/>',
    c: '<path d="m12 2 10 10-10 10L2 12Z" fill="#c084fc" stroke="#6b21a8" stroke-width="2"/>',
    d: '<path d="M12 2 22 21H2Z" fill="#6ee7b7" stroke="#065f46" stroke-width="2"/>',
  };
  const arrow = (x1, y, x2, h) => {
    const tip = Math.min(3, (x2 - x1) * .4, h * .2);
    return outline(`<path d="M${x1} ${y}H${x2}m${-tip} ${-tip} ${tip} ${tip} ${-tip} ${tip}"/>`, Math.min(1.5, h * .1));
  };
  function parts(type, limit = Infinity) {
    const args = [];
    while (type.tag === 'fun' && args.length < limit) { args.push(type.from); type = type.to; }
    return { args, result: type };
  }
  function weight(type) {
    if (type.tag === 'var' || type.tag === 'con') return 1;
    if (type.tag === 'fun') {
      const {args, result} = parts(type);
      return Math.min(4, 1 + .6 * (args.reduce((n, arg) => n + weight(arg), 0) + weight(result)));
    }
    const {args} = flattenApp(type);
    return Math.min(4, .5 + args.reduce((n, arg) => n + weight(arg), 0));
  }
  function row(types, x, y, w, h, gap = 2) {
    gap = Math.min(gap, w / (types.length * 5));
    const weights = types.map(weight), total = weights.reduce((a, b) => a + b, 0);
    const available = w - gap * (types.length - 1);
    let offset = x;
    return types.map((type, i) => {
      const cell = available * weights[i] / total;
      const body = draw(type, offset, y, cell, h);
      offset += cell + gap;
      return body;
    }).join('');
  }
  function draw(type, x, y, w, h) {
    if (type.tag === 'var') {
      const size = Math.min(w, h);
      return place(marks[type.name] || marks.a, x + (w - size) / 2, y + (h - size) / 2, size, size);
    }
    if (type.tag === 'fun') {
      const height = Math.min(h, w / 2);
      y += (h - height) / 2;
      h = height;
      const { args, result } = parts(type);
      const pad = Math.min(2, w * .04, h * .12);
      return outline(`<rect x="${x + .6}" y="${y + .6}" width="${w - 1.2}" height="${h - 1.2}" rx="${Math.min(4, h / 3)}"/>`, 1.2) +
        row(args, x + pad, y + pad, w * .4 - pad, h - 2 * pad, 1) +
        arrow(x + w * .43, y + h / 2, x + w * .61, h) +
        draw(result, x + w * .65, y + pad, w * .35 - pad, h - 2 * pad);
    }
    const { head, args } = type.tag === 'app' ? flattenApp(type) : { head: type, args: [] };
    if (head.name === '()') {
      return outline(`<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${Math.min(w, h) * .33}"/><path d="M${x + w * .4} ${y + h / 2}h${w * .2}"/>`, 1.3);
    }
    if (head.name.startsWith('(')) {
      const pad = Math.min(2.5, w * .08, h * .12);
      return outline(`<rect x="${x + .7}" y="${y + .7}" width="${w - 1.4}" height="${h - 1.4}" rx="1.5"/>`, 1.3) +
        row(args, x + pad, y + pad, w - 2 * pad, h - 2 * pad, 1.5);
    }
    if (head.name === 'Zero' || head.name === 'Hero') {
      // Stretch the wrapper for multiple or nested slots, keeping room to read them.
      const simple = args.length <= 1 && (!args.length || args[0].tag === 'var');
      const width = simple ? Math.min(w, h) : w;
      const height = simple ? Math.min(w, h) : h;
      const left = x + (w - width) / 2;
      const top = y + (h - height) / 2;
      const shape = head.name === 'Zero' ? shield : hedgehog;
      return place(outline(shape), left, top, width, height) +
        (args.length ? row(args, left + width * .24, top + height * .24, width * .53, height * .55, 1) : '');
    }
    throw new Error('No pictogram for type constructor ' + head.name);
  }
  function transformation(signature, label, arity = Infinity) {
    const { args, result } = parts(parseType(signature), arity);
    return svg(label,
      `<g class="icon-inputs">${row(args, 2, 2, 60, 25, 4)}</g>` +
      outline('<path d="M32 29v6m-3-3 3 3 3-3"/>', 2) +
      `<g class="icon-output">${draw(result, 2, 38, 60, 24)}</g>`);
  }
  const data = {
    1: { f: ['Changes the wrapper; keeps the value. The dot represents a.', 'Change Zero to Hero, keeping the same value.'] },
    2: {
      runZero: ['Unwrap Zero', 'Unwrap Zero and take its value.'],
      mkHero: ['Wrap in Hero', 'Put a value inside Hero.'],
    },
    3: {
      f1: ['Zero → Hero', 'Change Zero to Hero, keeping its value.'],
      f2: ['Unwrap and duplicate', 'Take Zero’s value and duplicate it into a pair.'],
      f3: ['Duplicate inside Hero', 'Duplicate Hero’s value into a pair inside Hero.'],
    },
    4: {
      f1: ['Swap; make Hero', 'Swap the two slots and change Zero to Hero.'],
      f2: ['Matching slots → Hero', 'Change Zero to Hero when both slots have the same type.'],
      f3: ['Swap slots', 'Swap the two slots inside Zero.'],
      f4: ['Repeat second slot', 'Replace the first slot with a copy of the second.'],
    },
    5: {
      fst: ['Take left item', 'Take the first item of a pair.'],
      snd: ['Take right item', 'Take the second item of a pair.'],
      f1: ['Pair in second slot', 'Keep Zero’s first slot and put both original values into a pair in its second slot.'],
      f2: ['Reversed pair in Hero', 'Put Zero’s two values into Hero as a reversed pair.'],
      f3: ['Split into two Heroes', 'Put each Zero slot into its own Hero, returning a pair of Heroes.'],
    },
    6: {
      f1: ['Swap first and last', 'Swap Zero’s first and last slots; keep the middle slot.'],
      f2: ['Repeat last slot', 'Keep the first slot and replace the middle slot with a copy of the last.'],
      f3: ['Last two → Hero', 'Keep Zero’s last two slots and put them in Hero.'],
    },
    7: {
      f1: ['Hero holding a → b', 'Produce a Hero containing a function from a to b.'],
      f2: ['Hero holding b → c', 'Produce a Hero containing a function from b to c.'],
      f3: ['First slot → Hero', 'Take Zero’s first slot and put it in Hero.'],
    },
    8: {
      fmap: ['Map the last slot', 'Apply the supplied function to Zero’s last slot; keep the first two slots.'],
      f1: ['Last slot to front', 'Rotate Zero’s last slot to the front.'],
      f2: ['Zero → Hero', 'Change Zero to Hero, keeping all three slots.'],
    },
    9: {
      f1: ['Duplicate first two', 'Keep the first two slots and duplicate each: a, a, b, b.'],
      f2: ['Duplicate last two', 'Put copies of Zero’s last two slots in Hero: c, c, d, d.'],
      f3: ['Reverse four slots', 'Reverse the order of all four Zero slots.'],
    },
    10: {
      f1: ['Apply first to second', 'Apply the function in slot 1 to slot 2. Replace slot 1 with (), and slot 2 with the result.'],
      f2: ['First slot to end', 'Rotate Zero’s first slot to the end.'],
      f3: ['Last slot → Hero', 'Take Zero’s last slot and put it in Hero.'],
    },
    11: {
      wrap: ['Two Hero layers', 'Move Zero’s value inside two nested Hero layers.'],
      join: ['Flatten Hero layers', 'Flatten two nested Hero layers into one.'],
    },
    12: {
      f: ['Zero → Hero', 'Change Zero to Hero, keeping its value.'],
      dup: ['Duplicate into Hero', 'Duplicate a value into a pair inside Hero.'],
    },
    13: {
      f: ['Pair inside Hero', 'Put Zero’s two slots into Hero as an ordered pair.'],
      swap: ['Swap pair items', 'Swap the first and second items of a pair.'],
    },
    14: {
      f: ['Zero → Hero', 'Change Zero to Hero, keeping its value.'],
      dup: ['Duplicate into Hero', 'Duplicate a value into a pair inside Hero.'],
      nest: ['Nested pair in Hero', 'Make a Hero containing a value and a nested pair, all of the same type.'],
    },
    15: {
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
  const value = '<circle cx="12" cy="12" r="3.2" fill="#fbbf24" stroke="#92400e" stroke-width="1.2"/>';
  const icons = {}, captions = {}, descriptions = {};
  for (const level of levels) {
    const map = icons[level.level] = { Zero: zero, Ze: zero, Hero: hero, He: hero,
      '()': svg('Unit: an empty slot', draw({tag:'con', name:'()'}, 0, 0, 24, 24), 24) };
    const labels = captions[level.level] = {}, details = descriptions[level.level] = {};
    for (const func of level.funcs) {
      const bare = func.name.replace(/^\((.*)\)$/, '$1');
      const info = data[level.level][bare] || operatorData[bare];
      if (!info) throw new Error(`Missing icon description: level ${level.level}, ${bare}`);
      labels[bare] = labels[func.name] = info[0];
      details[bare] = details[func.name] = info[1];
      let picture = transformation(func.sig, `${bare}: ${info[1]} Type: ${func.sig}`, bare === '.' ? 2 : Infinity);
      // Retain the approved first-level pictogram wherever that same operation appears.
      if (func.sig === 'Zero a -> Hero a') picture = svg(`${bare}: ${info[1]}`,
        `<g transform="translate(1 1)">${outline(shield)}${value}</g>` +
        outline('<path d="M12 27v7a3 3 0 0 0 3 3h8m-4-4 4 4-4 4"/>') +
        `<g transform="translate(24 24)">${outline(hedgehog)}${value}</g>`, 49);
      map[bare] = map[func.name] = picture;
    }
    const names = level.lhs.split('=')[0].trim().split(/\s+/).slice(1);
    const {args} = parts(parseType(level.target), names.length);
    names.forEach((name, i) => {
      const type = args[i];
      const info = name === 'z' ? (level.level === 10 ? 'Zero holding a function and three arguments.' : 'Your starting Zero value.') : `Function from ${typeToString(type.from)} to ${typeToString(type.to)}.`;
      labels[name] = details[name] = info;
      map[name] = svg(`${name}: ${info} Type: ${typeToString(type)}`, draw(type, 2, 2, 60, 60));
      if (name === 'z' && level.target === 'Zero a -> Hero a') map[name] = svg('z: a Zero containing a value', outline(shield) + value, 24);
    });
  }
  const legend = `<details class="icon-legend"><summary>Icon key</summary>
    <div class="icon-key-marks">${Object.entries(marks).map(([name, mark]) => `<span>${svg(name, mark, 24)}<code>${name}</code></span>`).join('')}</div>
    <p>Matching shapes show matching types within an icon. Read inputs above, result below.</p>
    <p>Shield = Zero. Hedgehog = Hero. Box = pair. Rounded box with an arrow = function.</p>
    <p>These are type patterns; matching shapes do not require equal values.</p></details>`;
  return {icons, captions, descriptions, legend};
}
