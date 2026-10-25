// Keep the HTML, release marker and cached Pages assets in sync before publishing.
const { createHash } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const hash = content => createHash('sha256').update(content).digest('hex').slice(0, 12);

function versionAssets(root = path.resolve(__dirname, '..')) {
  const entry = path.join(root, 'index.html');
  const html = readFileSync(entry, 'utf8');
  const assets = html.replace(/\b(src|href)="((?:[\w.-]+\/)*[\w.-]+\.(?:js|css))(?:\?v=[^"\s]*)?"/g,
    (_, attribute, file) => `${attribute}="${file}?v=${hash(readFileSync(path.join(root, file)))}"`);
  const marker = /(<meta name="app-version" content=")[^"]*(">)/;
  if (!marker.test(assets)) throw new Error('Missing app-version marker');
  const version = hash(assets.replace(marker, '$1BUILD$2'));
  const updated = assets.replace(marker, (_, before, after) => before + version + after);
  if (updated !== html) writeFileSync(entry, updated);
  writeFileSync(path.join(root, 'version.json'), JSON.stringify({ version }) + '\n');
  return version;
}

module.exports = { versionAssets };
if (require.main === module) versionAssets();
