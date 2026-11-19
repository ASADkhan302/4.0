import { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { ULM_OFFICIAL_CREST_SRC, syncAppDesktopAndFaviconIcon } from '../constants/ulmOfficialAssets';

export interface InstitutionalIdentity {
  universityName: string;        // Default: "University of Lakki Marwat"
  libraryDepartmentName: string; // Default: "Central Campus Library"
  campusAddress: string;         // Default: "Main Campus, Bannu-Mianwali Road, Lakki Marwat, Khyber Pakhtunkhwa, Pakistan"
  contactPhone: string;          // Default: "+92 969 511819"
  circulationEmail: string;      // Default: "library@ulm.edu.pk"
  workstationNodeId: string;     // Default: "LMS-WIN-01"
  customCrestUrl: string | null; // Base64 Data URL when user uploads a custom PNG, or null for Official ULM 2017 Crest
}

export const INSTITUTIONAL_IDENTITY_STORAGE_KEY = 'ulm_institutional_identity_v1';

export const DEFAULT_INSTITUTIONAL_IDENTITY: InstitutionalIdentity = {
  universityName: 'University of Lakki Marwat',
  libraryDepartmentName: 'Central Campus Library',
  campusAddress: 'Main Campus, Bannu-Mianwali Road, Lakki Marwat, Khyber Pakhtunkhwa, Pakistan',
  contactPhone: '+92 969 511819',
  circulationEmail: 'library@ulm.edu.pk',
  workstationNodeId: 'LMS-WIN-01',
  customCrestUrl: null,
};

export function getInstitutionalIdentity(): InstitutionalIdentity {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_INSTITUTIONAL_IDENTITY };
  }

  try {
    const rawIdentity = localStorage.getItem(INSTITUTIONAL_IDENTITY_STORAGE_KEY);
    const rawSettings = localStorage.getItem('ulm_lms_settings_v1');
    const parsedSettings = rawSettings ? JSON.parse(rawSettings) : {};
    const parsedIdentity = rawIdentity ? JSON.parse(rawIdentity) : {};

    const resolved: InstitutionalIdentity = {
      universityName:
        (parsedIdentity.universityName ?? parsedSettings.university_name ?? DEFAULT_INSTITUTIONAL_IDENTITY.universityName).trim() ||
        DEFAULT_INSTITUTIONAL_IDENTITY.universityName,
      libraryDepartmentName:
        (parsedIdentity.libraryDepartmentName ?? parsedSettings.library_name ?? DEFAULT_INSTITUTIONAL_IDENTITY.libraryDepartmentName).trim() ||
        DEFAULT_INSTITUTIONAL_IDENTITY.libraryDepartmentName,
      campusAddress:
        (parsedIdentity.campusAddress ?? parsedSettings.campus_address ?? DEFAULT_INSTITUTIONAL_IDENTITY.campusAddress).trim() ||
        DEFAULT_INSTITUTIONAL_IDENTITY.campusAddress,
      contactPhone:
        (parsedIdentity.contactPhone ?? parsedSettings.phone ?? DEFAULT_INSTITUTIONAL_IDENTITY.contactPhone).trim() ||
        DEFAULT_INSTITUTIONAL_IDENTITY.contactPhone,
      circulationEmail:
        (parsedIdentity.circulationEmail ?? parsedSettings.email ?? DEFAULT_INSTITUTIONAL_IDENTITY.circulationEmail).trim() ||
        DEFAULT_INSTITUTIONAL_IDENTITY.circulationEmail,
      workstationNodeId:
        (parsedIdentity.workstationNodeId ?? parsedSettings.station_id ?? DEFAULT_INSTITUTIONAL_IDENTITY.workstationNodeId).trim() ||
        DEFAULT_INSTITUTIONAL_IDENTITY.workstationNodeId,
      customCrestUrl:
        parsedIdentity.customCrestUrl !== undefined
          ? parsedIdentity.customCrestUrl
          : parsedSettings.customLogoDataUri || null,
    };

    if (!rawIdentity) {
      localStorage.setItem(INSTITUTIONAL_IDENTITY_STORAGE_KEY, JSON.stringify(resolved));
    }

    return resolved;
  } catch {
    return { ...DEFAULT_INSTITUTIONAL_IDENTITY };
  }
}

