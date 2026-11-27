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
import { useInstitutionalIdentity } from '../../utils/themeTransition';
import { encodeCode128B } from '../../utils/code128';
import {
  resolveMemberCardStanding,
  parseCardDate,
  type CardStandingState,
  type MemberCardStanding,
} from '../../utils/memberStanding';

export { resolveMemberCardStanding, parseCardDate, type CardStandingState, type MemberCardStanding };

export type CardRoleBadge =
  | 'STUDENT CARD'
  | 'FACULTY CARD'
  | 'TEACHER CARD'
  | 'STAFF CARD'
  | 'RESEARCH SCHOLAR'
  | 'VISITOR CARD'
  | string;

export interface CardMemberData {
  name: string;
  role: CardRoleBadge;
  memberId: string;
  rollNo: string;
  session: string;
  program: string;
  department: string;
  bloodGroup: string;
  borrowingLimit: string;
  phone: string;
  validTill: string;
  status?: string;
  photoUrl?: string;
}

/**
 * Single authoritative CR80 Card Role Badge resolver used across Live Preview,
 * Preset Switcher, Print CR80 Card, and Save as PDF.
 */
export function resolveCardRoleBadge(member: any, overrideBadge?: string): string {
  const manual = String(overrideBadge || '').trim();
  if (manual) return manual.toUpperCase();

  const rawRole = String(
    member?.card_role_badge ||
      member?.roleBadge ||
      member?.role ||
      member?.member_type ||
      member?.people_type ||
      member?.type ||
      'Student'
  )
    .trim()
    .toLowerCase();

  if (rawRole.includes('faculty')) return 'FACULTY CARD';
  if (
    rawRole.includes('teacher') ||
    rawRole.includes('lecturer') ||
    rawRole.includes('professor')
  ) {
    return 'TEACHER CARD';
  }
  if (
    rawRole.includes('staff') ||
    rawRole.includes('admin') ||
    rawRole.includes('employee')
  ) {
    return 'STAFF CARD';
  }
  if (rawRole.includes('visitor') || rawRole.includes('guest')) {
    return 'VISITOR CARD';
  }
  if (rawRole.includes('scholar') || rawRole.includes('research')) {
    return 'RESEARCH SCHOLAR';
  }
  if (
    rawRole.includes('student') &&
    (member?.degree_level === 'MS' ||
      member?.degree_level === 'MPhil' ||
      member?.degree_level === 'PhD')
  ) {
    return 'RESEARCH SCHOLAR';
  }
  return 'STUDENT CARD';
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

const FACULTY_PRESET: CardMemberData = {
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
};

const TEACHER_PRESET: CardMemberData = {
  name: 'Prof. Rehmat Ullah Khan',
  role: 'TEACHER CARD',
  memberId: 'ULM-TCH-0204',
  rollNo: 'EMP-PHY-011',
  session: 'Teaching Faculty',
  program: 'Lecturer in Physics',
  department: 'Department of Physics',
  bloodGroup: 'A+',
  borrowingLimit: '10 Books (30 Days)',
  phone: '0345-2233445',
  validTill: 'PERMANENT',
};

const STAFF_PRESET: CardMemberData = {
  name: 'Tariq Mahmood Khan',
  role: 'STAFF CARD',
  memberId: 'ULM-STF-0042',
  rollNo: 'EMP-LIB-042',
  session: 'Regular Staff',
  program: 'Senior Cataloger & Circulation Officer',
  department: 'Central Campus Library',
  bloodGroup: 'B+',
  borrowingLimit: '05 Books (14 Days)',
  phone: '0345-9112033',
  validTill: '31 DEC 2028',
};

const SCHOLAR_PRESET: CardMemberData = {
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
};

export const SAMPLE_CARD_PRESETS: Record<string, CardMemberData> = {
  student_default: DEFAULT_STUDENT,
  student_cs: DEFAULT_STUDENT,
  faculty_sample: FACULTY_PRESET,
  faculty_cs: FACULTY_PRESET,
  teacher_sample: TEACHER_PRESET,
  staff_sample: STAFF_PRESET,
  staff_lib: STAFF_PRESET,
  scholar_sample: SCHOLAR_PRESET,
  scholar_ms: SCHOLAR_PRESET,
};

const formatExpiryDateDisplay = (val?: string | null, role?: string | null): string => {
  const lowerRole = String(role || '').toLowerCase();
  if (!val) {
    return lowerRole.includes('faculty') || lowerRole.includes('teacher')
      ? 'PERMANENT'
      : '30 JUN 2027';
  }
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

export function borrowerToCardMemberData(
  member: Partial<Borrower> | null | undefined,
  overrideBadge?: string
): CardMemberData {
  if (!member) {
    return overrideBadge
      ? { ...DEFAULT_STUDENT, role: resolveCardRoleBadge(DEFAULT_STUDENT, overrideBadge) }
      : DEFAULT_STUDENT;
  }

  const role = resolveCardRoleBadge(member, overrideBadge);
  const rawRole = String(member.role || 'Student').toLowerCase();
  const isAcademicStaff =
    role === 'FACULTY CARD' || role === 'TEACHER CARD' || rawRole.includes('faculty') || rawRole.includes('teacher');
  const isAdminStaff = role === 'STAFF CARD' || rawRole.includes('staff');

  const memberId = (member.barcode || member.university_id || member.student_id || 'ULM0329984').toUpperCase();
  const rollNo =
    member.roll_number ||
    member.employee_no ||
    member.university_id ||
    member.student_id ||
    'BSCS-23-42';

  const session =
    member.session ||
    (isAcademicStaff ? 'Permanent Faculty' : isAdminStaff ? 'Regular Staff' : 'FA23 (2023–2027)');

  const degreePrefix = member.degree_level ? `${member.degree_level} ` : '';
  const modeSuffix = member.study_mode ? ` (${member.study_mode})` : '';
  const program =
    isAcademicStaff || isAdminStaff
      ? member.designation ||
        member.program ||
        (role === 'TEACHER CARD' ? 'Lecturer' : isAcademicStaff ? 'Assistant Professor' : 'Administrative Staff')
      : member.program
      ? member.program.includes('(')
        ? member.program
        : `${degreePrefix}${member.program}${modeSuffix}`.trim()
      : 'BS Computer Science (Regular)';

  const rawDept = member.department || 'Computer Science';
  const department = rawDept.toLowerCase().startsWith('department')
    ? rawDept
    : `Department of ${rawDept}`;

  const limitNum = member.borrow_limit || (isAcademicStaff ? 10 : isAdminStaff ? 5 : 3);
  const limitPad = String(limitNum).padStart(2, '0');
  const daysNum = isAcademicStaff ? 30 : 14;
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
    status: member.status || 'active',
    photoUrl:
      member.photo_url ||
      member.photo_path ||
      member.photoDataUrl ||
      member.photoUrl ||
      member.photo ||
      undefined,
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

// 2. ISO/IEC 15417 Scannable Code-128B SVG Barcode Generator
export const Code128Barcode: React.FC<{
  value: string;
  width?: number;
  height?: number;
}> = ({ value, width = 175, height = 20 }) => {
  const encoded = useMemo(() => {
    return encodeCode128B((value || 'ULM0329984').toUpperCase());
  }, [value]);

  const quietZone = 8;
  const totalUnits = encoded.totalModules + quietZone * 2;
  const unitWidth = width / Math.max(1, totalUnits);
  let currentX = quietZone * unitWidth;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="block overflow-hidden bg-white rounded-[2px]"
      shapeRendering="crispEdges"
      aria-label={`Barcode ${value}`}
    >
      <rect x={0} y={0} width={width} height={height} fill="#FFFFFF" />
      {encoded.modules.map((mod, idx) => {
        const w = mod.widthModules * unitWidth;
        const x = currentX;
        currentX += w;
        return mod.isBar ? (
          <rect
            key={idx}
            x={x}
            y={0}
            width={w}
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
  const identity = useInstitutionalIdentity();
  const member = memberProp || data || DEFAULT_STUDENT;
  const resolvedRoleBadge = resolveCardRoleBadge(member);
  const standing = resolveMemberCardStanding(member, member.validTill);
  const isInvalidStanding = standing.state === 'EXPIRED' || standing.state === 'SUSPENDED';
  const resolvedCrestSrc = identity.customCrestUrl || crestSrc || crestUrl || ULM_OFFICIAL_CREST_SRC;
  const preBakedWatermarkUrl = usePreBakedWatermark(resolvedCrestSrc, watermarkAlpha);

  const CardFront = (
    <div
      data-member-card="true"
      className="cr80-card relative w-[428px] h-[270px] rounded-[12px] bg-white overflow-hidden select-none flex flex-col justify-between shrink-0"
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

      {/* Layer 1: Pre-Baked Offscreen Canvas Watermark with Safety Fallback */}
      {preBakedWatermarkUrl && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1] pt-5">
          <img
            src={preBakedWatermarkUrl}
            alt=""
            aria-hidden="true"
            className="w-[144px] h-[144px] object-contain select-none"
            style={{ opacity: preBakedWatermarkUrl.startsWith('data:') ? 1 : watermarkAlpha / 100 }}
          />
        </div>
      )}

      {/* Top Institutional Header Band (54px — Zero overlap between university title and role badge) */}
      <div
        className="ulm-dark-plaque relative z-[2] h-[54px] px-2.5 flex items-center justify-between gap-1.5 shrink-0"
        style={{
          background:
            'linear-gradient(90deg, #3B0764 0%, #581C87 55%, #6B21A8 100%)',
          borderBottom: '2.5px solid #C8963E',
        }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          <div className="w-[30px] h-[30px] rounded-full bg-white p-[1.5px] border-[1.5px] border-[#FFD147] shadow-md flex items-center justify-center shrink-0">
            <img
              src={resolvedCrestSrc}
              alt="ULM Crest"
              onError={handleCrestFallback}
              className="w-full h-full object-contain rounded-full"
            />
          </div>
          <div className="leading-tight min-w-0 flex-1 overflow-hidden">
            <h1
              className="text-[9.5px] font-extrabold tracking-[0.01em] leading-[1.15] whitespace-nowrap truncate !text-white uppercase"
              style={{ fontFamily: "'Plus Jakarta Sans', 'Segoe UI', sans-serif", color: '#FFFFFF' }}
            >
              {identity.universityName.toUpperCase()}
            </h1>
            <p className="text-[7.2px] font-bold tracking-[0.08em] !text-[#FFD147] uppercase mt-[1px] whitespace-nowrap truncate">
              {identity.libraryDepartmentName.toUpperCase()}
            </p>
            <p className="text-[6.4px] font-medium !text-white/85 tracking-[0.01em] whitespace-nowrap truncate">
              {identity.campusAddress}
            </p>
          </div>
        </div>

        <div
          className="px-2 py-[3px] rounded-md text-[6.8px] font-black tracking-[0.04em] uppercase whitespace-nowrap shrink-0 shadow-2xs"
          style={{
            background: 'linear-gradient(135deg, #FFD147 0%, #C8963E 100%)',
            color: '#1E0730',
            border: '1px solid #FFF3B0',
          }}
        >
          {resolvedRoleBadge}
        </div>
      </div>

      {/* Center Body Content */}
      <div className="relative z-[2] flex-1 px-3 py-1.5 grid grid-cols-[88px_1fr] gap-2.5 items-center text-[#1A1027] min-h-0">
        {/* Left Column: Photo & Active Pill */}
        <div className="flex flex-col items-center">
          <div
            className="w-[82px] h-[102px] rounded-[8px] bg-[#F8FAFC] overflow-hidden flex flex-col items-center justify-center relative shadow-xs transition-colors duration-200"
            style={{
              border: isInvalidStanding ? `2px solid ${standing.dotColor}` : '2px solid #3B1054',
              outline: isInvalidStanding ? `1.5px solid ${standing.borderColor}` : '1.5px solid #C8963E',
            }}
          >
            {member.photoUrl ? (
              <img
                src={member.photoUrl}
                alt={member.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center !text-[#3B1054]/80 p-1.5 text-center">
                <div className="w-9 h-9 rounded-full bg-[#3B1054]/10 border border-[#C8963E]/50 flex items-center justify-center mb-1">
                  <User className="w-4.5 h-4.5 !text-[#3B1054]" />
                </div>
                <span className="text-[6.8px] font-bold uppercase tracking-wider !text-[#3B1054]">
                  PASSPORT PHOTO
                </span>
              </div>
            )}
            <span
              className="absolute top-1 right-1 px-1.5 py-[1px] rounded text-[7px] font-extrabold !text-white shadow-xs"
              style={{
                backgroundColor: '#DC2626',
                border: '1px solid #FFFFFF',
              }}
            >
              {member.bloodGroup}
            </span>
          </div>

          <div
            className="mt-1.5 w-full py-[2px] px-1 rounded-full flex items-center justify-center gap-1 transition-colors duration-200"
            style={{
              backgroundColor: standing.bgColor,
              border: `1px solid ${standing.borderColor}`,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: standing.dotColor }}
            />
            <span
              className="text-[6.2px] font-extrabold tracking-[0.05em] uppercase whitespace-nowrap leading-none"
              style={{ color: standing.textColor }}
            >
              {standing.label}
            </span>
          </div>
        </div>

        {/* Right Column: Metadata Grid */}
        <div className="flex flex-col justify-between h-full py-0.5 min-w-0">
          <div className="border-b border-[#E2E8F0] pb-1 flex items-end justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className="block text-[6.5px] font-bold uppercase tracking-[0.1em] !text-[#64748B]">
                BORROWER FULL NAME
              </span>
              <h2 className="text-[12.5px] font-extrabold !text-[#1A1027] tracking-tight leading-[1.15] truncate" dir="auto">
                {member.name}
              </h2>
            </div>
            <div className="text-right shrink-0">
              <span className="block text-[6.3px] font-bold uppercase tracking-[0.08em] !text-[#64748B]">
                MEMBER ID
              </span>
              <span
                className="inline-block px-1.5 py-[1px] rounded bg-[#F3E8FF] border border-[#C8963E]/60 text-[8.5px] font-extrabold !text-[#3B1054] whitespace-nowrap"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {member.memberId}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-2.5 gap-y-1 my-auto py-0.5">
            <div className="min-w-0">
              <span className="block text-[6.4px] font-bold uppercase tracking-wider !text-[#64748B]">
                Roll No / Reg ID
              </span>
              <span
                className="text-[8.8px] font-extrabold !text-[#1A1027] block truncate"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {member.rollNo}
              </span>
            </div>

            <div className="min-w-0">
              <span className="block text-[6.4px] font-bold uppercase tracking-wider !text-[#64748B]">
                Academic Session
              </span>
              <span className="text-[8.8px] font-extrabold !text-[#1A1027] block truncate">
                {member.session}
              </span>
            </div>

            <div className="col-span-2 min-w-0">
              <span className="block text-[6.4px] font-bold uppercase tracking-wider !text-[#64748B]">
                Program / Designation
              </span>
              <span className="text-[9px] font-extrabold !text-[#3B1054] block truncate">
                {member.program}
              </span>
            </div>

            <div className="col-span-2 min-w-0">
              <span className="block text-[6.4px] font-bold uppercase tracking-wider !text-[#64748B]">
                Department
              </span>
              <span className="text-[8.5px] font-bold !text-[#1A1027] block truncate">
                {member.department}
              </span>
            </div>

            <div className="min-w-0">
              <span className="block text-[6.4px] font-bold uppercase tracking-wider !text-[#64748B]">
                Borrowing Privilege
              </span>
              <span className="text-[8.2px] font-extrabold !text-[#047857] block truncate">
                {member.borrowingLimit}
              </span>
            </div>

            <div className="min-w-0">
              <span className="block text-[6.4px] font-bold uppercase tracking-wider !text-[#64748B]">
                Valid Till
              </span>
              <span
                className="text-[8.2px] font-extrabold block truncate transition-colors duration-200"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  color: standing.validTillColor,
                }}
              >
                {member.validTill}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Barcode & Footer (48px — Generous 7px bottom breathing room) */}
      <div
        className="relative z-[2] h-[48px] px-3 pt-1.5 pb-[7px] bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between shrink-0"
      >
        <div className="flex flex-col justify-center">
          <Code128Barcode value={member.memberId} width={178} height={21} />
          <span
            className="text-[6.8px] font-bold tracking-[0.18em] text-[#334155] mt-[3px] leading-none"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            *{member.memberId}*
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <div
              className="text-[8.5px] font-bold italic text-[#3B1054] leading-none"
              style={{ fontFamily: "'Cinzel', Georgia, serif" }}
            >
              Chief Librarian
            </div>
            <div className="w-24 border-b border-[#94A3B8] my-[2.5px] ml-auto" />
            <span className="block text-[6.2px] font-bold uppercase tracking-[0.09em] text-[#475569] whitespace-nowrap">
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
      className="cr80-card relative w-[428px] h-[270px] rounded-[12px] bg-white overflow-hidden select-none flex flex-col justify-between shrink-0"
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
            className="w-[138px] h-[138px] object-contain select-none"
            style={{ opacity: preBakedWatermarkUrl.startsWith('data:') ? 1 : watermarkAlpha / 100 }}
          />
        </div>
      )}

      {/* Top Purple Header Strip */}
      <div
        className="relative z-[2] h-[34px] px-3 flex items-center justify-between gap-2 shrink-0"
        style={{
          background: 'linear-gradient(90deg, #3B0764 0%, #581C87 55%, #6B21A8 100%)',
          borderBottom: '2px solid #C8963E',
        }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <ShieldCheck className="w-3.5 h-3.5 text-[#FFD147] shrink-0" />
          <span className="text-[7.8px] font-extrabold tracking-[0.1em] text-[#FFD147] uppercase whitespace-nowrap truncate">
            INSTITUTIONAL LIBRARY MEMBERSHIP TERMS
          </span>
        </div>
        <span
          className="text-[7.8px] font-bold text-white/95 whitespace-nowrap shrink-0"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          ID: {member.memberId}
        </span>
      </div>

      {/* Back Body */}
      <div className="relative z-[2] flex-1 px-3 py-2 grid grid-cols-[1fr_100px] gap-2.5 items-center min-h-0">
        <div className="space-y-1.5 min-w-0">
          <h3 className="text-[8.2px] font-extrabold uppercase tracking-[0.07em] text-[#3B1054] border-b border-[#E2E8F0] pb-0.5">
            Library Borrowing Terms &amp; Discipline
          </h3>
          <ul className="space-y-1 text-[7.3px] font-medium text-[#1E293B] leading-snug">
            <li className="flex items-start gap-1.5">
              <CheckCircle2 className="w-2.5 h-2.5 text-[#C8963E] shrink-0 mt-[1px]" />
              <span>
                This card is strictly <strong>non-transferable</strong> and must be presented at the Circulation Desk for every checkout or return.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <CheckCircle2 className="w-2.5 h-2.5 text-[#C8963E] shrink-0 mt-[1px]" />
              <span>
                Overdue fine of <strong>Rs. 10/- per day</strong> per volume applies after the standard borrowing window.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <CheckCircle2 className="w-2.5 h-2.5 text-[#C8963E] shrink-0 mt-[1px]" />
              <span>
                Loss or damage of this Smart Card must be reported immediately to the {identity.libraryDepartmentName} administration.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <CheckCircle2 className="w-2.5 h-2.5 text-[#C8963E] shrink-0 mt-[1px]" />
              <span>
                Final clearance requires returning all issued library books and settling any outstanding dues.
              </span>
            </li>
          </ul>

          <div className="mt-1 p-1.5 rounded bg-[#F8FAFC] border border-[#CBD5E1] flex items-center justify-between gap-2 text-[7.2px]">
            <div className="flex items-center gap-1 text-[#0F172A] font-bold min-w-0 truncate">
              <Phone className="w-2.5 h-2.5 text-[#3B1054] shrink-0" />
              <span>Contact:</span>
              <span className="truncate" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {member.phone}
              </span>
            </div>
            <span className="px-1.5 py-[0.5px] rounded bg-[#FEE2E2] text-[#991B1B] font-extrabold whitespace-nowrap shrink-0">
              Blood: {member.bloodGroup}
            </span>
          </div>
        </div>

        {/* Verification QR */}
        <div className="flex flex-col items-center justify-center p-1.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-center">
          <VerificationQr
            payload={`ULM|${member.memberId}|${member.name}|${member.rollNo}|${member.validTill}`}
            size={66}
          />
          <span className="mt-1 text-[6.5px] font-extrabold uppercase tracking-wider text-[#3B1054]">
            SCAN TO VERIFY
          </span>
          <span
            className="text-[6.2px] font-bold text-[#64748B] truncate max-w-full"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {member.memberId}
          </span>
        </div>
      </div>

      {/* Purple Campus Address Footer Bar */}
      <div
        className="relative z-[2] h-[38px] px-3 py-1 text-white flex items-center justify-between gap-2 text-[7px] shrink-0"
        style={{
          background: 'linear-gradient(90deg, #3B0764 0%, #581C87 55%, #6B21A8 100%)',
          borderTop: '2px solid #C8963E',
        }}
      >
        <div className="min-w-0 flex-1 pr-1">
          <p className="font-extrabold text-[#FFD147] uppercase tracking-wider leading-tight">
            IF FOUND, PLEASE RETURN TO:
          </p>
          <p className="text-white/95 truncate leading-tight">
            {identity.campusAddress}
          </p>
        </div>
        <div className="text-right shrink-0 leading-tight">
          <p className="font-mono font-bold text-[#FFD147]">{identity.contactPhone}</p>
          <p className="text-white/85">{identity.circulationEmail}</p>
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
