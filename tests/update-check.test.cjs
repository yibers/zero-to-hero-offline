const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { versionAssets } = require('../scripts/version-assets.js');
const script = fs.readFileSync(path.join(__dirname, '../update-check.js'), 'utf8');
const oldVersion = '111111111111', newVersion = '222222222222';

async function updater(options = {}) {
  const events = {}, calls = [], redirects = [], cleanups = [], order = [];
  let version = options.latest || oldVersion;
  const location = {
    href: options.url || 'https://example.com/game/?v=old#puzzle', protocol: options.protocol || 'https:',
    replace(url) { redirects.push(url); order.push('reload'); }
  };
  const document = {
    baseURI: location.href, visibilityState: 'visible',
    querySelector() { return { content: oldVersion }; },
    addEventListener(name, fn) { events[name] = fn; }
  };
  const timers = new Set();
  const context = {
    URL, AbortController, Date, location, document,
    setTimeout(fn) { const timer = { fn }; timers.add(timer); return timer; },
    clearTimeout(timer) { timers.delete(timer); },
    history: { state: { preserved: true }, replaceState(state, _, url) {
      cleanups.push({ state, url: url.href }); location.href = url.href;
    } },
    addEventListener(name, fn) { events[name] = fn; },
    saveProgress() { order.push('save'); if (options.saveFails) throw new Error('Storage unavailable'); },
    async fetch(url, init) {
      calls.push({ url: url.href, init });
      if (options.offline) throw new Error('offline');
      if (options.hang) return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('timeout'))));
      return { ok: options.ok !== false, json: async () => ({ version }) };
    }
  };
  context.window = context;
  vm.runInNewContext(script, context);
  const settle = () => new Promise(resolve => setImmediate(resolve));
  await settle();
  return { events, calls, redirects, cleanups, order, document, timers, settle, setVersion: v => { version = v; } };
}

test('new deployments save work and automatically replace obsolete page links', async () => {
  const app = await updater({ latest: newVersion, url: 'https://example.com/game/?v=old&test=1#puzzle' });
  assert.equal(app.calls[0].init.cache, 'no-store');
  const manifest = new URL(app.calls[0].url);
  assert.equal(manifest.pathname, '/game/version.json');
  assert.match(manifest.searchParams.get('check'), /^\d+$/);
  assert.deepEqual(app.order, ['save', 'reload']);
  assert.deepEqual(app.redirects, [`https://example.com/game/?test=1&__update=${newVersion}#puzzle`]);
  assert.equal(app.timers.size, 0);
});

test('current pages keep a clean stable link, preserving unrelated parameters and history state', async () => {
  const app = await updater({ url: `https://example.com/game/?v=old&__update=${oldVersion}&test=1#puzzle` });
  assert.equal(app.redirects.length, 0);
  assert.deepEqual(app.cleanups, [{ state: { preserved: true }, url: 'https://example.com/game/?test=1#puzzle' }]);
});

test('back navigation, returning to a tab, and reconnecting check for updates', async () => {
  const app = await updater();
  app.document.visibilityState = 'hidden';
  await app.events.visibilitychange();
  assert.equal(app.calls.length, 1);
  app.document.visibilityState = 'visible';
  await app.events.visibilitychange();
  await app.events.pageshow();
  assert.equal(app.calls.length, 3);
  app.setVersion(newVersion);
  await app.events.online();
  assert.deepEqual(app.order, ['save', 'reload']);
});

test('a deployment still serving old HTML cannot create a reload loop', async () => {
  const app = await updater({ latest: newVersion, url: `https://example.com/game/?__update=${newVersion}` });
  await app.events.pageshow();
  await app.events.visibilitychange();
  assert.equal(app.redirects.length, 0);
  assert.equal(app.cleanups[0].url, 'https://example.com/game/');
  app.setVersion('333333333333');
  await app.events.online();
  assert.equal(app.redirects.length, 1);
});

test('offline, invalid, failed and unsavable updates leave the current game intact', async () => {
  for (const options of [{ offline: true }, { ok: false }, { latest: 'bad' }, { latest: newVersion, saveFails: true }]) {
    const app = await updater(options);
    assert.equal(app.redirects.length, 0);
    assert.equal(app.timers.size, 0);
  }
  const local = await updater({ protocol: 'file:', url: 'file:///game/index.html' });
  assert.equal(local.calls.length, 0);
});

test('a hanging request times out without blocking the game or parallel checks', async () => {
  const app = await updater({ hang: true });
  await app.events.pageshow();
  assert.equal(app.calls.length, 1);
  for (const timer of app.timers) timer.fn();
  await app.settle();
  assert.equal(app.timers.size, 0);
  assert.equal(app.redirects.length, 0);
});

test('release generation is repeatable and changes for HTML, JavaScript or CSS edits', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zth-release-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const entry = path.join(root, 'index.html');
  fs.writeFileSync(entry, '<meta name="app-version" content="initial">\r\n<script src="app.js"></script>\r\n<link href="app.css">');
  fs.writeFileSync(path.join(root, 'app.js'), 'first');
  fs.writeFileSync(path.join(root, 'app.css'), 'first');
  let previous = versionAssets(root);
  assert.equal(versionAssets(root), previous);
  for (const file of ['app.js', 'app.css', 'index.html']) {
    fs.appendFileSync(path.join(root, file), '\nchange');
    const version = versionAssets(root);
    assert.notEqual(version, previous);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'version.json'))).version, version);
    assert.match(fs.readFileSync(entry, 'utf8'), new RegExp(`app-version" content="${version}"`));
    assert.equal(versionAssets(root), version);
    previous = version;
  }
  assert.match(fs.readFileSync(entry, 'utf8'), /\r\n/);
});
