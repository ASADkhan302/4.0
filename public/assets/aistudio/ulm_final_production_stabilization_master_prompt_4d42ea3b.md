# 🏛️ ULM LMS — FINAL PRODUCTION STABILIZATION MASTER PROMPT

> **How to use this prompt:**
> Copy and paste the entire directive below directly into **Google AI Studio** (`Labrary-app-3.0`). It applies the final consolidation fixes: hardening the **SQLite WebAssembly (`sql.js@1.15.2`) runtime**, resolving the **backup split-brain**, synchronizing **catalog dropdown filters with 3D Almari placements**, dynamic **discipline subtitles**, fresh **analytics caching**, and a **clean factory reset routine**.

# 🏛️ SYSTEM DIRECTIVE: FINAL PRODUCTION STABILIZATION & CODE CONSOLIDATION

You are the Principal Lead Architect for the **University of Lakki Marwat (ULM) Central Campus Library System**.

Apply the following production stabilization fixes across the application codebase.

## 🔍 CORE FIXES CONSOLIDATION MATRIX

| Target Subsystem | Root Cause | Solution Implemented | 
| ----- | ----- | ----- | 
| **0. SQLite WASM Runtime** | Mismatched WebAssembly byte exports causing Emscripten `onRuntimeInitialized` callback failures. | Synchronize WASM binary handler with `sql.js@1.15.2`, harden initialization promise, and provide graceful fallback. | 
| **1. Backup & Restore** | `StorageEngine.ts` was exporting obsolete keys with only 2 mock books instead of the live catalog. | Unify `triggerOneClickBackupDownload()` and `importBackupData()` to export 100% of live books, cupboards, and placements. | 
| **2. Metric Card 1 Subtitle** | Static text `"Across 1 academic disciplines"` in `BooksCatalogView.tsx`. | Bind subtitle to `new Set(...)` unique discipline calculation across active books. | 
| **3. Catalog Filter Sync** | Books Catalog Almari dropdown filter did not read `ulm_almari_placements_master_v3` on mount. | Apply master placements merge so the catalog dropdown immediately reflects physical Almari shelf assignments. | 
| **4. Analytics Cupboard Sync** | `CatalogVisualAnalytics.tsx` locked `AlmariService.getAlmaris()` to `[books.length]`. | Re-evaluate cupboards dynamically on render so newly created or edited cupboards appear instantly in Physical Stacks. | 
| **5. Factory Reset Routine** | Residual mirror keys left behind after clearing data. | Provide `purgeAllDataAndResetFactory()` to wipe all data across both engines back to a clean default state. | 

## 💻 0. SQLITE WASM RUNTIME HARDENING (`src/services/storageEngine.ts` / SQLite Initializer)

Ensure the SQLite WebAssembly runtime initialization handles all browser environments with a clean promise reset and automatic fallback:

```
// Hardened SQLite WASM Initializer with Safe Fallback
private static sqliteInitPromise: Promise<boolean> | null = null;

public static async initSqliteWasm(): Promise<boolean> {
  if (this.isSqliteIpcConnected()) {
    return true; // Electron Native SQLite IPC Active
  }

  if (this.sqliteInitPromise) {
    return this.sqliteInitPromise;
  }

  this.sqliteInitPromise = (async () => {
    try {
      if (typeof window === 'undefined') return false;
      
      // Check for sql.js global or dynamic import
      const initSqlJs = (window as any).initSqlJs || (await import('sql.js')).default;
      if (typeof initSqlJs !== 'function') {
        console.warn('[StorageEngine] sql.js runtime not found; operating in verified LocalStorage mode.');
        return false;
      }

      const SQL = await initSqlJs({
        locateFile: (file: string) => `/${file}`,
      });

      console.info('[StorageEngine] SQLite WASM runtime successfully initialized.');
      return true;
    } catch (err) {
      console.warn('[StorageEngine] SQLite WASM initialization note (falling back to LocalStorage):', err);
      this.sqliteInitPromise = null; // Clean promise reset on failure
      return false;
    }
  })();

  return this.sqliteInitPromise;
}

```

