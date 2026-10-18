/**
 * ULM Central Campus Library Management System
 * Electron Main Process (electron/main.cjs)
 *
 * Hardware GPU Acceleration, V8 RAM Allocation & Concurrency Hardening:
 * - GPU Hardware Acceleration switches (`enable-gpu-rasterization`, `enable-zero-copy`, `ignore-gpu-blocklist`)
 * - 4 GB V8 Heap RAM ceiling (`--max-old-space-size=4096`) for large file operations
 * - nodeIntegration: false, contextIsolation: true, backgroundThrottling: false
 * - Concurrency lock (`isImportRunning`) preventing overlapping imports
 * - Chunked 250-record batch transactions with setImmediate event-loop yielding
 */

'use strict';

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { UlmSqliteEngine } = require('./db/sqliteEngine.cjs');

// Enable GPU Hardware Acceleration & expanded V8 RAM ceiling before app.whenReady()
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-accelerated-2d-canvas');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096');

let mainWindow = null;
let sqliteEngine = null;
let activeImportCancelled = false;
let isImportRunning = false;

const WINDOW_STATE_FILE = 'ulm_lms_window_state.json';

function loadWindowState(userDataPath) {
  try {
    const statePath = path.join(userDataPath, WINDOW_STATE_FILE);
    if (fs.existsSync(statePath)) {
      return JSON.parse(fs.readFileSync(statePath, 'utf8'));
    }
  } catch (_) {}
  return { width: 1440, height: 900, isMaximized: true };
}

function saveWindowState(userDataPath, win) {
  if (!win || win.isDestroyed()) return;
  try {
    const bounds = win.getBounds();
    const state = {
      ...bounds,
      isMaximized: win.isMaximized(),
    };
    fs.writeFileSync(
      path.join(userDataPath, WINDOW_STATE_FILE),
      JSON.stringify(state, null, 2),
      'utf8'
    );
  } catch (_) {}
}

