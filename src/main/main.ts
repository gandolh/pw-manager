import { app, BrowserWindow } from 'electron';
import * as path from 'node:path';
import { initDb } from './db.js';
import { Session } from './session.js';
import { registerIpc } from './ipc.js';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 650,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  const dbPath = path.join(app.getPath('userData'), 'vault.db');
  const db = initDb(dbPath);
  const session = new Session(() => mainWindow);
  registerIpc(db, session);
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
