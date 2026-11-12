const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('mwNative', {
  readSave: () => ipcRenderer.invoke('save:read'),
  writeSave: (text) => ipcRenderer.invoke('save:write', text),
  quarantineSave: () => ipcRenderer.invoke('save:quarantine'),
  readSettings: () => ipcRenderer.invoke('settings:read'),
  writeSettings: (text) => ipcRenderer.invoke('settings:write', text),
  setWindowMode: (mode) => ipcRenderer.invoke('window:mode', mode),
  setResolution: (w, h) => ipcRenderer.invoke('window:resolution', w, h),
  quit: () => ipcRenderer.invoke('app:quit'),
});
