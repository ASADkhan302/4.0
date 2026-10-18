import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building2, 
  Layers, 
  Check, 
  X, 
  AlertCircle, 
  ArrowRight,
  BookOpen
} from 'lucide-react';
import { Book, Almari, BookGroup, AlmariShelf } from '../../types/library';
import { AlmariService } from '../../services/almariService';

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
  const groups = AlmariService.getGroups().filter(g => g.is_active);
  const almaris = AlmariService.getAlmaris().filter(a => a.is_active);

  const [selectedGroupId, setSelectedGroupId] = useState<string>(groups[0]?.id || '');
  const [selectedAlmariId, setSelectedAlmariId] = useState<string>(initialAlmariId || almaris[0]?.id || '');
  const [shelfPlacementMode, setShelfPlacementMode] = useState<'single' | 'fill_onward' | 'keep'>('fill_onward');
  const [selectedShelfNo, setSelectedShelfNo] = useState<number>(initialShelfNo || 1);
  const [orderBy, setOrderBy] = useState<'barcode_series' | 'call_number' | 'title' | 'author'>('barcode_series');

  // Sync initial props
  useEffect(() => {
    if (initialAlmariId) setSelectedAlmariId(initialAlmariId);
    if (initialShelfNo) setSelectedShelfNo(initialShelfNo);
  }, [initialAlmariId, initialShelfNo]);

  // Capacity left computation for target Almari
  const targetAlmari = useMemo(() => almaris.find(a => a.id === selectedAlmariId), [almaris, selectedAlmariId]);
  const targetAlmariShelves = useMemo(() => {
    if (!selectedAlmariId) return [];
    return AlmariService.getShelvesForAlmari(selectedAlmariId);
  }, [selectedAlmariId]);

  const almariCapacityStats = useMemo(() => {
    if (!targetAlmari) return { totalCap: 0, currentCount: 0, capacityLeft: 0 };
    const totalCap = AlmariService.getAlmariTotalCapacity(targetAlmari);
    const currentCount = allBooks.filter(b => b.almari_id === targetAlmari.id).length;
    const capacityLeft = Math.max(0, totalCap - currentCount);
    return { totalCap, currentCount, capacityLeft };
  }, [targetAlmari, allBooks]);

  // Compute live preview of shelf distribution when placing into Almari
  const placementPlan = useMemo(() => {
    if (mode !== 'assign_almari' || !targetAlmari) return null;

    // Check books of another group
    const targetGroups = AlmariService.getGroupsForAlmari(targetAlmari.id);
    const targetGroupIds = new Set(targetGroups.map(g => g.id));
    const booksOfAnotherGroup = selectedBooks.filter(b => b.group_id && targetGroupIds.size > 0 && !targetGroupIds.has(b.group_id));

    // Sort books according to requested order
    const sorted = [...selectedBooks].sort((a, b) => {
      if (orderBy === 'barcode_series') {
        const numA = AlmariService.extractAccessionNumber(a.barcode) || 0;
        const numB = AlmariService.extractAccessionNumber(b.barcode) || 0;
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

    const shelves: AlmariShelf[] = targetAlmariShelves.length > 0
      ? targetAlmariShelves
      : Array.from({ length: Math.max(1, Math.min(50, Math.floor(targetAlmari.shelf_count || 5))) }, (_, i) => ({
          almari_id: targetAlmari.id,
          shelf_no: i + 1,
          capacity: Math.max(1, Math.min(200, Math.floor(targetAlmari.books_per_shelf || 30))),
        }));

    const updatedBooks: Book[] = [];
    const shelfBreakdown: { shelf_no: number; capacity: number; count: number; rangeStr: string }[] = [];

    if (shelfPlacementMode === 'single') {
      const shelfCap = shelves.find((s: AlmariShelf) => s.shelf_no === selectedShelfNo)?.capacity || 30;
      for (const b of sorted) {
        updatedBooks.push({
          ...b,
          almari_id: targetAlmari.id,
          shelf_no: selectedShelfNo,
        });
      }
      const range = AlmariService.computeShelfRange(sorted, shelfCap);
      shelfBreakdown.push({
        shelf_no: selectedShelfNo,
        capacity: shelfCap,
        count: sorted.length,
        rangeStr: range.rangeStr,
      });
    } else if (shelfPlacementMode === 'fill_onward') {
      const startingShelves = shelves.filter((s: AlmariShelf) => s.shelf_no >= selectedShelfNo).sort((a: AlmariShelf, b: AlmariShelf) => a.shelf_no - b.shelf_no);
      let cursor = 0;
      for (const sh of startingShelves) {
        if (cursor >= sorted.length) break;
        const cap = sh.capacity || 30;
        const slice = sorted.slice(cursor, cursor + cap);
        cursor += slice.length;
        for (const b of slice) {
          updatedBooks.push({
            ...b,
            almari_id: targetAlmari.id,
            shelf_no: sh.shelf_no,
          });
        }
        const range = AlmariService.computeShelfRange(slice, cap);
        shelfBreakdown.push({
          shelf_no: sh.shelf_no,
          capacity: cap,
          count: slice.length,
          rangeStr: range.rangeStr,
        });
      }
      // If overflow remains beyond last shelf, assign to last shelf
      if (cursor < sorted.length) {
        const lastShelf = startingShelves[startingShelves.length - 1] || shelves[shelves.length - 1];
        const overflow = sorted.slice(cursor);
        for (const b of overflow) {
          updatedBooks.push({
            ...b,
            almari_id: targetAlmari.id,
            shelf_no: lastShelf.shelf_no,
          });
        }
      }
    } else {
      // keep current shelf
      for (const b of sorted) {
        updatedBooks.push({
          ...b,
          almari_id: targetAlmari.id,
          shelf_no: b.shelf_no || 1,
        });
      }
    }

    const isOverCapacity = sorted.length > almariCapacityStats.capacityLeft;

    return {
      updatedBooks,
      shelfBreakdown,
      isOverCapacity,
      overCapacityCount: Math.max(0, sorted.length - almariCapacityStats.capacityLeft),
      booksOfAnotherGroup,
    };
  }, [mode, targetAlmari, targetAlmariShelves, selectedBooks, selectedShelfNo, shelfPlacementMode, orderBy, almariCapacityStats]);

  if (!isOpen) return null;

  // Execution handlers
  const handleApplyGroup = () => {
    if (!selectedGroupId) return;
    const grp = groups.find(g => g.id === selectedGroupId);
    const updated = selectedBooks.map(b => ({
      ...b,
      group_id: selectedGroupId,
    }));
    onComplete(updated, `Assigned ${selectedBooks.length} book(s) to group "${grp?.name_en}".`);
    onClose();
  };

  const handleApplyAlmari = () => {
    if (!selectedAlmariId || !placementPlan) return;
    const alm = almaris.find(a => a.id === selectedAlmariId);
    const batchId = `batch-bulk-${Date.now()}`;
    const nowIso = new Date().toISOString();

    for (const b of placementPlan.updatedBooks) {
      const prevBook = allBooks.find(ob => ob.id === b.id);
      const fromStr = prevBook && prevBook.almari_id
        ? `${almaris.find(a => a.id === prevBook.almari_id)?.code || prevBook.almari_id}, Shelf ${prevBook.shelf_no || 1}`
        : 'Unassigned';
      const toStr = `${alm?.code}, Shelf ${b.shelf_no || 1}`;

      AlmariService.recordMove({
        book_id: b.id,
        from: fromStr,
        to: toStr,
        reason: 'Bulk Almari assignment',
        batch_id: batchId,
      });
    }

    onComplete(
      placementPlan.updatedBooks,
      `Placed ${placementPlan.updatedBooks.length} book(s) into ${alm?.name_en} (${alm?.code}).`,
      batchId
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-[#141214] border border-[var(--border-subtle)] rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="h-[2px] w-full bg-[var(--gold)] shrink-0" />

        {/* Header */}
        <div className="px-6 py-4 bg-[#1A1A1A] border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--gold)]/15 border border-[var(--gold)]/30 flex items-center justify-center text-[var(--gold-text)]">
              {mode === 'assign_group' ? (
                <Layers className="w-5 h-5" />
              ) : (
                <Building2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">
                {mode === 'assign_group' && `Assign Group (${selectedBooks.length} selected)`}
                {mode === 'assign_almari' && `Assign to Almari (${selectedBooks.length} selected)`}
              </h3>
              <p className="text-[12px] text-[var(--text-muted)]">
                {mode === 'assign_group' && 'Choose a Book Group to apply to all selected titles.'}
                {mode === 'assign_almari' && 'Assign a cupboard (Almari) and shelf level. Barcode and call number will not change.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-white p-1 rounded hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Mode 1: Assign Group */}
          {mode === 'assign_group' && (
            <div className="space-y-4">
              <label className="block text-[12px] font-semibold text-[var(--text-body)]">
                Select Target Book Group:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {groups.map(grp => (
                  <button
                    key={grp.id}
                    type="button"
                    onClick={() => setSelectedGroupId(grp.id)}
                    className={`p-3 rounded-[10px] border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                      selectedGroupId === grp.id
                        ? 'border-[var(--gold)] bg-[var(--gold)]/15 text-white font-semibold'
                        : 'border-[var(--border-subtle)] bg-[#1A1A1A] text-[var(--text-body)] hover:border-[var(--border-field)]'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: grp.color }}
                    />
                    <div className="truncate">
                      <div className="text-[13px] truncate">{grp.name_en}</div>
                      <div className="text-[11px] text-[var(--text-muted)] font-urdu" dir="auto">{grp.name_ur}</div>
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
                  <label className="block text-[12px] font-semibold text-[var(--text-body)] mb-1">
                    Select Target Almari ({almariCapacityStats.capacityLeft} slots available):
                  </label>
                  <select
                    value={selectedAlmariId}
                    onChange={e => setSelectedAlmariId(e.target.value)}
                    className="w-full h-10 px-3 bg-[#1A1A1A] border border-[var(--border-subtle)] rounded-[8px] text-[13px] text-white focus:outline-none focus:border-[var(--gold)]"
                  >
                    {almaris.map(a => {
                      const total = AlmariService.getAlmariTotalCapacity(a);
                      const current = allBooks.filter(b => b.almari_id === a.id).length;
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
                  <label className="block text-[12px] font-semibold text-[var(--text-body)] mb-1">
                    Shelf Placement Strategy:
                  </label>
                  <select
                    value={shelfPlacementMode}
                    onChange={e => setShelfPlacementMode(e.target.value as any)}
                    className="w-full h-10 px-3 bg-[#1A1A1A] border border-[var(--border-subtle)] rounded-[8px] text-[13px] text-white focus:outline-none focus:border-[var(--gold)]"
                  >
                    <option value="fill_onward">Fill from shelf X onward by capacity</option>
                    <option value="single">Choose a specific shelf</option>
                    <option value="keep">Keep current shelf</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {shelfPlacementMode !== 'keep' && (
                  <div>
                    <label className="block text-[12px] font-semibold text-[var(--text-body)] mb-1">
                      {shelfPlacementMode === 'fill_onward' ? 'Start From Shelf:' : 'Target Shelf:'}
                    </label>
                    <select
                      value={selectedShelfNo}
                      onChange={e => setSelectedShelfNo(Number(e.target.value))}
                      className="w-full h-10 px-3 bg-[#1A1A1A] border border-[var(--border-subtle)] rounded-[8px] text-[13px] text-white focus:outline-none focus:border-[var(--gold)]"
                    >
                      {Array.from(
                        { length: targetAlmari?.shelf_count || 5 },
                        (_, i) => i + 1
                      ).map(s => (
                        <option key={s} value={s}>
                          Shelf {s}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[12px] font-semibold text-[var(--text-body)] mb-1">
                    Order Books By:
                  </label>
                  <select
                    value={orderBy}
                    onChange={e => setOrderBy(e.target.value as any)}
                    className="w-full h-10 px-3 bg-[#1A1A1A] border border-[var(--border-subtle)] rounded-[8px] text-[13px] text-white focus:outline-none focus:border-[var(--gold)]"
                  >
                    <option value="barcode_series">Barcode Series (Default)</option>
                    <option value="call_number">Call Number</option>
                    <option value="title">Title</option>
                    <option value="author">Author</option>
                  </select>
                </div>
              </div>

              {/* Warnings */}
              {placementPlan?.isOverCapacity && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>
                    Warning: Selected {selectedBooks.length} books exceed available space ({almariCapacityStats.capacityLeft} slots). Overflow books will be assigned to the final shelf.
                  </span>
                </div>
              )}

              {placementPlan && placementPlan.booksOfAnotherGroup.length > 0 && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>
                    Note: {placementPlan.booksOfAnotherGroup.length} book(s) belong to different subject disciplines than this Almari.
                  </span>
                </div>
              )}

              {/* Preview table of shelves, ranges and counts */}
              {placementPlan && placementPlan.shelfBreakdown.length > 0 && (
                <div className="space-y-2 border-t border-white/[0.08] pt-3">
                  <div className="text-xs font-semibold text-[#E0B450] flex items-center justify-between">
                    <span>Shelf Distribution Preview</span>
                    <span className="text-[#B3AABD]">{placementPlan.updatedBooks.length} books assigned</span>
                  </div>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto">
                    {placementPlan.shelfBreakdown.map((sb: { shelf_no: number; capacity: number; count: number; rangeStr: string }) => (
                      <div key={sb.shelf_no} className="flex items-center justify-between bg-[#1A1A1A] px-3 py-2 rounded text-xs border border-white/[0.04]">
                        <span className="font-semibold text-white">Shelf {sb.shelf_no}</span>
                        <span className="font-mono text-[#E0B450]">{sb.rangeStr}</span>
                        <span className="text-[#B3AABD]">{sb.count} / {sb.capacity} books</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3 bg-[#1A1A1A] border border-[var(--border-subtle)] rounded-[10px] text-[12px] text-[var(--text-muted)] flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[var(--gold)] shrink-0" />
                <span>Move runs in an atomic transaction with full Undo support. Barcodes and accession numbers are untouched.</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#1A1A1A] border-t border-[var(--border-subtle)] flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#2B2730] hover:bg-[#3F3B45] text-[var(--text-body)] text-[13px] font-medium rounded-[8px]"
          >
            Cancel
          </button>
          {mode === 'assign_group' && (
            <button
              onClick={handleApplyGroup}
              className="px-5 py-2 bg-[var(--gold)] hover:bg-[var(--gold-hover)] text-[#1A1A1A] text-[13px] font-semibold rounded-[8px] cursor-pointer shadow-sm"
            >
              Assign Group
            </button>
          )}
          {mode === 'assign_almari' && (
            <button
              onClick={handleApplyAlmari}
              className="px-5 py-2 bg-[var(--gold)] hover:bg-[var(--gold-hover)] text-[#1A1A1A] text-[13px] font-semibold rounded-[8px] cursor-pointer shadow-sm"
            >
              Assign to Almari
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
