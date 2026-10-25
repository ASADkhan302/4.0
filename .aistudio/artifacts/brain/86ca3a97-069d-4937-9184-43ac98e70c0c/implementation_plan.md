# University of Lakki Marwat — Central Campus Library Management System: Offline Windows Desktop (.exe) Readiness Plan

## 1. Confirmed Decisions & Scope
- **Full Offline Bundle Architecture**: Eliminate all external internet/CDN links (Google Fonts preconnect/stylesheets, CDN scripts, or import maps) so the application compiles cleanly offline via Vite (`base: './'`) into a self-contained static bundle mapped to `https://app.local/` inside WebView2.
- **Complete C# .NET 8 WPF + WebView2 Builder Included**: Provide a turnkey desktop packaging workflow that compiles the production frontend bundle, converts the ULM 2017 crest into a multi-resolution Windows `.ico` (`16x16` through `256x256`), and builds the native C# .NET 8 WPF + WebView2 `.exe` host mapped to `https://app.local/`.
- **Custom Top Windows Title Bar Retained**: Keep the custom top workstation title bar (`ULM Library — Central Campus Workstation`) permanently visible with the official ULM 2017 crest badge on the left and native WebView2 window control buttons (`Minimize`, `Maximize/Restore`, `Close`) on the right.
- **Locked Executive UI & Scroll Geometry Preserved**:
  - **Full-Width Executive Institutional Header**: Retains the full-width edge-to-edge shell (`min-h-[96px] xl:min-h-[108px]`) with the large ULM crest pedestal and title block pinned flush-left (`mr-auto`) and the 6 large executive toolbar buttons (`White Glass`, `125%`, `Sync Sheet`, `Export`, `Master Excel`, `+ Add Book`) pinned flush-right (`ml-auto`).
  - **Fixed Left Navigation Sidebar**: Remains permanently docked on the left (`240px` expanded / `72px` collapsed icon rail) and never scrolls vertically with page content.
  - **Dedicated Vertical Scroll Container**: `#ulm-main-scroll-view` (`flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar`) serves as the single smooth vertical scroll viewport across all 8 workstation modules.

---

## 2. System & Desktop Host Architecture

```
+--------------------------------------------------------------------------------------------------+
| C# .NET 8 WPF Host Window (WebView2 Virtual Host: https://app.local/ -> dist/)                   |
| +----------------------------------------------------------------------------------------------+ |
| | Custom Windows Title Bar (32px, Fixed)                                                       | |
| | [ULM 2017 Crest] ULM Library — Central Campus Workstation        [ _ ] [ [] ] [ X ] (IPC)    | |
| +----------------------------------------------------------------------------------------------+ |
| | Full-Width Executive Institutional Header (96px-108px, Fixed, Flush-Left / Flush-Right)      | |
| | [ULM 2017 Crest Pedestal + Title + 100,000 Volumes]  [Glass][125%][Sync][Export][Excel][+Add]| |
| +----------------------------------------------------------------------------------------------+ |
| | Workspace Body (flex-1 min-h-0 overflow-hidden)                                              | |
| | +------------------------+ +---------------------------------------------------------------+ | |
| | | Fixed Left Sidebar     | | Dedicated Vertical Scroll Container (#ulm-main-scroll-view)   | | |
| | | (240px / 72px Rail)    | | - Unified smooth vertical scrolling across all 8 views        | | |
| | | - 8 Core Modules       | | - 100,000-Volume IndexedDB Engine + Bundled Offline XLSX      | | |
| | | - Expand/Collapse      | | - Student/Faculty ID Cards + Barcode Printing + Crest Mark    | | |
| | | - Reset Workspace      | | - Institutional Footer with ULM 2017 Crest Seal               | | |
| | +------------------------+ +---------------------------------------------------------------+ | |
+--------------------------------------------------------------------------------------------------+
```

---

## 3. Visual & Offline Bundling Specifications

### A. Startup Anti-Flash & Offline Font Stack
- **Anti-Flash Viewport Shell**: Inline root styles lock `html, body, #root` to `height: 100%; width: 100%; margin: 0; padding: 0; overflow: hidden; background-color: #f8fafc;` so WebView2 never flashes an unstyled frame during initialization.
- **100% Offline Typography**:
  - **Display & Institutional Headers**: Bundled `@fontsource/playfair-display` with fallback to `'Playfair Display', Georgia, serif`.
  - **UI & Dense Data Tables**: `'Inter', 'Segoe UI', system-ui, sans-serif` with `tabular-nums` alignment for catalog counters, accession codes, and call numbers.
  - **RTL Urdu & Arabic Cataloging**: Bundled `@fontsource/noto-nastaliq-urdu` and `@fontsource/noto-naskh-arabic` with fallback to `'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', 'Urdu Typesetting', Tahoma, serif`.
- **Bundled Offline Spreadsheet Engine**: Local `xlsx` ES module imported at startup and bound to `window.XLSX` so 100,000-volume Excel imports, Master Workbook exports, and PC Migration backups operate with zero network dependency.

### B. Unified ULM 2017 Crest Identity (`image_0.png`)
- **Offline Data URI + Public Asset Fallback**: The official ULM 2017 crest is exported both as a self-contained Base64 PNG data URI (`ULM_CREST_URL` / `ULM_OFFICIAL_CREST_DATA_URI`) and as a static public asset (`./image_0.png`) referenced in the HTML `<link rel="icon" type="image/png" href="./image_0.png" />`.
- **Consistent Crest Placement**:
  1. **Top Windows Title Bar**: Compact ULM 2017 crest icon (`18px × 18px`) beside `ULM Library — Central Campus Workstation`.
  2. **Executive Institutional Header**: Luxury double-rimmed pedestal (`64px–80px`) flush-left alongside the university title.
  3. **Borrower & Faculty Library ID Cards**: Official ULM 2017 crest in the ID card header and subtle centered security watermark behind borrower credentials.
  4. **Workspace Watermark & Institutional Footer**: Fixed subtle background watermark (`opacity-[0.025]`) and footer seal at the bottom of `#ulm-main-scroll-view`.

---

## 4. Desktop Host Bridge & Build Pipeline Specifications

| Capability | Mechanism & Behavior |
| :--- | :--- |
| **Window Control Bridge** | Sends `{ type: 'WINDOW_CONTROL', action: 'minimize' \| 'maximize' \| 'close' }` (plus legacy string fallback) via `window.chrome?.webview?.postMessage(...)` with graceful browser no-op when testing in standard web preview. |
| **Desktop Shortcut & Context Guards** | When running inside WebView2 (`window.chrome?.webview` or `location.hostname === 'app.local'`), blocks accidental browser refresh/devtools keys (`F5`, `Ctrl+R`, `Ctrl+Shift+R`, `F12`) and suppresses the default browser right-click menu on non-input UI chrome while keeping standard cut/copy/paste inside `<input>` and `<textarea>`. |
| **Relative Production Bundle** | Vite configured with `base: './'`, `outDir: 'dist'`, `assetsDir: 'assets'`, `emptyOutDir: true`, `sourcemap: false`, and `chunkSizeWarningLimit: 2500` so all JS, CSS, and font assets resolve cleanly via `https://app.local/` or local file paths. |
| **Automated `.exe` Builder** | PowerShell build script (`build:exe`) validates dependencies, runs `npm run build`, generates multi-size `app.ico` from `image_0.png`, scaffolds/updates the C# .NET 8 WPF + WebView2 host (`SetVirtualHostNameToFolderMapping("app.local", ...)`), and publishes a standalone Windows executable. |
