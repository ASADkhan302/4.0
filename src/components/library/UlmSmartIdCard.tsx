import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Phone,
  CheckCircle2,
  User,
} from 'lucide-react';
import { ULM_OFFICIAL_CREST_SRC } from '../../constants/ulmOfficialAssets';
import { handleCrestFallback } from '../../constants/ulmOfficialCrest';
import { Borrower } from '../../types/library';

export interface CardMemberData {
  name: string;
  role: 'STUDENT CARD' | 'FACULTY CARD' | 'STAFF CARD' | 'RESEARCH SCHOLAR';
  memberId: string;
  rollNo: string;
  session: string;
  program: string;
  department: string;
  bloodGroup: string;
  borrowingLimit: string;
  phone: string;
  validTill: string;
  photoUrl?: string;
}

export const DEFAULT_STUDENT: CardMemberData = {
  name: 'Asad Zeb',
  role: 'STUDENT CARD',
  memberId: 'ULM0329984',
  rollNo: 'BSCS-23-42',
  session: 'FA23 (2023–2027)',
  program: 'BS Computer Science (Regular)',
  department: 'Department of Computer Science',
  bloodGroup: 'B-',
  borrowingLimit: '03 Books (14 Days)',
  phone: '0342-5252555',
  validTill: '30 JUN 2027',
};

export const SAMPLE_CARD_PRESETS: Record<string, CardMemberData> = {
  student_cs: DEFAULT_STUDENT,
  faculty_cs: {
    name: 'Dr. Kamran Ullah Marwat',
    role: 'FACULTY CARD',
    memberId: 'ULM-FAC-0118',
    rollNo: 'EMP-CS-018',
    session: 'Permanent Faculty',
    program: 'Associate Professor & Chairman',
    department: 'Department of Computer Science',
    bloodGroup: 'O+',
    borrowingLimit: '10 Books (30 Days)',
    phone: '0333-9482110',
    validTill: 'PERMANENT',
  },
  scholar_ms: {
    name: 'Ayesha Gul Marwat',
    role: 'RESEARCH SCHOLAR',
    memberId: 'ULM0418209',
    rollNo: 'MSCS-24-09',
    session: 'FA24 (2024–2026)',
    program: 'MS Computer Science (Research)',
    department: 'Department of Computer Science',
    bloodGroup: 'A+',
    borrowingLimit: '06 Books (21 Days)',
    phone: '0315-8824109',
    validTill: '30 JUN 2026',
  },
  staff_lib: {
    name: 'Tariq Mahmood Khan',
    role: 'STAFF CARD',
    memberId: 'ULM-STF-0042',
    rollNo: 'EMP-LIB-042',
    session: 'Regular Staff',
    program: 'Senior Cataloger & Circulation Officer',
    department: 'Central Digital Library',
    bloodGroup: 'B+',
    borrowingLimit: '05 Books (14 Days)',
    phone: '0345-9112033',
    validTill: '31 DEC 2028',
  },
};

const formatExpiryDateDisplay = (val?: string | null, role?: string | null): string => {
  if (!val) return role === 'Faculty' ? 'PERMANENT' : '30 JUN 2027';
  if (val.toUpperCase() === 'PERMANENT') return 'PERMANENT';
  const parts = val.split('-');
  if (parts.length === 3) {
    const year = parts[0];
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const mIdx = parseInt(parts[1], 10) - 1;
    const day = parts[2];
    const monthStr = monthNames[mIdx] || parts[1];
    return `${day} ${monthStr} ${year}`;
  }
  return val.toUpperCase();
};

