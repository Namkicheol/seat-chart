'use strict';
const crypto = require('node:crypto');

function hash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}
function validateBackup(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > 5 * 1024 * 1024) {
    throw new Error('백업 파일은 5MB 이하의 JSON 파일이어야 합니다.');
  }
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.students) || !Array.isArray(data.seats)) {
    throw new Error('자리 배치표 백업 파일이 아닙니다.');
  }
  return text;
}
function validateUpdate(content) {
  if (typeof content !== 'string' || Buffer.byteLength(content, 'utf8') > 5 * 1024 * 1024 ||
      !/^<!doctype html>/i.test(content.trimStart()) ||
      !content.includes('id="seatGrid"') || !content.includes('id="nameListBody"') ||
      !/<\/html>\s*$/i.test(content)) {
    throw new Error('업데이트 파일을 확인할 수 없습니다. 기존 버전을 계속 사용합니다.');
  }
  return content;
}
function safeFilename(filename) {
  return typeof filename === 'string' && /^[^<>:"/\\|?*\x00-\x1f]+\.json$/i.test(filename)
    ? filename : '자리배치.json';
}
module.exports = {hash, validateBackup, validateUpdate, safeFilename};
