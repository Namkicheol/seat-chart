'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {pathToFileURL} = require('node:url');
const {hash} = require('../update-utils.cjs');
const sourceFile = path.resolve(__dirname, '../main.cjs');
const HTML = '<!DOCTYPE html><html><div id="seatGrid"></div><div id="nameListBody"></div></html>';

async function harness(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'seatchart-desktop-'));
  t.after(() => fs.rm(root, {recursive: true, force: true}));
  const bundle = path.join(root, 'bundle');
  const data = path.join(root, 'data');
  const docs = path.join(root, 'documents');
  await fs.mkdir(path.join(bundle, 'ui'), {recursive: true});
  await fs.mkdir(docs);
  await fs.writeFile(path.join(bundle, 'ui/index.html'), HTML);
  await fs.writeFile(path.join(bundle, 'ui/version.json'), JSON.stringify({
    revision: 'a'.repeat(40), hash: hash(HTML), builtAt: '2026-01-01T00:00:00.000Z'
  }));
  const handlers = new Map();
  const saveCalls = [], openCalls = [], messages = [], loads = [], fetches = [];
  const answers = [], responses = [];
  let win;
  class BrowserWindow {
    constructor(options) {
      assert.equal(options.webPreferences.nodeIntegration, false);
      assert.equal(options.webPreferences.contextIsolation, true);
      assert.equal(options.webPreferences.sandbox, true);
      win = this;
      this.webContents = {
        mainFrame: {url: ''}, setWindowOpenHandler() {}, on() {},
        session: {setPermissionRequestHandler() {}}
      };
    }
    async loadFile(filename) {
      loads.push(filename); this.webContents.mainFrame.url = pathToFileURL(filename).href;
    }
  }
  const electron = {
    app: {
      requestSingleInstanceLock: () => true,
      whenReady: () => new Promise(() => {}), on() {}, quit() {}, getVersion: () => '1.0.0',
      getPath: name => name === 'userData' ? data : docs
    },
    BrowserWindow, Menu: {buildFromTemplate: value => value, setApplicationMenu() {}},
    dialog: {
      showSaveDialog: async (_window, options) => {saveCalls.push(options); return answers.shift();},
      showOpenDialog: async (_window, options) => {openCalls.push(options); return answers.shift();},
      showMessageBox: async (_window, options) => {messages.push(options); return answers.shift() || {response: 1};}
    },
    ipcMain: {handle: (name, callback) => handlers.set(name, callback)},
    shell: {openPath: async () => '', openExternal: async () => {}},
    net: {fetch: async url => {
      fetches.push(url);
      const response = responses.shift();
      if (response instanceof Error) throw response;
      return {ok: true, text: async () => response};
    }}
  };
  const context = vm.createContext({
    Buffer, AbortSignal, console, __dirname: bundle,
    require: name => name === 'electron' ? electron : name === './update-utils.cjs' ? require('../update-utils.cjs') : require(name)
  });
  vm.runInContext(await fs.readFile(sourceFile, 'utf8'), context);
  await vm.runInContext('start()', context);
  const event = () => ({sender: win.webContents, senderFrame: win.webContents.mainFrame});
  return {root, data, docs, handlers, saveCalls, openCalls, messages, loads, fetches, answers, responses, event, context};
}

test('native backup dialogs share persisted folder and preserve JSON', async t => {
  const h = await harness(t);
  const folder = path.join(h.root, 'my-class');
  await fs.mkdir(folder);
  const file = path.join(folder, 'one.json');
  h.answers.push({canceled: false, filePath: file});
  const payload = '{"students":[{"id":"01","name":"가나"}],"seats":[0]}';
  const saved = await h.handlers.get('seat:save-backup')(h.event(), payload, 'one.json');
  assert.equal(saved.canceled, false);
  assert.equal(await fs.readFile(file, 'utf8'), payload);
  assert.equal(h.saveCalls[0].defaultPath, path.join(h.docs, 'one.json'));
  const prefs = JSON.parse(await fs.readFile(path.join(h.data, 'preferences.json'), 'utf8'));
  assert.equal(prefs.lastDirectory, folder);
  h.answers.push({canceled: false, filePaths: [file]});
  const opened = await h.handlers.get('seat:open-backup')(h.event());
  assert.equal(opened.content, payload);
  assert.equal(h.openCalls[0].defaultPath, folder);
  h.answers.push({canceled: true});
  assert.equal((await h.handlers.get('seat:save-backup')(h.event(), payload, 'two.json')).canceled, true);
  assert.equal(h.saveCalls[1].defaultPath, path.join(folder, 'two.json'));
  await assert.rejects(h.handlers.get('seat:open-backup')({sender: {}, senderFrame: {url: 'https://example.com'}}));
});

test('accepted update uses immutable commit and keeps local page URL stable', async t => {
  const h = await harness(t);
  const revision = 'b'.repeat(40);
  const updated = HTML.replace('</html>', '<p>new design</p></html>');
  h.responses.push(JSON.stringify([{sha: revision}]), updated);
  h.answers.push({response: 0});
  await vm.runInContext('checkForUpdates()', h.context);
  assert.equal(h.loads.length, 2);
  assert.equal(h.loads[0], h.loads[1]);
  assert.equal(await fs.readFile(h.loads[0], 'utf8'), updated);
  assert.ok(h.fetches[1].includes(`/${revision}/index.html`));
  const metadata = JSON.parse(await fs.readFile(path.join(h.data, 'ui/version.json'), 'utf8'));
  assert.equal(metadata.revision, revision);
  assert.equal(metadata.hash, hash(updated));
  h.responses.push(JSON.stringify([{sha: revision}]));
  await vm.runInContext('checkForUpdates()', h.context);
  assert.equal(h.messages.at(-1).message, '최신 버전입니다.');
});

test('offline or invalid updates keep working cached app unchanged', async t => {
  const h = await harness(t);
  h.responses.push(new Error('offline'));
  await vm.runInContext('checkForUpdates()', h.context);
  assert.equal(await fs.readFile(h.loads[0], 'utf8'), HTML);
  assert.equal(h.loads.length, 1);
  h.responses.push(JSON.stringify([{sha: 'c'.repeat(40)}]), '<!DOCTYPE html><html>404</html>');
  await vm.runInContext('checkForUpdates()', h.context);
  assert.equal(await fs.readFile(h.loads[0], 'utf8'), HTML);
  assert.equal(h.loads.length, 1);
});
