import type {
  DesktopBridgeAPI,
  DesktopFileInfo,
  DesktopFolderResult,
  DesktopWindowControlAction,
  DesktopWriteResult,
} from '../types/desktop';
import { invokeDesktop, isRunningInWebView2, sendWindowControl } from './desktopHostBridge';
import { idbGet, idbSet } from './indexedDbStorage';

const DEFAULT_REPO_PATH = 'Documents\\ULM Library Data';
const REPO_PATH_STORAGE_KEY = 'ulm_library_repo_path_v1';
const REPO_DIR_HANDLE_IDB_KEY = 'ulm_repo_dir_handle';
const LEGACY_REPO_DIR_HANDLE_IDB_KEY = 'repo_dir_handle';
const DEFAULT_LIBRARY_FILENAME = 'Library.ulmlib';

interface BrowserDirectoryHandle {
  name: string;
  queryPermission?: (desc: { mode: 'read' | 'readwrite' }) => Promise<string>;
  requestPermission?: (desc: { mode: 'read' | 'readwrite' }) => Promise<string>;
  getFileHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob | BufferSource | string) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
}

function getNativeBridge(): DesktopBridgeAPI | null {
  if (typeof window === 'undefined') return null;
  const bridge = window.desktopAPI || window.electronAPI;
  return bridge ?? null;
}

function safeReadLocalStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWriteLocalStorage(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage quota or private-mode restrictions
  }
}

/**
 * Returns true when running inside the exported Windows desktop runtime
 * (C# WPF WebView2 or Electron exposing `window.desktopAPI` or `window.electronAPI`).
 */
export function isDesktopRuntime(): boolean {
  const bridge = getNativeBridge();
  return Boolean(
    isRunningInWebView2() ||
      (bridge &&
        (bridge.isDesktop === true ||
          typeof bridge.changeLibraryLocation === 'function' ||
          typeof bridge.selectFolder === 'function' ||
          typeof bridge.selectLibraryFolder === 'function' ||
          typeof bridge.chooseLibraryFolder === 'function' ||
          typeof bridge.openFolderInExplorer === 'function'))
  );
}

/**
 * Persists a browser FileSystemDirectoryHandle in IndexedDB so Master Excel & AutoBackups
 * can continue writing to the chosen folder across reloads.
 */
export async function saveRepoDirHandle(handle: unknown): Promise<void> {
  if (!handle) return;
  try {
    if (typeof window !== 'undefined') {
      (window as unknown as { __ulm_data_dir_handle?: unknown }).__ulm_data_dir_handle = handle;
    }
    await idbSet(REPO_DIR_HANDLE_IDB_KEY, handle);
    await idbSet(LEGACY_REPO_DIR_HANDLE_IDB_KEY, handle);
  } catch {
    // Ignore if browser does not support structured-cloning directory handles
  }
}

export async function getRepoDirHandle(): Promise<BrowserDirectoryHandle | null> {
  try {
    if (typeof window !== 'undefined') {
      const mem = (window as unknown as { __ulm_data_dir_handle?: BrowserDirectoryHandle })
        .__ulm_data_dir_handle;
      if (mem && typeof mem.getFileHandle === 'function') return mem;
    }
    const stored =
      (await idbGet<BrowserDirectoryHandle>(REPO_DIR_HANDLE_IDB_KEY)) ||
      (await idbGet<BrowserDirectoryHandle>(LEGACY_REPO_DIR_HANDLE_IDB_KEY));
    if (stored && typeof stored.getFileHandle === 'function') {
      if (typeof window !== 'undefined') {
        (window as unknown as { __ulm_data_dir_handle?: BrowserDirectoryHandle }).__ulm_data_dir_handle =
          stored;
      }
      return stored;
    }
  } catch {
    // Ignore IDB errors
  }
  return null;
}

/**
 * Returns the configured repository folder path from native desktop host or local storage fallback.
 */
export async function getRepoPath(): Promise<string> {
  const saved = safeReadLocalStorage(REPO_PATH_STORAGE_KEY);
  const bridge = getNativeBridge();

  if (bridge && typeof bridge.getDefaultRepoPath === 'function') {
    try {
      const nativePath = await bridge.getDefaultRepoPath();
      if (nativePath && typeof nativePath === 'string') {
        if (!saved) {
          safeWriteLocalStorage(REPO_PATH_STORAGE_KEY, nativePath);
          return nativePath;
        }
        return saved;
      }
    } catch {
      // Fall through to saved/default path
    }
  }

  return saved || DEFAULT_REPO_PATH;
}

export interface ChangeLibraryLocationOutcome {
  handled: boolean;
  ok: boolean;
  cancelled: boolean;
  canceled: boolean;
  path: string | null;
  error?: string;
}

