# Implementation Plan: Manual Almari (Cupboard) Addition & Removal of Auto-Suggestions

## User Requirements & Context
1. **Clarified Feature**: Add a new manual Almari or cupboard directly from within the **Almaris and Shelves** view.
2. **Auto-Suggestion Constraint**: Remove auto-suggested Almari naming/creation behavior; only manual Almaris will exist and be configured by the librarian.
3. **Persistence & Polish**: Ensure newly created cupboards immediately reflect in the Almaris overview grid, shelf visualizations, catalog filters, book modals, and storage.

---

## Architecture & Changes

### 1. Removal of Almari Auto-Suggestions
- **File**: `src/components/modals/AddEditAlmariModal.tsx`
  - Remove the reactive auto-suggestion `useEffect` that was overriding/auto-filling the English and Urdu names whenever a subject group was selected (e.g., auto-filling `${group.name_en} Stacks`).
  - Keep Almari name fields purely manual with clear descriptive placeholders (`e.g., Computer Science Stacks`, `مثلاً شعبہ کمپیوٹر سائنس`).
  - Provide a clean, manual workflow where the librarian sets the code, name in English, Urdu name, and notes without automated overrides.

### 2. Manual Almari Addition in "Almaris & Shelves" View
- **File**: `src/components/catalog/AlmariView.tsx`
  - Enhance the "+ Add Almari" action button in the top action bar: make it prominent with high-contrast styling and clear Urdu/English captioning.
  - Add an **"Add New Almari" action card** directly at the end of the Almari overview grid so users can initiate creation either from the header toolbar or right alongside existing cupboards.
  - Ensure when a new Almari is created, the grid refreshes immediately, triggers a success toast, and can automatically open the newly created Almari in shelf-inspection mode.
  - Wire up parent callbacks (`onCatalogBooksUpdated`, `onReloadAlmaris`) so assigned books and new Almaris sync across `App.tsx` and all dropdowns without requiring a page reload.

### 3. Parent View & Props Synchronization
- **File**: `src/components/BooksCatalogView.tsx`
  - Pass `onReloadAlmaris` or proper update handler to `<AlmariView />` to ensure any new manual Almari is recognized throughout the catalog and filter bars immediately.
- **File**: `src/App.tsx`
  - Ensure any book assignment changes made during Almari creation update the top-level `books` state in `App.tsx`.

### 4. Robust Validation & Shelf Distribution in Manual Almari Modal
- **File**: `src/components/modals/AddEditAlmariModal.tsx`
  - Validate Almari code uniqueness against active cupboards (preventing accidental duplicate codes).
  - Allow intuitive shelf setup (1 to 20 shelves, default books per shelf, or manual individual shelf capacity configuration).
  - Support optional manual initial book assignment by continuous accession range (`ULM-XXXXX` to `ULM-YYYYY`) or by subject group, with instant distribution preview and zero auto-naming side effects.

---

## Verification Plan

1. **Compilation Check**:
   - Run `compile_applet` to verify TypeScript builds with zero syntax errors or missing imports.
2. **Almari Creation Flow**:
   - Open Almaris & Shelves view (`⌘A` or via sidebar).
   - Click the "+ Add Almari" button in the top header or the "Add New Cupboard" card in the grid.
   - Verify modal opens with clean manual input fields without unwanted auto-suggest naming overrides.
   - Create a new manual Almari (e.g. `A-08`, `General Reference`, `حوالہ جاتی ذخیرہ`, 5 shelves).
   - Save and verify the new Almari immediately renders in the grid with 5 shelves, correct badges, and 0 books.
3. **Manual Book Assignment**:
   - Test adding an Almari with manual range assignment to ensure books are placed and catalog state updates instantly.
4. **Edit & Delete Verification**:
   - Verify existing manual edit and delete flows continue to operate smoothly.