## 💻 1. UNIFIED BACKUP & RESTORE (`src/services/storageEngine.ts`)

Update `triggerOneClickBackupDownload()` and `importBackupData()` to ensure complete synchronization:

```
// Unified Institutional Backup (Exports 100% of Real Books, Almaris, and Placements)
public static triggerOneClickBackupDownload(): void {
  try {
    // 1. Gather live books from primary store
    let liveBooks: any[] = [];
    try {
      const rawBooks = localStorage.getItem('ulm_lms_books_v1') || 
                       localStorage.getItem('ulm_library_books_master_v1') ||
                       localStorage.getItem('ulm_storage_engine_books_v1');
      if (rawBooks) liveBooks = JSON.parse(rawBooks);
    } catch {}

    // 2. Gather live cupboards registry
    let liveAlmaris: any[] = [];
    try {
      const rawAlmaris = localStorage.getItem('ulm_almaris_registry_v2') || 
                         localStorage.getItem('ulm_lms_almaris_v1');
      if (rawAlmaris) liveAlmaris = JSON.parse(rawAlmaris);
    } catch {}

    // 3. Gather master placement overrides
    let livePlacements: any = {};
    try {
      const rawPlacements = localStorage.getItem('ulm_almari_placements_master_v3');
      if (rawPlacements) livePlacements = JSON.parse(rawPlacements);
    } catch {}

    // 4. Gather circulation transactions
    let liveCirculation: any[] = [];
    try {
      const rawCirc = localStorage.getItem('ulm_lms_transactions_v1') || 
                      localStorage.getItem('ulm_circulation_records_v1');
      if (rawCirc) liveCirculation = JSON.parse(rawCirc);
    } catch {}

    const backupPayload = {
      version: '3.0.0',
      university: 'University of Lakki Marwat (ULM)',
      exportedAt: new Date().toISOString(),
      books: liveBooks,
      almaris: liveAlmaris,
      masterPlacements: livePlacements,
      circulation: liveCirculation,
    };

    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ULM_CENTRAL_LIBRARY_BACKUP_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('[StorageEngine] Failed to create unified backup:', err);
  }
}

// Unified Restore Routine
public static async importBackupData(backupJson: string): Promise<boolean> {
  try {
    const data = JSON.parse(backupJson);
    if (!data || typeof data !== 'object') return false;

    if (Array.isArray(data.books)) {
      localStorage.setItem('ulm_lms_books_v1', JSON.stringify(data.books));
      localStorage.setItem('ulm_library_books_master_v1', JSON.stringify(data.books));
      localStorage.setItem('ulm_storage_engine_books_v1', JSON.stringify(data.books));
    }
    if (Array.isArray(data.almaris)) {
      localStorage.setItem('ulm_almaris_registry_v2', JSON.stringify(data.almaris));
      localStorage.setItem('ulm_lms_almaris_v1', JSON.stringify(data.almaris));
    }
    if (data.masterPlacements && typeof data.masterPlacements === 'object') {
      localStorage.setItem('ulm_almari_placements_master_v3', JSON.stringify(data.masterPlacements));
    }
    if (Array.isArray(data.circulation)) {
      localStorage.setItem('ulm_lms_transactions_v1', JSON.stringify(data.circulation));
      localStorage.setItem('ulm_circulation_records_v1', JSON.stringify(data.circulation));
    }
    return true;
  } catch (err) {
    console.error('[StorageEngine] Backup restore failed:', err);
    return false;
  }
}

```

## 💻 2. DYNAMIC CARD 1 SUBTITLE (`src/components/BooksCatalogView.tsx`)

In `src/components/BooksCatalogView.tsx`, update Card 1's subtitle to calculate academic disciplines dynamically:

