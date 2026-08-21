import { app, BrowserWindow, dialog, ipcMain, screen, shell } from 'electron';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { printKotJob, printReceiptJob, readPrinterConfig } from './thermal.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;
const PORT = 8001;

let mainWindow = null;
let stopServer = null;

function getUserDataPaths() {
  const root = path.join(app.getPath('userData'), 'POS');
  return {
    root,
    dbDir: path.join(root, 'server', 'databases'),
    dbFile: path.join(root, 'server', 'databases', 'pos-v3.sqlite'),
    uploads: path.join(root, 'uploads'),
  };
}

function ensureDirs(paths) {
  fs.mkdirSync(paths.dbDir, { recursive: true });
  fs.mkdirSync(paths.uploads, { recursive: true });
}

async function startApiServer(paths) {
  const { createServer } = await import('../server/index.js');
  const expressApp = await createServer({
    dbPath: paths.dbFile,
    uploadsPath: paths.uploads,
  });

  const httpServer = await new Promise((resolve, reject) => {
    const server = expressApp.listen(PORT, '127.0.0.1', () => {
      console.log(`POS API listening on 127.0.0.1:${PORT}`);
      resolve(server);
    });
    server.on('error', reject);
  });

  return () =>
    new Promise((resolve) => {
      httpServer.close(() => resolve());
    });
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const iconPath = fs.existsSync(path.join(__dirname, '..', 'build', 'icon.ico'))
    ? path.join(__dirname, '..', 'build', 'icon.ico')
    : path.join(__dirname, '..', 'public', 'favicon.ico');
  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.maximize();
  mainWindow.show();

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('get-api-info', () => {
  return {
    baseUrl: `http://127.0.0.1:${PORT}/api`,
    healthUrl: `http://127.0.0.1:${PORT}/`,
    till: 1,
  };
});

ipcMain.on('app-quit', () => {
  app.quit();
});

ipcMain.handle('print-receipt', async (_event, payload) => {
  const config = readPrinterConfig();
  if (!config || !config.receipt.interface) return { printed: false, fallback: true };
  return printReceiptJob(payload.tx, payload.settings, config, { printKot: !!payload.printKot });
});

ipcMain.handle('print-kot', async (_event, payload) => {
  const config = readPrinterConfig();
  if (!config || !config.kot.interface) return { printed: false, fallback: true };
  return printKotJob(payload.tx, config);
});

// Hand a generated PDF report (sales report, X/Z shift report, invoice) to the
// system's default PDF viewer. Electron's native `webContents.print` reliably
// SIGTRAPs under Wayland (zxdg_exporter_v2 surface-role crash), so we sidestep
// the print pipeline entirely: the renderer already produced a complete PDF, we
// just persist it and let the OS open it. The user can print or save from there,
// and the app shell never gets involved (or crashes).
ipcMain.handle('print-pdf', async (_event, { data }) => {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const tmp = path.join(os.tmpdir(), `pos-report-${Date.now()}.pdf`);
  try {
    fs.writeFileSync(tmp, buffer);
  } catch (err) {
    console.error('Failed to write report PDF', err);
    return { printed: false };
  }
  try {
    await shell.openPath(tmp);
  } catch (err) {
    console.error('Failed to open report PDF', err);
    return { printed: false };
  }
  return { printed: true };
});

ipcMain.handle('save-file', async (_event, { defaultName, type, data }) => {
  const isXlsx = type === 'xlsx';
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export',
    defaultPath: defaultName,
    filters: isXlsx
      ? [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
      : [{ name: 'CSV file', extensions: ['csv'] }],
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
  return { ok: true, filePath };
});

ipcMain.on('app-reload', () => {
  if (mainWindow) mainWindow.reload();
});

// ---------------------------------------------------------------------------
// Auto-updater (electron-updater, GitHub Releases provider)
// ---------------------------------------------------------------------------
const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

let updateState = {
  status: 'idle', // idle | checking | available | downloading | downloaded | error
  version: null,
  error: null,
};

function emitUpdateState() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:state', updateState);
  }
}

function setUpdateState(patch) {
  updateState = { ...updateState, ...patch };
  emitUpdateState();
}

function setupAutoUpdater() {
  if (isDev) return; // auto-updates only run in packaged builds

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = null;

  autoUpdater.on('checking-for-update', () => setUpdateState({ status: 'checking', error: null }));
  autoUpdater.on('update-available', (info) => {
    setUpdateState({ status: 'available', version: info.version, error: null });
    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update available',
        message: `Version ${info.version} is available.`,
        detail: 'A new version of Store POS is ready. Download it now?',
        buttons: ['Update now', 'Later'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.downloadUpdate();
      });
  });
  autoUpdater.on('update-not-available', () => setUpdateState({ status: 'idle', error: null }));
  autoUpdater.on('download-progress', () => setUpdateState({ status: 'downloading' }));
  autoUpdater.on('update-downloaded', (info) => {
    setUpdateState({ status: 'downloaded', version: info.version });
    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update ready',
        message: 'Update downloaded. Restart now to apply?',
        buttons: ['Restart now', 'Later'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
  });
  autoUpdater.on('error', (err) => setUpdateState({ status: 'error', error: err.message }));

  autoUpdater.checkForUpdates().catch((err) => {
    setUpdateState({ status: 'error', error: err.message });
  });
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, UPDATE_CHECK_INTERVAL_MS);
}

ipcMain.handle('updater:get-state', () => updateState);
ipcMain.handle('updater:check-now', async () => {
  if (isDev) return { status: 'idle', dev: true };
  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    setUpdateState({ status: 'error', error: err.message });
  }
  return updateState;
});
ipcMain.handle('updater:download', async () => {
  if (isDev) return { ok: false, dev: true };
  try {
    await autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
ipcMain.handle('updater:restart', () => {
  if (isDev) return { ok: false, dev: true };
  autoUpdater.quitAndInstall();
  return { ok: true };
});

app.whenReady().then(async () => {
  const paths = getUserDataPaths();
  ensureDirs(paths);

  try {
    stopServer = await startApiServer(paths);
  } catch (err) {
    console.error('Failed to start API server', err);
  }

  createWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  if (stopServer) {
    await stopServer();
    stopServer = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  if (stopServer) {
    await stopServer();
    stopServer = null;
  }
});
