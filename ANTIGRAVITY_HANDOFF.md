# ULM Central Campus Library — Antigravity Desktop Handoff Guide

## 1. Project Overview
- **Application**: University of Lakki Marwat — Central Campus Library Management System (`university-of-lakki-marwat-lms`)
- **Stack**: React 19 + TypeScript + Vite 8 + Tailwind CSS v4 (`@tailwindcss/vite`)
- **Target Desktop Runtime**: Windows Desktop `.exe` (Electron or C# .NET 8 WPF + WebView2) loading the offline static bundle from `dist/index.html` using relative asset paths (`base: './'`).
- **Offline Readiness**: Zero external AI Studio CDN dependencies, zero native browser `alert()`/`confirm()`/`prompt()` dialogs, and full IndexedDB + `localStorage` + Desktop IPC persistence.

---

## 2. Build & Verification Commands
```bash
npm install
npm run build
```
- `npm run build` executes `tsc --noEmit && vite build`.
- Output directory: `dist/` (`emptyOutDir: true`, `base: './'`, `assetsDir: 'assets'`).
- Development preview: `npm run dev` (serves on port `3000`).
- Static preview of production bundle: `npm run preview`.

---

## 3. Desktop IPC Contract (`window.desktopAPI`)
Defined in **`src/types/desktop.d.ts`** and wrapped with graceful browser fallbacks in **`src/services/desktopBridge.ts`**.

The Windows desktop host (Electron `preload.js` via `contextBridge.exposeInMainWorld('desktopAPI', ...)` or C# WPF WebView2 host bridge) should expose `window.desktopAPI` (or `window.electronAPI`) implementing:

```ts
interface DesktopBridgeAPI {
  isDesktop: true;
  platform: 'win32' | 'darwin' | 'linux';
  getDefaultRepoPath: () => Promise<string>;
  selectFolder: () => Promise<string | null>;
  openFolderInExplorer: (folderPath: string) => Promise<boolean>;
  writeLibraryFile: (filename: string, content: string) => Promise<{ ok: boolean; fullPath?: string }>;
  readLibraryFile: (filename: string) => Promise<string | null>;
  checkLibraryFile: (filename: string) => Promise<{
    exists: boolean;
    sizeBytes: number;
    lastModified: string | null;
    fullPath?: string;
  }>;
  saveBinaryFile: (defaultName: string, base64Data: string) => Promise<boolean>;
  printCurrentView: () => Promise<void>;
  windowControl?: (action: 'minimize' | 'maximize' | 'close') => void;
}
```

### Automatic Desktop Runtime Behaviors Already Wired
- **Mock Chrome Auto-Hide**: `src/components/WindowsTitleBar.tsx` automatically returns `null` when `isDesktopRuntime()` returns `true`, preventing duplicate mock window controls (`— □ ×`) inside the native `.exe`.
- **Settings Repository Controls**: `src/components/SettingsView.tsx` wires **Open Folder**, **Change Location**, **Check Library File**, and **Copy Path** through `desktopBridge.ts`.
- **Workstation Setup Gate**: `src/components/modals/WorkstationSetupModal.tsx` wires **Browse Folder** and default repository path hydration through `desktopBridge.ts`.
- **WebView2 Guards**: `src/services/desktopHostBridge.ts` handles `window.chrome.webview.postMessage` window control and production keyboard/context-menu guards (`F5`, `Ctrl+R`, `F12`).

---

## 4. Protected UI & Animation Files (Do Not Redesign or Strip)
Preserve all Frosted Crystal Liquid-Glass surfaces, typography, and motion physics in these files during desktop packaging:
- `src/index.css` — Frosted Crystal Liquid-Glass tokens, Dark Glass & White Glass variables, hairline borders, and animations.
- `src/components/ui/background-gradient-animation.tsx` — Ambient liquid gradient backdrop (`BackgroundGradientAnimation`).
- `src/utils/themeTransition.ts` — Circular Theme Wave View Transition (`triggerCircularThemeTransition`) & live Institutional Identity sync (`useInstitutionalIdentity`).
- `src/utils/heavyTaskRunner.tsx` — Global Frosted Crystal heavy-task loading overlay.
- `src/components/AppOpeningSplash.tsx` — Official Portrait Opening Splash Screen with ULM 2017 Crest.
- `src/components/PrimaryHeader.tsx` & `src/components/LmsSidebar.tsx` — Waterline liquid-physics navigation and top header shell.
- `src/components/BooksCatalogView.tsx` — Catalog grid, series extension controls, and Waterline segmented view switcher.
- `src/components/BorrowersView.tsx` & `src/components/library/UlmSmartIdCard.tsx` — Member ID Cards & CR80 card preview/print system.
- `src/components/AlmariView.tsx` — Manual Almari & Shelf Management Board.
- `src/components/SettingsView.tsx` & `src/components/settings/*` — Executive System Settings, Appearance, Book Groups, and Almari Registry.

---

## 5. Persistent Data Stores

### IndexedDB
- **Database Name**: `ulm_central_library_idb_v1`
- **Object Store**: `kv_store` (implemented in `src/services/indexedDbStorage.ts`)
- Stores large catalog datasets (`books`, `borrowers`, `transactions`, `history`) to bypass the ~5 MB `localStorage` quota for 5,000–50,000+ book collections.

### Key `localStorage` Keys
| Key | Purpose |
| --- | --- |
| `ulm_lms_books_v1` / `ulm_library_books_master_v1` | Catalog books mirror & fast boot metadata |
| `ulm_lms_borrowers_v1` | Registered Student, Faculty & Staff borrowers |
| `ulm_lms_transactions_v1` | Issue / Return circulation ledger |
| `ulm_lms_history_v1` | Audit trail & circulation/catalog activity log |
| `ulm_almari_placements_master_v3` | Authoritative Accession → Almari & Shelf placement map |
| `ulm_lms_almaris_v1` | Almari cupboards registry (cupboard names, shelf counts, rooms) |
| `ulm_lms_book_groups_v1` | Discipline / Book Group definitions |
| `ulm_lms_settings_v1` | Workstation settings & circulation rules |
| `ulm_institutional_identity_v1` | University name, library name, address, phone, email, custom crest PNG |
| `ulm_setup_completed_v1` | First-run Setup Gate completion flag (`'true'` / `'false'`) |
| `ulm_library_repo_path_v1` | Active Windows local repository folder path |
| `ulm_data_folder_config_v1` | Repository folder metadata & configuration timestamp |
| `ulm_highest_serial_number_v1` | Monotonic accession series watermark (`AccessionSeriesEngine`) |
| `ulm_database_cleared` | Explicit zero-catalog reset state flag |

### Core Domain Services
- `src/services/indexedDbStorage.ts` — Async IndexedDB key-value persistence & O(1) book search index generator.
- `src/services/storage.ts` — Unified `LibraryStorage` facade, hydration lock, loan-to-book reconciliation, and storage location config.
- `src/services/accessionSeriesEngine.ts` — Deterministic sequential accession & barcode allocation (`AccessionSeriesEngine`).
- `src/services/almariService.ts` — Centralized Almari/Shelf placement (`assignBookPlacement`, `unassignBookPlacement`), cupboard CRUD, and group mapping.
- `src/services/desktopBridge.ts` — Native Desktop IPC facade with graceful web preview fallbacks.
