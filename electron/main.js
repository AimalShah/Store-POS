import { app, BrowserWindow, ipcMain, screen } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

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
    dbFile: path.join(root, 'server', 'databases', 'pos.sqlite'),
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
    jwtSecret: app.getPath('userData') + '-store-pos-jwt',
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

ipcMain.on('app-reload', () => {
  if (mainWindow) mainWindow.reload();
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
