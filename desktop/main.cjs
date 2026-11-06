'use strict';
const {app, BrowserWindow, Menu, dialog, ipcMain, shell, net} = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {hash, validateBackup, validateUpdate, safeFilename} = require('./update-utils.cjs');

const REPOSITORY = 'Namkicheol/seat-chart';
const RELEASES = `https://github.com/${REPOSITORY}/releases/latest`;
let window;
let preferences = {};
let activeVersion;
let uiFile;
let prefsFile;
let updateBusy = false;
let backupBusy = false;

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.show(); window.focus();
  });
  app.whenReady().then(start).catch(async error => {
    await dialog.showMessageBox({type: 'error', message: '자리 배치표를 열지 못했습니다.', detail: error.message});
    app.quit();
  });
}
app.on('window-all-closed', () => app.quit());

async function readJson(filename, fallback = {}) {
  try { return JSON.parse(await fs.readFile(filename, 'utf8')); } catch { return fallback; }
}
async function writeAtomic(filename, content) {
  const temporary = `${filename}.tmp`;
  await fs.writeFile(temporary, content, 'utf8');
  await fs.rename(temporary, filename);
}
async function rememberDirectory(filename) {
  preferences.lastDirectory = path.dirname(filename);
  try { await writeAtomic(prefsFile, JSON.stringify(preferences)); } catch {}
}
function trustedSender(event) {
  return window && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame &&
    event.senderFrame.url === pathToFileURL(uiFile).href;
}
async function start() {
  const userData = app.getPath('userData');
  const localUi = path.join(userData, 'ui');
  uiFile = path.join(localUi, 'index.html');
  prefsFile = path.join(userData, 'preferences.json');
  preferences = await readJson(prefsFile);
  const bundledFile = path.join(__dirname, 'ui/index.html');
  const bundledVersion = await readJson(path.join(__dirname, 'ui/version.json'));
  const installedVersion = await readJson(path.join(localUi, 'version.json'));
  await fs.mkdir(localUi, {recursive: true});
  // Always load the same local URL, preserving the origin and all saved class data.
  let cachedContent;
  try { cachedContent = validateUpdate(await fs.readFile(uiFile, 'utf8')); } catch {}
  if (!cachedContent || !installedVersion.builtAt || bundledVersion.builtAt > installedVersion.builtAt) {
    const bundled = validateUpdate(await fs.readFile(bundledFile, 'utf8'));
    await writeAtomic(uiFile, bundled);
    activeVersion = bundledVersion;
    await writeAtomic(path.join(localUi, 'version.json'), JSON.stringify(activeVersion));
  } else activeVersion = installedVersion;

  window = new BrowserWindow({
    width: 1440, height: 940, minWidth: 1060, minHeight: 700,
    title: '자리 배치표', backgroundColor: '#F4F3EE', icon: path.join(__dirname, 'assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false, contextIsolation: true, sandbox: true,
      webSecurity: true, allowRunningInsecureContent: false
    }
  });
  const openExternalLink = destination => {
    try {
      const url = new URL(destination);
      if (url.protocol === 'https:' && ['github.com', 'creativecommons.org'].includes(url.hostname)) {
        shell.openExternal(url.href);
      }
    } catch {}
  };
  window.webContents.setWindowOpenHandler(({url}) => {openExternalLink(url); return {action: 'deny'};});
  window.webContents.on('will-navigate', (event, destination) => {
    if (destination !== pathToFileURL(uiFile).href) {event.preventDefault(); openExternalLink(destination);}
  });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  registerFileHandlers();
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {label: '파일', submenu: [
      {label: '저장 폴더 열기', click: async () => {
        const location = preferences.lastDirectory || app.getPath('documents');
        const error = await shell.openPath(location);
        if (error) dialog.showMessageBox(window, {type: 'info', message: '이전에 사용한 폴더가 없습니다. 파일을 다시 저장해 주세요.'});
      }},
      {type: 'separator'}, {role: 'quit', label: '종료'}
    ]},
    {label: '보기', submenu: [
      {role: 'resetZoom', label: '기본 크기'}, {role: 'zoomIn', label: '확대'}, {role: 'zoomOut', label: '축소'},
      {type: 'separator'}, {role: 'togglefullscreen', label: '전체 화면'}
    ]},
    {label: '도움말', submenu: [
      {label: '업데이트 확인', click: () => checkForUpdates()},
      {label: '앱 설치 파일 받기', click: () => shell.openExternal(RELEASES)},
      {type: 'separator'},
      {label: '자리 배치표 정보', click: () => dialog.showMessageBox(window, {
        type: 'info', message: `자리 배치표 ${app.getVersion()}`,
        detail: '인터넷 없이 실행할 수 있습니다.\n도움말 → 업데이트 확인으로 새 디자인과 기능을 적용하세요.\n학생 명단과 배치는 이 컴퓨터에 보관합니다.'
      })}
    ]}
  ]));
  await window.loadFile(uiFile);
}
function registerFileHandlers() {
  ipcMain.handle('seat:save-backup', async (event, text, filename) => {
    if (!trustedSender(event)) throw new Error('허용되지 않은 요청입니다.');
    if (backupBusy) return {canceled: true};
    backupBusy = true;
    try {
      validateBackup(text);
      const result = await dialog.showSaveDialog(window, {
        title: '자리 배치표 저장', buttonLabel: '저장',
        defaultPath: path.join(preferences.lastDirectory || app.getPath('documents'), safeFilename(filename)),
        filters: [{name: '자리 배치표 백업', extensions: ['json']}]
      });
      if (result.canceled || !result.filePath) return {canceled: true};
      await fs.writeFile(result.filePath, text, 'utf8');
      await rememberDirectory(result.filePath);
      return {canceled: false, name: path.basename(result.filePath)};
    } finally { backupBusy = false; }
  });
  ipcMain.handle('seat:open-backup', async event => {
    if (!trustedSender(event)) throw new Error('허용되지 않은 요청입니다.');
    if (backupBusy) return {canceled: true};
    backupBusy = true;
    try {
      const result = await dialog.showOpenDialog(window, {
        title: '저장한 자리 배치표 열기', buttonLabel: '열기',
        defaultPath: preferences.lastDirectory || app.getPath('documents'),
        properties: ['openFile'], filters: [{name: '자리 배치표 백업', extensions: ['json']}]
      });
      if (result.canceled || !result.filePaths[0]) return {canceled: true};
      const filename = result.filePaths[0];
      const info = await fs.stat(filename);
      if (info.size > 5 * 1024 * 1024) throw new Error('백업 파일은 5MB 이하여야 합니다.');
      const content = validateBackup(await fs.readFile(filename, 'utf8'));
      await rememberDirectory(filename);
      return {canceled: false, content, name: path.basename(filename)};
    } finally { backupBusy = false; }
  });
}
async function fetchText(url) {
  const response = await net.fetch(url, {
    headers: {'Accept': 'application/vnd.github+json', 'User-Agent': 'seat-chart-desktop'},
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`업데이트 서버에 연결하지 못했습니다 (${response.status}).`);
  const content = await response.text();
  if (Buffer.byteLength(content, 'utf8') > 5 * 1024 * 1024) throw new Error('업데이트 파일이 너무 큽니다.');
  return content;
}
async function checkForUpdates() {
  if (updateBusy) return;
  updateBusy = true;
  try {
    const commits = JSON.parse(await fetchText(`https://api.github.com/repos/${REPOSITORY}/commits?path=index.html&per_page=1`));
    const revision = commits[0]?.sha;
    if (!/^[a-f0-9]{40}$/.test(revision || '')) throw new Error('업데이트 버전을 확인할 수 없습니다.');
    if (revision === activeVersion.revision) {
      await dialog.showMessageBox(window, {type: 'info', message: '최신 버전입니다.'}); return;
    }
    const content = validateUpdate(await fetchText(`https://raw.githubusercontent.com/${REPOSITORY}/${revision}/index.html`));
    if (hash(content) === activeVersion.hash) {
      await dialog.showMessageBox(window, {type: 'info', message: '최신 버전입니다.'}); return;
    }
    const result = await dialog.showMessageBox(window, {
      type: 'question', buttons: ['업데이트하고 다시 열기', '나중에'], defaultId: 0, cancelId: 1,
      message: '새로운 자리 배치표를 적용할까요?',
      detail: '현재 학생 명단과 배치를 유지한 채 화면을 다시 엽니다. 열려 있는 입력창은 적용한 뒤 업데이트해 주세요. 설치 프로그램을 다시 받을 필요가 없습니다.'
    });
    if (result.response !== 0) return;
    // Keep a rollback copy so a disk or navigation failure never destroys the working version.
    const previousContent = await fs.readFile(uiFile, 'utf8');
    const previousVersion = activeVersion;
    const nextVersion = {revision, hash: hash(content), builtAt: new Date().toISOString()};
    try {
      await writeAtomic(uiFile, content);
      await window.loadFile(uiFile);
      await writeAtomic(path.join(path.dirname(uiFile), 'version.json'), JSON.stringify(nextVersion));
      activeVersion = nextVersion;
    } catch (error) {
      await writeAtomic(uiFile, previousContent);
      activeVersion = previousVersion;
      await window.loadFile(uiFile);
      throw error;
    }
  } catch (error) {
    await dialog.showMessageBox(window, {
      type: 'info', message: '지금은 업데이트를 확인할 수 없습니다.',
      detail: `${error.message}\n기존 프로그램과 저장된 자료는 그대로 사용할 수 있습니다.`
    });
  } finally { updateBusy = false; }
}
