import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  IdCard,
  Layers,
  FileDown,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Info,
  Sliders,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Borrower } from '../../types/library';
import {
  UlmSmartIdCard,
  CardMemberData,
  DEFAULT_STUDENT,
  SAMPLE_CARD_PRESETS,
  borrowerToCardMemberData,
  resolveCardRoleBadge,
} from '../library/UlmSmartIdCard';
import { ULM_OFFICIAL_CREST_SRC } from '../../constants/ulmOfficialAssets';
import { PdfGeneratorService, CardPdfLayout } from '../../services/pdfGeneratorService';
import {
  buildCr80CardsPrintHtml,
  isSandboxedPreviewIframe,
  openPrintablePdfDocument,
  printIsolatedHtml,
  renderCr80SideToDataUrl,
  saveJsPdfDocument,
  type RenderedCr80CardImages,
} from '../../services/printAndPdfEngine';
import { useInstitutionalIdentity } from '../../utils/themeTransition';
import { notifyGlassToast } from '../ui/LiquidGlassToast';
import { resolveMemberCardStanding } from '../../utils/memberStanding';

interface MemberCardPrintModalProps {
  borrower: Borrower | null;
  members?: Borrower[];
  allMembers?: Borrower[];
  isOpen: boolean;
  onClose: () => void;
}

const ROLE_PRESET_MAP: Record<string, string> = {
  role_faculty: 'FACULTY CARD',
  role_teacher: 'TEACHER CARD',
  role_staff: 'STAFF CARD',
  role_student: 'STUDENT CARD',
  role_scholar: 'RESEARCH SCHOLAR',
};

const ROLE_BADGE_OPTIONS = [
  'FACULTY CARD',
  'TEACHER CARD',
  'STAFF CARD',
  'STUDENT CARD',
  'RESEARCH SCHOLAR',
  'VISITOR CARD',
] as const;

