'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {hash, validateBackup, validateUpdate, safeFilename} = require('../update-utils.cjs');

test('backup boundary rejects non-backups and oversized text', () => {
  assert.equal(validateBackup('{"students":[],"seats":[]}'), '{"students":[],"seats":[]}');
  for (const value of ['{}', 'null', 'x', {}, ' '.repeat(5 * 1024 * 1024 + 1)]) {
    assert.throws(() => validateBackup(value));
  }
});
test('save filename cannot escape the remembered directory', () => {
  assert.equal(safeFilename('자리배치_20261106.json'), '자리배치_20261106.json');
  for (const name of ['../other.json', 'C:\\other.json', 'bad.txt', 'bad\n.json']) {
    assert.equal(safeFilename(name), '자리배치.json');
  }
});
test('updates must be complete seating app HTML', () => {
  const html = '<!DOCTYPE html><html><div id="seatGrid"></div><div id="nameListBody"></div></html>';
  assert.equal(validateUpdate(html), html);
  for (const value of ['<!DOCTYPE html><html>404</html>', '<html>oops</html>', html.replace('</html>', '')]) {
    assert.throws(() => validateUpdate(value));
  }
  assert.equal(hash(html), hash(html));
  assert.notEqual(hash(html), hash(html + ' '));
});