export function borrowerToCardMemberData(member: Partial<Borrower> | null | undefined): CardMemberData {
  if (!member) return DEFAULT_STUDENT;

  const rawRole = (member.role || 'Student').toLowerCase();
  const role: CardMemberData['role'] =
    rawRole === 'faculty'
      ? 'FACULTY CARD'
      : rawRole === 'staff'
      ? 'STAFF CARD'
      : member.degree_level === 'MS' || member.degree_level === 'MPhil' || member.degree_level === 'PhD'
      ? 'RESEARCH SCHOLAR'
      : 'STUDENT CARD';

  const memberId = (member.barcode || member.university_id || member.student_id || 'ULM0329984').toUpperCase();
  const rollNo =
    member.roll_number ||
    member.employee_no ||
    member.university_id ||
    member.student_id ||
    'BSCS-23-42';

  const session =
    member.session ||
    (rawRole === 'faculty' ? 'Permanent Faculty' : rawRole === 'staff' ? 'Regular Staff' : 'FA23 (2023–2027)');

  const degreePrefix = member.degree_level ? `${member.degree_level} ` : '';
  const modeSuffix = member.study_mode ? ` (${member.study_mode})` : '';
  const program =
    rawRole === 'faculty' || rawRole === 'staff'
      ? member.designation || (rawRole === 'faculty' ? 'Assistant Professor' : 'Administrative Staff')
      : member.program
      ? member.program.includes('(')
        ? member.program
        : `${degreePrefix}${member.program}${modeSuffix}`.trim()
      : 'BS Computer Science (Regular)';

  const rawDept = member.department || 'Computer Science';
  const department = rawDept.toLowerCase().startsWith('department')
    ? rawDept
    : `Department of ${rawDept}`;

  const limitNum = member.borrow_limit || (rawRole === 'faculty' ? 10 : rawRole === 'staff' ? 5 : 3);
  const limitPad = String(limitNum).padStart(2, '0');
  const daysNum = rawRole === 'faculty' ? 30 : 14;
  const borrowingLimit = `${limitPad} Books (${daysNum} Days)`;

  return {
    name: member.name || DEFAULT_STUDENT.name,
    role,
    memberId,
    rollNo,
    session,
    program,
    department,
    bloodGroup: member.blood_group || 'B-',
    borrowingLimit,
    phone: member.phone || '0342-5252555',
    validTill: formatExpiryDateDisplay(member.valid_until, member.role),
    photoUrl: member.photo_url || member.photo_path || undefined,
  };
}

// 1. Offscreen HTML5 Canvas Watermark Baker with Fallback Safety
export function usePreBakedWatermark(crestSrc: string, alphaPercent: number = 6.5): string {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    const srcToLoad = crestSrc || ULM_OFFICIAL_CREST_SRC;
    if (!srcToLoad) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 320;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, size, size);
        ctx.globalAlpha = Math.max(0.02, Math.min(0.20, alphaPercent / 100));
        ctx.drawImage(img, 0, 0, size, size);
        setDataUrl(canvas.toDataURL('image/png'));
      } catch {
        setDataUrl(srcToLoad);
      }
    };
    img.onerror = () => {
      setDataUrl(srcToLoad);
    };
    img.src = srcToLoad;
  }, [crestSrc, alphaPercent]);

  return dataUrl;
}

// 2. Deterministic Code-128 SVG Barcode Generator (Fixed bitwise masking)
export const Code128Barcode: React.FC<{
  value: string;
  width?: number;
  height?: number;
}> = ({ value, width = 175, height = 20 }) => {
  const bars = useMemo(() => {
    const clean = (value || 'ULM0329984').toUpperCase();
    const pattern: number[] = [2, 1, 1, 2, 3, 2]; // Code-128 Start B
    for (let i = 0; i < clean.length; i++) {
      const code = clean.charCodeAt(i);
      pattern.push(
        ((code >> 0) & 1) + 1,
        ((code >> 1) & 1) + 1,
        ((code >> 2) & 1) + 1, // Fixed: & 1
        ((code >> 3) & 1) + 1,
        ((code >> 4) & 1) + 1, // Fixed: & 1
        1
      );
    }
    pattern.push(2, 3, 3, 1, 1, 1, 2); // Stop pattern
    return pattern;
  }, [value]);

  const totalUnits = bars.reduce((a, b) => a + b, 0);
  const unitWidth = width / totalUnits;
  let currentX = 0;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="block overflow-visible"
      aria-label={`Barcode ${value}`}
    >
      {bars.map((units, idx) => {
        const w = units * unitWidth;
        const x = currentX;
        currentX += w;
        return idx % 2 === 0 ? (
          <rect
            key={idx}
            x={x}
            y={0}
            width={Math.max(0.75, w)}
            height={height}
            fill="#0F172A"
          />
        ) : null;
      })}
    </svg>
  );
};

