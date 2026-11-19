import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  Building2, 
  Plus, 
  Edit3, 
  Trash2, 
  Save, 
  X, 
  Check, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  Sparkles,
  Info,
  Lock,
  Unlock,
  RotateCcw
} from 'lucide-react';
import { Almari, BookGroup, Book, AlmariPlanEntry } from '../../types/library';
import { AlmariService } from '../../services/almariService';
import { LibraryStorage } from '../../services/storage';
import { DeleteAlmariModal } from '../modals/DeleteAlmariModal';

interface AlmarisSettingsTabProps {
  onAlmarisChanged?: () => void;
}

export const AlmarisSettingsTab: React.FC<AlmarisSettingsTabProps> = ({ onAlmarisChanged }) => {
  const [almaris, setAlmaris] = useState<Almari[]>(() => AlmariService.getAlmaris());
  const [groups, setGroups] = useState<BookGroup[]>(() => AlmariService.getGroups());
  const [almariPlan, setAlmariPlan] = useState<AlmariPlanEntry[]>(() => AlmariService.getAlmariPlan());
  const [editingAlmariId, setEditingAlmariId] = useState<string | null>(null);

  // Edit fields
  const [editCode, setEditCode] = useState('');
  const [editNameEn, setEditNameEn] = useState('');
  const [editNameUr, setEditNameUr] = useState('');
  const [editShelves, setEditShelves] = useState(5);
  const [editBooksPerShelf, setEditBooksPerShelf] = useState(30);
  const [editNotes, setEditNotes] = useState('');
  const [editNameLocked, setEditNameLocked] = useState(false);
  const [editGroupIds, setEditGroupIds] = useState<string[]>([]);

  // Add modal state
  const [isAdding, setIsAdding] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newNameEn, setNewNameEn] = useState('');
  const [newNameUr, setNewNameUr] = useState('');
  const [newShelves, setNewShelves] = useState(5);
  const [newBooksPerShelf, setNewBooksPerShelf] = useState(30);
  const [newNotes, setNewNotes] = useState('');
  const [newGroupIds, setNewGroupIds] = useState<string[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Warning checks: groups with no almari or split groups
  const almariGroups = AlmariService.getAlmariGroups();
  const allBooks = LibraryStorage.getBooks().filter(b => b.is_active);

  // 1. Group with no almari
  const assignedGroupIds = new Set(almariGroups.map(ag => ag.group_id));
  const groupsWithNoAlmari = groups.filter(g => g.is_active && !assignedGroupIds.has(g.id));

  // 2. Capacity alerts
  const shelfLoadByAlmari: Record<string, number> = {};
  for (const b of allBooks) {
    if (b.almari_id) {
      shelfLoadByAlmari[b.almari_id] = (shelfLoadByAlmari[b.almari_id] || 0) + 1;
    }
  }

  const handleStartEdit = (alm: Almari) => {
    setEditingAlmariId(alm.id);
    setEditCode(alm.code);
    setEditNameEn(alm.name_en);
    setEditNameUr(alm.name_ur);
    setEditShelves(alm.shelf_count);
    setEditBooksPerShelf(alm.books_per_shelf);
    setEditNotes(alm.notes || '');
    setEditNameLocked(!!alm.name_locked);
    const grps = AlmariService.getGroupsForAlmari(alm.id);
    setEditGroupIds(grps.map(g => g.id));
  };

  const handleSaveEdit = () => {
    if (!editingAlmariId || !editCode.trim() || !editNameEn.trim()) return;
    AlmariService.updateAlmari(
      editingAlmariId,
      {
        code: editCode.trim().toUpperCase(),
        name_en: editNameEn.trim(),
        name_ur: editNameUr.trim() || editNameEn.trim(),
        shelf_count: Number(editShelves) || 5,
        books_per_shelf: Number(editBooksPerShelf) || 30,
        notes: editNotes.trim() || undefined,
        name_locked: editNameLocked,
      },
      editGroupIds
    );
    setAlmaris(AlmariService.getAlmaris());
    setEditingAlmariId(null);
    onAlmarisChanged?.();
    showToast('Almari configuration updated.');
  };

  const handleResetPlanToDefault = () => {
    const def = AlmariService.resetAlmariPlanToDefault();
    setAlmariPlan([...def]);
    showToast('Almari plan successfully reset to canonical 12 disciplines.');
  };

  const handleSaveAdd = () => {
    if (!newCode.trim() || !newNameEn.trim()) return;
    AlmariService.addAlmari(
      {
        code: newCode.trim().toUpperCase(),
        name_en: newNameEn.trim(),
        name_ur: newNameUr.trim() || newNameEn.trim(),
        shelf_count: Number(newShelves) || 5,
        books_per_shelf: Number(newBooksPerShelf) || 30,
        notes: newNotes.trim() || undefined,
        is_active: true,
      },
      newGroupIds
    );
    setAlmaris(AlmariService.getAlmaris());
    setIsAdding(false);
    setNewCode('');
    setNewNameEn('');
    setNewNameUr('');
    setNewNotes('');
    setNewGroupIds([]);
    onAlmarisChanged?.();
    showToast('New Almari created.');
  };

  const [almariToDelete, setAlmariToDelete] = useState<Almari | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleDelete = (almari: Almari) => {
    setAlmariToDelete(almari);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeleteAlmari = (almId: string, action: 'move' | 'unassign', targetAlmId?: string) => {
    setIsDeleteModalOpen(false);
    setAlmariToDelete(null);
    const res = AlmariService.softDeleteAlmari(almId, action, targetAlmId);
    if (res.success) {
      setAlmaris(AlmariService.getAlmaris());
      onAlmarisChanged?.();
      showToast(res.message);
    }
  };

  const toggleGroupCheckbox = (groupId: string, isEdit: boolean) => {
    if (isEdit) {
      setEditGroupIds(prev =>
        prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
      );
    } else {
      setNewGroupIds(prev =>
        prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
      );
    }
  };

  return (
    <div className="ulm-preserve-glass rounded-[22px] p-5 bg-gradient-to-br from-white/80 via-white/65 to-white/50 dark:from-white/[0.075] dark:via-white/[0.03] dark:to-white/[0.015] backdrop-blur-xl backdrop-saturate-[180%] border border-slate-200/85 dark:border-white/[0.14] shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.85),0_8px_24px_rgba(15,23,42,0.05)] dark:shadow-[inset_1px_1px_1.5px_rgba(255,255,255,0.22),0_8px_24px_rgba(0,0,0,0.22)] space-y-4">
      {/* Toast */}
      {toastMsg && (
        <div className="p-2.5 bg-amber-500/[0.10] border border-amber-500/35 rounded-xl text-amber-800 dark:text-amber-300 text-[12px] font-semibold flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Sub-Section A: Compact Warning Banner */}
      {groupsWithNoAlmari.length > 0 && (
        <div className="bg-amber-500/[0.08] border border-amber-500/30 rounded-2xl p-3.5 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-[11px] flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <span className="font-bold text-amber-900 dark:text-amber-300 text-[12px]">
                Warning: Unassigned Book Groups ({groupsWithNoAlmari.length})
              </span>
              <span className="text-amber-800/80 dark:text-amber-200/75 text-[10px]">
                Auto-slotted by discipline when placed
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {groupsWithNoAlmari.map(g => (
                <span
                  key={g.id}
                  className="px-2 py-0.5 rounded-md text-[10px] font-semibold border"
                  style={{
                    backgroundColor: `${g.color}18`,
                    borderColor: `${g.color}55`,
                    color: g.color,
                  }}
                >
                  {g.name_en} ({g.name_ur})
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Header & Add Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/70 dark:border-white/[0.10]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 dark:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-['Plus_Jakarta_Sans'] text-[14px] font-bold text-slate-900 dark:text-white leading-tight">
              Almaris &amp; Cupboards (الماریاں) Management
            </h3>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
              Physical cupboards, shelf capacity guidance, and assigned book groups.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            const nextNum = almaris.length + 1;
            setNewCode(`A-${String(nextNum).padStart(2, '0')}`);
            setIsAdding(true);
          }}
          className="h-9 px-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-[12px] rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add New Almari</span>
        </button>
      </div>

      {/* Add New Almari Full-Viewport Portal Modal */}
      {isAdding && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] w-screen h-screen flex items-center justify-center p-4 sm:p-6 bg-slate-900/35 dark:bg-[#090514]/80 backdrop-blur-xl backdrop-saturate-[180%] animate-in fade-in duration-150"
          onClick={() => setIsAdding(false)}
        >
          <div
            className="ulm-preserve-glass relative w-full max-w-2xl rounded-[26px] p-6 bg-gradient-to-br from-white/95 via-white/90 to-white/85 dark:from-[#170F2A]/95 dark:via-[#120B22]/90 dark:to-[#0D0819]/90 backdrop-blur-2xl backdrop-saturate-[200%] border border-slate-200/90 dark:border-white/[0.16] shadow-[0_24px_64px_rgba(15,23,42,0.28)] dark:shadow-[0_24px_64px_rgba(0,0,0,0.65)] space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/[0.10]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-['Plus_Jakarta_Sans'] text-[15px] font-bold text-slate-900 dark:text-white">
                    New Physical Almari (الماری)
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Configure cupboard code, bilingual name, shelf count, and book groups.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="w-8 h-8 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border border-slate-200/80 dark:border-white/[0.10] flex items-center justify-center text-slate-500 dark:text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300 tracking-wider mb-1">
                  Almari Code *
                </label>
                <input
                  type="text"
                  value={newCode}
                  onChange={e => setNewCode(e.target.value)}
                  placeholder="e.g. A-08"
                  className="w-full h-9 px-3 bg-white/80 dark:bg-white/[0.05] border border-slate-300/90 dark:border-white/[0.14] rounded-xl text-[12px] text-slate-900 dark:text-white font-['JetBrains_Mono'] focus:outline-none focus:border-amber-500/60"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300 tracking-wider mb-1">
                  English Name *
                </label>
                <input
                  type="text"
                  value={newNameEn}
                  onChange={e => setNewNameEn(e.target.value)}
                  placeholder="e.g. Research & Journals"
                  className="w-full h-9 px-3 bg-white/80 dark:bg-white/[0.05] border border-slate-300/90 dark:border-white/[0.14] rounded-xl text-[12px] text-slate-900 dark:text-white focus:outline-none focus:border-amber-500/60"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300 tracking-wider mb-1">
                  Urdu Name (اردو) *
                </label>
                <input
                  type="text"
                  dir="auto"
                  value={newNameUr}
                  onChange={e => setNewNameUr(e.target.value)}
                  placeholder="الماری نام"
                  className="w-full h-9 px-3 bg-white/80 dark:bg-white/[0.05] border border-slate-300/90 dark:border-white/[0.14] rounded-xl text-[12px] text-slate-900 dark:text-white font-urdu focus:outline-none focus:border-amber-500/60"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300 tracking-wider mb-1">
                  Shelf Count
                </label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={newShelves}
                  onChange={e => setNewShelves(parseInt(e.target.value, 10) || 5)}
                  className="w-full h-9 px-3 bg-white/80 dark:bg-white/[0.05] border border-slate-300/90 dark:border-white/[0.14] rounded-xl text-[12px] text-slate-900 dark:text-white focus:outline-none focus:border-amber-500/60"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300 tracking-wider mb-1">
                  Books Per Shelf
                </label>
                <input
                  type="number"
                  min="5"
                  max="100"
                  value={newBooksPerShelf}
                  onChange={e => setNewBooksPerShelf(parseInt(e.target.value, 10) || 30)}
                  className="w-full h-9 px-3 bg-white/80 dark:bg-white/[0.05] border border-slate-300/90 dark:border-white/[0.14] rounded-xl text-[12px] text-slate-900 dark:text-white focus:outline-none focus:border-amber-500/60"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300 tracking-wider mb-1">
                  Location Notes / Bay
                </label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  placeholder="e.g. Ground Floor, East Wing"
                  className="w-full h-9 px-3 bg-white/80 dark:bg-white/[0.05] border border-slate-300/90 dark:border-white/[0.14] rounded-xl text-[12px] text-slate-900 dark:text-white focus:outline-none focus:border-amber-500/60"
                />
              </div>
            </div>

            {/* Group assignment checkboxes */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300 tracking-wider mb-1.5">
                Book Groups Held in this Almari (Tick all that apply)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-white/70 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.12] rounded-xl max-h-44 overflow-y-auto">
                {groups.map(grp => (
                  <label
                    key={grp.id}
                    className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-white/10 cursor-pointer text-[11px]"
                  >
                    <input
                      type="checkbox"
                      checked={newGroupIds.includes(grp.id)}
                      onChange={() => toggleGroupCheckbox(grp.id, false)}
                      className="accent-amber-500 rounded"
                    />
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: grp.color }}
                    />
                    <span className="truncate text-slate-900 dark:text-white font-medium">{grp.name_en}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200/80 dark:border-white/[0.10]">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="h-9 px-4 bg-white/70 hover:bg-white dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border border-slate-300/80 dark:border-white/[0.12] text-slate-700 dark:text-slate-200 text-[12px] font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAdd}
                disabled={!newCode.trim() || !newNameEn.trim()}
                className="h-9 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-[12px] font-bold rounded-xl disabled:opacity-50 cursor-pointer shadow-sm"
              >
                Save Almari
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Physical Almaris Table */}
      <div className="rounded-2xl bg-white/65 dark:bg-white/[0.03] border border-slate-200/85 dark:border-white/[0.10] overflow-hidden">
        <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-100/95 dark:bg-[#150E26]/95 backdrop-blur-md">
              <tr className="border-b border-slate-200/80 dark:border-white/[0.10] text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                <th className="py-2.5 px-3 w-16 text-center">Code</th>
                <th className="py-2.5 px-3">Almari Name &amp; Location</th>
                <th className="py-2.5 px-3">Shelves &amp; Capacity</th>
                <th className="py-2.5 px-3">Assigned Book Groups</th>
                <th className="py-2.5 px-3 text-center">Current Load</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.06] text-[12px] text-slate-800 dark:text-slate-200">
              {almaris.map(alm => {
                const isEditing = editingAlmariId === alm.id;
                const almGroups = AlmariService.getGroupsForAlmari(alm.id);
                const currentBooksCount = shelfLoadByAlmari[alm.id] || 0;
                const totalCap = alm.shelf_count * alm.books_per_shelf;
                const pct = totalCap > 0 ? Math.round((currentBooksCount / totalCap) * 100) : 0;

                return (
                  <tr key={alm.id} className="hover:bg-white/70 dark:hover:bg-white/[0.04] transition-colors">
                    {/* Code */}
                    <td className="py-2 px-3 text-center font-['JetBrains_Mono'] font-bold text-amber-700 dark:text-amber-300">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editCode}
                          onChange={e => setEditCode(e.target.value)}
                          className="w-16 h-7 px-1 bg-white dark:bg-white/[0.06] border border-slate-300 dark:border-white/15 rounded-lg text-[11px] text-center font-['JetBrains_Mono'] text-slate-900 dark:text-white"
                        />
                      ) : (
                        alm.code
                      )}
                    </td>

                    {/* Name & Notes */}
                    <td className="py-2 px-3">
                      {isEditing ? (
                        <div className="space-y-1.5 max-w-xs">
                          <input
                            type="text"
                            value={editNameEn}
                            onChange={e => setEditNameEn(e.target.value)}
                            className="w-full h-7 px-2 bg-white dark:bg-white/[0.06] border border-slate-300 dark:border-white/15 rounded-lg text-[11px] text-slate-900 dark:text-white"
                            placeholder="English Name"
                          />
                          <input
                            type="text"
                            dir="auto"
                            value={editNameUr}
                            onChange={e => setEditNameUr(e.target.value)}
                            className="w-full h-7 px-2 bg-white dark:bg-white/[0.06] border border-slate-300 dark:border-white/15 rounded-lg text-[11px] text-slate-900 dark:text-white font-urdu"
                            placeholder="اردو نام"
                          />
                          <input
                            type="text"
                            value={editNotes}
                            onChange={e => setEditNotes(e.target.value)}
                            className="w-full h-7 px-2 bg-white dark:bg-white/[0.06] border border-slate-300 dark:border-white/15 rounded-lg text-[11px] text-slate-600 dark:text-slate-300"
                            placeholder="Notes / Bay location"
                          />
                          <label className="flex items-center gap-1.5 text-[10px] text-amber-700 dark:text-amber-300 cursor-pointer pt-0.5">
                            <input
                              type="checkbox"
                              checked={editNameLocked}
                              onChange={e => setEditNameLocked(e.target.checked)}
                              className="accent-amber-500"
                            />
                            <span>Lock name</span>
                          </label>
                        </div>
                      ) : (
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                            <span>{alm.name_en}</span>
                            <span className="text-slate-500 dark:text-slate-400 font-urdu text-[12px]" dir="auto">
                              ({alm.name_ur})
                            </span>
                            {alm.name_locked && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-['JetBrains_Mono']" title="Name is locked">
                                <Lock className="w-2.5 h-2.5" />
                                Locked
                              </span>
                            )}
                          </div>
                          {alm.notes && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {alm.notes}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Shelves & capacity */}
                    <td className="py-2 px-3">
                      {isEditing ? (
                        <div className="flex gap-1.5 items-center">
                          <div>
                            <span className="text-[9px] text-slate-500 uppercase block">Shelves</span>
                            <input
                              type="number"
                              min="1"
                              max="12"
                              value={editShelves}
                              onChange={e => setEditShelves(parseInt(e.target.value, 10) || 5)}
                              className="w-12 h-7 px-1.5 bg-white dark:bg-white/[0.06] border border-slate-300 dark:border-white/15 rounded-lg text-[11px] text-slate-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 uppercase block">Per Shelf</span>
                            <input
                              type="number"
                              min="5"
                              max="100"
                              value={editBooksPerShelf}
                              onChange={e => setEditBooksPerShelf(parseInt(e.target.value, 10) || 30)}
                              className="w-14 h-7 px-1.5 bg-white dark:bg-white/[0.06] border border-slate-300 dark:border-white/15 rounded-lg text-[11px] text-slate-900 dark:text-white"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-[11px]">
                          <span className="font-bold text-slate-900 dark:text-white">{alm.shelf_count} Shelves</span>
                          <span className="text-slate-500 dark:text-slate-400 block text-[10px]">
                            ~{alm.books_per_shelf}/shelf (Cap: {totalCap})
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Groups */}
                    <td className="py-2 px-3">
                      {isEditing ? (
                        <div className="grid grid-cols-2 gap-1 max-w-xs max-h-32 overflow-y-auto p-1.5 bg-white/80 dark:bg-white/[0.05] rounded-lg border border-slate-300 dark:border-white/15">
                          {groups.map(grp => (
                            <label
                              key={grp.id}
                              className="flex items-center gap-1.5 text-[10px] text-slate-900 dark:text-white cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={editGroupIds.includes(grp.id)}
                                onChange={() => toggleGroupCheckbox(grp.id, true)}
                                className="accent-amber-500"
                              />
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: grp.color }}
                              />
                              <span className="truncate">{grp.name_en}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {almGroups.length > 0 ? (
                            almGroups.map(grp => (
                              <span
                                key={grp.id}
                                className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold border flex items-center gap-1"
                                style={{
                                  backgroundColor: `${grp.color}15`,
                                  borderColor: `${grp.color}50`,
                                  color: grp.color,
                                }}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: grp.color }}
                                />
                                {grp.name_en}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 italic">No groups assigned</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Current load */}
                    <td className="py-2 px-3 text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-['JetBrains_Mono'] text-[11px] font-bold text-slate-900 dark:text-white">
                          {currentBooksCount} / {totalCap}
                        </span>
                        <div className="w-14 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden mt-1">
                          <div
                            className={`h-full rounded-full ${
                              pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">{pct}% full</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-2 px-3 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] flex items-center cursor-pointer"
                            title="Save Almari changes"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingAlmariId(null)}
                            className="p-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-white/10 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] cursor-pointer"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(alm)}
                            className="p-1.5 text-slate-500 hover:text-amber-600 dark:hover:text-amber-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                            title="Edit Almari"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(alm)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                            title="Delete Almari"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sub-Section B: Master Almari Plan (ماسٹر الماری پلان) — 12 Disciplines */}
      <div className="pt-3 border-t border-slate-200/70 dark:border-white/[0.10] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 dark:bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-700 dark:text-purple-300 shrink-0">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-300" />
            </div>
            <div>
              <h4 className="font-['Plus_Jakarta_Sans'] text-[13px] font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Almari Plan (ماسٹر الماری پلان)</span>
                <span className="text-[10px] font-['JetBrains_Mono'] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-500/30">
                  {almariPlan.length} Disciplines
                </span>
              </h4>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Canonical naming and group mappings for auto-arranging books and overflow Almaris.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetPlanToDefault}
            className="h-8 px-3 bg-white/75 hover:bg-white dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-amber-800 dark:text-amber-300 border border-amber-500/35 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Reset Almari Plan to canonical 12 disciplines"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset to default plan</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {almariPlan.map((entry) => {
            const assignedCount = almaris.filter(a => a.plan_key === entry.key || a.name_en.startsWith(entry.name_en)).length;
            return (
              <div
                key={entry.key}
                className="rounded-2xl p-3.5 bg-white/70 dark:bg-white/[0.045] border border-slate-200/80 dark:border-white/[0.12] hover:border-amber-500/40 transition-all flex flex-col justify-between space-y-2 shadow-[inset_1px_1px_1px_rgba(255,255,255,0.6)] dark:shadow-[inset_1px_1px_1px_rgba(255,255,255,0.08)]"
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-['Plus_Jakarta_Sans'] font-bold text-slate-900 dark:text-white text-[12px] leading-snug">
                      {entry.name_en}
                    </span>
                    <span className="font-urdu text-[12px] text-amber-700 dark:text-amber-300 shrink-0" dir="auto">
                      {entry.name_ur}
                    </span>
                  </div>
                  <div className="text-[10.5px] text-slate-600 dark:text-slate-300/90 leading-relaxed">
                    <span className="font-bold text-slate-800 dark:text-slate-200 mr-1">Target Disciplines:</span>
                    <span>{(entry.group_names_en || []).join(', ')}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-200/70 dark:border-white/[0.08] flex items-center justify-between text-[10.5px]">
                  <span className="text-slate-500 dark:text-slate-400">Current Almaris:</span>
                  <span className="font-['JetBrains_Mono'] text-slate-900 dark:text-white font-bold">
                    {assignedCount > 0 ? `${assignedCount} active` : 'None yet'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete Almari Modal */}
      {isDeleteModalOpen && almariToDelete && (
        <DeleteAlmariModal
          isOpen={isDeleteModalOpen}
          almari={almariToDelete}
          allBooks={LibraryStorage.getBooks()}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setAlmariToDelete(null);
          }}
          onConfirmDelete={handleConfirmDeleteAlmari}
        />
      )}
    </div>
  );
};

