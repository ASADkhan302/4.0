export interface DesktopFileInfo {
  exists: boolean;
  sizeBytes: number;
  lastModified: string | null;
  fullPath?: string;
}

export interface DesktopWriteResult {
  ok: boolean;
  fullPath?: string;
}

export type DesktopWindowControlAction = 'minimize' | 'maximize' | 'close';

export interface DesktopBridgeAPI {
  isDesktop: true;
  platform: 'win32' | 'darwin' | 'linux';
  getDefaultRepoPath: () => Promise<string>;
  selectFolder: () => Promise<string | { canceled?: boolean; path?: string | null } | null>;
  openFolderInExplorer: (folderPath: string) => Promise<boolean>;
  writeLibraryFile: (filename: string, content: string) => Promise<DesktopWriteResult>;
  writeLocalFile?: (
    filename: string,
    content: string,
    options?: { encoding?: 'utf8' | 'base64' }
  ) => Promise<DesktopWriteResult>;
  readLibraryFile: (filename: string) => Promise<string | null>;
  checkLibraryFile: (filename: string) => Promise<DesktopFileInfo>;
  saveBinaryFile: (defaultName: string, base64Data: string) => Promise<boolean>;
  printCurrentView: () => Promise<void>;
  windowControl?: (action: DesktopWindowControlAction) => void;

  // Optional legacy desktop bridge compatibility hooks
  selectLibraryFolder?: () => Promise<string | { canceled?: boolean; path?: string | null } | null>;
  sendWindowAction?: (action: string) => void;
  isWindowMaximized?: () => Promise<boolean>;
  onWindowMaximizeChange?: (cb: (isMax: boolean) => void) => () => void;
  setAppIcon?: (iconUrl: string) => void;
  sqliteQuery?: <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;
  sqliteExecute?: (
    sql: string,
    params?: unknown[]
  ) => Promise<{ changes: number; lastInsertRowid?: number | string }>;
}

declare global {
  interface Window {
    desktopAPI?: DesktopBridgeAPI;
    electronAPI?: DesktopBridgeAPI;
  }
}

export {};