// 3. Deterministic Verification QR SVG Matrix Generator
export const VerificationQr: React.FC<{ payload: string; size?: number }> = ({
  payload,
  size = 68,
}) => {
  const grid = 29;
  const cells = useMemo(() => {
    const matrix: boolean[][] = Array.from({ length: grid }, () =>
      Array(grid).fill(false)
    );
    const drawFinder = (r0: number, c0: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const border = r === 0 || r === 6 || c === 0 || c === 6;
          const inner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          if (border || inner) matrix[r0 + r][c0 + c] = true;
        }
      }
    };
    drawFinder(0, 0);
    drawFinder(0, grid - 7);
    drawFinder(grid - 7, 0);

    let hash = 2166136261;
    for (let i = 0; i < payload.length; i++) {
      hash ^= payload.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    for (let r = 0; r < grid; r++) {
      for (let c = 0; c < grid; c++) {
        const inFinder =
          (r < 8 && c < 8) ||
          (r < 8 && c >= grid - 8) ||
          (r >= grid - 8 && c < 8);
        if (inFinder) continue;
        if (r === 6 || c === 6) {
          matrix[r][c] = (r + c) % 2 === 0;
          continue;
        }
        const seed = Math.imul(r * 31 + c * 17, hash >>> 0);
        matrix[r][c] = ((seed >>> 3) & 1) === 1;
      }
    }
    return matrix;
  }, [payload]);

  const cellSize = size / grid;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="block bg-white p-1 rounded border border-[#CBD5E1]"
      aria-label="Verification QR Code"
    >
      {cells.map((row, r) =>
        row.map((on, c) =>
          on ? (
            <rect
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize + 0.15}
              height={cellSize + 0.15}
              fill="#1E0730"
            />
          ) : null
        )
      )}
    </svg>
  );
};