function normalizeNativeFolderResult(
  raw: string | DesktopFolderResult | null | undefined
): { ok: boolean; cancelled: boolean; canceled: boolean; path: string | null; error?: string } {
  if (raw === null || raw === undefined) {
    return { ok: false, cancelled: true, canceled: true, path: null };
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed
      ? { ok: true, cancelled: false, canceled: false, path: trimmed }
      : { ok: false, cancelled: true, canceled: true, path: null };
  }
  if (typeof raw === 'object') {
    const isCancelled = Boolean(raw.cancelled || raw.canceled);
    if (isCancelled) {
      return { ok: false, cancelled: true, canceled: true, path: null };
    }
    const trimmed = typeof raw.path === 'string' ? raw.path.trim() : '';
    if (trimmed && raw.ok !== false) {
      return { ok: true, cancelled: false, canceled: false, path: trimmed };
    }
    if (raw.error) {
      return {
        ok: false,
        cancelled: false,
        canceled: false,
        path: null,
        error: String(raw.error),
      };
    }
    return {
      ok: false,
      cancelled: raw.ok === undefined,
      canceled: raw.ok === undefined,
      path: null,
      error: raw.ok === false ? 'Could not change library folder location.' : undefined,
    };
  }
  return { ok: false, cancelled: true, canceled: true, path: null };
}

/**
 * Desktop-first Change Library Location bridge:
 * Calls `window.desktopAPI.changeLibraryLocation()` -> `selectLibraryFolder()` -> `chooseLibraryFolder()`
 * -> `selectFolder()` -> WebView2 JSON-RPC `invokeDesktop('changeLibraryLocation')`.
 * Never falls through to `showDirectoryPicker` when inside a Windows desktop/WebView2 host.
 */
export async function changeLibraryLocationDetailed(): Promise<ChangeLibraryLocationOutcome> {
  const bridge = getNativeBridge();
  const inWebView2 = isRunningInWebView2();

  if (!bridge && !inWebView2) {
    return { handled: false, ok: false, cancelled: false, canceled: false, path: null };
  }

  try {
    let raw: string | DesktopFolderResult | null | undefined;
    if (bridge && typeof bridge.changeLibraryLocation === 'function') {
      raw = await bridge.changeLibraryLocation();
    } else if (bridge && typeof bridge.selectLibraryFolder === 'function') {
      raw = await bridge.selectLibraryFolder();
    } else if (bridge && typeof bridge.chooseLibraryFolder === 'function') {
      raw = await bridge.chooseLibraryFolder();
    } else if (bridge && typeof bridge.selectFolder === 'function') {
      raw = await bridge.selectFolder();
    } else if (inWebView2) {
      raw = await invokeDesktop<DesktopFolderResult>('changeLibraryLocation');
    } else {
      return {
        handled: true,
        ok: false,
        cancelled: false,
        canceled: false,
        path: null,
        error: 'Desktop folder picker bridge is unavailable in this host build.',
      };
    }

    const res = normalizeNativeFolderResult(raw);
    if (res.ok && res.path) {
      safeWriteLocalStorage(REPO_PATH_STORAGE_KEY, res.path);
    }
    return { handled: true, ...res };
  } catch (err) {
    return {
      handled: true,
      ok: false,
      cancelled: false,
      canceled: false,
      path: null,
      error: err instanceof Error ? err.message : 'Could not change library folder location.',
    };
  }
}

/**
 * Opens a native Windows folder picker via Desktop IPC when in desktop runtime,
 * distinguishing between user cancellation vs unavailable native API.
 */
export async function pickRepoFolderDetailed(): Promise<{
  handled: boolean;
  canceled: boolean;
  path: string | null;
  error?: string;
}> {
  const res = await changeLibraryLocationDetailed();
  return {
    handled: res.handled,
    canceled: res.cancelled,
    path: res.path,
    error: res.error,
  };
}

/**
 * Opens a native Windows folder picker via Desktop IPC when in desktop runtime,
 * or returns null in browser mode so callers can fall back to browser pickers.
 */
export async function pickRepoFolder(): Promise<string | null> {
  const res = await changeLibraryLocationDetailed();
  return res.ok && res.path ? res.path : null;
}

/**
 * Opens the library repository folder in Windows File Explorer when in desktop runtime.
 * Returns true if launched natively, false in browser preview fallback.
 */
export async function openRepoFolder(folderPath?: string): Promise<boolean> {
  const bridge = getNativeBridge();
  if (!bridge || typeof bridge.openFolderInExplorer !== 'function') {
    return false;
  }

  try {
    const resolvedPath = (folderPath && folderPath.trim()) || (await getRepoPath());
    return await bridge.openFolderInExplorer(resolvedPath);
  } catch {
    return false;
  }
}

/**
 * Checks whether a library file exists on disk in the active repository folder.
 */
