// Electron main process: window, save file IO, window-mode settings.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const savePath = () => path.join(app.getPath('userData'), 'save.json');
const backupPath = () => path.join(app.getPath('userData'), 'save.bak.json');
const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');

function readText(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }

function writeAtomic(p, text) {
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, p);
}

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 1024, minHeight: 600,
    backgroundColor: '#0B2E36',
    title: 'Murmurwater',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  win.once('ready-to-show', () => win.show());
  if (process.env.MW_DEV_URL) win.loadURL(process.env.MW_DEV_URL);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

ipcMain.handle('save:read', () => ({ main: readText(savePath()), backup: readText(backupPath()) }));
ipcMain.handle('save:write', (_e, text) => {
  const prev = readText(savePath());
  if (prev) writeAtomic(backupPath(), prev);
  writeAtomic(savePath(), text);
  return true;
});
ipcMain.handle('settings:read', () => readText(settingsPath()));
ipcMain.handle('settings:write', (_e, text) => { writeAtomic(settingsPath(), text); return true; });
ipcMain.handle('window:mode', (_e, mode) => {
  if (!win) return;
  if (mode === 'fullscreen') { win.setFullScreen(true); }
  else if (mode === 'borderless') { win.setFullScreen(false); win.setSimpleFullScreen?.(false); win.maximize(); win.setFullScreen(true); }
  else { win.setFullScreen(false); win.unmaximize(); }
});
ipcMain.handle('window:resolution', (_e, w, h) => { if (win && !win.isFullScreen()) win.setContentSize(w, h); });
ipcMain.handle('app:quit', () => app.quit());

app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