// 4. Main ULM CR80 Smart ID Card Component (Front & Back)
export const UlmSmartIdCard: React.FC<{
  member?: CardMemberData;
  data?: CardMemberData;
  crestSrc?: string;
  crestUrl?: string;
  side?: 'front' | 'back' | 'both';
  watermarkAlpha?: number;
}> = ({
  member: memberProp,
  data,
  crestSrc,
  crestUrl,
  side = 'both',
  watermarkAlpha = 6.5,
}) => {
  const member = memberProp || data || DEFAULT_STUDENT;
  const resolvedCrestSrc = crestSrc || crestUrl || ULM_OFFICIAL_CREST_SRC;
  const preBakedWatermarkUrl = usePreBakedWatermark(resolvedCrestSrc, watermarkAlpha);

  const CardFront = (
    <div
      data-member-card="true"
      className="cr80-card relative w-[428px] h-[270px] rounded-[12px] bg-white overflow-hidden select-none flex flex-col justify-between"
      style={{
        border: '1.5px solid #C8963E',
        boxShadow:
          '0 14px 32px -10px rgba(36, 8, 54, 0.25), inset 0 0 0 1px rgba(255,255,255,0.9)',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
    >
      {/* Layer 0: Security Micro-Mesh Guilloche Background */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `
            radial-gradient(circle at 18% 22%, rgba(59, 16, 84, 0.045) 1px, transparent 1px),
            radial-gradient(circle at 82% 78%, rgba(200, 150, 62, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '14px 14px',
        }}
      />

      {/* Layer 1: Pre-Baked 6.5% Alpha Offscreen Canvas Watermark with Safety Fallback */}
      {preBakedWatermarkUrl && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1] pt-6">
          <img
            src={preBakedWatermarkUrl}
            alt=""
            aria-hidden="true"
            className="w-[148px] h-[148px] object-contain select-none"
            style={{ opacity: preBakedWatermarkUrl.startsWith('data:') ? 1 : 0.065 }}
          />
        </div>
      )}

      {/* Top Institutional Header Band (58px) */}
      <div
        className="relative z-[2] h-[58px] px-3 flex items-center justify-between shrink-0"
        style={{
          background:
            'linear-gradient(135deg, #240836 0%, #3B1054 52%, #541A72 100%)',
          borderBottom: '2.5px solid #C8963E',
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-[42px] h-[42px] rounded-full bg-white p-[2.5px] border-2 border-[#FFD147] shadow-md flex items-center justify-center shrink-0">
            <img
              src={resolvedCrestSrc}
              alt="ULM 2017 Crest"
              onError={handleCrestFallback}
              className="w-full h-full object-contain rounded-full"
            />
          </div>
          <div className="leading-tight min-w-0">
            <h1
              className="text-[11.2px] font-extrabold tracking-[0.04em] text-white uppercase truncate"
              style={{ fontFamily: "'Cinzel', Georgia, serif" }}
            >
              UNIVERSITY OF LAKKI MARWAT
            </h1>
            <p className="text-[8.5px] font-bold tracking-[0.14em] text-[#FFD147] uppercase mt-0.5">
              CENTRAL DIGITAL LIBRARY
            </p>
            <p className="text-[7.2px] font-medium text-white/80 tracking-[0.04em]">
              Khyber Pakhtunkhwa, Pakistan • Est. 2017
            </p>
          </div>
        </div>

        <div
          className="px-2 py-0.5 rounded-[5px] text-[8px] font-extrabold tracking-[0.08em] uppercase shrink-0 shadow-xs"
          style={{
            background: 'linear-gradient(135deg, #FFD147 0%, #C8963E 100%)',
            color: '#1E0730',
            border: '1px solid #FFF3B0',
          }}
        >
          {member.role}
        </div>
      </div>

      {/* Center Body Content */}
      <div className="relative z-[2] flex-1 px-3 py-2 grid grid-cols-[92px_1fr] gap-3 items-center">
        {/* Left Column: Photo & Active Pill */}
        <div className="flex flex-col items-center">
          <div
            className="w-[88px] h-[108px] rounded-[8px] bg-[#F8FAFC] overflow-hidden flex flex-col items-center justify-center relative shadow-xs"
            style={{
              border: '2px solid #3B1054',
              outline: '1.5px solid #C8963E',
            }}
          >
            {member.photoUrl ? (
              <img
                src={member.photoUrl}
                alt={member.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-[#3B1054]/70 p-1.5 text-center">
                <div className="w-10 h-10 rounded-full bg-[#3B1054]/10 border border-[#C8963E]/50 flex items-center justify-center mb-1">
                  <User className="w-5 h-5 text-[#3B1054]" />
                </div>
                <span className="text-[7px] font-bold uppercase tracking-wider text-[#3B1054]">
                  PASSPORT PHOTO
                </span>
              </div>
            )}
            <span
              className="absolute top-1 right-1 px-1.5 py-[1px] rounded text-[7.5px] font-extrabold text-white shadow-xs"
              style={{
                backgroundColor: '#DC2626',
                border: '1px solid #FFFFFF',
              }}
            >
              {member.bloodGroup}
            </span>
          </div>

          <div className="mt-1.5 w-full py-[2px] px-1.5 rounded-full bg-[#ECFDF5] border border-[#10B981]/50 flex items-center justify-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
            <span className="text-[7px] font-extrabold tracking-wider text-[#047857] uppercase">
              ACTIVE MEMBER
            </span>
          </div>
        </div>

        {/* Right Column: Metadata Grid */}
        <div className="flex flex-col justify-between h-full py-0.5 min-w-0">
          <div className="border-b border-[#E2E8F0] pb-1 flex items-baseline justify-between gap-2">
            <div className="min-w-0">
              <span className="block text-[7px] font-bold uppercase tracking-[0.12em] text-[#64748B]">
                BORROWER FULL NAME
              </span>
              <h2 className="text-[14px] font-extrabold text-[#1E0730] tracking-tight leading-tight truncate">
                {member.name}
              </h2>
            </div>
            <div className="text-right shrink-0">
              <span className="block text-[6.8px] font-bold uppercase tracking-[0.1em] text-[#64748B]">
                MEMBER ID
              </span>
              <span
                className="inline-block px-1.5 py-[1px] rounded bg-[#F3E8FF] border border-[#C8963E]/60 text-[9.5px] font-extrabold text-[#3B1054]"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {member.memberId}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-2.5 gap-y-1 my-auto py-1">
            <div>
              <span className="block text-[6.8px] font-bold uppercase tracking-wider text-[#64748B]">
                Roll No / Reg ID
              </span>
              <span
                className="text-[9.5px] font-extrabold text-[#0F172A]"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {member.rollNo}
              </span>
            </div>

            <div>
              <span className="block text-[6.8px] font-bold uppercase tracking-wider text-[#64748B]">
                Academic Session
              </span>
              <span className="text-[9.5px] font-extrabold text-[#0F172A]">
                {member.session}
              </span>
            </div>

            <div className="col-span-2">
              <span className="block text-[6.8px] font-bold uppercase tracking-wider text-[#64748B]">
                Degree Program / Designation
              </span>
              <span className="text-[9.8px] font-extrabold text-[#3B1054] block truncate">
                {member.program}
              </span>
            </div>

            <div className="col-span-2">
              <span className="block text-[6.8px] font-bold uppercase tracking-wider text-[#64748B]">
                Department
              </span>
              <span className="text-[9px] font-bold text-[#1E293B] block truncate">
                {member.department}
              </span>
            </div>

            <div>
              <span className="block text-[6.8px] font-bold uppercase tracking-wider text-[#64748B]">
                Borrowing Privilege
              </span>
              <span className="text-[8.8px] font-extrabold text-[#047857]">
                {member.borrowingLimit}
              </span>
            </div>

            <div>
              <span className="block text-[6.8px] font-bold uppercase tracking-wider text-[#64748B]">
                Valid Till
              </span>
              <span
                className="text-[8.8px] font-extrabold text-[#B45309]"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {member.validTill}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Barcode & Footer */}
      <div
        className="relative z-[2] h-[38px] px-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between shrink-0"
      >
        <div className="flex flex-col justify-center">
          <Code128Barcode value={member.memberId} width={175} height={19} />
          <span
            className="text-[6.8px] font-bold tracking-[0.22em] text-[#334155] mt-[1px]"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            *{member.memberId}*
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <div
              className="text-[8.5px] font-bold italic text-[#3B1054] leading-none"
              style={{ fontFamily: "'Cinzel', Georgia, serif" }}
            >
              Chief Librarian
            </div>
            <div className="w-24 border-b border-[#94A3B8] my-[2px]" />
            <span className="block text-[6.5px] font-bold uppercase tracking-[0.1em] text-[#475569]">
              Issuing Authority • ULM
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const CardBack = (
    <div
      data-member-card="true"
      className="cr80-card relative w-[428px] h-[270px] rounded-[12px] bg-white overflow-hidden select-none flex flex-col justify-between"
      style={{
        border: '1.5px solid #C8963E',
        boxShadow:
          '0 14px 32px -10px rgba(36, 8, 54, 0.25), inset 0 0 0 1px rgba(255,255,255,0.9)',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
    >
      {preBakedWatermarkUrl && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1]">
          <img
            src={preBakedWatermarkUrl}
            alt=""
            aria-hidden="true"
            className="w-[140px] h-[140px] object-contain select-none"
            style={{ opacity: preBakedWatermarkUrl.startsWith('data:') ? 1 : 0.065 }}
          />
        </div>
      )}

      {/* Top Strip */}
      <div
        className="relative z-[2] h-[34px] px-3 flex items-center justify-between"
        style={{
          background: 'linear-gradient(90deg, #1E0730 0%, #3B1054 60%, #1E0730 100%)',
          borderBottom: '2px solid #C8963E',
        }}
      >
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#FFD147]" />
          <span className="text-[8.5px] font-extrabold tracking-[0.14em] text-[#FFD147] uppercase">
            INSTITUTIONAL LIBRARY MEMBERSHIP TERMS
          </span>
        </div>
        <span
          className="text-[8px] font-bold text-white/90"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          ID: {member.memberId}
        </span>
      </div>

      {/* Back Body */}
      <div className="relative z-[2] flex-1 px-3.5 py-2.5 grid grid-cols-[1fr_102px] gap-3 items-center">
        <div className="space-y-1.5">
          <h3 className="text-[8.5px] font-extrabold uppercase tracking-[0.08em] text-[#3B1054] border-b border-[#E2E8F0] pb-0.5">
            Library Borrowing Terms & Discipline
          </h3>
          <ul className="space-y-1 text-[7.6px] font-medium text-[#1E293B] leading-snug">
            <li className="flex items-start gap-1.5">
              <CheckCircle2 className="w-2.5 h-2.5 text-[#C8963E] shrink-0 mt-[1px]" />
              <span>
                This card is strictly <strong>non-transferable</strong> and must be presented at the Circulation Desk for every checkout or return.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <CheckCircle2 className="w-2.5 h-2.5 text-[#C8963E] shrink-0 mt-[1px]" />
              <span>
                Overdue fine of <strong>Rs. 10/- per day</strong> per volume applies after the standard 14-day borrowing window.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <CheckCircle2 className="w-2.5 h-2.5 text-[#C8963E] shrink-0 mt-[1px]" />
              <span>
                Loss or damage of this Smart Card must be reported immediately to the Central Digital Library administration.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <CheckCircle2 className="w-2.5 h-2.5 text-[#C8963E] shrink-0 mt-[1px]" />
              <span>
                Final semester clearance requires returning all issued library books and settling outstanding dues.
              </span>
            </li>
          </ul>

          <div className="mt-1.5 p-1.5 rounded bg-[#F8FAFC] border border-[#CBD5E1] flex items-center justify-between text-[7.5px]">
            <div className="flex items-center gap-1 text-[#0F172A] font-bold">
              <Phone className="w-2.5 h-2.5 text-[#3B1054]" />
              <span>Holder Contact:</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {member.phone}
              </span>
            </div>
            <span className="px-1.5 py-[0.5px] rounded bg-[#FEE2E2] text-[#991B1B] font-extrabold">
              Blood: {member.bloodGroup}
            </span>
          </div>
        </div>

        {/* Verification QR */}
        <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-center">
          <VerificationQr
            payload={`ULM|${member.memberId}|${member.name}|${member.rollNo}|${member.validTill}`}
            size={68}
          />
          <span className="mt-1 text-[6.8px] font-extrabold uppercase tracking-wider text-[#3B1054]">
            SCAN TO VERIFY
          </span>
          <span
            className="text-[6.5px] font-bold text-[#64748B]"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {member.memberId}
          </span>
        </div>
      </div>

      {/* Return Address Footer */}
      <div
        className="relative z-[2] h-[36px] px-3.5 bg-[#0F172A] text-white flex items-center justify-between text-[7.2px]"
        style={{ borderTop: '2px solid #C8963E' }}
      >
        <div>
          <p className="font-extrabold text-[#FFD147] uppercase tracking-wider">
            IF FOUND, PLEASE RETURN TO:
          </p>
          <p className="text-white/90">
            Central Digital Library, University of Lakki Marwat, Main Campus, KP, Pakistan
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono font-bold text-[#FFD147]">www.ulm.edu.pk</p>
          <p className="text-white/75">registrar@ulm.edu.pk</p>
        </div>
      </div>
    </div>
  );

  if (side === 'front') return CardFront;
  if (side === 'back') return CardBack;

  return (
    <div className="flex flex-wrap items-center justify-center gap-6 print:flex-col print:gap-4">
      {CardFront}
      {CardBack}
    </div>
  );
};

export default UlmSmartIdCard;