export async function checkDiskFile(
  filename: string = DEFAULT_LIBRARY_FILENAME
): Promise<DesktopFileInfo> {
  const bridge = getNativeBridge();
  if (bridge && typeof bridge.checkLibraryFile === 'function') {
    try {
      return await bridge.checkLibraryFile(filename);
    } catch {
      // Fall through to browser fallback
    }
  }

  return {
    exists: false,
    sizeBytes: 0,
    lastModified: null,
  };
}

/**
 * Reads a text/JSON library file from disk in desktop runtime.
 */
export async function readDiskFile(filename: string): Promise<string | null> {
  const bridge = getNativeBridge();
  if (bridge && typeof bridge.readLibraryFile === 'function') {
    try {
      return await bridge.readLibraryFile(filename);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Writes a text or binary file silently into the user's chosen library repository folder
 * (Desktop IPC `writeLocalFile` / `writeLibraryFile`, or persisted browser `FileSystemDirectoryHandle`).
 */
export async function writeFileToRepoFolder(
  filename: string,
  data: string | Uint8Array,
  isBinary: boolean = false
): Promise<DesktopWriteResult> {
  const bridge = getNativeBridge();

  if (bridge) {
    try {
      if (isBinary) {
        let base64: string;
        if (typeof data === 'string') {
          base64 = data;
        } else {
          let binary = '';
          const chunk = 0x8000;
          for (let i = 0; i < data.length; i += chunk) {
            binary += String.fromCharCode(...data.subarray(i, i + chunk));
          }
          base64 = btoa(binary);
        }

        if (typeof bridge.writeLocalFile === 'function') {
          return await bridge.writeLocalFile(filename, base64, { encoding: 'base64' });
        }
        if (typeof bridge.writeLibraryFile === 'function') {
          return await bridge.writeLibraryFile(filename, `data:application/octet-stream;base64,${base64}`);
        }
      } else {
        const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
        if (typeof bridge.writeLocalFile === 'function') {
          return await bridge.writeLocalFile(filename, text, { encoding: 'utf8' });
        }
        if (typeof bridge.writeLibraryFile === 'function') {
          return await bridge.writeLibraryFile(filename, text);
        }
      }
    } catch {
      // Fall through to directory handle fallback
    }
  }

  // Browser File System Access API persisted handle
  const dirHandle = await getRepoDirHandle();
  if (dirHandle) {
    try {
      const perm = dirHandle.queryPermission
        ? await dirHandle.queryPermission({ mode: 'readwrite' })
        : 'granted';
      if (perm === 'granted') {
        const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        if (data instanceof Uint8Array) {
          const copy = new Uint8Array(data.byteLength);
          copy.set(data);
          await writable.write(copy.buffer);
        } else {
          await writable.write(data);
        }
        await writable.close();
        return { ok: true, fullPath: `${dirHandle.name}\\${filename}` };
      }
    } catch {
      // Ignore permission or handle errors silently
    }
  }

  return { ok: false };
}

/**
 * Writes an automatic backup snapshot directly to disk in desktop runtime or chosen browser folder.
 */
export async function saveAutoBackupToDisk(
  payload: string | Record<string, unknown>,
  filename: string = 'ULM_Library_AutoBackup.json'
): Promise<DesktopWriteResult> {
  const content = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  return writeFileToRepoFolder(filename, content, false);
}

/**
 * Saves a binary export (Excel/PDF/ZIP base64) via native Save dialog in desktop runtime,
 * or triggers a standard browser download in web preview.
 */
export async function saveBinaryExport(
  defaultName: string,
  base64Data: string
): Promise<boolean> {
  const bridge = getNativeBridge();
  if (bridge && typeof bridge.saveBinaryFile === 'function') {
    try {
      return await bridge.saveBinaryFile(defaultName, base64Data);
    } catch {
      // Fall through to browser download
    }
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try {
    const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const binaryString = window.atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const mime = defaultName.toLowerCase().endsWith('.pdf')
      ? 'application/pdf'
      : defaultName.toLowerCase().endsWith('.xlsx')
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/octet-stream';
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = defaultName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return true;
  } catch {
    return false;
  }
}

/**
 * Triggers native desktop printing when available, or falls back to `window.print()`.
 */
export async function printView(): Promise<void> {
  const bridge = getNativeBridge();
  if (bridge && typeof bridge.printCurrentView === 'function') {
    try {
      await bridge.printCurrentView();
      return;
    } catch {
      // Fall through to browser print
    }
  }
  if (typeof window !== 'undefined' && typeof window.print === 'function') {
    window.print();
  }
}

/**
 * Forwards native window controls (`minimize`, `maximize`, `close`) to Desktop IPC / WebView2 host.
 */
export function controlWindow(action: DesktopWindowControlAction): boolean {
  const bridge = getNativeBridge();
  if (bridge && typeof bridge.windowControl === 'function') {
    try {
      bridge.windowControl(action);
      return true;
    } catch {
      // Fall through
    }
  }
  return sendWindowControl(action);
}
