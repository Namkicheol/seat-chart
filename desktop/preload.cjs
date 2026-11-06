'use strict';
const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('seatDesktop', Object.freeze({
  saveBackup: (text, filename) => ipcRenderer.invoke('seat:save-backup', text, filename),
  openBackup: () => ipcRenderer.invoke('seat:open-backup')
}));
