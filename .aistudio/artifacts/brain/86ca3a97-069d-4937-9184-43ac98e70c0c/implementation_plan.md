# ULM Almari Cupboard — Forensic Audit & Dual-Key Zero-Reset Architecture Plan

This plan details the definitive forensic repair of the **Physical Almari Cupboard & Bookshelf Registry** for the **University of Lakki Marwat (ULM) Central Campus Library System**, resolving the `b.id` vs `b.barcode` key-mismatch overwrite bug, adding the live Database Sync HUD indicator, and delivering the complete forensic audit report and full unabridged source code in the response.

## User Review & Critical Decisions

> [!IMPORTANT]
> Both preferences confirmed during Phase 1 are incorporated into this plan:

- **Confirmed Decision 1 (Dual-Key Master Registry + Live DB Sync HUD)**: `AlmariView` will index manual shelf placements under **both** `book.id` and `book.barcode` in `ulm_almari_placements_master_v3` and display the live **`DB SYNCED • X VOLS LOCKED IN [ALMARI]`** indicator in the top toolbar.
- **Confirmed Decision 2 (Live App Repair + Full Forensic Report & Source Code in Chat)**: Upon approval, we will apply the dual-key repair to the live application, verify compilation and linting, and output the complete **Forensic Audit Report**, **Health Scorecard**, and **100% Unabridged Source Code** directly in the response description.

---

## 1. Overview & Core Concept

- **What It Does**: Eliminates the subtle `b.id` vs `b.barcode` key mismatch where dragging a book saved its placement under one identifier while re-render lookups checked the other, causing books to appear unassigned after re-renders.
- **Target Audience / Persona**: University librarians and catalog administrators at ULM organizing physical cupboards (`IH` and custom departmental cupboards).
- **Key Value**: 100% deterministic drag-and-drop shelf persistence across re-renders, tab switches, and hard browser refreshes, backed by live visual confirmation of locked volume counts.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Live DB Sync HUD**: The top header bar displays a real-time badge (`DB SYNCED • {activeAlmariBooksCount} VOLS LOCKED IN {selectedAlmari.code}`) that immediately increments or decrements when volumes are moved onto or off a shelf.
  2. **Dual-Key Drag & Drop Reassignment**: Dragging a standing 3D spine or an unassigned queue item onto any physical shelf writes the placement under both `targetBook.id` and `targetBook.barcode` in `ulm_almari_placements_master_v3`, syncs with `StorageEngine.upsertBook`, and updates parent catalog state.
  3. **Custom Cupboard Persistence**: Creating a cupboard via **+ Add Almari** saves to `ulm_almaris_registry_v2`, initializes per-shelf capacities (`1–50`), and locks `ulm_active_almari_id_v3` to the newly created cupboard.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: ULM Royal Institutional Glassmorphism (`#541A72` royal purple, `#140D22` obsidian glass, and `#FFD147` / `#C8963E` gold accents).
  - *Typography & Hierarchy*: Tabular monospace (`font-mono`) for shelf capacities, barcode tags, and live database sync counters; bold display headers for cupboard plaques.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Dual-Key Indexing (`b.id` AND `b.barcode`) in `ulm_almari_placements_master_v3`**
  - *Chosen Approach*: When a book is placed on a shelf, record the placement entry under both `targetBook.id` and `targetBook.barcode` in `ulm_almari_placements_master_v3`, and resolve via `(b.id && masterPlacements[b.id]) || (b.barcode && masterPlacements[b.barcode])`.
  - *Why*: Guarantees zero key-mismatch misses regardless of whether a book was imported with a generated UUID, an accession number, or a barcode string.
- **Decision 2: Full Compatibility in `AlmariService` & `BooksCatalogView`**
  - *Chosen Approach*: Ensure `AlmariService` persists to `ulm_almaris_registry_v2` with the default `IH` cupboard while preserving all helper methods required by catalog modals and settings tabs, and keep `onUpdateBooks` wired in both `BooksCatalogView` and `App`.
  - *Why*: Prevents any regression across other views while guaranteeing full persistence in `AlmariView`.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        AppState (books, setBooks)                        │
│              onUpdateBooks={(updated) => setBooks(updated)}              │
└───────────────────┬──────────────────────────────────┬───────────────────┘
                    │                                  │
                    ▼                                  ▼
┌───────────────────────────────────────┐  ┌───────────────────────────────┐
│           BooksCatalogView            │  │          AlmariView           │
│  Passes onUpdateBooks to AlmariView   │  │ • Dual-Key Master Registry    │
│  Resolves shelf badges via v3 master  │  │   (b.id + b.barcode)          │
└───────────────────────────────────────┘  │ • Live DB Sync HUD Counter    │
                                           │ • useRef Drag & Drop Engine   │
                                           └───────────────┬───────────────┘
                                                           │
                         ┌─────────────────────────────────┼─────────────────────────────────┐
                         ▼                                 ▼                                 ▼
        ┌────────────────────────────────┐ ┌───────────────────────────────┐ ┌───────────────────────────────┐
        │ localStorage Master Registry   │ │   StorageEngine.upsertBook    │ │   LibraryStorage & IndexedDB  │
        │ ulm_almari_placements_master_v3│ │ (SQLite IPC + LocalStorage)   │ │      Catalog Persistence      │
        └────────────────────────────────┘ └───────────────────────────────┘ └───────────────────────────────┘
```

- **Interactive Component & State Mapping**:
  - `executeReassignBook(bookId, targetAlmari, targetShelf)`: Writes both `targetBook.id` and `targetBook.barcode` keys into `masterPlacements` (`ulm_almari_placements_master_v3`), updates `StorageEngine.upsertBook` and `LibraryStorage.updateBook`, updates `activeAlmariBooksCount` in the Live DB Sync HUD, and invokes `onUpdateBooks(updatedList)`.
  - `handleUnassignBook(book)`: Deletes both `book.id` and `book.barcode` keys from `masterPlacements`, resets shelf fields in `StorageEngine` and `LibraryStorage`, and updates parent state.
