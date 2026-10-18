/**
 * ULM Central Campus Library Management System
 * Electron Preload Bridge (electron/preload.cjs)
 *
 * Exposes a narrowly scoped, validated API on both `window.ulmLibraryApi`
 * and `window.ulmElectronSqlite` with contextIsolation: true and nodeIntegration: false,
 * and prevents EventEmitter listener leaks across repeated imports.
 */

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ulmLibraryApi', {
  getDatabaseInfo: () => ipcRenderer.invoke('ulm-db:get-info'),

  selectCustomDataFolder: () => ipcRenderer.invoke('ulm-db:select-data-folder'),

  getStartupBootSnapshot: (pageSize = 50) =>
    ipcRenderer.invoke('ulm-db:boot-snapshot', pageSize),

  getFullBookDetails: (idOrAccession) =>
    ipcRenderer.invoke('ulm-db:get-full-book', String(idOrAccession ?? '')),

  queryBooks: (params) => ipcRenderer.invoke('ulm-db:query-books', params),

  lookupByScanCode: (code) => ipcRenderer.invoke('ulm-db:scan-lookup', String(code ?? '')),

  saveBook: (book, mode = 'upsert') =>
    ipcRenderer.invoke('ulm-db:save-book', { book, mode }),

  deleteBook: (idOrAccession) =>
    ipcRenderer.invoke('ulm-db:delete-book', String(idOrAccession ?? '')),

  getDashboardStats: () => ipcRenderer.invoke('ulm-db:dashboard-stats'),

  migrateFromLocalStorage: (payload) =>
    ipcRenderer.invoke('ulm-db:migrate-localstorage', payload),

  importSingleChunk: (chunk, options = {}) =>
    ipcRenderer.invoke('ulm-db:import-single-chunk', {
      chunk,
      onDuplicate: options.onDuplicate || 'skip',
      rowOffset: options.rowOffset || 0,
      isFinalChunk: Boolean(options.isFinalChunk),
    }),

  importBooksChunked: (books, options = {}) =>
    ipcRenderer.invoke('ulm-db:import-books-chunked', {
      books,
      onDuplicate: options.onDuplicate || 'skip',
      chunkSize: options.chunkSize || 250,
    }),

  bulkUpdateByFilter: (filterParams, patch) =>
    ipcRenderer.invoke('ulm-db:bulk-update-by-filter', { filterParams, patch }),

  cancelImport: () => ipcRenderer.invoke('ulm-db:cancel-import'),

  onImportProgress: (callback) => {
    if (typeof callback !== 'function') return () => {};
    // Remove stale progress listeners to prevent memory/listener leaks
    ipcRenderer.removeAllListeners('ulm-db:import-progress');
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('ulm-db:import-progress', listener);
    return () => ipcRenderer.removeListener('ulm-db:import-progress', listener);
  },

  createBackup: (customOutputPath) =>
    ipcRenderer.invoke('ulm-db:create-backup', customOutputPath),

  restoreBackup: (backupFilePath) =>
    ipcRenderer.invoke('ulm-db:restore-backup', backupFilePath),
});

// Also expose under `window.ulmElectronSqlite` for full compatibility with ai_studio_code.txt
contextBridge.exposeInMainWorld('ulmElectronSqlite', {
  getDatabaseInfo: () => ipcRenderer.invoke('ulm-db:get-info'),
  selectCustomDataFolder: () => ipcRenderer.invoke('ulm-db:select-folder'),
  getStartupBootSnapshot: (pageSize = 50) => ipcRenderer.invoke('ulm-db:boot-snapshot', pageSize),
  getFullBookDetails: (idOrAccession) => ipcRenderer.invoke('ulm-db:get-full-book', idOrAccession),
  queryBooks: (params) => ipcRenderer.invoke('ulm-db:query-books', params),
  lookupByScanCode: (code) => ipcRenderer.invoke('ulm-db:scan-lookup', code),
  upsertBook: (book) => ipcRenderer.invoke('ulm-db:save-book', { book, mode: 'upsert' }),
  saveBook: (book, mode = 'upsert') => ipcRenderer.invoke('ulm-db:save-book', { book, mode }),
  importSingleChunk: (chunk, options = {}) =>
    ipcRenderer.invoke('ulm-db:import-single-chunk', {
      chunk,
      onDuplicate: options.onDuplicate || 'skip',
      rowOffset: options.rowOffset || 0,
      isFinalChunk: Boolean(options.isFinalChunk),
    }),
  batchUpsertBooks: (books, batchSize = 250) =>
    ipcRenderer.invoke('ulm-db:import-books-chunked', { books, onDuplicate: 'upsert', chunkSize: batchSize }),
  importBooksChunked: (books, options = {}) => ipcRenderer.invoke('ulm-db:import-books-chunked', { books, options }),
  bulkUpdateByFilter: (filterParams, patch) => ipcRenderer.invoke('ulm-db:bulk-update-by-filter', { filterParams, patch }),
  cancelImport: () => ipcRenderer.invoke('ulm-db:cancel-import'),
  onImportProgress: (callback) => {
    if (typeof callback !== 'function') return () => {};
    ipcRenderer.removeAllListeners('ulm-db:import-progress');
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('ulm-db:import-progress', listener);
    return () => ipcRenderer.removeListener('ulm-db:import-progress', listener);
  },
  deleteBook: (id, _permanent = true) => ipcRenderer.invoke('ulm-db:delete-book', id),
  getStats: () => ipcRenderer.invoke('ulm-db:dashboard-stats'),
  getDashboardStats: () => ipcRenderer.invoke('ulm-db:dashboard-stats'),
  migrateFromLocalStorage: (payload) => ipcRenderer.invoke('ulm-db:migrate-localstorage', payload),
  createBackup: (customOutputPath) => ipcRenderer.invoke('ulm-db:create-backup', customOutputPath),
  restoreBackup: (backupFilePath) => ipcRenderer.invoke('ulm-db:restore-backup', backupFilePath),
});
