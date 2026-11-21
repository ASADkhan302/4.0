import React, { useState, useEffect } from 'react';
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
} from '../library/UlmSmartIdCard';
import { ULM_OFFICIAL_CREST_SRC } from '../../constants/ulmOfficialAssets';
import { PdfGeneratorService, CardPdfLayout } from '../../services/pdfGeneratorService';

interface MemberCardPrintModalProps {
  borrower: Borrower | null;
  members?: Borrower[];
  isOpen: boolean;
  onClose: () => void;
}

export const MemberCardPrintModal: React.FC<MemberCardPrintModalProps> = ({
  borrower,
  members: passedMembers,
  isOpen,
  onClose,
}) => {
  const [activeSide, setActiveSide] = useState<'both' | 'front' | 'back'>('both');
  const [cardLayout, setCardLayout] = useState<CardPdfLayout>('cr80_single');
  const [selectedMemberIndex, setSelectedMemberIndex] = useState<number>(0);
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>('member');
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(true);
  const [watermarkAlpha, setWatermarkAlpha] = useState<number>(6.5);
  const [editableData, setEditableData] = useState<CardMemberData>(DEFAULT_STUDENT);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [statusNotification, setStatusNotification] = useState<{
    type: 'info' | 'success' | 'warn';
    message: string;
  } | null>(null);

  // Combine passed members or single borrower
  const memberList: Borrower[] = React.useMemo(() => {
    if (passedMembers && passedMembers.length > 0) return passedMembers;
    if (borrower) return [borrower];
    return [];
  }, [passedMembers, borrower]);

  const currentMember = memberList[selectedMemberIndex] || memberList[0] || null;

  useEffect(() => {
    if (!isOpen) return;
    setSelectedMemberIndex(0);
    setSelectedPresetKey(currentMember ? 'member' : 'student_default');
    setEditableData(currentMember ? borrowerToCardMemberData(currentMember) : DEFAULT_STUDENT);
    setStatusNotification(null);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (selectedPresetKey === 'member' && currentMember) {
      setEditableData(borrowerToCardMemberData(currentMember));
    }
  }, [selectedMemberIndex, currentMember, selectedPresetKey]);

  if (!isOpen) return null;

  const handlePresetChange = (presetKey: string) => {
    setSelectedPresetKey(presetKey);
    if (presetKey === 'member' && currentMember) {
      setEditableData(borrowerToCardMemberData(currentMember));
    } else if (SAMPLE_CARD_PRESETS[presetKey]) {
      setEditableData({ ...SAMPLE_CARD_PRESETS[presetKey] });
    }
  };

  const handleFieldChange = (field: keyof CardMemberData, value: string) => {
    setEditableData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleResetFields = () => {
    setWatermarkAlpha(6.5);
    if (currentMember) {
      setSelectedPresetKey('member');
      setEditableData(borrowerToCardMemberData(currentMember));
    } else {
      setSelectedPresetKey('student_default');
      setEditableData({ ...DEFAULT_STUDENT });
    }
  };

  // Convert current editableData back to a Borrower object for batch/single PDF export
  const buildEffectiveMembersForPdf = (): Borrower[] => {
    if (memberList.length > 1 && selectedPresetKey === 'member') {
      return memberList.map((m, idx) =>
        idx === selectedMemberIndex
          ? {
              ...m,
              name: editableData.name,
              university_id: editableData.memberId,
              barcode: editableData.memberId,
              roll_number: editableData.rollNo,
              session: editableData.session,
              program: editableData.program,
              department: editableData.department,
              blood_group: editableData.bloodGroup,
              phone: editableData.phone,
              valid_until: editableData.validTill,
              photo_url: editableData.photoUrl,
            }
          : m
      );
    }

    const base: Borrower = currentMember || {
      id: 'preset-card',
      student_id: editableData.memberId,
      university_id: editableData.memberId,
      barcode: editableData.memberId,
      name: editableData.name,
      role:
        editableData.role === 'FACULTY CARD'
          ? 'Faculty'
          : editableData.role === 'STAFF CARD'
          ? 'Staff'
          : 'Student',
      department: editableData.department,
      program: editableData.program,
      session: editableData.session,
      roll_number: editableData.rollNo,
      blood_group: editableData.bloodGroup,
      phone: editableData.phone,
      email: '',
      status: 'active',
      borrow_limit: parseInt(editableData.borrowingLimit, 10) || 3,
      valid_until: editableData.validTill,
      joined_date: new Date().toISOString().slice(0, 10),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true,
    };

    return [
      {
        ...base,
        name: editableData.name,
        university_id: editableData.memberId,
        barcode: editableData.memberId,
        roll_number: editableData.rollNo,
        session: editableData.session,
        program: editableData.program,
        department: editableData.department,
        blood_group: editableData.bloodGroup,
        phone: editableData.phone,
        valid_until: editableData.validTill,
        photo_url: editableData.photoUrl,
      },
    ];
  };

  // Handle Save as PDF
  const handleSaveAsPdf = async () => {
    setIsGeneratingPdf(true);
    setStatusNotification({ type: 'info', message: 'Generating exact physical CR80 PDF...' });

    try {
      const targetMembers = buildEffectiveMembersForPdf();
      const result = await PdfGeneratorService.generateMemberCardsPdf(targetMembers, {
        layout: cardLayout,
      });

      PdfGeneratorService.downloadPdf(result.doc, result.filename);
      setStatusNotification({
        type: 'success',
        message: `Saved ${result.cardCount} CR80 card(s) across ${result.pageCount} page(s) to ${result.filename}`,
      });
    } catch (err: any) {
      setStatusNotification({
        type: 'warn',
        message: `Failed to export PDF: ${err.message || 'Error occurred'}`,
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Handle Direct Browser Print (@media print) + PDF fallback
  const handlePrint = async () => {
    try {
      window.print();
      setStatusNotification({
        type: 'success',
        message: 'CR80 print sheet dispatched. Use "Save as PDF" if your preview environment blocks direct printing.',
      });
    } catch {
      setIsGeneratingPdf(true);
      try {
        const targetMembers = buildEffectiveMembersForPdf();
        const result = await PdfGeneratorService.generateMemberCardsPdf(targetMembers, {
          layout: cardLayout,
        });
        const blob = result.doc.output('blob');
        await PdfGeneratorService.printPdfBlob(blob);
      } finally {
        setIsGeneratingPdf(false);
      }
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] w-screen h-screen flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0 print:overflow-visible"
      onClick={onClose}
    >
      <div
        className="ulm-preserve-glass w-full max-w-5xl my-auto bg-gradient-to-br from-white/95 via-white/90 to-white/85 dark:from-[#1B1130]/95 dark:via-[#130B24]/95 dark:to-[#0D071A]/95 backdrop-blur-2xl backdrop-saturate-[180%] border border-white/80 dark:border-white/[0.14] rounded-[26px] shadow-[0_28px_80px_rgba(15,23,42,0.32)] dark:shadow-[0_28px_80px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col max-h-[94vh] transition-all text-slate-900 dark:text-slate-100 print:border-none print:shadow-none print:w-auto print:max-w-none print:max-h-none print:bg-white print:rounded-none"
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
                {memberList.length > 1 && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-amber-500/[0.14] text-amber-800 dark:text-[#FFD147] border border-amber-500/35">
                    {memberList.length} Cards Selected
                  </span>
                )}
              </h3>
              <p className="text-[11px] font-mono text-slate-500 dark:text-[#B3AABD] truncate">
                85.60 mm × 53.98 mm · Pre-Baked 6.5% RGBA Watermark · Code-128 &amp; Verification QR
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100/80 hover:bg-slate-200/80 dark:bg-white/[0.05] dark:hover:bg-white/[0.12] border border-slate-200/80 dark:border-white/[0.10] transition-colors cursor-pointer shrink-0"
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
            <div className="flex items-center gap-2">
              {statusNotification.type === 'warn' ? (
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              ) : (
                <Info className="w-4 h-4 shrink-0" />
              )}
              <span>{statusNotification.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusNotification(null)}
              className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Toolbar Controls */}
        <div className="px-6 py-3 bg-slate-50/75 dark:bg-white/[0.025] border-b border-slate-200/80 dark:border-white/[0.10] flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden no-print">
          {/* Side Selector (Both / Front / Back) */}
          <div className="flex items-center gap-1 bg-slate-200/75 dark:bg-white/[0.05] p-1 rounded-xl border border-slate-300/80 dark:border-white/[0.12]">
            <button
              type="button"
              onClick={() => setActiveSide('both')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeSide === 'both'
                  ? 'bg-[#BC881B] text-[#1A1A1A] shadow-xs'
                  : 'text-slate-600 dark:text-[#B3AABD] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Both Sides
            </button>
            <button
              type="button"
              onClick={() => setActiveSide('front')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeSide === 'front'
                  ? 'bg-[#BC881B] text-[#1A1A1A] shadow-xs'
                  : 'text-slate-600 dark:text-[#B3AABD] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Front Side
            </button>
            <button
              type="button"
              onClick={() => setActiveSide('back')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeSide === 'back'
                  ? 'bg-[#BC881B] text-[#1A1A1A] shadow-xs'
                  : 'text-slate-600 dark:text-[#B3AABD] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Back Side
            </button>
          </div>

          {/* Sample Presets Selector */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-600 dark:text-[#B3AABD] text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-[#FFD147] shrink-0" />
              Preset:
            </span>
            <select
              value={selectedPresetKey}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="ulm-compact-control ulm-inline-select h-9 w-auto bg-white dark:bg-[#110A20]/90 border border-slate-300/90 dark:border-white/[0.14] text-slate-900 dark:text-white text-xs rounded-xl px-3 outline-hidden focus:border-[#BC881B] cursor-pointer"
            >
              {currentMember && (
                <option value="member">
                  Selected Member: {currentMember.name} ({currentMember.university_id || currentMember.student_id})
                </option>
              )}
              <option value="student_default">Sample Student: Asad Zeb (BSCS-23-42)</option>
              <option value="faculty_sample">Sample Faculty: Dr. Rehmat Ullah (Physics)</option>
              <option value="staff_sample">Sample Staff: Muhammad Irfan (Admin)</option>
              <option value="scholar_sample">Sample Research Scholar: Sana Ullah Marwat</option>
            </select>
          </div>

          {/* Print / PDF Layout Option */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-600 dark:text-[#B3AABD] text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap">
              <Layers className="w-3.5 h-3.5 text-amber-600 dark:text-[#FFD147] shrink-0" />
              Sheet:
            </span>
            <select
              value={cardLayout}
              onChange={(e) => setCardLayout(e.target.value as CardPdfLayout)}
              className="ulm-compact-control ulm-inline-select h-9 w-auto bg-white dark:bg-[#110A20]/90 border border-slate-300/90 dark:border-white/[0.14] text-slate-900 dark:text-white text-xs rounded-xl px-3 outline-hidden focus:border-[#BC881B] cursor-pointer"
            >
              <option value="cr80_single">Exact CR80 Pages (85.60 × 53.98 mm)</option>
              <option value="a4_sheet_10">A4 Sheet (10 Cards: 2 × 5 with Crop Marks)</option>
              <option value="a4_duplex">Double-Sided A4 (Fronts on p1, Mirrored Backs on p2)</option>
            </select>
          </div>

          {/* Toggle Live Field Editor & Member Navigator */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditorOpen(!isEditorOpen)}
              className={`h-9 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                isEditorOpen
                  ? 'bg-purple-500/20 border-purple-400/50 text-purple-900 dark:text-purple-200'
                  : 'bg-white/85 dark:bg-white/[0.06] border-slate-300/90 dark:border-white/[0.14] text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{isEditorOpen ? 'Hide Field Editor' : 'Live Field Editor'}</span>
            </button>

            {memberList.length > 1 && (
              <div className="flex items-center gap-1.5 text-xs font-mono text-slate-700 dark:text-slate-200">
                <button
                  type="button"
                  disabled={selectedMemberIndex <= 0}
                  onClick={() => {
                    setSelectedPresetKey('member');
                    setSelectedMemberIndex((idx) => Math.max(0, idx - 1));
                  }}
                  className="p-1.5 rounded-lg bg-white/85 dark:bg-white/[0.06] border border-slate-300/80 dark:border-white/[0.12] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-white/[0.12] cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="whitespace-nowrap">
                  {selectedMemberIndex + 1} / {memberList.length}
                </span>
                <button
                  type="button"
                  disabled={selectedMemberIndex >= memberList.length - 1}
                  onClick={() => {
                    setSelectedPresetKey('member');
                    setSelectedMemberIndex((idx) => Math.min(memberList.length - 1, idx + 1));
                  }}
                  className="p-1.5 rounded-lg bg-white/85 dark:bg-white/[0.06] border border-slate-300/80 dark:border-white/[0.12] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-white/[0.12] cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Body: Interactive Card Preview + Live Field Editor */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-900/[0.025] dark:bg-black/20 space-y-6 print:p-0 print:bg-white print:overflow-visible">
          {/* Interactive CR80 Card Preview (Also serves as @media print target) */}
          <div className="flex flex-col items-center justify-center space-y-3 print:space-y-0">
            <div className="p-4 sm:p-5 rounded-2xl bg-white/65 dark:bg-white/[0.03] border border-slate-200/85 dark:border-white/[0.10] shadow-inner flex items-center justify-center overflow-x-auto max-w-full ulm-preserve-dark print:p-0 print:bg-transparent print:border-none print:shadow-none">
              <UlmSmartIdCard
                data={editableData}
                crestUrl={ULM_OFFICIAL_CREST_SRC}
                watermarkAlpha={watermarkAlpha}
                side={activeSide}
              />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-600 dark:text-[#B3AABD] font-mono print:hidden no-print">
              <span>ISO/IEC 7810 ID-1 (CR80: 85.60 × 53.98 mm)</span>
              <span>•</span>
              <span>Pre-Baked Canvas Watermark: {watermarkAlpha.toFixed(1)}% Alpha</span>
              <span>•</span>
              <span className="text-amber-800 dark:text-[#FFD147] font-bold">
                {editableData.name} ({editableData.memberId})
              </span>
            </div>
          </div>

          {/* Live Field Editor Panel */}
          {isEditorOpen && (
            <div className="rounded-[20px] bg-white/75 dark:bg-white/[0.035] border border-slate-200/85 dark:border-white/[0.12] p-4 sm:p-5 space-y-4 print:hidden no-print">
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
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.07] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/[0.12] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
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
                    value={editableData.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    className="ulm-compact-control w-full h-10 px-3 rounded-xl bg-white dark:bg-[#110A20]/85 border border-slate-300/90 dark:border-white/[0.14] text-slate-900 dark:text-white text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5">
                    Card Role Badge
                  </label>
                  <select
                    value={editableData.role}
                    onChange={(e) =>
                      handleFieldChange('role', e.target.value as CardMemberData['role'])
                    }
                    className="ulm-compact-control w-full h-10 px-3 rounded-xl bg-white dark:bg-[#110A20]/85 border border-slate-300/90 dark:border-white/[0.14] text-slate-900 dark:text-white text-xs"
                  >
                    <option value="STUDENT CARD">STUDENT CARD</option>
                    <option value="FACULTY CARD">FACULTY CARD</option>
                    <option value="STAFF CARD">STAFF CARD</option>
                    <option value="RESEARCH SCHOLAR">RESEARCH SCHOLAR</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5">
                    Member ID / Barcode
                  </label>
                  <input
                    type="text"
                    value={editableData.memberId}
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
                    value={editableData.rollNo}
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
                    value={editableData.session}
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
                    value={editableData.program}
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
                    value={editableData.department}
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
                    value={editableData.bloodGroup}
                    onChange={(e) => handleFieldChange('bloodGroup', e.target.value)}
                    className="ulm-compact-control w-full h-10 px-3 rounded-xl bg-white dark:bg-[#110A20]/85 border border-slate-300/90 dark:border-white/[0.14] text-slate-900 dark:text-white font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5">
                    Borrowing Limit
                  </label>
                  <input
                    type="text"
                    value={editableData.borrowingLimit}
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
                    value={editableData.phone}
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
                    value={editableData.validTill}
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
            Active Card: <strong className="text-emerald-700 dark:text-emerald-400">{editableData.name}</strong> ·{' '}
            <span className="text-amber-800 dark:text-[#FFD147] font-semibold">{editableData.memberId}</span>
          </span>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-xl bg-slate-200/85 hover:bg-slate-300/85 dark:bg-white/[0.07] dark:hover:bg-white/[0.13] text-slate-800 dark:text-slate-100 border border-slate-300/80 dark:border-white/[0.14] text-xs font-semibold transition-colors cursor-pointer"
            >
              Close
            </button>

            {/* Save as PDF Button */}
            <button
              type="button"
              disabled={isGeneratingPdf}
              onClick={handleSaveAsPdf}
              className="h-9 px-4 rounded-xl bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:brightness-110 text-[#1A1A1A] font-bold text-xs flex items-center gap-1.5 shadow-md border border-[#FFD147]/50 transition-all cursor-pointer whitespace-nowrap"
              title="Save exact physical PDF with crop marks or CR80 dimensions"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5" />
              )}
              <span>Save as PDF</span>
            </button>

            {/* Direct Print Button */}
            <button
              type="button"
              disabled={isGeneratingPdf}
              onClick={handlePrint}
              className="h-9 px-4 rounded-xl bg-gradient-to-r from-[#541A72] to-[#6B21A8] hover:brightness-110 !text-white font-bold text-xs flex items-center gap-1.5 border border-[#FFD147]/45 shadow-md transition-all cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5 text-[#FFD147]" />
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
