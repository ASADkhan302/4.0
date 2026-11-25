import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2,
  Layers,
  CheckCircle2,
  X,
  AlertCircle,
} from 'lucide-react';
import { Book, Almari } from '../../types/library';
import { AlmariService } from '../../services/almariService';
import { LibraryStorage } from '../../services/storage';
import { persistManualBookShelfAssignments } from '../../services/libraryStorageAndMigration';
import { notifyGlassToast } from '../ui/LiquidGlassToast';

interface BulkAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBooks: Book[];
  allBooks: Book[];
  mode: 'assign_group' | 'assign_almari';
  onComplete: (updatedBooks: Book[], message: string, batchId?: string) => void;
  initialAlmariId?: string;
  initialShelfNo?: number;
}

interface ShelfPreviewRow {
  shelf_no: number;
  capacity: number;
  existingCount: number;
  addedCount: number;
  finalCount: number;
  rangeStr: string;
}

export const BulkAssignModal: React.FC<BulkAssignModalProps> = ({
  isOpen,
  onClose,
  selectedBooks,
  allBooks,
  mode,
  onComplete,
  initialAlmariId,
  initialShelfNo,
}) => {
  const [syncVersion, setSyncVersion] = useState(0);

  // Stay 100% live-synced whenever shelf capacities or cupboard definitions change
  useEffect(() => {
    if (!isOpen) return;
    setSyncVersion((v) => v + 1);
    const handleSync = () => setSyncVersion((v) => v + 1);
    window.addEventListener('ulm-almari-capacity-sync', handleSync);
    window.addEventListener('ulm-library-sync', handleSync);
    window.addEventListener('ulm-library-data-changed', handleSync);
    return () => {
      window.removeEventListener('ulm-almari-capacity-sync', handleSync);
      window.removeEventListener('ulm-library-sync', handleSync);
      window.removeEventListener('ulm-library-data-changed', handleSync);
    };
  }, [isOpen]);

  const groups = useMemo(() => {
    void syncVersion;
    return AlmariService.getGroups().filter((g) => g.is_active);
  }, [syncVersion]);

  const almaris = useMemo(() => {
    void syncVersion;
    return AlmariService.getAlmaris().filter((a) => a.is_active !== false);
  }, [syncVersion]);

  const shelfCapacities = useMemo(() => {
    void syncVersion;
    return AlmariService.getShelfCapacities();
  }, [syncVersion]);

  const [selectedGroupId, setSelectedGroupId] = useState<string>(groups[0]?.id || '');
  const [selectedAlmariId, setSelectedAlmariId] = useState<string>(initialAlmariId || almaris[0]?.id || '');
  const [shelfPlacementMode, setShelfPlacementMode] = useState<'single' | 'fill_onward' | 'keep'>('fill_onward');
  const [selectedShelfNo, setSelectedShelfNo] = useState<number>(initialShelfNo || 1);
  const [orderBy, setOrderBy] = useState<'barcode_series' | 'call_number' | 'title' | 'author'>('barcode_series');

  // Sync initial props & recover gracefully if active almari list updates
  useEffect(() => {
    if (initialAlmariId) setSelectedAlmariId(initialAlmariId);
    else if (almaris.length > 0 && !almaris.some((a) => a.id === selectedAlmariId)) {
      setSelectedAlmariId(almaris[0].id);
    }
    if (initialShelfNo) setSelectedShelfNo(initialShelfNo);
  }, [initialAlmariId, initialShelfNo, almaris, selectedAlmariId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const targetAlmari = useMemo<Almari | undefined>(
    () => almaris.find((a) => a.id === selectedAlmariId) || almaris[0],
    [almaris, selectedAlmariId]
  );

  // Clamp selectedShelfNo if switching to a cupboard with fewer shelves
  useEffect(() => {
    if (!targetAlmari) return;
    const maxShelves = Math.max(1, Number(targetAlmari.shelf_count) || 5);
    if (selectedShelfNo > maxShelves) {
      setSelectedShelfNo(1);
    }
  }, [targetAlmari, selectedShelfNo]);

  // IDs/barcodes of currently selected books so moving books already in targetAlmari isn't double-counted
  const selectedIdSet = useMemo(() => {
    const set = new Set<string>();
    for (const b of selectedBooks) {
      if (b.id) set.add(String(b.id).trim());
      if (b.barcode) set.add(String(b.barcode).trim());
    }
    return set;
  }, [selectedBooks]);

  // Live physical occupancy across ALL cupboards & shelves (merging ulm_almari_placements_master_v3)
  const liveOccupancy = useMemo(() => {
    void syncVersion;
    return AlmariService.getLiveShelfOccupancyMap(allBooks, almaris, selectedIdSet);
  }, [allBooks, almaris, selectedIdSet, syncVersion]);

  // Per-shelf live capacity & open slots for the selected target Almari
  const targetShelfSlots = useMemo(() => {
    if (!targetAlmari) return [];
    const shelfCount = Math.max(1, Number(targetAlmari.shelf_count) || 5);
    return Array.from({ length: shelfCount }, (_, idx) => {
      const shelfNo = idx + 1;
      const shelfMax = AlmariService.getShelfCapacity(targetAlmari, shelfNo, shelfCapacities);
      const existingOnShelf = liveOccupancy.byAlmariShelf.get(`${targetAlmari.id}::${shelfNo}`) || 0;
      const freeSlots = Math.max(0, shelfMax - existingOnShelf);
      return {
        shelf_no: shelfNo,
        capacity: shelfMax,
        existingOnShelf,
        freeSlots,
      };
    });
  }, [targetAlmari, shelfCapacities, liveOccupancy]);

  const almariCapacityStats = useMemo(() => {
    if (!targetAlmari) {
      return {
        totalCap: 0,
        currentCount: 0,
        capacityLeft: 0,
        availableFromStartShelf: 0,
      };
    }
    const totalCap = AlmariService.getAlmariTotalCapacity(targetAlmari, shelfCapacities);
    const currentCount = liveOccupancy.byAlmari.get(targetAlmari.id) || 0;
    const capacityLeft = Math.max(0, totalCap - currentCount);

    let availableFromStartShelf = capacityLeft;
    if (shelfPlacementMode === 'fill_onward') {
      availableFromStartShelf = targetShelfSlots
        .filter((s) => s.shelf_no >= selectedShelfNo)
        .reduce((sum, s) => sum + s.freeSlots, 0);
    } else if (shelfPlacementMode === 'single') {
      const targetSlot = targetShelfSlots.find((s) => s.shelf_no === selectedShelfNo);
      availableFromStartShelf = targetSlot ? targetSlot.freeSlots : 0;
    }

    return { totalCap, currentCount, capacityLeft, availableFromStartShelf };
  }, [targetAlmari, shelfCapacities, liveOccupancy, shelfPlacementMode, targetShelfSlots, selectedShelfNo]);

  // Compute live preview of shelf distribution using LIVE per-shelf capacities & existing occupancy
  const placementPlan = useMemo(() => {
    if (mode !== 'assign_almari' || !targetAlmari) return null;

    const targetGroups = AlmariService.getGroupsForAlmari(targetAlmari.id);
    const targetGroupIds = new Set(targetGroups.map((g) => g.id));
    const booksOfAnotherGroup = selectedBooks.filter(
      (b) => b.group_id && targetGroupIds.size > 0 && !targetGroupIds.has(b.group_id)
    );

    const sorted = [...selectedBooks].sort((a, b) => {
      if (orderBy === 'barcode_series') {
        const numA = AlmariService.extractAccessionNumber(a.barcode || a.accession_no) || 0;
        const numB = AlmariService.extractAccessionNumber(b.barcode || b.accession_no) || 0;
        return numA - numB;
      }
      if (orderBy === 'call_number') {
        return (a.dewey_call_number || '').localeCompare(b.dewey_call_number || '');
      }
      if (orderBy === 'author') {
        return (a.author || '').localeCompare(b.author || '');
      }
      return (a.book_name || '').localeCompare(b.book_name || '');
    });

    const nowIso = new Date().toISOString();
    const buildAssignedBook = (book: Book, shelfNo: number): Book => ({
      ...book,
      almari_id: targetAlmari.id,
      almari_code: targetAlmari.code,
      almari_name: targetAlmari.name_en,
      cupboard: targetAlmari.code,
      shelf_no: shelfNo,
      shelf: `${targetAlmari.code} · Shelf ${shelfNo}`,
      row: `Shelf ${shelfNo}`,
      section: targetAlmari.name_en,
      placement_locked: true,
      location_source: 'manual',
      updated_at: nowIso,
    });

    const updatedBooks: Book[] = [];
    const shelfBreakdown: ShelfPreviewRow[] = [];

    if (shelfPlacementMode === 'single') {
      const slot = targetShelfSlots.find((s) => s.shelf_no === selectedShelfNo) || {
        shelf_no: selectedShelfNo,
        capacity: AlmariService.getShelfCapacity(targetAlmari, selectedShelfNo, shelfCapacities),
        existingOnShelf: 0,
        freeSlots: AlmariService.getShelfCapacity(targetAlmari, selectedShelfNo, shelfCapacities),
      };
      for (const b of sorted) {
        updatedBooks.push(buildAssignedBook(b, selectedShelfNo));
      }
      const range = AlmariService.computeShelfRange(sorted, slot.capacity);
      shelfBreakdown.push({
        shelf_no: selectedShelfNo,
        capacity: slot.capacity,
        existingCount: slot.existingOnShelf,
        addedCount: sorted.length,
        finalCount: slot.existingOnShelf + sorted.length,
        rangeStr: range.rangeStr,
      });
    } else if (shelfPlacementMode === 'fill_onward') {
      const startingSlots = targetShelfSlots
        .filter((s) => s.shelf_no >= selectedShelfNo)
        .sort((a, b) => a.shelf_no - b.shelf_no);

      let cursor = 0;
      for (const slot of startingSlots) {
        if (cursor >= sorted.length) break;
        const takeCount = Math.min(slot.freeSlots, sorted.length - cursor);
        if (takeCount <= 0) continue;

        const slice = sorted.slice(cursor, cursor + takeCount);
        cursor += slice.length;
        for (const b of slice) {
          updatedBooks.push(buildAssignedBook(b, slot.shelf_no));
        }
        const range = AlmariService.computeShelfRange(slice, slot.capacity);
        shelfBreakdown.push({
          shelf_no: slot.shelf_no,
          capacity: slot.capacity,
          existingCount: slot.existingOnShelf,
          addedCount: slice.length,
          finalCount: slot.existingOnShelf + slice.length,
          rangeStr: range.rangeStr,
        });
      }

      // If genuine overflow remains beyond the last shelf, append to final shelf
      if (cursor < sorted.length) {
        const lastSlot =
          startingSlots[startingSlots.length - 1] ||
          targetShelfSlots[targetShelfSlots.length - 1];
        if (lastSlot) {
          const overflow = sorted.slice(cursor);
          for (const b of overflow) {
            updatedBooks.push(buildAssignedBook(b, lastSlot.shelf_no));
          }
          const existingRow = shelfBreakdown.find((r) => r.shelf_no === lastSlot.shelf_no);
          if (existingRow) {
            const combined = updatedBooks.filter((b) => b.shelf_no === lastSlot.shelf_no);
            const range = AlmariService.computeShelfRange(combined, lastSlot.capacity);
            existingRow.addedCount += overflow.length;
            existingRow.finalCount = existingRow.existingCount + existingRow.addedCount;
            existingRow.rangeStr = range.rangeStr;
          } else {
            const range = AlmariService.computeShelfRange(overflow, lastSlot.capacity);
            shelfBreakdown.push({
              shelf_no: lastSlot.shelf_no,
              capacity: lastSlot.capacity,
              existingCount: lastSlot.existingOnShelf,
              addedCount: overflow.length,
              finalCount: lastSlot.existingOnShelf + overflow.length,
              rangeStr: range.rangeStr,
            });
          }
        }
      }
    } else {
      // Keep current shelf number (clamped to target almari shelf count)
      const maxShelves = Math.max(1, Number(targetAlmari.shelf_count) || 5);
      const groupedByShelf = new Map<number, Book[]>();
      for (const b of sorted) {
        const clampedShelf = Math.max(1, Math.min(maxShelves, Number(b.shelf_no) || 1));
        updatedBooks.push(buildAssignedBook(b, clampedShelf));
        const arr = groupedByShelf.get(clampedShelf) || [];
        arr.push(b);
        groupedByShelf.set(clampedShelf, arr);
      }
      Array.from(groupedByShelf.entries())
        .sort((a, b) => a[0] - b[0])
        .forEach(([sNo, list]) => {
          const slot = targetShelfSlots.find((s) => s.shelf_no === sNo);
          const cap = slot?.capacity || AlmariService.getShelfCapacity(targetAlmari, sNo, shelfCapacities);
          const existing = slot?.existingOnShelf || 0;
          const range = AlmariService.computeShelfRange(list, cap);
          shelfBreakdown.push({
            shelf_no: sNo,
            capacity: cap,
            existingCount: existing,
            addedCount: list.length,
            finalCount: existing + list.length,
            rangeStr: range.rangeStr,
          });
        });
    }

    const isOverCapacity = sorted.length > almariCapacityStats.availableFromStartShelf;
    const remainingOpenSlots = Math.max(0, almariCapacityStats.availableFromStartShelf - sorted.length);
    const firstUsedShelf = shelfBreakdown.length > 0 ? shelfBreakdown[0].shelf_no : selectedShelfNo;
    const lastUsedShelf =
      shelfBreakdown.length > 0 ? shelfBreakdown[shelfBreakdown.length - 1].shelf_no : selectedShelfNo;

    return {
      updatedBooks,
      shelfBreakdown,
      isOverCapacity,
      overCapacityCount: Math.max(0, sorted.length - almariCapacityStats.availableFromStartShelf),
      remainingOpenSlots,
      firstUsedShelf,
      lastUsedShelf,
      booksOfAnotherGroup,
    };
  }, [
    mode,
    targetAlmari,
    targetShelfSlots,
    shelfCapacities,
    selectedBooks,
    selectedShelfNo,
    shelfPlacementMode,
    orderBy,
    almariCapacityStats,
  ]);

  if (!isOpen) return null;

  // Execution handlers
  const handleApplyGroup = () => {
    if (!selectedGroupId) return;
    const grp = groups.find((g) => g.id === selectedGroupId);
    const updated = selectedBooks.map((b) => ({
      ...b,
      group_id: selectedGroupId,
    }));
    const updatedMap = new Map(updated.map((b) => [b.id, b]));
    const mergedAll = allBooks.map((b) => updatedMap.get(b.id) || b);
    LibraryStorage.saveBooks(mergedAll);

    onComplete(updated, `Assigned ${selectedBooks.length} book(s) to group "${grp?.name_en}".`);
    notifyGlassToast({
      type: 'success',
      title: 'Bulk Assignment Complete',
      message: `Assigned ${selectedBooks.length} book(s) to group "${grp?.name_en || selectedGroupId}".`,
    });
    onClose();
  };

  const handleApplyAlmari = () => {
    if (!targetAlmari || !placementPlan) return;
    const batchId = `batch-bulk-${Date.now()}`;
    const nowIso = new Date().toISOString();

    // 1. Write every assigned book into ulm_almari_placements_master_v3 (Single Source of Truth)
    const nextPlacements = { ...AlmariService.getMasterPlacements() };
    const updatedById = new Map<string, Book>();

    for (const b of placementPlan.updatedBooks) {
      const shelfNo = Number(b.shelf_no) || 1;
      const entry = {
        almari_id: targetAlmari.id,
        almari_code: targetAlmari.code,
        almari_name: targetAlmari.name_en,
        shelf_no: shelfNo,
        placement_locked: true,
        updated_at: nowIso,
      };
      const idKey = b.id ? String(b.id).trim() : '';
      const bcKey = b.barcode ? String(b.barcode).trim() : '';
      if (idKey) {
        nextPlacements[idKey] = entry;
        updatedById.set(idKey, b);
      }
      if (bcKey) {
        nextPlacements[bcKey] = entry;
      }

      const prevBook = allBooks.find((ob) => ob.id === b.id);
      const fromStr =
        prevBook && prevBook.almari_id
          ? `${almaris.find((a) => a.id === prevBook.almari_id)?.code || prevBook.almari_id}, Shelf ${prevBook.shelf_no || 1}`
          : 'Unassigned';
      const toStr = `${targetAlmari.code}, Shelf ${shelfNo}`;

      AlmariService.recordMove({
        book_id: b.id,
        from: fromStr,
        to: toStr,
        reason: 'Bulk Almari assignment',
        batch_id: batchId,
      });
    }

    AlmariService.saveMasterPlacements(nextPlacements);

    // 2. Persist full catalog to IndexedDB + Master Storage Engine & broadcast 'ulm-library-sync'
    const mergedAllBooks = allBooks.map((b) => updatedById.get(String(b.id || '').trim()) || b);
    LibraryStorage.saveBooks(mergedAllBooks);
    try {
      persistManualBookShelfAssignments(placementPlan.updatedBooks);
    } catch {}

    const shelfSpan =
      placementPlan.firstUsedShelf === placementPlan.lastUsedShelf
        ? `Shelf ${placementPlan.firstUsedShelf}`
        : `Shelves ${placementPlan.firstUsedShelf}–${placementPlan.lastUsedShelf}`;

    onComplete(
      placementPlan.updatedBooks,
      `Assigned ${placementPlan.updatedBooks.length} book(s) to Almari ${targetAlmari.code} (${targetAlmari.name_en}) · ${shelfSpan}.`,
      batchId
    );
    notifyGlassToast({
      type: 'success',
      title: 'Assigned to Almari',
      message: `Assigned ${placementPlan.updatedBooks.length} book(s) to Almari ${targetAlmari.code} (${targetAlmari.name_en}).`,
      meta: `${targetAlmari.code} · ${shelfSpan}`,
    });
    onClose();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="ulm-modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/60 backdrop-blur-[10px] backdrop-saturate-150"
      onClick={onClose}
    >
      <div
        className="ulm-modal-dialog ulm-preserve-glass w-full max-w-3xl rounded-[24px] bg-gradient-to-br from-white/92 via-white/84 to-white/76 dark:from-[#1A102E]/94 dark:via-[#140C24]/92 dark:to-[#0F081C]/90 backdrop-blur-2xl backdrop-saturate-[180%] border border-white/85 dark:border-[#C8963E]/45 shadow-[inset_1px_1px_2px_rgba(255,255,255,0.85),0_24px_64px_rgba(15,23,42,0.28)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.18),0_24px_70px_rgba(0,0,0,0.65)] overflow-hidden flex flex-col max-h-[86vh] text-slate-900 dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-[2px] w-full bg-gradient-to-r from-[#541A72] via-[#C8963E] to-[#FFD147] shrink-0" />

        {/* Header */}
        <div className="px-6 py-4 bg-white/50 dark:bg-white/[0.03] border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-[#C8963E]/40 flex items-center justify-center text-[#8A4B00] dark:text-[#FFD147]">
              {mode === 'assign_group' ? (
                <Layers className="w-5 h-5" />
              ) : (
                <Building2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                {mode === 'assign_group' && `Assign Group (${selectedBooks.length} selected)`}
                {mode === 'assign_almari' && `Assign to Almari (${selectedBooks.length} selected)`}
              </h3>
              <p className="text-[12px] text-slate-600 dark:text-[#B3AABD]">
                {mode === 'assign_group' && 'Choose a Book Group to apply to all selected titles.'}
                {mode === 'assign_almari' && 'Assign a cupboard (Almari) and shelf level. Barcode and call number will not change.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-900 dark:text-[#B3AABD] dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-200/70 dark:hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Mode 1: Assign Group */}
          {mode === 'assign_group' && (
            <div className="space-y-4">
              <label className="block text-[12px] font-extrabold text-slate-800 dark:text-white">
                Select Target Book Group:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {groups.map((grp) => (
                  <button
                    key={grp.id}
                    type="button"
                    onClick={() => setSelectedGroupId(grp.id)}
                    className={`p-3 rounded-[12px] border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                      selectedGroupId === grp.id
                        ? 'border-[#C8963E] bg-amber-500/15 text-slate-900 dark:text-white font-bold shadow-xs'
                        : 'border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-white/[0.04] text-slate-700 dark:text-[#B3AABD] hover:border-[#C8963E]'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: grp.color }}
                    />
                    <div className="truncate">
                      <div className="text-[13px] truncate">{grp.name_en}</div>
                      <div className="text-[11px] text-slate-500 dark:text-[#B3AABD] font-urdu" dir="auto">
                        {grp.name_ur}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mode 2: Assign Almari */}
          {mode === 'assign_almari' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-bold text-slate-800 dark:text-white mb-1">
                    Select Target Almari ({almariCapacityStats.capacityLeft} slots available):
                  </label>
                  <select
                    value={targetAlmari?.id || ''}
                    onChange={(e) => setSelectedAlmariId(e.target.value)}
                    className="w-full h-10 px-3 bg-white/85 dark:bg-[#1B132B] border border-slate-300/90 dark:border-white/15 rounded-[10px] text-[13px] font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#C8963E]"
                  >
                    {almaris.map((a) => {
                      const total = AlmariService.getAlmariTotalCapacity(a, shelfCapacities);
                      const current = liveOccupancy.byAlmari.get(a.id) || 0;
                      const left = Math.max(0, total - current);
                      return (
                        <option key={a.id} value={a.id}>
                          {a.code} - {a.name_en} ({left} / {total} available)
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-slate-800 dark:text-white mb-1">
                    Shelf Placement Strategy:
                  </label>
                  <select
                    value={shelfPlacementMode}
                    onChange={(e) => setShelfPlacementMode(e.target.value as 'single' | 'fill_onward' | 'keep')}
                    className="w-full h-10 px-3 bg-white/85 dark:bg-[#1B132B] border border-slate-300/90 dark:border-white/15 rounded-[10px] text-[13px] font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#C8963E]"
                  >
                    <option value="fill_onward">Fill onward by shelf capacity</option>
                    <option value="single">Place all on selected shelf</option>
                    <option value="keep">Keep current shelf number</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {shelfPlacementMode !== 'keep' && (
                  <div>
                    <label className="block text-[12px] font-bold text-slate-800 dark:text-white mb-1">
                      {shelfPlacementMode === 'fill_onward' ? 'Start From Shelf:' : 'Target Shelf:'}
                    </label>
                    <select
                      value={selectedShelfNo}
                      onChange={(e) => setSelectedShelfNo(Number(e.target.value))}
                      className="w-full h-10 px-3 bg-white/85 dark:bg-[#1B132B] border border-slate-300/90 dark:border-white/15 rounded-[10px] text-[13px] font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#C8963E]"
                    >
                      {targetShelfSlots.map((slot) => (
                        <option key={slot.shelf_no} value={slot.shelf_no}>
                          Shelf {slot.shelf_no} ({slot.freeSlots} / {slot.capacity} free)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[12px] font-bold text-slate-800 dark:text-white mb-1">
                    Order Books By:
                  </label>
                  <select
                    value={orderBy}
                    onChange={(e) => setOrderBy(e.target.value as 'barcode_series' | 'call_number' | 'title' | 'author')}
                    className="w-full h-10 px-3 bg-white/85 dark:bg-[#1B132B] border border-slate-300/90 dark:border-white/15 rounded-[10px] text-[13px] font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#C8963E]"
                  >
                    <option value="barcode_series">Barcode Series (Default)</option>
                    <option value="call_number">Call Number</option>
                    <option value="title">Title</option>
                    <option value="author">Author</option>
                  </select>
                </div>
              </div>

              {/* Live Fit Status Banner (Only red warning on genuine overflow; emerald confirmation when it fits!) */}
              {placementPlan && placementPlan.isOverCapacity ? (
                <div className="p-3 bg-rose-500/12 border border-rose-500/35 rounded-xl text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>
                    Warning: Selected {selectedBooks.length} books exceed available space (
                    {almariCapacityStats.availableFromStartShelf} open slots from Shelf {selectedShelfNo} onward).{' '}
                    {placementPlan.overCapacityCount} overflow book(s) will be assigned to the final shelf.
                  </span>
                </div>
              ) : (
                placementPlan &&
                selectedBooks.length > 0 && (
                  <div className="p-3 bg-emerald-500/12 border border-emerald-500/35 rounded-xl text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2.5 font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      Fits cleanly across{' '}
                      {placementPlan.firstUsedShelf === placementPlan.lastUsedShelf
                        ? `Shelf ${placementPlan.firstUsedShelf}`
                        : `Shelves ${placementPlan.firstUsedShelf}–${placementPlan.lastUsedShelf}`}{' '}
                      ({placementPlan.remainingOpenSlots} open slot
                      {placementPlan.remainingOpenSlots === 1 ? '' : 's'} remaining).
                    </span>
                  </div>
                )
              )}

              {/* Preview table of shelves, ranges and live occupancy counts */}
              {placementPlan && placementPlan.shelfBreakdown.length > 0 && (
                <div className="space-y-2 border-t border-slate-200/80 dark:border-white/[0.08] pt-3">
                  <div className="text-xs font-extrabold text-[#8A4B00] dark:text-[#E0B450] flex items-center justify-between">
                    <span>Shelf Distribution Preview</span>
                    <span className="text-slate-600 dark:text-[#B3AABD] font-mono">
                      {placementPlan.updatedBooks.length} books assigned
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {placementPlan.shelfBreakdown.map((sb) => (
                      <div
                        key={sb.shelf_no}
                        className="flex items-center justify-between gap-2 bg-white/70 dark:bg-white/[0.04] px-3 py-2 rounded-lg text-xs border border-slate-200/80 dark:border-white/[0.08]"
                      >
                        <span className="font-bold text-slate-900 dark:text-white shrink-0">
                          Shelf {sb.shelf_no}
                        </span>
                        <span className="font-mono font-bold text-[#8A4B00] dark:text-[#E0B450] truncate">
                          {sb.rangeStr}
                        </span>
                        <div className="flex items-center gap-2 shrink-0 font-mono">
                          {sb.existingCount > 0 && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              ({sb.existingCount} existing + {sb.addedCount} new)
                            </span>
                          )}
                          <span
                            className={`font-bold ${
                              sb.finalCount > sb.capacity
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            {sb.finalCount} / {sb.capacity} books
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3 bg-white/60 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10 rounded-xl text-[12px] text-slate-600 dark:text-[#B3AABD] flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#B4690E] dark:text-[#FFD147] shrink-0" />
                <span>
                  Move runs in an atomic transaction with full Undo support. Barcodes and accession numbers are untouched.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white/50 dark:bg-white/[0.03] border-t border-slate-200/80 dark:border-white/10 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200/80 hover:bg-slate-300/80 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white text-[13px] font-bold rounded-xl cursor-pointer transition-colors"
          >
            Cancel
          </button>
          {mode === 'assign_group' && (
            <button
              type="button"
              onClick={handleApplyGroup}
              className="px-5 py-2 bg-gradient-to-r from-[#8E4F0B] via-[#B4690E] to-[#CE851D] !text-white text-[13px] font-extrabold rounded-xl cursor-pointer shadow-sm hover:brightness-110 transition-all"
            >
              Assign Group
            </button>
          )}
          {mode === 'assign_almari' && (
            <button
              type="button"
              onClick={handleApplyAlmari}
              className="px-5 py-2 bg-gradient-to-r from-[#8E4F0B] via-[#B4690E] to-[#CE851D] !text-white text-[13px] font-extrabold rounded-xl cursor-pointer shadow-sm hover:brightness-110 transition-all"
            >
              Assign to Almari
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
