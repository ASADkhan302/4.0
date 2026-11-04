import React, { useState } from 'react';
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
    <div className="space-y-6">
      {/* Toast */}
      {toastMsg && (
        <div className="p-3 bg-white/90 dark:bg-[#140D22]/90 border border-[#C8963E]/50 rounded-[10px] text-[#8A4B00] dark:text-[#FFD147] text-[13px] font-semibold flex items-center gap-2 shadow-xs">
          <Sparkles className="w-4 h-4 text-[#B4690E] dark:text-[#FFD147]" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Warnings Panel */}
      {groupsWithNoAlmari.length > 0 && (
        <div className="p-4 bg-amber-50/90 dark:bg-amber-950/20 border border-amber-400/60 dark:border-amber-600/40 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-[13px]">
            <span className="font-bold text-amber-900 dark:text-amber-300 block mb-1">
              Warning: Unassigned Book Groups
            </span>
            <p className="text-amber-800 dark:text-amber-200/80 mb-2">
              The following active groups have no designated Almari. Books in these groups will be auto-slotted by discipline:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {groupsWithNoAlmari.map(g => (
                <span
                  key={g.id}
                  className="px-2 py-0.5 rounded text-[11px] font-semibold border"
                  style={{
                    backgroundColor: `${g.color}20`,
                    borderColor: `${g.color}60`,
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 bg-white/90 dark:bg-[#140D22]/85 border border-slate-200/90 dark:border-white/10 rounded-2xl shadow-sm">
        <div>
          <h3 className="text-[15px] font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#B4690E] dark:text-[#FFD147]" />
            Almaris &amp; Cupboards (الماریاں) Management
          </h3>
          <p className="text-[12px] text-slate-600 dark:text-slate-300 mt-0.5">
            Configure physical cupboards, shelf capacity guidance, and check the book groups assigned to each Almari.
          </p>
        </div>
        {!isAdding && (
          <button
            onClick={() => {
              const nextNum = almaris.length + 1;
              setNewCode(`A-${String(nextNum).padStart(2, '0')}`);
              setIsAdding(true);
            }}
            className="px-4 py-2 bg-gradient-to-r from-[#8E4F0B] via-[#B4690E] to-[#CE851D] !text-white font-extrabold text-[13px] rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add New Almari
          </button>
        )}
      </div>

      {/* Add New Almari Form */}
      {isAdding && (
        <div className="p-5 bg-white/95 dark:bg-[#181028] border border-[#C8963E]/50 rounded-2xl space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h4 className="text-[14px] font-bold text-[#8A4B00] dark:text-[#FFD147] flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#B4690E] dark:text-[#FFD147]" />
              New Physical Almari (الماری)
            </h4>
            <button
              onClick={() => setIsAdding(false)}
              className="text-slate-500 hover:text-slate-900 dark:hover:text-white p-1 rounded hover:bg-black/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] uppercase font-bold text-slate-600 dark:text-slate-300 tracking-wider mb-1">
                Almari Code *
              </label>
              <input
                type="text"
                value={newCode}
                onChange={e => setNewCode(e.target.value)}
                placeholder="e.g. A-08"
                className="w-full h-9 px-3 bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 rounded-lg text-[13px] text-slate-900 dark:text-white font-mono focus:outline-none focus:border-[#B4690E]"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase font-bold text-slate-600 dark:text-slate-300 tracking-wider mb-1">
                English Name *
              </label>
              <input
                type="text"
                value={newNameEn}
                onChange={e => setNewNameEn(e.target.value)}
                placeholder="e.g. Research & Journals"
                className="w-full h-9 px-3 bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 rounded-lg text-[13px] text-slate-900 dark:text-white focus:outline-none focus:border-[#B4690E]"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase font-bold text-slate-600 dark:text-slate-300 tracking-wider mb-1">
                Urdu Name (اردو) *
              </label>
              <input
                type="text"
                dir="auto"
                value={newNameUr}
                onChange={e => setNewNameUr(e.target.value)}
                placeholder="الماری نام"
                className="w-full h-9 px-3 bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 rounded-lg text-[13px] text-slate-900 dark:text-white font-urdu focus:outline-none focus:border-[#B4690E]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] uppercase font-bold text-slate-600 dark:text-slate-300 tracking-wider mb-1">
                Shelf Count
              </label>
              <input
                type="number"
                min="1"
                max="12"
                value={newShelves}
                onChange={e => setNewShelves(parseInt(e.target.value, 10) || 5)}
                className="w-full h-9 px-3 bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 rounded-lg text-[13px] text-slate-900 dark:text-white focus:outline-none focus:border-[#B4690E]"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase font-bold text-slate-600 dark:text-slate-300 tracking-wider mb-1">
                Books Per Shelf (Capacity Guidance)
              </label>
              <input
                type="number"
                min="5"
                max="100"
                value={newBooksPerShelf}
                onChange={e => setNewBooksPerShelf(parseInt(e.target.value, 10) || 30)}
                className="w-full h-9 px-3 bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 rounded-lg text-[13px] text-slate-900 dark:text-white focus:outline-none focus:border-[#B4690E]"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase font-bold text-slate-600 dark:text-slate-300 tracking-wider mb-1">
                Location Notes / Bay
              </label>
              <input
                type="text"
                value={newNotes}
                onChange={e => setNewNotes(e.target.value)}
                placeholder="e.g. Ground Floor, East Wing"
                className="w-full h-9 px-3 bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 rounded-lg text-[13px] text-slate-900 dark:text-white focus:outline-none focus:border-[#B4690E]"
              />
            </div>
          </div>

          {/* Group assignment checkboxes */}
          <div>
            <label className="block text-[11px] uppercase font-bold text-slate-600 dark:text-slate-300 tracking-wider mb-2">
              Book Groups Held in this Almari (Tick all that apply)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-white/15 rounded-xl">
              {groups.map(grp => (
                <label
                  key={grp.id}
                  className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-200/60 dark:hover:bg-white/10 cursor-pointer text-[12px]"
                >
                  <input
                    type="checkbox"
                    checked={newGroupIds.includes(grp.id)}
                    onChange={() => toggleGroupCheckbox(grp.id, false)}
                    className="accent-[#B4690E] rounded"
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

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setIsAdding(false)}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-[12px] font-bold rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAdd}
              disabled={!newCode.trim() || !newNameEn.trim()}
              className="px-4 py-1.5 bg-gradient-to-r from-[#8E4F0B] to-[#CE851D] !text-white text-[12px] font-extrabold rounded-lg disabled:opacity-50 cursor-pointer"
            >
              Save Almari
            </button>
          </div>
        </div>
      )}

      {/* Almaris Table */}
      <div className="bg-white/90 dark:bg-[#140D22]/85 border border-slate-200/90 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-100/90 dark:bg-black/30 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                <th className="py-3 px-3 w-16 text-center">Code</th>
                <th className="py-3 px-4">Almari Name &amp; Location</th>
                <th className="py-3 px-4">Shelves &amp; Capacity</th>
                <th className="py-3 px-4">Assigned Book Groups</th>
                <th className="py-3 px-3 text-center">Current Load</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/5 text-[13px] text-slate-800 dark:text-slate-200">
              {almaris.map(alm => {
                const isEditing = editingAlmariId === alm.id;
                const almGroups = AlmariService.getGroupsForAlmari(alm.id);
                const currentBooksCount = shelfLoadByAlmari[alm.id] || 0;
                const totalCap = alm.shelf_count * alm.books_per_shelf;
                const pct = totalCap > 0 ? Math.round((currentBooksCount / totalCap) * 100) : 0;

                return (
                  <tr key={alm.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    {/* Code */}
                    <td className="py-3 px-3 text-center font-mono font-extrabold text-[#8A4B00] dark:text-[#FFD147]">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editCode}
                          onChange={e => setEditCode(e.target.value)}
                          className="w-16 h-7 px-1 bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 rounded text-[12px] text-center font-mono text-slate-900 dark:text-white"
                        />
                      ) : (
                        alm.code
                      )}
                    </td>

                    {/* Name & Notes */}
                    <td className="py-3 px-4">
                      {isEditing ? (
                        <div className="space-y-1.5 max-w-sm">
                          <input
                            type="text"
                            value={editNameEn}
                            onChange={e => setEditNameEn(e.target.value)}
                            className="w-full h-8 px-2 bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 rounded text-[12px] text-slate-900 dark:text-white"
                            placeholder="English Name"
                          />
                          <input
                            type="text"
                            dir="auto"
                            value={editNameUr}
                            onChange={e => setEditNameUr(e.target.value)}
                            className="w-full h-8 px-2 bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 rounded text-[12px] text-slate-900 dark:text-white font-urdu"
                            placeholder="اردو نام"
                          />
                          <input
                            type="text"
                            value={editNotes}
                            onChange={e => setEditNotes(e.target.value)}
                            className="w-full h-7 px-2 bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 rounded text-[11px] text-slate-600 dark:text-slate-300"
                            placeholder="Notes / Bay location"
                          />
                          <label className="flex items-center gap-1.5 text-[11px] text-[#8A4B00] dark:text-[#E0B450] cursor-pointer pt-0.5">
                            <input
                              type="checkbox"
                              checked={editNameLocked}
                              onChange={e => setEditNameLocked(e.target.checked)}
                              className="accent-[#B4690E]"
                            />
                            <span>Lock name (prevent automatic renaming during auto-arrange)</span>
                          </label>
                        </div>
                      ) : (
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>{alm.name_en} - {alm.code}</span>
                            <span className="text-slate-500 dark:text-slate-400 font-urdu text-[13px]" dir="auto">
                              ({alm.name_ur})
                            </span>
                            {alm.name_locked && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/15 text-[#8A4B00] dark:text-[#E0B450] border border-[#BC881B]/30 font-mono" title="Name is locked">
                                <Lock className="w-2.5 h-2.5" />
                                Locked
                              </span>
                            )}
                          </div>
                          {alm.notes && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {alm.notes}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Shelves & capacity */}
                    <td className="py-3 px-4">
                      {isEditing ? (
                        <div className="flex gap-2 items-center">
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block">Shelves</span>
                            <input
                              type="number"
                              min="1"
                              max="12"
                              value={editShelves}
                              onChange={e => setEditShelves(parseInt(e.target.value, 10) || 5)}
                              className="w-14 h-7 px-1.5 bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 rounded text-[12px] text-slate-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase block">Per Shelf</span>
                            <input
                              type="number"
                              min="5"
                              max="100"
                              value={editBooksPerShelf}
                              onChange={e => setEditBooksPerShelf(parseInt(e.target.value, 10) || 30)}
                              className="w-16 h-7 px-1.5 bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 rounded text-[12px] text-slate-900 dark:text-white"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-[12px]">
                          <span className="font-bold text-slate-900 dark:text-white">{alm.shelf_count} Shelves</span>
                          <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                            ~{alm.books_per_shelf} bks/shelf (Cap: {totalCap})
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Groups */}
                    <td className="py-3 px-4">
                      {isEditing ? (
                        <div className="grid grid-cols-2 gap-1 max-w-sm max-h-36 overflow-y-auto p-1.5 bg-slate-50 dark:bg-[#0B1220] rounded border border-slate-300 dark:border-white/15">
                          {groups.map(grp => (
                            <label
                              key={grp.id}
                              className="flex items-center gap-1.5 text-[11px] text-slate-900 dark:text-white cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={editGroupIds.includes(grp.id)}
                                onChange={() => toggleGroupCheckbox(grp.id, true)}
                                className="accent-[#B4690E]"
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
                        <div className="flex flex-wrap gap-1.5">
                          {almGroups.length > 0 ? (
                            almGroups.map(grp => (
                              <span
                                key={grp.id}
                                className="px-2 py-0.5 rounded text-[11px] font-semibold border flex items-center gap-1.5"
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
                            <span className="text-[11px] text-amber-600 dark:text-amber-400 italic">No groups assigned</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Current load */}
                    <td className="py-3 px-3 text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-mono text-[12px] font-bold text-slate-900 dark:text-white">
                          {currentBooksCount} / {totalCap}
                        </span>
                        <div className="w-16 h-1.5 bg-slate-200 dark:bg-[#2B2730] rounded-full overflow-hidden mt-1">
                          <div
                            className={`h-full rounded-full ${
                              pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{pct}% full</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={handleSaveEdit}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[12px] flex items-center gap-1"
                            title="Save Almari changes"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingAlmariId(null)}
                            className="p-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-white/10 text-slate-700 dark:text-slate-300 rounded text-[12px]"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleStartEdit(alm)}
                            className="p-1.5 text-slate-500 hover:text-[#B4690E] dark:hover:text-[#FFD147] hover:bg-slate-100 dark:hover:bg-white/10 rounded transition-colors cursor-pointer"
                            title="Edit Almari"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(alm)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
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

      {/* Almari Plan (Master Disciplines & Auto-Naming Rules) */}
      <div className="bg-white/90 dark:bg-[#140D22]/85 border border-slate-200/90 dark:border-white/10 rounded-2xl p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#541A72]/15 dark:bg-[#541A72]/30 border border-[#541A72]/30 dark:border-[#A66BC9]/30 flex items-center justify-center text-[#541A72] dark:text-[#C084FC]">
              <Sparkles className="w-5 h-5 text-[#B4690E] dark:text-[#FFD147]" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Almari Plan (ماسٹر الماری پلان)</span>
                <span className="text-xs font-mono font-bold text-[#8A4B00] dark:text-[#FFD147] bg-amber-500/15 px-2 py-0.5 rounded border border-[#BC881B]/30">
                  {almariPlan.length} Disciplines
                </span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Defines canonical naming and group mappings for auto-arranging books and creating overflow Almaris.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetPlanToDefault}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-[#8A4B00] dark:text-amber-300 border border-[#C8963E]/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Reset Almari Plan to canonical 12 disciplines"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to default plan
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {almariPlan.map((entry) => {
            const assignedCount = almaris.filter(a => a.plan_key === entry.key || a.name_en.startsWith(entry.name_en)).length;
            return (
              <div 
                key={entry.key}
                className="p-3.5 bg-slate-50/90 dark:bg-[#0B0714] rounded-xl border border-slate-200/90 dark:border-white/10 hover:border-[#C8963E]/50 transition-all space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white text-[13px]">{entry.name_en}</span>
                  <span className="font-urdu text-[13px] text-[#8A4B00] dark:text-[#FFD147]" dir="auto">{entry.name_ur}</span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 flex flex-wrap gap-1">
                  <span className="font-bold text-slate-800 dark:text-slate-200">Target Disciplines:</span>
                  <span>{(entry.group_names_en || []).join(', ')}</span>
                </div>
                <div className="pt-2 border-t border-slate-200/70 dark:border-white/[0.06] flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400">Current Almaris:</span>
                  <span className="font-mono text-slate-900 dark:text-white font-extrabold">{assignedCount > 0 ? `${assignedCount} active` : 'None yet'}</span>
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
