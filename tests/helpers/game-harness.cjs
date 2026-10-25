// Exercise the real puzzle engine and saved progress without requiring a browser.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');

function game(saved) {
  const storage = new Map(saved ? [['zth_progress', JSON.stringify(saved)]] : []);
  const nodes = Object.fromEntries(['app', 'status-bar', 'status-output', 'next-level', 'skip-level', 'level-badge']
    .map(id => [id, { innerHTML: '', textContent: '', hidden: true }]));
  const context = {
    console, setTimeout, clearTimeout, addEventListener() {},
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    document: { getElementById: id => nodes[id] || null }
  };
  context.window = context;
  vm.createContext(context);
  for (const file of ['levels.js', 'semantic-icons.js', 'row-program.js', 'puzzle-rules.js', 'row-editor.js', 'text-editor.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInContext(source.replace(/\/\/ Initial render\s+render\(\);/, ''), context, { filename: 'index.html' });
  // Keep real templates and validation; DOM layout and pointer events belong to Playwright.
  vm.runInContext('mountRowEditor = () => {}; mountTextEditor = () => {};', context);
  const run = source => vm.runInContext(source, context);
  const read = source => JSON.parse(run(`JSON.stringify(${source})`));
  return { run, read, nodes, saved: () => JSON.parse(storage.get('zth_progress')) };
}

module.exports = { game };
