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
  // Start in the window mode and size the player chose last time.
  let saved = {};
  try { saved = JSON.parse(readText(settingsPath()) || '{}'); } catch { saved = {}; }
  const [w, h] = Array.isArray(saved.resolution) ? saved.resolution : [1600, 900];
  win = new BrowserWindow({
    width: Math.max(1024, w | 0), height: Math.max(600, h | 0), minWidth: 1024, minHeight: 600,
    fullscreen: saved.windowMode === 'fullscreen',
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
  // The previous save becomes the backup, unless it is unreadable: then the backup is the good copy.
  const prev = readText(savePath());
  let ok = false;
  try { ok = !!prev && JSON.parse(prev).format === 'murmurwater-save'; } catch { ok = false; }
  if (ok) writeAtomic(backupPath(), prev);
  writeAtomic(savePath(), text);
  return true;
});
// When neither the save nor its backup could be read, the game starts fresh; keep the unreadable files
// aside first so the new game's autosave can't destroy what might still be recoverable.
ipcMain.handle('save:quarantine', () => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const kept = [];
  for (const [p, name] of [[savePath(), 'save'], [backupPath(), 'save.bak']]) {
    if (!fs.existsSync(p)) continue;
    const to = path.join(app.getPath('userData'), `${name}.corrupt-${stamp}.json`);
    try { fs.renameSync(p, to); kept.push(to); } catch { /* leave it where it is */ }
  }
  return kept;
});
ipcMain.handle('settings:read', () => readText(settingsPath()));
ipcMain.handle('settings:write', (_e, text) => { writeAtomic(settingsPath(), text); return true; });
ipcMain.handle('window:mode', (_e, mode) => {
  if (!win) return;
  // On Windows Electron's fullscreen is borderless (no exclusive mode switch), which alt-tabs cleanly.
  if (mode === 'fullscreen') win.setFullScreen(true);
  else { win.setFullScreen(false); win.unmaximize(); }
});
ipcMain.handle('window:resolution', (_e, w, h) => { if (win && !win.isFullScreen()) win.setContentSize(w, h); });
ipcMain.handle('app:quit', () => app.quit());

app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
// One copy at a time: two would take turns overwriting the same save.
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(createWindow);
  app.on('window-all-closed', () => app.quit());
}
