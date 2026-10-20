// Keep cached Pages assets tied to their contents. Run before publishing edits.
const { createHash } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const entry = path.join(root, 'index.html');
const html = readFileSync(entry, 'utf8');
const updated = html.replace(/\b(src|href)="((?:[\w.-]+\/)*[\w.-]+\.(?:js|css))(?:\?v=[^"\s]*)?"/g,
  (_, attribute, file) => {
    const version = createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex').slice(0, 12);
    return `${attribute}="${file}?v=${version}"`;
  });
if (updated !== html) writeFileSync(entry, updated);