function createMainWindow() {
  const userDataPath = app.getPath('userData');
  const winState = loadWindowState(userDataPath);

  mainWindow = new BrowserWindow({
    width: winState.width || 1440,
    height: winState.height || 900,
    x: winState.x,
    y: winState.y,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0B1220',
    title: 'ULM Central Campus Library Management System',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false, // Keep full CPU priority during background batch imports
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  if (winState.isMaximized) {
    mainWindow.maximize();
  }

  mainWindow.on('close', () => saveWindowState(userDataPath, mainWindow));

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

function registerSqliteIpcHandlers() {
  ipcMain.handle('ulm-db:get-info', async () => {
    return {
      dbPath: sqliteEngine.dbPath,
      activeDataDir: sqliteEngine.activeDataDir,
      coversDir: sqliteEngine.coversDir,
      backupsDir: sqliteEngine.backupsDir,
      journalMode: sqliteEngine.journalMode,
      stats: sqliteEngine.getDashboardStats(),
    };
  });

  ipcMain.handle('ulm-db:select-data-folder', async () => {
    if (isImportRunning) {
      throw new Error('Cannot change database folder while a book import is in progress.');
    }
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Local Folder for ULM Library SQLite Database (ulm-library.sqlite)',
      defaultPath: sqliteEngine.activeDataDir,
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { canceled: true, activeDataDir: sqliteEngine.activeDataDir };
    }
    return sqliteEngine.changeDataDirectory(result.filePaths[0]);
  });

  ipcMain.handle('ulm-db:boot-snapshot', async (_event, pageSize) => {
    return sqliteEngine.getStartupBootSnapshot(pageSize || 50);
  });

  ipcMain.handle('ulm-db:get-full-book', async (_event, idOrAccession) => {
    return sqliteEngine.getFullBookDetails(idOrAccession);
  });

  ipcMain.handle('ulm-db:query-books', async (_event, params) => {
    return sqliteEngine.queryBooks(params || {});
  });

  ipcMain.handle('ulm-db:scan-lookup', async (_event, code) => {
    return sqliteEngine.findBookByScanCode(code);
  });

  ipcMain.handle('ulm-db:save-book', async (_event, { book, mode }) => {
    return sqliteEngine.saveBook(book, mode || 'upsert');
  });

  ipcMain.handle('ulm-db:delete-book', async (_event, idOrAccession) => {
    return sqliteEngine.deleteBook(idOrAccession);
  });

  ipcMain.handle('ulm-db:dashboard-stats', async () => {
    return sqliteEngine.getDashboardStats();
  });

  ipcMain.handle('ulm-db:select-folder', async () => {
    if (!mainWindow) {
      return { canceled: true, activeDataDir: sqliteEngine.activeDataDir };
    }
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Local Folder for ULM Library SQLite Database (ulm-library.sqlite)',
      defaultPath: sqliteEngine.activeDataDir,
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { canceled: true, activeDataDir: sqliteEngine.activeDataDir };
    }
    return sqliteEngine.changeDataDirectory(result.filePaths[0]);
  });

  ipcMain.handle('ulm-db:bulk-update-by-filter', async (_event, { filterParams, patch } = {}) => {
    return sqliteEngine.bulkUpdateByFilter(filterParams || {}, patch || {});
  });

  ipcMain.handle('ulm-db:migrate-localstorage', async (_event, payload) => {
    if (isImportRunning) {
      throw new Error('An import or migration operation is already in progress.');
    }
    isImportRunning = true;
    try {
      return sqliteEngine.migrateFromLocalStoragePayload(payload || {}, { batchSize: 250 });
    } finally {
      isImportRunning = false;
    }
  });

  ipcMain.handle('ulm-db:cancel-import', async () => {
    activeImportCancelled = true;
    return { cancelRequested: true };
  });

  ipcMain.handle(
    'ulm-db:import-single-chunk',
    async (_event, { chunk, onDuplicate = 'skip', rowOffset = 0, isFinalChunk = false }) => {
      if (!Array.isArray(chunk)) {
        throw new Error('Expected an array of book records for chunk import.');
      }
      const report = sqliteEngine.importBookBatchTransactional(chunk, {
        onDuplicate,
        rowOffset,
        skipShelfRecalc: !isFinalChunk,
      });
      return report;
    }
  );

  ipcMain.handle(
    'ulm-db:import-books-chunked',
    async (event, { books, onDuplicate = 'skip', chunkSize = 250 }) => {
      if (!Array.isArray(books)) {
        throw new Error('Expected an array of book records to import.');
      }
      if (isImportRunning) {
        throw new Error('Another book import is already running. Please wait or cancel it first.');
      }

      isImportRunning = true;
      activeImportCancelled = false;
      const total = books.length;
      const safeChunkSize = Math.min(500, Math.max(50, Number(chunkSize) || 250));

      const summary = {
        totalInput: total,
        processed: 0,
        inserted: 0,
        updated: 0,
        skippedDuplicates: 0,
        rejected: 0,
        cancelled: false,
        errors: [],
      };

      try {
        for (let offset = 0; offset < total; offset += safeChunkSize) {
          if (activeImportCancelled) {
            summary.cancelled = true;
            break;
          }

          const slice = books.slice(offset, offset + safeChunkSize);
          const batchReport = sqliteEngine.importBookBatchTransactional(slice, {
            onDuplicate,
            rowOffset: offset,
            skipShelfRecalc: true,
          });

          summary.processed += batchReport.processed;
          summary.inserted += batchReport.inserted;
          summary.updated += batchReport.updated;
          summary.skippedDuplicates += batchReport.skippedDuplicates;
          summary.rejected += batchReport.rejected;

          if (batchReport.errors.length > 0 && summary.errors.length < 1000) {
            summary.errors.push(...batchReport.errors.slice(0, 1000 - summary.errors.length));
          }

          if (!event.sender.isDestroyed()) {
            event.sender.send('ulm-db:import-progress', {
              processed: summary.processed,
              total,
              percent: Math.round((summary.processed / Math.max(1, total)) * 100),
              inserted: summary.inserted,
              updated: summary.updated,
              skippedDuplicates: summary.skippedDuplicates,
              rejected: summary.rejected,
            });
          }

          await new Promise((resolve) => setImmediate(resolve));
        }

        sqliteEngine.recalculateShelfOccupancy();
        summary.finalDbBooks = sqliteEngine.getDashboardStats().totalBooks;
        return summary;
      } finally {
        isImportRunning = false;
      }
    }
  );

  ipcMain.handle('ulm-db:create-backup', async (_event, customOutputPath) => {
    return sqliteEngine.createBackupSnapshot(customOutputPath || null);
  });

  ipcMain.handle('ulm-db:restore-backup', async (_event, backupFilePath) => {
    if (isImportRunning) {
      throw new Error('Cannot restore backup while a book import is running.');
    }
    let targetPath = backupFilePath;
    if (!targetPath) {
      const picked = await dialog.showOpenDialog(mainWindow, {
        title: 'Select ULM Library SQLite Backup File to Restore',
        defaultPath: sqliteEngine.backupsDir,
        filters: [{ name: 'SQLite Database', extensions: ['sqlite', 'db', 'sqlite3'] }],
        properties: ['openFile'],
      });
      if (picked.canceled || !picked.filePaths.length) {
        return { canceled: true };
      }
      targetPath = picked.filePaths[0];
    }
    return sqliteEngine.restoreBackupSnapshot(targetPath);
  });
}

app.whenReady().then(() => {
  sqliteEngine = new UlmSqliteEngine({
    defaultUserDataDir: app.getPath('userData'),
  });
  sqliteEngine.init();
  registerSqliteIpcHandlers();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (sqliteEngine) sqliteEngine.close();
    app.quit();
  }
});

app.on('before-quit', () => {
  if (sqliteEngine) sqliteEngine.close();
});
