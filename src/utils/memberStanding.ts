export type CardStandingState = 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'SUSPENDED';

export interface MemberCardStanding {
  state: CardStandingState;
  label: string;
  shortLabel: string;
  dotColor: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  validTillColor: string;
  daysRemaining: number | null;
}

const MONTH_MAP: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const NON_EXPIRING_TOKENS = new Set([
  'PERMANENT',
  'INDEFINITE',
  'LIFETIME',
  'UNLIMITED',
  'N/A',
  'NA',
  'NONE',
  '-',
  '—',
]);

/**
 * Parses ISO dates ("2027-06-30") and display dates ("30 JUN 2027", "15-Nov-2025", "Jun 30, 2027")
 * reliably into local end-of-day timestamps without UTC timezone off-by-one drift.
 * Returns null for empty values or non-expiring tokens like "PERMANENT".
 */
export function parseCardDate(raw?: string | null): Date | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (NON_EXPIRING_TOKENS.has(s.toUpperCase())) return null;

  // 1. ISO YYYY-MM-DD (or YYYY-MM-DDTHH:mm:ss...)
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|T|\s)/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    const d = new Date(year, month, day, 23, 59, 59, 999);
    if (!Number.isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
      return d;
    }
  }

  // 2. Display DD MMM YYYY / DD-MMM-YYYY / DD/MMM/YYYY (e.g. "30 JUN 2027", "15-Nov-2025")
  const dmyTextMatch = s.match(/^(\d{1,2})[\s\-/]+([A-Za-z]+)[\s\-/,]+(\d{4})$/);
  if (dmyTextMatch) {
    const day = Number(dmyTextMatch[1]);
    const monthIdx = MONTH_MAP[dmyTextMatch[2].toLowerCase()];
    const year = Number(dmyTextMatch[3]);
    if (monthIdx !== undefined) {
      const d = new Date(year, monthIdx, day, 23, 59, 59, 999);
      if (!Number.isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === monthIdx && d.getDate() === day) {
        return d;
      }
    }
  }

  // 3. Display MMM DD, YYYY / MMM-DD-YYYY (e.g. "Jun 30, 2027")
  const mdyTextMatch = s.match(/^([A-Za-z]+)[\s\-/]+(\d{1,2}),?[\s\-/]+(\d{4})$/);
  if (mdyTextMatch) {
    const monthIdx = MONTH_MAP[mdyTextMatch[1].toLowerCase()];
    const day = Number(mdyTextMatch[2]);
    const year = Number(mdyTextMatch[3]);
    if (monthIdx !== undefined) {
      const d = new Date(year, monthIdx, day, 23, 59, 59, 999);
      if (!Number.isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === monthIdx && d.getDate() === day) {
        return d;
      }
    }
  }

  // 4. Numeric DD/MM/YYYY or DD-MM-YYYY
  const numericDmyMatch = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
  if (numericDmyMatch) {
    const first = Number(numericDmyMatch[1]);
    const second = Number(numericDmyMatch[2]);
    const year = Number(numericDmyMatch[3]);
    const day = first > 12 ? first : second > 12 ? second : first;
    const month = (first > 12 ? second : second > 12 ? first : second) - 1;
    const d = new Date(year, month, day, 23, 59, 59, 999);
    if (!Number.isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
      return d;
    }
  }

  // 5. Fallback native Date parser
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    parsed.setHours(23, 59, 59, 999);
    return parsed;
  }

  return null;
}

/**
 * Single authoritative standing resolver for CR80 Member ID Cards, Registry badges,
 * Barcode Station borrower cards, Enroll/Edit previews, Print output, and PDF exports.
 */
export function resolveMemberCardStanding(
  member: Record<string, any> | null | undefined,
  overrideValidTill?: string | null
): MemberCardStanding {
  const rawStatus = String(member?.status ?? member?.account_status ?? '').trim().toLowerCase();

  // 1. Account explicitly suspended / blocked / revoked
  if (
    rawStatus === 'suspended' ||
    rawStatus === 'blocked' ||
    rawStatus === 'revoked' ||
    Boolean(member?.is_suspended)
  ) {
    return {
      state: 'SUSPENDED',
      label: 'SUSPENDED',
      shortLabel: 'SUSPENDED',
      dotColor: '#E11D48',
      textColor: '#9F1239',
      bgColor: '#FFF1F2',
      borderColor: '#FDA4AF',
      validTillColor: '#E11D48',
      daysRemaining: null,
    };
  }

  // 2. Date-based expiry evaluation against local start-of-day
  const rawValidTill =
    overrideValidTill !== undefined && overrideValidTill !== null && String(overrideValidTill).trim() !== ''
      ? overrideValidTill
      : (member?.validTill ??
        member?.valid_till ??
        member?.valid_until ??
        member?.expiry_date ??
        member?.validUntil ??
        null);

  const expiry = parseCardDate(rawValidTill);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffDays = expiry
    ? Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  if ((expiry && diffDays !== null && diffDays < 0) || rawStatus === 'expired') {
    return {
      state: 'EXPIRED',
      label: 'CARD EXPIRED',
      shortLabel: 'EXPIRED',
      dotColor: '#DC2626',
      textColor: '#991B1B',
      bgColor: '#FEF2F2',
      borderColor: '#FCA5A5',
      validTillColor: '#DC2626',
      daysRemaining: diffDays,
    };
  }

  // 3. Expiring within 30 days (including today)
  if (expiry && diffDays !== null && diffDays <= 30) {
    return {
      state: 'EXPIRING_SOON',
      label: 'EXPIRING SOON',
      shortLabel: 'EXPIRING SOON',
      dotColor: '#D97706',
      textColor: '#92400E',
      bgColor: '#FFFBEB',
      borderColor: '#FCD34D',
      validTillColor: '#D97706',
      daysRemaining: diffDays,
    };
  }

  // 4. Active member
  return {
    state: 'ACTIVE',
    label: 'ACTIVE MEMBER',
    shortLabel: 'ACTIVE',
    dotColor: '#10B981',
    textColor: '#047857',
    bgColor: '#ECFDF5',
    borderColor: '#6EE7B7',
    validTillColor: '#D97706',
    daysRemaining: diffDays,
  };
}