export function saveInstitutionalIdentity(
  updates: Partial<InstitutionalIdentity>,
  broadcast = true
): InstitutionalIdentity {
  const current = getInstitutionalIdentity();
  const updatedIdentity: InstitutionalIdentity = {
    universityName: (updates.universityName ?? current.universityName).trim() || DEFAULT_INSTITUTIONAL_IDENTITY.universityName,
    libraryDepartmentName: (updates.libraryDepartmentName ?? current.libraryDepartmentName).trim() || DEFAULT_INSTITUTIONAL_IDENTITY.libraryDepartmentName,
    campusAddress: (updates.campusAddress ?? current.campusAddress).trim() || DEFAULT_INSTITUTIONAL_IDENTITY.campusAddress,
    contactPhone: (updates.contactPhone ?? current.contactPhone).trim() || DEFAULT_INSTITUTIONAL_IDENTITY.contactPhone,
    circulationEmail: (updates.circulationEmail ?? current.circulationEmail).trim() || DEFAULT_INSTITUTIONAL_IDENTITY.circulationEmail,
    workstationNodeId: (updates.workstationNodeId ?? current.workstationNodeId).trim() || DEFAULT_INSTITUTIONAL_IDENTITY.workstationNodeId,
    customCrestUrl: updates.customCrestUrl !== undefined ? updates.customCrestUrl : current.customCrestUrl,
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(INSTITUTIONAL_IDENTITY_STORAGE_KEY, JSON.stringify(updatedIdentity));

      // Keep legacy settings object in sync as well
      const rawSettings = localStorage.getItem('ulm_lms_settings_v1');
      const parsedSettings = rawSettings ? JSON.parse(rawSettings) : {};
      const syncedSettings = {
        ...parsedSettings,
        university_name: updatedIdentity.universityName,
        library_name: updatedIdentity.libraryDepartmentName,
        campus_address: updatedIdentity.campusAddress,
        phone: updatedIdentity.contactPhone,
        email: updatedIdentity.circulationEmail,
        station_id: updatedIdentity.workstationNodeId,
        customLogoDataUri: updatedIdentity.customCrestUrl || undefined,
      };
      localStorage.setItem('ulm_lms_settings_v1', JSON.stringify(syncedSettings));
    } catch {
      // ignore storage quota errors
    }

    if (typeof document !== 'undefined') {
      document.title = `${updatedIdentity.universityName} — ${updatedIdentity.libraryDepartmentName}`;
    }
    syncAppDesktopAndFaviconIcon(updatedIdentity.customCrestUrl || ULM_OFFICIAL_CREST_SRC);

    if (broadcast) {
      window.dispatchEvent(new CustomEvent('ulm-branding-sync', { detail: updatedIdentity }));
    }
  }

  return updatedIdentity;
}

export function useInstitutionalIdentity(): InstitutionalIdentity {
  const [identity, setIdentity] = useState<InstitutionalIdentity>(() => getInstitutionalIdentity());

  useEffect(() => {
    const handleSync = (e: Event) => {
      const custom = e as CustomEvent<InstitutionalIdentity>;
      if (custom.detail && typeof custom.detail === 'object') {
        setIdentity({ ...custom.detail });
      } else {
        setIdentity(getInstitutionalIdentity());
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (!e.key || e.key === INSTITUTIONAL_IDENTITY_STORAGE_KEY || e.key === 'ulm_lms_settings_v1') {
        setIdentity(getInstitutionalIdentity());
      }
    };

    window.addEventListener('ulm-branding-sync', handleSync);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('ulm-branding-sync', handleSync);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return identity;
}

export const VIEW_TRANSITION_THEME_CSS = `
::view-transition-old(root),
::view-transition-new(root) {
  animation: none !important;
  mix-blend-mode: normal !important;
}
::view-transition-old(root) {
  z-index: 1;
}
::view-transition-new(root) {
  z-index: 999999;
}
`;

export async function triggerCircularThemeTransition(
  triggerElement: HTMLElement | null,
  applyThemeUpdate: () => void
): Promise<void> {
  if (typeof document !== 'undefined' && !document.getElementById('ulm-view-transition-css')) {
    const style = document.createElement('style');
    style.id = 'ulm-view-transition-css';
    style.textContent = VIEW_TRANSITION_THEME_CSS;
    document.head.appendChild(style);
  }

  const docAny = document as any;
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  if (!triggerElement || typeof docAny.startViewTransition !== 'function' || prefersReducedMotion) {
    applyThemeUpdate();
    return;
  }

  const { left, top, width, height } = triggerElement.getBoundingClientRect();
  const centerX = left + width / 2;
  const centerY = top + height / 2;
  const maxDistance = Math.hypot(
    Math.max(centerX, window.innerWidth - centerX),
    Math.max(centerY, window.innerHeight - centerY)
  );

  try {
    const transition = docAny.startViewTransition(() => {
      flushSync(() => {
        applyThemeUpdate();
      });
    });

    await transition.ready;

    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${centerX}px ${centerY}px)`,
          `circle(${maxDistance}px at ${centerX}px ${centerY}px)`,
        ],
      },
      {
        duration: 700,
        easing: 'ease-in-out',
        pseudoElement: '::view-transition-new(root)',
      }
    );
  } catch {
    applyThemeUpdate();
  }
}
