import React, { useState } from 'react';
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

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete book group "${name}"?`)) return;
    AlmariService.deleteGroup(id);
    const refreshed = AlmariService.getGroups();
    setGroups(refreshed);
    onGroupsChanged?.();
    showToast(`Deleted group "${name}".`);
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
    <div className="space-y-6">
      {/* Toast */}
      {toastMsg && (
        <div className="p-3 bg-white/90 dark:bg-[#140D22]/90 border border-[#C8963E]/50 rounded-[10px] text-[#8A4B00] dark:text-[#FFD147] text-[13px] font-semibold flex items-center gap-2 shadow-xs">
          <Sparkles className="w-4 h-4 text-[#B4690E] dark:text-[#FFD147]" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 bg-white/90 dark:bg-[#140D22]/85 border border-slate-200/90 dark:border-white/10 rounded-2xl shadow-sm">
        <div>
          <h3 className="text-[15px] font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#B4690E] dark:text-[#FFD147]" />
            Book Groups (گروپس) Configuration
          </h3>
          <p className="text-[12px] text-slate-600 dark:text-slate-300 mt-0.5">
            Define classification groups, color badges, and auto-suggestion matching rules (language and subject category).
          </p>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="px-4 py-2 bg-gradient-to-r from-[#8E4F0B] via-[#B4690E] to-[#CE851D] !text-white font-extrabold text-[13px] rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer shadow-sm"
          >
            <FolderPlus className="w-4 h-4" />
            Add New Group
          </button>
        )}
      </div>

      {/* Add Form Panel */}
      {isAdding && (
        <div className="p-5 bg-white/95 dark:bg-[#181028] border border-[#C8963E]/50 rounded-2xl space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h4 className="text-[14px] font-bold text-[#8A4B00] dark:text-[#FFD147] flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-[#B4690E] dark:text-[#FFD147]" />
              New Book Group
            </h4>
            <button
              onClick={() => setIsAdding(false)}
              className="text-slate-500 hover:text-slate-900 dark:hover:text-white p-1 rounded hover:bg-black/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] uppercase font-bold text-slate-600 dark:text-slate-300 tracking-wider mb-1">
                Group Name (English) *
              </label>
              <input
                type="text"
                value={newNameEn}
                onChange={e => setNewNameEn(e.target.value)}
                placeholder="e.g. Computer Science"
                className="w-full h-9 px-3 bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 rounded-lg text-[13px] text-slate-900 dark:text-white focus:outline-none focus:border-[#B4690E]"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase font-bold text-slate-600 dark:text-slate-300 tracking-wider mb-1">
                Group Name (Urdu / اردو) *
              </label>
              <input
                type="text"
                dir="auto"
                value={newNameUr}
                onChange={e => setNewNameUr(e.target.value)}
                placeholder="مثلاً: کمپیوٹر سائنس"
                className="w-full h-9 px-3 bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 rounded-lg text-[13px] text-slate-900 dark:text-white font-urdu focus:outline-none focus:border-[#B4690E]"
              />
            </div>
          </div>

          {/* Color & Rules */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] uppercase font-bold text-slate-600 dark:text-slate-300 tracking-wider mb-1">
                Badge Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newColor}
                  onChange={e => setNewColor(e.target.value)}
                  className="w-9 h-9 rounded-lg bg-transparent border border-slate-300 dark:border-white/15 cursor-pointer"
                />
                <div className="flex gap-1 flex-wrap">
                  {PRESET_COLORS.slice(0, 6).map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      className="w-5 h-5 rounded-full border border-black/20 dark:border-white/20"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase font-bold text-slate-600 dark:text-slate-300 tracking-wider mb-1">
                Rule: Match Language (Optional)
              </label>
              <input
                type="text"
                value={newMatchLang}
                onChange={e => setNewMatchLang(e.target.value)}
                placeholder="e.g. Urdu, Pashto, English"
                className="w-full h-9 px-3 bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 rounded-lg text-[13px] text-slate-900 dark:text-white focus:outline-none focus:border-[#B4690E]"
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase font-bold text-slate-600 dark:text-slate-300 tracking-wider mb-1">
                Rule: Match Category (Optional)
              </label>
              <input
                type="text"
                value={newMatchCat}
                onChange={e => setNewMatchCat(e.target.value)}
                placeholder="e.g. Computer Science, Physics"
                className="w-full h-9 px-3 bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 rounded-lg text-[13px] text-slate-900 dark:text-white focus:outline-none focus:border-[#B4690E]"
              />
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
              disabled={!newNameEn.trim()}
              className="px-4 py-1.5 bg-gradient-to-r from-[#8E4F0B] to-[#CE851D] !text-white text-[12px] font-extrabold rounded-lg disabled:opacity-50 cursor-pointer"
            >
              Create Group
            </button>
          </div>
        </div>
      )}

      {/* Groups List Table */}
      <div className="bg-white/90 dark:bg-[#140D22]/85 border border-slate-200/90 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-100/90 dark:bg-black/30 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                <th className="py-3 px-3 w-12 text-center">#</th>
                <th className="py-3 px-4">Group Name (English &amp; Urdu)</th>
                <th className="py-3 px-4">Color Badge</th>
                <th className="py-3 px-4">Suggestion Rules</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/5 text-[13px] text-slate-800 dark:text-slate-200">
              {groups.map((grp, idx) => {
                const isEditing = editingGroupId === grp.id;
                return (
                  <tr key={grp.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    {/* Reorder arrows */}
                    <td className="py-3 px-2 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          onClick={() => handleMoveOrder(idx, 'up')}
                          disabled={idx === 0}
                          className="p-0.5 text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-20"
                          title="Move up"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{idx + 1}</span>
                        <button
                          onClick={() => handleMoveOrder(idx, 'down')}
                          disabled={idx === groups.length - 1}
                          className="p-0.5 text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-20"
                          title="Move down"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    </td>

                    {/* Group names */}
                    <td className="py-3 px-4">
                      {isEditing ? (
                        <div className="space-y-1.5 max-w-sm">
                          <input
                            type="text"
                            value={editNameEn}
                            onChange={e => setEditNameEn(e.target.value)}
                            className="w-full h-8 px-2 bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 rounded text-[12px] text-slate-900 dark:text-white"
                            placeholder="English name"
                          />
                          <input
                            type="text"
                            dir="auto"
                            value={editNameUr}
                            onChange={e => setEditNameUr(e.target.value)}
                            className="w-full h-8 px-2 bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 rounded text-[12px] text-slate-900 dark:text-white font-urdu"
                            placeholder="اردو نام"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">{grp.name_en}</span>
                          <span className="text-slate-500 dark:text-slate-400 font-urdu text-[14px]" dir="auto">
                            ({grp.name_ur})
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Color */}
                    <td className="py-3 px-4">
                      {isEditing ? (
                        <input
                          type="color"
                          value={editColor}
                          onChange={e => setEditColor(e.target.value)}
                          className="w-8 h-8 rounded border border-slate-300 dark:border-white/15 cursor-pointer bg-transparent"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full border border-black/20 dark:border-white/30 shrink-0"
                            style={{ backgroundColor: grp.color }}
                          />
                          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{grp.color}</span>
                        </div>
                      )}
                    </td>

                    {/* Suggestion rules */}
                    <td className="py-3 px-4">
                      {isEditing ? (
                        <div className="space-y-1 max-w-xs">
                          <input
                            type="text"
                            value={editMatchLang}
                            onChange={e => setEditMatchLang(e.target.value)}
                            placeholder="match_language (e.g. Urdu)"
                            className="w-full h-7 px-2 bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 rounded text-[11px] text-slate-900 dark:text-white"
                          />
                          <input
                            type="text"
                            value={editMatchCat}
                            onChange={e => setEditMatchCat(e.target.value)}
                            placeholder="match_category"
                            className="w-full h-7 px-2 bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-white/15 rounded text-[11px] text-slate-900 dark:text-white"
                          />
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {grp.match_language && (
                            <span className="inline-block px-2 py-0.5 bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 rounded text-[11px] mr-1.5 font-mono">
                              Lang: {grp.match_language}
                            </span>
                          )}
                          {grp.match_category && (
                            <span className="inline-block px-2 py-0.5 bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 rounded text-[11px] font-mono">
                              Cat: {grp.match_category}
                            </span>
                          )}
                          {!grp.match_language && !grp.match_category && (
                            <span className="text-[11px] text-slate-400 italic">No auto-match rules</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Active */}
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => handleToggleActive(grp.id, grp.is_active)}
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border cursor-pointer ${
                          grp.is_active
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-200 dark:bg-stone-900/40 text-slate-600 dark:text-stone-400 border-slate-300 dark:border-stone-800'
                        }`}
                      >
                        {grp.is_active ? 'Active' : 'Hidden'}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={handleSaveEdit}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[12px] flex items-center gap-1"
                            title="Save changes"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingGroupId(null)}
                            className="p-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-white/10 text-slate-700 dark:text-slate-300 rounded text-[12px]"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleStartEdit(grp)}
                            className="p-1.5 text-slate-500 hover:text-[#B4690E] dark:hover:text-[#FFD147] hover:bg-slate-100 dark:hover:bg-white/10 rounded transition-colors cursor-pointer"
                            title="Edit group"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(grp.id, grp.name_en)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
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
