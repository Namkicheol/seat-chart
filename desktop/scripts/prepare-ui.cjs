'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const ui = path.resolve(__dirname, '../ui');
const content = fs.readFileSync(path.join(root, 'index.html'));
let revision = '';
try {
  revision = execFileSync('git', ['log', '-1', '--format=%H', '--', 'index.html'], {cwd: root, encoding: 'utf8'}).trim();
} catch {}
fs.mkdirSync(ui, {recursive: true});
fs.writeFileSync(path.join(ui, 'index.html'), content);
fs.writeFileSync(path.join(ui, 'version.json'), JSON.stringify({
  revision,
  hash: crypto.createHash('sha256').update(content).digest('hex'),
  builtAt: new Date().toISOString()
}, null, 2));
console.log('Bundled current index.html for Windows desktop.');
