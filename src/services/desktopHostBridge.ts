/**
 * Native Windows Desktop Host Bridge (C# .NET 8 WPF + WebView2 & Electron)
 * Bridges React window controls (`minimize`, `maximize`, `close`) to the C# WebView2 host
 * mapped to `https://app.local/` and installs native desktop keyboard/context-menu guards.
 */

export type DesktopWindowAction = 'minimize' | 'maximize' | 'close';

interface WebView2ChromeBridge {
  webview?: {
    postMessage: (message: unknown) => void;
    addEventListener?: (type: string, listener: (event: { data: unknown }) => void) => void;
    removeEventListener?: (type: string, listener: (event: { data: unknown }) => void) => void;
  };
}

interface ElectronWindowBridge {
  sendWindowAction?: (action: string) => void;
  isWindowMaximized?: () => Promise<boolean>;
  onWindowMaximizeChange?: (cb: (isMax: boolean) => void) => () => void;
}

/**
 * Returns true when running inside the C# .NET 8 WPF WebView2 host (`window.chrome.webview` or `https://app.local/`).
 */
export function isRunningInWebView2(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as { chrome?: WebView2ChromeBridge };
  if (typeof w.chrome?.webview?.postMessage === 'function') {
    return true;
  }
  const host = window.location?.hostname?.toLowerCase() || '';
  return host === 'app.local' || host === 'ulm-lms.local';
}

let rpcSeq = 0;

/**
 * Invokes a JSON-RPC command on the native C# WPF WebView2 host via `window.chrome.webview.postMessage`.
 */
export function invokeDesktop<T = unknown>(
  method: string,
  params?: Record<string, unknown>,
  timeoutMs: number = 120000
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Desktop bridge unavailable outside browser window.'));
      return;
    }

    const w = window as unknown as { chrome?: WebView2ChromeBridge };
    const webview = w.chrome?.webview;
    if (!webview || typeof webview.postMessage !== 'function') {
      reject(new Error('WebView2 host bridge is not available.'));
      return;
    }

    const id = `ulm_rpc_${Date.now()}_${++rpcSeq}`;
    let settled = false;

    const cleanup = (
      timer: ReturnType<typeof setTimeout> | null,
      listener: (event: { data: unknown }) => void
    ) => {
      if (timer) clearTimeout(timer);
      if (typeof webview.removeEventListener === 'function') {
        webview.removeEventListener('message', listener);
      }
    };

    const onMessage = (event: { data: unknown }) => {
      if (settled) return;
      let payload = event?.data as Record<string, unknown> | string | null | undefined;
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload) as Record<string, unknown>;
        } catch {
          return;
        }
      }
      if (!payload || typeof payload !== 'object') return;

      // Match JSON-RPC response by id
      if (payload.id === id) {
        settled = true;
        cleanup(timer, onMessage);
        if (payload.error) {
          reject(new Error(String(payload.error)));
        } else {
          resolve((payload.result !== undefined ? payload.result : payload) as T);
        }
        return;
      }

      // Compatibility fallback for legacy C# host folder-selected event
      if (
        (method === 'changeLibraryLocation' || method === 'selectLibraryFolder') &&
        payload.event === 'folder-selected' &&
        typeof payload.folderPath === 'string'
      ) {
        settled = true;
        cleanup(timer, onMessage);
        resolve({ ok: true, cancelled: false, path: payload.folderPath } as unknown as T);
      }
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup(null, onMessage);
      reject(new Error(`Desktop command "${method}" timed out.`));
    }, timeoutMs);

    if (typeof webview.addEventListener === 'function') {
      webview.addEventListener('message', onMessage);
    }

    try {
      webview.postMessage({ id, method, params: params ?? {} });
    } catch (err) {
      settled = true;
      cleanup(timer, onMessage);
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

/**
 * Sends a window control action (`minimize`, `maximize`, `close`) to the C# WebView2 host or Electron shell.
 * Returns `true` if handled by a native desktop host, or `false` when running in a standard web browser.
 */
export function sendWindowControl(action: DesktopWindowAction): boolean {
  if (typeof window === 'undefined') return false;

  const w = window as unknown as {
    chrome?: WebView2ChromeBridge;
    electronAPI?: ElectronWindowBridge;
  };

  // 1. C# .NET 8 WPF + WebView2 Host (`window.chrome.webview.postMessage`)
  if (typeof w.chrome?.webview?.postMessage === 'function') {
    try {
      w.chrome.webview.postMessage({ type: 'WINDOW_CONTROL', action });
      return true;
    } catch {
      try {
        w.chrome.webview.postMessage(JSON.stringify({ type: 'WINDOW_CONTROL', action }));
        return true;
      } catch {
        // Fall through
      }
    }
  }

  // 2. Electron IPC Fallback
  if (typeof w.electronAPI?.sendWindowAction === 'function') {
    try {
      w.electronAPI.sendWindowAction(action);
      return true;
    } catch {
      // Fall through
    }
  }

  return false;
}

let guardsInitialized = false;

/**
 * Installs desktop-grade keyboard & context-menu guards when hosted inside WebView2:
 * - Blocks accidental browser refresh (`F5`, `Ctrl+R`, `Ctrl+Shift+R`) and DevTools (`F12`) in production desktop host
 * - Suppresses the default browser right-click menu on non-input UI chrome while preserving cut/copy/paste inside inputs
 */
export function initDesktopHostGuards(): void {
  if (typeof window === 'undefined' || guardsInitialized) return;
  guardsInitialized = true;

  window.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      if (!isRunningInWebView2()) return;

      const key = e.key;
      const isRefreshKey =
        key === 'F5' ||
        ((e.ctrlKey || e.metaKey) && (key === 'r' || key === 'R'));
      const isDevToolsKey = key === 'F12';

      if (isRefreshKey || isDevToolsKey) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    { capture: true }
  );

  window.addEventListener(
    'contextmenu',
    (e: MouseEvent) => {
      if (!isRunningInWebView2()) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      const tagName = target.tagName?.toUpperCase();
      const isEditable =
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        Boolean(target.closest('input, textarea, [contenteditable="true"]'));

      if (!isEditable) {
        e.preventDefault();
      }
    },
    { capture: true }
  );
}
