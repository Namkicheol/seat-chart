'use strict';
const assert = require('node:assert/strict');
const {_electron} = require('playwright');

(async () => {
  const executablePath = process.argv[2];
  assert.ok(executablePath, 'Pass installed Windows executable path.');
  const app = await _electron.launch({executablePath, timeout: 60000});
  try {
    const page = await app.firstWindow({timeout: 30000});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.waitForSelector('#seatGrid .seat[data-idx]');
    assert.equal(await page.locator('#seatGrid .seat[data-idx]').count(), 25);
    assert.equal(await page.evaluate(() => typeof window.seatDesktop?.saveBackup), 'function');
    assert.equal(await page.evaluate(() => typeof window.seatDesktop?.openBackup), 'function');
    await page.evaluate(() => {
      setPrintTheme(7, true);
      localStorage.setItem('desktop-smoke-persist', 'kept');
    });
    await page.reload();
    await page.waitForSelector('#seatGrid .seat[data-idx]');
    assert.equal(await page.evaluate(() => localStorage.getItem('desktop-smoke-persist')), 'kept');
    assert.equal(await page.evaluate(() => document.body.classList.contains('pt-7')), true);
    assert.deepEqual(errors, []);
    console.log('Installed Windows app passed: 25 seats, native bridge, stable saved state, no page errors.');
  } finally { await app.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