export const MemberCardPrintModal: React.FC<MemberCardPrintModalProps> = ({
  borrower,
  members: passedMembers,
  allMembers,
  isOpen,
  onClose,
}) => {
  const identity = useInstitutionalIdentity();
  const [activeSide, setActiveSide] = useState<'both' | 'front' | 'back'>('both');
  const [cardLayout, setCardLayout] = useState<CardPdfLayout>('cr80_single');
  const [selectedMemberIndex, setSelectedMemberIndex] = useState<number>(0);
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>('selected');
  const [showFieldEditor, setShowFieldEditor] = useState<boolean>(true);
  const [watermarkAlpha, setWatermarkAlpha] = useState<number>(6.5);
  const [editorFields, setEditorFields] = useState<CardMemberData>(DEFAULT_STUDENT);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [statusNotification, setStatusNotification] = useState<{
    type: 'info' | 'success' | 'warn';
    message: string;
  } | null>(null);

  // Selected batch passed to the modal
  const memberList: Borrower[] = useMemo(() => {
    if (passedMembers && passedMembers.length > 0) return passedMembers;
    if (borrower) return [borrower];
    return [];
  }, [passedMembers, borrower]);

  // Complete directory available for all_members & individual member:<id> presets
  const directoryMembers: Borrower[] = useMemo(() => {
    const map = new Map<string, Borrower>();
    for (const m of memberList) {
      if (m?.id) map.set(m.id, m);
    }
    for (const m of allMembers || []) {
      if (m?.id && !map.has(m.id)) map.set(m.id, m);
    }
    return Array.from(map.values());
  }, [memberList, allMembers]);

  // Active navigable list based on whether all_members preset is selected
  const activeNavList: Borrower[] = useMemo(() => {
    if (selectedPresetKey === 'all_members' && directoryMembers.length > 0) {
      return directoryMembers;
    }
    return memberList;
  }, [selectedPresetKey, directoryMembers, memberList]);

  const currentMember = activeNavList[selectedMemberIndex] || memberList[0] || null;

  // Initialize modal state cleanly whenever opened
  useEffect(() => {
    if (!isOpen) return;
    const initialMember = memberList[0] || null;
    setSelectedMemberIndex(0);
    setSelectedPresetKey(
      memberList.length > 1
        ? 'all_members'
        : initialMember
        ? 'selected'
        : 'student_default'
    );
    setEditorFields(
      initialMember
        ? borrowerToCardMemberData(initialMember)
        : { ...DEFAULT_STUDENT }
    );
    setStatusNotification(null);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, memberList, onClose]);

  if (!isOpen) return null;

  // Synchronize all editorFields immediately whenever Preset changes
  const handlePresetChange = (presetKey: string) => {
    setSelectedPresetKey(presetKey);
    setStatusNotification(null);

    if (presetKey === 'selected') {
      const target = memberList[0] || directoryMembers[0] || null;
      setSelectedMemberIndex(0);
      setEditorFields(target ? borrowerToCardMemberData(target) : { ...DEFAULT_STUDENT });
      return;
    }

    if (presetKey === 'all_members') {
      const target = directoryMembers[0] || memberList[0] || null;
      setSelectedMemberIndex(0);
      setEditorFields(target ? borrowerToCardMemberData(target) : { ...DEFAULT_STUDENT });
      return;
    }

    if (presetKey.startsWith('member:')) {
      const id = presetKey.slice('member:'.length);
      const foundIdx = directoryMembers.findIndex((m) => m.id === id);
      const found = foundIdx >= 0 ? directoryMembers[foundIdx] : null;
      if (found) {
        const navIdx = memberList.findIndex((m) => m.id === id);
        if (navIdx >= 0) setSelectedMemberIndex(navIdx);
        setEditorFields(borrowerToCardMemberData(found));
      }
      return;
    }

    if (ROLE_PRESET_MAP[presetKey]) {
      const nextBadge = ROLE_PRESET_MAP[presetKey];
      setEditorFields((prev) => ({
        ...prev,
        role: resolveCardRoleBadge(prev, nextBadge),
      }));
      return;
    }

    if (SAMPLE_CARD_PRESETS[presetKey]) {
      setEditorFields({
        ...SAMPLE_CARD_PRESETS[presetKey],
        role: resolveCardRoleBadge(SAMPLE_CARD_PRESETS[presetKey]),
      });
    }
  };

  const handleNavigateMember = (nextIndex: number) => {
    const clamped = Math.max(0, Math.min(activeNavList.length - 1, nextIndex));
    setSelectedMemberIndex(clamped);
    const target = activeNavList[clamped];
    if (target) {
      setEditorFields(borrowerToCardMemberData(target));
    }
  };

  const handleFieldChange = (field: keyof CardMemberData, value: string) => {
    setEditorFields((prev) => ({
      ...prev,
      [field]: field === 'role' ? resolveCardRoleBadge(prev, value) : value,
    }));
  };

  const handleResetFields = () => {
    setWatermarkAlpha(6.5);
    if (selectedPresetKey.startsWith('member:')) {
      const id = selectedPresetKey.slice('member:'.length);
      const found = directoryMembers.find((m) => m.id === id);
      if (found) {
        setEditorFields(borrowerToCardMemberData(found));
        return;
      }
    }
    if (SAMPLE_CARD_PRESETS[selectedPresetKey]) {
      setEditorFields({ ...SAMPLE_CARD_PRESETS[selectedPresetKey] });
      return;
    }
    if (currentMember) {
      setEditorFields(borrowerToCardMemberData(currentMember));
    } else {
      setSelectedPresetKey('student_default');
      setEditorFields({ ...DEFAULT_STUDENT });
    }
  };

  // Single source of truth for BOTH Save as PDF and Print CR80 Card
  // Merges 100% of live editorFields for the active card and real per-member resolveCardRoleBadge(m) for batch cards
  const getCardsForOutput = (): CardMemberData[] => {
    const activeCard: CardMemberData = {
      ...editorFields,
      role: resolveCardRoleBadge(editorFields, editorFields.role),
    };

    if (selectedPresetKey === 'all_members' && activeNavList.length > 1) {
      return activeNavList.map((m, idx) =>
        idx === selectedMemberIndex
          ? activeCard
          : borrowerToCardMemberData(m)
      );
    }

    return [activeCard];
  };

  const cardsOutputCount =
    selectedPresetKey === 'all_members' && activeNavList.length > 1
      ? activeNavList.length
      : 1;

  // Handle Save as PDF (uses exact 300-DPI CR80 Master Canvas Renderer)
  const handleSaveAsPdf = async () => {
    setIsGenerating(true);
    setStatusNotification({
      type: 'info',
      message: 'Rendering 300-DPI CR80 master cards for PDF export...',
    });

    try {
      const outputCards = getCardsForOutput();
      const result = await PdfGeneratorService.generateMemberCardsPdf(
        selectedPresetKey === 'all_members' ? activeNavList : currentMember ? [currentMember] : [],
        {
          layout: cardLayout,
          side: activeSide,
          watermarkAlpha,
          cards: outputCards,
          identity,
        }
      );

      await saveJsPdfDocument(result.doc, result.filename);
      setStatusNotification({
        type: 'success',
        message: `Saved ${result.cardCount} CR80 card(s) across ${result.pageCount} page(s) to ${result.filename}`,
      });
      notifyGlassToast({
        type: 'success',
        title: 'ID Card PDF Saved',
        message: `Saved ${result.cardCount} CR80 card(s) across ${result.pageCount} page(s).`,
        meta: result.filename,
      });
    } catch (err: any) {
      setStatusNotification({
        type: 'warn',
        message: `Failed to export PDF: ${err?.message || 'Error occurred'}`,
      });
      notifyGlassToast({
        type: 'danger',
        title: 'PDF Export Failed',
        message: err?.message || 'Failed to generate CR80 ID card PDF.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Print CR80 Card (uses the EXACT SAME 300-DPI CR80 Master Canvas Renderer)
  const handlePrint = async () => {
    setIsGenerating(true);
    setStatusNotification({
      type: 'info',
      message: 'Rendering pixel-perfect 300-DPI CR80 print sheet...',
    });

    try {
      const outputCards = getCardsForOutput();
      const nativeApi =
        typeof window !== 'undefined'
          ? (window as any).desktopAPI || (window as any).electronAPI
          : null;
      const willUseIframeFallback =
        !nativeApi?.printCurrentView && isSandboxedPreviewIframe();

      const openCr80PdfFallback = async () => {
        const result = await PdfGeneratorService.generateMemberCardsPdf(
          selectedPresetKey === 'all_members' ? activeNavList : currentMember ? [currentMember] : [],
          {
            layout: cardLayout,
            side: activeSide,
            watermarkAlpha,
            cards: outputCards,
            identity,
          }
        );
        await openPrintablePdfDocument(result.doc, result.filename);
      };

      let html = '';
      let pageCss = '';
      if (!willUseIframeFallback) {
        const renderedCards: RenderedCr80CardImages[] = [];
        for (const card of outputCards) {
          const [frontUrl, backUrl] = await Promise.all([
            activeSide === 'both' || activeSide === 'front'
              ? renderCr80SideToDataUrl(card, 'front', { watermarkAlpha, identity })
              : Promise.resolve(undefined),
            activeSide === 'both' || activeSide === 'back'
              ? renderCr80SideToDataUrl(card, 'back', { watermarkAlpha, identity })
              : Promise.resolve(undefined),
          ]);
          renderedCards.push({
            memberId: card.memberId,
            name: card.name,
            frontUrl,
            backUrl,
          });
        }
        const built = buildCr80CardsPrintHtml(renderedCards, {
          layout: cardLayout,
          activeSide,
        });
        html = built.html;
        pageCss = built.pageCss;
      }

      const printRes = await printIsolatedHtml(
        `${identity.universityName} — Member ID Card (${editorFields.name})`,
        html,
        pageCss,
        openCr80PdfFallback
      );

      if (printRes.usedPdfFallback) {
        setStatusNotification({
          type: 'success',
          message: `Opened printable 300-DPI CR80 PDF for ${outputCards.length} card${
            outputCards.length === 1 ? '' : 's'
          } — press Ctrl+P to print.`,
        });
      } else if (!printRes.success && printRes.blocked) {
        setStatusNotification({
          type: 'warn',
          message:
            'Direct printing is blocked in this preview frame. Click "Save as PDF" to download and print.',
        });
        notifyGlassToast({
          type: 'warning',
          title: 'Print Frame Blocked',
          message: 'Direct printing is blocked here. Use "Save as PDF" to download and print.',
        });
      } else {
        setStatusNotification({
          type: 'success',
          message: `300-DPI CR80 print sheet dispatched for ${outputCards.length} card${
            outputCards.length === 1 ? '' : 's'
          }.`,
        });
        notifyGlassToast({
          type: 'success',
          title: 'ID Card Ready to Print',
          message: `Dispatched ${outputCards.length} CR80 card${
            outputCards.length === 1 ? '' : 's'
          } (${activeSide === 'both' ? 'Front & Back' : activeSide === 'front' ? 'Front Only' : 'Back Only'}).`,
          meta: editorFields.memberId || undefined,
        });
      }
    } catch {
      setStatusNotification({
        type: 'warn',
        message: 'Direct printing is unavailable here. Use "Save as PDF" to export your CR80 cards.',
      });
      notifyGlassToast({
        type: 'warning',
        title: 'Print Unavailable',
        message: 'Use "Save as PDF" to export your CR80 cards.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (typeof document === 'undefined') return null;

  const resolvedPreviewData: CardMemberData = {
    ...editorFields,
    role: resolveCardRoleBadge(editorFields, editorFields.role),
  };

  const isKnownBadge = (ROLE_BADGE_OPTIONS as readonly string[]).includes(resolvedPreviewData.role);

  return createPortal(
    <div
      className="ulm-modal-backdrop fixed inset-0 z-[9999] w-screen h-screen flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0 print:overflow-visible"
      onClick={onClose}
    >
      <div
        className="ulm-modal-dialog ulm-preserve-glass w-full max-w-5xl my-auto bg-gradient-to-br from-white/95 via-white/90 to-white/85 dark:from-[#1B1130]/95 dark:via-[#130B24]/95 dark:to-[#0D071A]/95 backdrop-blur-2xl backdrop-saturate-[180%] border border-white/80 dark:border-white/[0.14] rounded-[26px] shadow-[0_28px_80px_rgba(15,23,42,0.32)] dark:shadow-[0_28px_80px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col max-h-[94vh] transition-all text-slate-900 dark:text-slate-100 print:border-none print:shadow-none print:w-auto print:max-w-none print:max-h-none print:bg-white print:rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-white/70 dark:bg-white/[0.03] border-b border-slate-200/80 dark:border-white/[0.10] flex items-center justify-between gap-3 shrink-0 print:hidden no-print">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/[0.14] border border-amber-500/35 flex items-center justify-center text-amber-700 dark:text-[#FFD147] shrink-0">
              <IdCard className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-cinzel leading-tight flex items-center gap-2 flex-wrap">
                <span>ULM Smart Library ID Card Studio (CR80 ISO/IEC 7810 ID-1)</span>
                {cardsOutputCount > 1 && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-amber-500/[0.14] text-amber-800 dark:text-[#FFD147] border border-amber-500/35">
                    Batch: {cardsOutputCount} Cards
                  </span>
                )}
              </h3>
              <p className="text-[11px] font-mono text-slate-500 dark:text-[#B3AABD] truncate">
                85.60 × 53.98 mm · 300-DPI Print &amp; PDF Master · Code-128B &amp; Verification QR
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ulm-btn-tactile w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100/80 hover:bg-slate-200/80 dark:bg-white/[0.05] dark:hover:bg-white/[0.12] border border-slate-200/80 dark:border-white/[0.10] transition-colors cursor-pointer shrink-0"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Status Notification */}
        {statusNotification && (
          <div
            className={`px-6 py-2.5 border-b flex items-center justify-between text-xs shrink-0 print:hidden no-print ${
              statusNotification.type === 'warn'
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-600/30 text-amber-900 dark:text-amber-200'
                : statusNotification.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-600/30 text-emerald-900 dark:text-emerald-200'
                : 'bg-sky-50 dark:bg-blue-950/40 border-sky-200 dark:border-blue-600/30 text-sky-900 dark:text-blue-200'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {statusNotification.type === 'warn' ? (
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              ) : (
                <Info className="w-4 h-4 shrink-0" />
              )}
              <span className="truncate">{statusNotification.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusNotification(null)}
              className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer shrink-0 ml-2"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Balanced 2-Row Frosted Crystal Liquid-Glass Studio Toolbar */}
        <div className="px-5 sm:px-6 py-3 bg-gradient-to-b from-white/65 to-slate-50/75 dark:from-white/[0.04] dark:to-white/[0.015] backdrop-blur-xl border-b border-slate-200/80 dark:border-white/[0.10] space-y-2.5 shrink-0 print:hidden no-print">
          {/* Row 1: Side Switcher + Batch Navigator (left) | Field Editor Toggle (right) */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Side Selector (Both / Front / Back) */}
              <div className="inline-flex items-center gap-1 bg-slate-200/75 dark:bg-white/[0.06] p-1 rounded-xl border border-slate-300/80 dark:border-white/[0.12]">
                {(
                  [
                    { id: 'both', label: 'Both Sides' },
                    { id: 'front', label: 'Front Side' },
                    { id: 'back', label: 'Back Side' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setActiveSide(opt.id)}
                    className={`ulm-btn-tactile px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                      activeSide === opt.id
                        ? 'bg-[#BC881B] text-[#1A1A1A] shadow-xs'
                        : 'text-slate-600 dark:text-[#B3AABD] hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Batch Member Navigator when multiple members are active */}
              {selectedPresetKey === 'all_members' && activeNavList.length > 1 && (
                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-xl bg-white/80 dark:bg-white/[0.05] border border-slate-300/80 dark:border-white/[0.12] text-xs font-mono text-slate-700 dark:text-slate-200">
                  <button
                    type="button"
                    disabled={selectedMemberIndex <= 0}
                    onClick={() => handleNavigateMember(selectedMemberIndex - 1)}
                    className="p-1 rounded-lg hover:bg-slate-200/70 dark:hover:bg-white/[0.12] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    aria-label="Previous member card"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="whitespace-nowrap px-1 font-semibold">
                    {selectedMemberIndex + 1} / {activeNavList.length}
                  </span>
                  <button
                    type="button"
                    disabled={selectedMemberIndex >= activeNavList.length - 1}
                    onClick={() => handleNavigateMember(selectedMemberIndex + 1)}
                    className="p-1 rounded-lg hover:bg-slate-200/70 dark:hover:bg-white/[0.12] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    aria-label="Next member card"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Hide / Show Field Editor Toggle */}
            <button
              type="button"
              onClick={() => setShowFieldEditor((prev) => !prev)}
              className={`ulm-btn-tactile h-9 px-3.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                showFieldEditor
                  ? 'bg-purple-500/20 border-purple-400/50 text-purple-900 dark:text-purple-200'
                  : 'bg-white/85 dark:bg-white/[0.06] border-slate-300/90 dark:border-white/[0.14] text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 shrink-0" />
              <span>{showFieldEditor ? 'Hide Field Editor' : 'Show Field Editor'}</span>
            </button>
          </div>

          {/* Row 2: Balanced 2-Column Preset & Sheet Dropdowns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {/* Preset Selector */}
            <div className="flex items-center gap-2 min-w-0">
              <label
                htmlFor="ulm-card-preset-select"
                className="text-slate-600 dark:text-[#B3AABD] text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-[#FFD147] shrink-0" />
                <span>Preset:</span>
              </label>
              <select
                id="ulm-card-preset-select"
                value={selectedPresetKey}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="ulm-compact-control flex-1 min-w-0 h-9 bg-white dark:bg-[#110A20]/90 border border-slate-300/90 dark:border-white/[0.14] text-slate-900 dark:text-white text-xs rounded-xl px-3 outline-hidden focus:border-[#BC881B] cursor-pointer truncate"
              >
                <optgroup label="Active Selection & Batch">
                  {memberList[0] && (
                    <option value="selected">
                      Selected Member: {memberList[0].name} ({memberList[0].university_id || memberList[0].student_id}) — {resolveCardRoleBadge(memberList[0])}
                    </option>
                  )}
                  {directoryMembers.length > 1 && (
                    <option value="all_members">
                      All Members Batch ({directoryMembers.length} Cards — Keep Real Role Badges)
                    </option>
                  )}
                </optgroup>

                <optgroup label="Quick Role Badge Override">
                  <option value="role_faculty">Apply Role Badge: FACULTY CARD</option>
                  <option value="role_teacher">Apply Role Badge: TEACHER CARD</option>
                  <option value="role_staff">Apply Role Badge: STAFF CARD</option>
                  <option value="role_student">Apply Role Badge: STUDENT CARD</option>
                  <option value="role_scholar">Apply Role Badge: RESEARCH SCHOLAR</option>
                </optgroup>

                {directoryMembers.length > 0 && (
                  <optgroup label={`Registered Members (${directoryMembers.length})`}>
                    {directoryMembers.slice(0, 100).map((m) => (
                      <option key={m.id} value={`member:${m.id}`}>
                        {m.name} ({m.university_id || m.student_id}) · {resolveCardRoleBadge(m)}
                      </option>
                    ))}
                  </optgroup>
                )}

                <optgroup label="Sample Card Templates">
                  <option value="student_default">Sample Student: Asad Zeb (BSCS-23-42)</option>
                  <option value="faculty_sample">Sample Faculty: Dr. Kamran Ullah Marwat</option>
                  <option value="teacher_sample">Sample Teacher: Prof. Rehmat Ullah Khan</option>
                  <option value="staff_sample">Sample Staff: Tariq Mahmood Khan</option>
                  <option value="scholar_sample">Sample Research Scholar: Ayesha Gul Marwat</option>
                </optgroup>
              </select>
            </div>

            {/* Print / PDF Sheet Layout Selector */}
            <div className="flex items-center gap-2 min-w-0">
              <label
                htmlFor="ulm-card-sheet-select"
                className="text-slate-600 dark:text-[#B3AABD] text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <Layers className="w-3.5 h-3.5 text-amber-600 dark:text-[#FFD147] shrink-0" />
                <span>Sheet:</span>
              </label>
              <select
                id="ulm-card-sheet-select"
                value={cardLayout}
                onChange={(e) => setCardLayout(e.target.value as CardPdfLayout)}
                className="ulm-compact-control flex-1 min-w-0 h-9 bg-white dark:bg-[#110A20]/90 border border-slate-300/90 dark:border-white/[0.14] text-slate-900 dark:text-white text-xs rounded-xl px-3 outline-hidden focus:border-[#BC881B] cursor-pointer truncate"
              >
                <option value="cr80_single">Exact CR80 Pages (85.60 × 53.98 mm)</option>
                <option value="a4_sheet_10">A4 Sheet (Front + Back Side-by-Side · Cut Marks)</option>
                <option value="a4_duplex">Double-Sided A4 (Fronts p1 · Mirrored Backs p2)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Scrollable Body: Interactive Card Preview + Single Live Field Editor */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-900/[0.025] dark:bg-black/20 space-y-5 print:p-0 print:bg-white print:overflow-visible">
          {/* Interactive CR80 Card Preview */}
          <div className="flex flex-col items-center justify-center space-y-3 print:space-y-0">
            <div className="p-4 sm:p-5 rounded-2xl bg-white/65 dark:bg-white/[0.03] border border-slate-200/85 dark:border-white/[0.10] shadow-inner flex items-center justify-center overflow-x-auto max-w-full ulm-preserve-dark print:p-0 print:bg-transparent print:border-none print:shadow-none">
              <UlmSmartIdCard
                data={resolvedPreviewData}
                crestUrl={ULM_OFFICIAL_CREST_SRC}
                watermarkAlpha={watermarkAlpha}
                side={activeSide}
              />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5 text-[11px] text-slate-600 dark:text-[#B3AABD] font-mono print:hidden no-print">
              <span>ISO/IEC 7810 ID-1 (85.60 × 53.98 mm)</span>
              <span>•</span>
              <span>Badge: <strong className="text-purple-800 dark:text-purple-300">{resolvedPreviewData.role}</strong></span>
              <span>•</span>
              {(() => {
                const liveStanding = resolveMemberCardStanding(resolvedPreviewData, resolvedPreviewData.validTill);
                return (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-sans font-extrabold uppercase tracking-wider"
                    style={{
                      backgroundColor: liveStanding.bgColor,
                      border: `1px solid ${liveStanding.borderColor}`,
                      color: liveStanding.textColor,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: liveStanding.dotColor }}
                    />
                    <span>{liveStanding.label}</span>
                  </span>
                );
              })()}
              <span>•</span>
              <span>Watermark: {watermarkAlpha.toFixed(1)}%</span>
              <span>•</span>
              <span className="text-amber-800 dark:text-[#FFD147] font-bold">
                {resolvedPreviewData.name} ({resolvedPreviewData.memberId})
              </span>
            </div>
          </div>

          {/* Single Live Card Field Editor Panel (Cleanly toggled by showFieldEditor) */}
          {showFieldEditor && (
            <div className="ulm-stagger-card rounded-[20px] bg-white/75 dark:bg-white/[0.035] border border-slate-200/85 dark:border-white/[0.12] p-4 sm:p-5 space-y-4 print:hidden no-print">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200/80 dark:border-white/[0.10]">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-600 dark:text-[#FFD147]" />
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Live Card Field Editor &amp; Watermark Calibration
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={handleResetFields}
                  className="ulm-btn-tactile px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.07] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/[0.12] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Fields</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-end text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5">
                    Borrower Full Name
                  </label>
                  <input
                    type="text"
                    value={editorFields.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    className="ulm-compact-control w-full h-10 px-3 rounded-xl bg-white dark:bg-[#110A20]/85 border border-slate-300/90 dark:border-white/[0.14] text-slate-900 dark:text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5">
                    Card Role Badge
                  </label>
                  <select
                    value={resolvedPreviewData.role}
                    onChange={(e) => handleFieldChange('role', e.target.value)}
                    className="ulm-compact-control w-full h-10 px-3 rounded-xl bg-white dark:bg-[#110A20]/85 border border-slate-300/90 dark:border-white/[0.14] text-slate-900 dark:text-white text-xs cursor-pointer"
                  >
                    {ROLE_BADGE_OPTIONS.map((badge) => (
                      <option key={badge} value={badge}>
                        {badge}
                      </option>
                    ))}
                    {!isKnownBadge && (
                      <option value={resolvedPreviewData.role}>{resolvedPreviewData.role}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5">
                    Member ID / Barcode
                  </label>
                  <input
                    type="text"
                    value={editorFields.memberId}
                    onChange={(e) => handleFieldChange('memberId', e.target.value.toUpperCase())}
                    className="ulm-compact-control w-full h-10 px-3 rounded-xl bg-white dark:bg-[#110A20]/85 border border-slate-300/90 dark:border-white/[0.14] text-slate-900 dark:text-white font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5">
                    Roll No / Reg ID
                  </label>
                  <input
                    type="text"
                    value={editorFields.rollNo}
                    onChange={(e) => handleFieldChange('rollNo', e.target.value)}
                    className="ulm-compact-control w-full h-10 px-3 rounded-xl bg-white dark:bg-[#110A20]/85 border border-slate-300/90 dark:border-white/[0.14] text-slate-900 dark:text-white font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5">
                    Academic Session
                  </label>
                  <input
                    type="text"
                    value={editorFields.session}
                    onChange={(e) => handleFieldChange('session', e.target.value)}
                    className="ulm-compact-control w-full h-10 px-3 rounded-xl bg-white dark:bg-[#110A20]/85 border border-slate-300/90 dark:border-white/[0.14] text-slate-900 dark:text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5">
                    Program / Designation
                  </label>
                  <input
                    type="text"
                    value={editorFields.program}
                    onChange={(e) => handleFieldChange('program', e.target.value)}
                    className="ulm-compact-control w-full h-10 px-3 rounded-xl bg-white dark:bg-[#110A20]/85 border border-slate-300/90 dark:border-white/[0.14] text-slate-900 dark:text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5">
                    Department
                  </label>
                  <input
                    type="text"
                    value={editorFields.department}
                    onChange={(e) => handleFieldChange('department', e.target.value)}
                    className="ulm-compact-control w-full h-10 px-3 rounded-xl bg-white dark:bg-[#110A20]/85 border border-slate-300/90 dark:border-white/[0.14] text-slate-900 dark:text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5">
                    Blood Group
                  </label>
                  <input
                    type="text"
                    value={editorFields.bloodGroup}
                    onChange={(e) => handleFieldChange('bloodGroup', e.target.value.toUpperCase())}
                    className="ulm-compact-control w-full h-10 px-3 rounded-xl bg-white dark:bg-[#110A20]/85 border border-slate-300/90 dark:border-white/[0.14] text-slate-900 dark:text-white font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5">
                    Borrowing Limit
                  </label>
                  <input
                    type="text"
                    value={editorFields.borrowingLimit}
                    onChange={(e) => handleFieldChange('borrowingLimit', e.target.value)}
                    className="ulm-compact-control w-full h-10 px-3 rounded-xl bg-white dark:bg-[#110A20]/85 border border-slate-300/90 dark:border-white/[0.14] text-slate-900 dark:text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5">
                    Holder Contact Phone
                  </label>
                  <input
                    type="text"
                    value={editorFields.phone}
                    onChange={(e) => handleFieldChange('phone', e.target.value)}
                    className="ulm-compact-control w-full h-10 px-3 rounded-xl bg-white dark:bg-[#110A20]/85 border border-slate-300/90 dark:border-white/[0.14] text-slate-900 dark:text-white font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5">
                    Valid Till
                  </label>
                  <input
                    type="text"
                    value={editorFields.validTill}
                    onChange={(e) => handleFieldChange('validTill', e.target.value.toUpperCase())}
                    className="ulm-compact-control w-full h-10 px-3 rounded-xl bg-white dark:bg-[#110A20]/85 border border-slate-300/90 dark:border-white/[0.14] text-slate-900 dark:text-white font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5">
                    Watermark Alpha ({watermarkAlpha.toFixed(1)}%)
                  </label>
                  <div className="flex items-center gap-2 h-10">
                    <input
                      type="range"
                      min={2}
                      max={15}
                      step={0.5}
                      value={watermarkAlpha}
                      onChange={(e) => setWatermarkAlpha(parseFloat(e.target.value) || 6.5)}
                      className="flex-1 accent-amber-500 cursor-pointer"
                    />
                    <span className="font-mono text-xs text-amber-800 dark:text-[#FFD147] font-bold w-12 text-right">
                      {watermarkAlpha.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-white/80 dark:bg-white/[0.03] border-t border-slate-200/80 dark:border-white/[0.10] flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden no-print">
          <span className="text-xs text-slate-600 dark:text-[#B3AABD] font-mono">
            Output:{' '}
            <strong className="text-emerald-700 dark:text-emerald-400">
              {cardsOutputCount > 1 ? `${cardsOutputCount} Cards (Batch)` : resolvedPreviewData.name}
            </strong>{' '}
            ·{' '}
            <span className="text-amber-800 dark:text-[#FFD147] font-semibold">
              {resolvedPreviewData.role}
            </span>
          </span>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="ulm-btn-tactile h-9 px-4 rounded-xl bg-slate-200/85 hover:bg-slate-300/85 dark:bg-white/[0.07] dark:hover:bg-white/[0.13] text-slate-800 dark:text-slate-100 border border-slate-300/80 dark:border-white/[0.14] text-xs font-semibold transition-colors cursor-pointer"
            >
              Close
            </button>

            {/* Save as PDF Button */}
            <button
              type="button"
              disabled={isGenerating}
              onClick={handleSaveAsPdf}
              className="ulm-btn-tactile h-9 px-4 rounded-xl bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:brightness-110 text-[#1A1A1A] font-bold text-xs inline-flex items-center gap-1.5 shadow-md border border-[#FFD147]/50 transition-all cursor-pointer whitespace-nowrap disabled:opacity-60"
              title="Save exact 300-DPI CR80 PDF matching the live preview"
            >
              {isGenerating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5" />
              )}
              <span>Save as PDF</span>
            </button>

            {/* Direct Print Button */}
            <button
              type="button"
              disabled={isGenerating}
              onClick={handlePrint}
              className="ulm-btn-tactile h-9 px-4 rounded-xl bg-gradient-to-r from-[#541A72] to-[#6B21A8] hover:brightness-110 !text-white font-bold text-xs inline-flex items-center gap-1.5 border border-[#FFD147]/45 shadow-md transition-all cursor-pointer whitespace-nowrap disabled:opacity-60"
            >
              {isGenerating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FFD147]" />
              ) : (
                <Printer className="w-3.5 h-3.5 text-[#FFD147]" />
              )}
              <span className="!text-white">Print CR80 Card</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MemberCardPrintModal;
