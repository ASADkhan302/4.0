import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  FolderPlus, 
  Layers, 
  Edit3, 
  Trash2, 
  Save, 
  X, 
  ArrowUp, 
  ArrowDown, 
  Check, 
  Palette,
  Sparkles,
  Info
} from 'lucide-react';
import { BookGroup } from '../../types/library';
import { AlmariService } from '../../services/almariService';

interface GroupsSettingsTabProps {
  onGroupsChanged?: () => void;
}

const PRESET_COLORS = [
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#06B6D4', // Cyan
  '#6366F1', // Indigo
  '#EC4899', // Pink
  '#059669', // Forest
  '#D97706', // Ochre
  '#14B8A6', // Teal
  '#EF4444', // Red
  '#84CC16', // Lime
  '#A855F7', // Violet
  '#64748B', // Slate
  '#BC881B', // Gold
];

export const GroupsSettingsTab: React.FC<GroupsSettingsTabProps> = ({ onGroupsChanged }) => {
  const [groups, setGroups] = useState<BookGroup[]>(() => AlmariService.getGroups());
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editNameEn, setEditNameEn] = useState('');
  const [editNameUr, setEditNameUr] = useState('');
  const [editColor, setEditColor] = useState('#3B82F6');
  const [editMatchCat, setEditMatchCat] = useState('');
  const [editMatchLang, setEditMatchLang] = useState('');

  // Add form state
  const [isAdding, setIsAdding] = useState(false);
  const [newNameEn, setNewNameEn] = useState('');
  const [newNameUr, setNewNameUr] = useState('');
  const [newColor, setNewColor] = useState('#3B82F6');
  const [newMatchCat, setNewMatchCat] = useState('');
  const [newMatchLang, setNewMatchLang] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleStartEdit = (grp: BookGroup) => {
    setEditingGroupId(grp.id);
    setEditNameEn(grp.name_en);
    setEditNameUr(grp.name_ur);
    setEditColor(grp.color);
    setEditMatchCat(grp.match_category || '');
    setEditMatchLang(grp.match_language || '');
  };

  const handleSaveEdit = () => {
    if (!editingGroupId || !editNameEn.trim()) return;
    AlmariService.updateGroup(editingGroupId, {
      name_en: editNameEn.trim(),
      name_ur: editNameUr.trim() || editNameEn.trim(),
      color: editColor,
      match_category: editMatchCat.trim() || undefined,
      match_language: editMatchLang.trim() || undefined,
    });
    const refreshed = AlmariService.getGroups();
    setGroups(refreshed);
    setEditingGroupId(null);
    onGroupsChanged?.();
    showToast('Book group updated.');
  };

  const handleSaveAdd = () => {
    if (!newNameEn.trim()) return;
    AlmariService.addGroup({
      name_en: newNameEn.trim(),
      name_ur: newNameUr.trim() || newNameEn.trim(),
      color: newColor,
      sort_order: groups.length + 1,
      is_active: true,
      match_category: newMatchCat.trim() || undefined,
      match_language: newMatchLang.trim() || undefined,
    });
    const refreshed = AlmariService.getGroups();
    setGroups(refreshed);
    setIsAdding(false);
    setNewNameEn('');
    setNewNameUr('');
    setNewMatchCat('');
    setNewMatchLang('');
    onGroupsChanged?.();
    showToast('New book group added.');
  };

  const [groupToDelete, setGroupToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!isAdding && !groupToDelete) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (groupToDelete) setGroupToDelete(null);
      else if (isAdding) setIsAdding(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isAdding, groupToDelete]);

  const handleDelete = (id: string, name: string) => {
    setGroupToDelete({ id, name });
  };

  const handleConfirmDeleteGroup = () => {
    if (!groupToDelete) return;
    AlmariService.deleteGroup(groupToDelete.id);
    const refreshed = AlmariService.getGroups();
    setGroups(refreshed);
    onGroupsChanged?.();
    showToast(`Deleted group "${groupToDelete.name}".`);
    setGroupToDelete(null);
  };

  const handleMoveOrder = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= groups.length) return;
    const reordered = [...groups];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved);
    const updated = reordered.map((g, idx) => ({ ...g, sort_order: idx + 1 }));
    AlmariService.saveGroups(updated);
    setGroups(updated);
    onGroupsChanged?.();
  };

  const handleToggleActive = (id: string, current: boolean) => {
    AlmariService.updateGroup(id, { is_active: !current });
    const refreshed = AlmariService.getGroups();
    setGroups(refreshed);
    onGroupsChanged?.();
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

      {/* Header & Add Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/70 dark:border-white/[0.10]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 dark:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-['Plus_Jakarta_Sans'] text-[14px] font-bold text-slate-900 dark:text-white leading-tight">
              Book Groups (گروپس) Configuration
            </h3>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
              Classification groups, color badges, and auto-suggestion matching rules.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="h-9 px-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-[12px] rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          <span>Add New Group</span>
        </button>
      </div>

      {/* Delete Group Full-Viewport Portal Confirmation Modal */}
      {groupToDelete && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] w-screen h-screen flex items-center justify-center p-4 sm:p-6 bg-slate-900/35 dark:bg-[#090514]/80 backdrop-blur-xl animate-in fade-in duration-150"
          onClick={() => setGroupToDelete(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="ulm-preserve-glass w-full max-w-sm rounded-[24px] p-5 bg-gradient-to-br from-white/92 via-white/82 to-white/70 dark:from-[#1A102E]/95 dark:via-[#140C24]/92 dark:to-[#0F081C]/90 backdrop-blur-2xl border border-rose-400/50 shadow-2xl space-y-4 text-slate-900 dark:text-white"
          >
            <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/10 pb-3">
              <h4 className="text-sm font-extrabold text-rose-700 dark:text-rose-300">
                Delete Book Group?
              </h4>
              <button
                type="button"
                onClick={() => setGroupToDelete(null)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              Are you sure you want to delete book group <strong>&quot;{groupToDelete.name}&quot;</strong>? Existing books will remain intact in the catalog.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setGroupToDelete(null)}
                className="h-9 px-4 rounded-xl text-xs font-semibold border border-slate-300 dark:border-white/15 text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteGroup}
                className="h-9 px-4 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 !text-white cursor-pointer"
              >
                Delete Group
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add Form Full-Viewport Portal Modal */}
      {isAdding && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] w-screen h-screen flex items-center justify-center p-4 sm:p-6 bg-slate-900/35 dark:bg-[#090514]/80 backdrop-blur-xl backdrop-saturate-[180%] animate-in fade-in duration-150"
          onClick={() => setIsAdding(false)}
        >
          <div
            className="ulm-preserve-glass relative w-full max-w-lg rounded-[26px] p-6 bg-gradient-to-br from-white/95 via-white/90 to-white/85 dark:from-[#170F2A]/95 dark:via-[#120B22]/90 dark:to-[#0D0819]/90 backdrop-blur-2xl backdrop-saturate-[200%] border border-slate-200/90 dark:border-white/[0.16] shadow-[0_24px_64px_rgba(15,23,42,0.28)] dark:shadow-[0_24px_64px_rgba(0,0,0,0.65)] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/[0.10]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <FolderPlus className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-['Plus_Jakarta_Sans'] text-[15px] font-bold text-slate-900 dark:text-white">
                    New Book Group (نیا گروپ)
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Define English &amp; Urdu titles, badge color, and auto-matching rules.
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300 tracking-wider mb-1">
                  Group Name (English) *
                </label>
                <input
                  type="text"
                  value={newNameEn}
                  onChange={e => setNewNameEn(e.target.value)}
                  placeholder="e.g. Computer Science"
                  className="w-full h-9 px-3 bg-white/80 dark:bg-white/[0.05] border border-slate-300/90 dark:border-white/[0.14] rounded-xl text-[12px] text-slate-900 dark:text-white focus:outline-none focus:border-amber-500/60"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300 tracking-wider mb-1">
                  Group Name (Urdu / اردو) *
                </label>
                <input
                  type="text"
                  dir="auto"
                  value={newNameUr}
                  onChange={e => setNewNameUr(e.target.value)}
                  placeholder="مثلاً: کمپیوٹر سائنس"
                  className="w-full h-9 px-3 bg-white/80 dark:bg-white/[0.05] border border-slate-300/90 dark:border-white/[0.14] rounded-xl text-[12px] text-slate-900 dark:text-white font-urdu focus:outline-none focus:border-amber-500/60"
                />
              </div>
            </div>

            {/* Color & Rules */}
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300 tracking-wider mb-1.5">
                  Badge Color
                </label>
                <div className="flex items-center gap-2.5">
                  <input
                    type="color"
                    value={newColor}
                    onChange={e => setNewColor(e.target.value)}
                    className="w-9 h-9 rounded-xl bg-transparent border border-slate-300 dark:border-white/15 cursor-pointer shrink-0"
                  />
                  <div className="flex gap-1.5 flex-wrap">
                    {PRESET_COLORS.slice(0, 10).map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewColor(c)}
                        className={`w-5 h-5 rounded-full border transition-transform cursor-pointer ${
                          newColor === c ? 'scale-110 ring-2 ring-amber-400 border-white' : 'border-black/20 dark:border-white/20'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300 tracking-wider mb-1">
                    Rule: Match Language (Optional)
                  </label>
                  <input
                    type="text"
                    value={newMatchLang}
                    onChange={e => setNewMatchLang(e.target.value)}
                    placeholder="e.g. Urdu, Pashto, English"
                    className="w-full h-9 px-3 bg-white/80 dark:bg-white/[0.05] border border-slate-300/90 dark:border-white/[0.14] rounded-xl text-[12px] text-slate-900 dark:text-white focus:outline-none focus:border-amber-500/60"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300 tracking-wider mb-1">
                    Rule: Match Category (Optional)
                  </label>
                  <input
                    type="text"
                    value={newMatchCat}
                    onChange={e => setNewMatchCat(e.target.value)}
                    placeholder="e.g. Computer Science, Physics"
                    className="w-full h-9 px-3 bg-white/80 dark:bg-white/[0.05] border border-slate-300/90 dark:border-white/[0.14] rounded-xl text-[12px] text-slate-900 dark:text-white focus:outline-none focus:border-amber-500/60"
                  />
                </div>
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
                disabled={!newNameEn.trim()}
                className="h-9 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-[12px] font-bold rounded-xl disabled:opacity-50 cursor-pointer shadow-sm"
              >
                Create Group
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Groups List Scrollable Compact Table */}
      <div className="rounded-2xl bg-white/65 dark:bg-white/[0.03] border border-slate-200/85 dark:border-white/[0.10] overflow-hidden">
        <div className="max-h-[520px] overflow-y-auto overflow-x-auto pr-1">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-100/95 dark:bg-[#150E26]/95 backdrop-blur-md">
              <tr className="border-b border-slate-200/80 dark:border-white/[0.10] text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                <th className="py-2.5 px-2.5 w-10 text-center">#</th>
                <th className="py-2.5 px-3">Group Name (English &amp; Urdu)</th>
                <th className="py-2.5 px-3">Color Badge</th>
                <th className="py-2.5 px-3">Suggestion Rules</th>
                <th className="py-2.5 px-2.5 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-white/[0.06] text-[12px] text-slate-800 dark:text-slate-200">
              {groups.map((grp, idx) => {
                const isEditing = editingGroupId === grp.id;
                return (
                  <tr key={grp.id} className="hover:bg-white/70 dark:hover:bg-white/[0.04] transition-colors">
                    {/* Reorder arrows */}
                    <td className="py-2 px-2 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => handleMoveOrder(idx, 'up')}
                          disabled={idx === 0}
                          className="p-0.5 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-20 cursor-pointer"
                          title="Move up"
                        >
                          <ArrowUp className="w-2.5 h-2.5" />
                        </button>
                        <span className="text-[10px] font-['JetBrains_Mono'] text-slate-500 dark:text-slate-400">{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => handleMoveOrder(idx, 'down')}
                          disabled={idx === groups.length - 1}
                          className="p-0.5 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-20 cursor-pointer"
                          title="Move down"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </td>

                    {/* Group names */}
                    <td className="py-2 px-3">
                      {isEditing ? (
                        <div className="space-y-1.5 max-w-xs">
                          <input
                            type="text"
                            value={editNameEn}
                            onChange={e => setEditNameEn(e.target.value)}
                            className="w-full h-7 px-2 bg-white dark:bg-white/[0.06] border border-slate-300 dark:border-white/15 rounded-lg text-[11px] text-slate-900 dark:text-white"
                            placeholder="English name"
                          />
                          <input
                            type="text"
                            dir="auto"
                            value={editNameUr}
                            onChange={e => setEditNameUr(e.target.value)}
                            className="w-full h-7 px-2 bg-white dark:bg-white/[0.06] border border-slate-300 dark:border-white/15 rounded-lg text-[11px] text-slate-900 dark:text-white font-urdu"
                            placeholder="اردو نام"
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-white leading-snug">{grp.name_en}</span>
                          <span className="text-slate-500 dark:text-slate-400 font-urdu text-[12px]" dir="auto">
                            ({grp.name_ur})
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Color */}
                    <td className="py-2 px-3">
                      {isEditing ? (
                        <input
                          type="color"
                          value={editColor}
                          onChange={e => setEditColor(e.target.value)}
                          className="w-7 h-7 rounded-lg border border-slate-300 dark:border-white/15 cursor-pointer bg-transparent"
                        />
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-3.5 h-3.5 rounded-full border border-black/20 dark:border-white/30 shrink-0"
                            style={{ backgroundColor: grp.color }}
                          />
                          <span className="font-['JetBrains_Mono'] text-[11px] text-slate-500 dark:text-slate-400">{grp.color}</span>
                        </div>
                      )}
                    </td>

                    {/* Suggestion rules */}
                    <td className="py-2 px-3">
                      {isEditing ? (
                        <div className="space-y-1 max-w-xs">
                          <input
                            type="text"
                            value={editMatchLang}
                            onChange={e => setEditMatchLang(e.target.value)}
                            placeholder="match_language (e.g. Urdu)"
                            className="w-full h-7 px-2 bg-white dark:bg-white/[0.06] border border-slate-300 dark:border-white/15 rounded-lg text-[11px] text-slate-900 dark:text-white"
                          />
                          <input
                            type="text"
                            value={editMatchCat}
                            onChange={e => setEditMatchCat(e.target.value)}
                            placeholder="match_category"
                            className="w-full h-7 px-2 bg-white dark:bg-white/[0.06] border border-slate-300 dark:border-white/15 rounded-lg text-[11px] text-slate-900 dark:text-white"
                          />
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {grp.match_language && (
                            <span className="inline-block px-1.5 py-0.5 bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 rounded text-[10px] font-['JetBrains_Mono']">
                              Lang: {grp.match_language}
                            </span>
                          )}
                          {grp.match_category && (
                            <span className="inline-block px-1.5 py-0.5 bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 rounded text-[10px] font-['JetBrains_Mono']">
                              Cat: {grp.match_category}
                            </span>
                          )}
                          {!grp.match_language && !grp.match_category && (
                            <span className="text-[10px] text-slate-400 italic">No auto-match rules</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Architectural Status Micro-Tag */}
                    <td className="py-2 px-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(grp.id, grp.is_active)}
                        className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-['JetBrains_Mono'] text-[10px] font-semibold uppercase tracking-wider border cursor-pointer transition-colors ${
                          grp.is_active
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                            : 'bg-slate-200/80 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 border-slate-300 dark:border-white/[0.12]'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-xs ${grp.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        <span>{grp.is_active ? 'ACTIVE' : 'HIDDEN'}</span>
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-2 px-3 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] flex items-center cursor-pointer"
                            title="Save changes"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingGroupId(null)}
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
                            onClick={() => handleStartEdit(grp)}
                            className="p-1.5 text-slate-500 hover:text-amber-600 dark:hover:text-amber-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                            title="Edit group"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(grp.id, grp.name_en)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                            title="Delete group"
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
    </div>
  );
};