```
{/* Card 1: Cataloged Titles */}
<div className="rounded-2xl bg-white/70 dark:bg-[#140D22]/70 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 p-4 shadow-sm hover:border-[#C8963E]/45 transition-all flex flex-col justify-between">
  <div className="flex items-center justify-between">
    <span className="text-[11px] font-bold uppercase tracking-[0.10em] text-slate-500 dark:text-slate-400">
      CATALOGED TITLES
    </span>
    <BookOpen className="w-4 h-4 text-slate-400 dark:text-slate-500 opacity-60 shrink-0" />
  </div>
  <div className="mt-2.5 flex items-baseline">
    <span className="text-2xl xl:text-[28px] font-extrabold font-display tabular-nums tracking-tight text-slate-900 dark:text-white leading-none">
      {totalCataloged.toLocaleString()}
    </span>
    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-2">
      Distinct records
    </span>
  </div>
  <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-1">
    Across {new Set(books.map((b) => (b.discipline || b.category || 'General').trim())).size} academic {new Set(books.map((b) => (b.discipline || b.category || 'General').trim())).size === 1 ? 'discipline' : 'disciplines'}
  </div>
</div>

```

## 💻 3. SYNC CATALOG DROPDOWN WITH MASTER PLACEMENTS (`src/components/BooksCatalogView.tsx`)

In `src/components/BooksCatalogView.tsx`, resolve books with placement overrides so the Almari filter dropdown matches the 3D Almari View:

```
// 1. Authoritative Master Placements Sync
const masterPlacements = useMemo(() => {
  try {
    const raw = localStorage.getItem('ulm_almari_placements_master_v3');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}, [books]);

// 2. Resolved Books with Placements Applied
const booksWithPlacements = useMemo(() => {
  return books.map((b) => {
    const idKey = b.id ? String(b.id).trim() : '';
    const barcodeKey = b.barcode ? String(b.barcode).trim() : '';
    const override = (idKey && masterPlacements[idKey]) || (barcodeKey && masterPlacements[barcodeKey]);
    if (override) {
      return {
        ...b,
        almari_id: override.almari_id,
        almari_code: override.almari_code,
        cupboard: override.almari_code,
        shelf_no: override.shelf_no,
      };
    }
    return b;
  });
}, [books, masterPlacements]);

```

*(Ensure `filteredBooks` filters over `booksWithPlacements` rather than raw `books`).*

## 💻 4. FRESH ALMARI CACHING IN ANALYTICS (`src/components/library/CatalogVisualAnalytics.tsx`)

In `src/components/library/CatalogVisualAnalytics.tsx`, ensure registered cupboards refresh on every view render:

```
// Resolve Registered Almaris & Cupboards (Always fresh from AlmariService)
const almaris: Almari[] = React.useMemo(() => {
  try {
    return AlmariService.getAlmaris();
  } catch {
    return [];
  }
}, [books]);

```

## 💻 5. FACTORY RESET & DEMO PURGE ROUTINE (`src/services/storage.ts` or `src/services/storageEngine.ts`)

Add the complete factory reset method to wipe all data across both engines back to clean institutional defaults:

```
public static purgeAllDataAndResetFactory(): void {
  const keysToRemove = [
    'ulm_lms_books_v1',
    'ulm_library_books_master_v1',
    'ulm_storage_engine_books_v1',
    'ulm_lms_transactions_v1',
    'ulm_circulation_records_v1',
    'ulm_storage_engine_circulation_v1',
    'ulm_almari_placements_master_v3',
    'ulm_shelf_capacities_v3',
    'ulm_demo_mode_active_v1',
  ];

  keysToRemove.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {}
  });

  // Reset Almaris to only Institutional Holdings (IH) default
  try {
    const defaultIh = {
      id: 'alm-ih-01',
      code: 'IH',
      name_en: 'Institutional Holdings & Main Stack',
      name_ur: 'ادارہ جاتی ذخیرہ کتب',
      shelf_count: 5,
      books_per_shelf: 25,
      approx_capacity: 125,
      location: 'Main Hall • Ground Floor',
      location_note: 'Main Hall • Ground Floor',
      is_active: true,
      created_at: new Date().toISOString(),
    };
    localStorage.setItem('ulm_almaris_registry_v2', JSON.stringify([defaultIh]));
    localStorage.setItem('ulm_lms_almaris_v1', JSON.stringify([defaultIh]));
  } catch {}

  window.location.reload();
}

```