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
