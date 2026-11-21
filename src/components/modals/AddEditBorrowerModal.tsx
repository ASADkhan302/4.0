import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  UserCheck, 
  UserPlus, 
  AlertCircle, 
  Upload, 
  Trash2, 
  Sparkles, 
  AlertTriangle,
  ArrowRight,
  Copy,
  ExternalLink,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Crop
} from 'lucide-react';
import { Borrower, BorrowerRole, BorrowerStatus } from '../../types/library';
import CustomSelect from '../ui/CustomSelect';
import { MemberCard } from '../cards/MemberCard';
import { PhotoCropModal } from '../shared/PhotoCropModal';

interface AddEditBorrowerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (borrowerData: Omit<Borrower, 'id' | 'created_at' | 'updated_at' | 'is_active'>) => { success: boolean; message: string; borrower?: Borrower; existingBorrowerId?: string };
  onUpdate?: (id: string, updates: Partial<Borrower>) => { success: boolean; message: string; borrower?: Borrower };
  borrowerToEdit?: Borrower | null;
  allBorrowers: Borrower[];
  onOpenExisting?: (borrowerId: string) => void;
  onCreated?: (borrower: Borrower) => void;
}

const DEFAULT_DEPARTMENTS = [
  'Computer Science',
  'Law',
  'Education',
  'Physics',
  'Mathematics',
  'Chemistry',
  'English',
  'Islamic Studies',
  'Management Sciences',
  'Civil Engineering'
];

const FACULTY_STAFF_DESIGNATIONS = [
  'Professor',
  'Associate Professor',
  'Assistant Professor',
  'Lecturer',
  'Visiting Faculty',
  'Librarian',
  'Assistant Librarian',
  'Lab Engineer',
  'Clerk',
  'Senior Clerk',
  'Other'
];

const DEGREE_LEVELS = ['BS', 'MS', 'MPhil', 'PhD', 'ADP', 'Other'];
const STUDY_MODES = [
  { value: 'Regular', label: 'Regular (Reg)' },
  { value: 'Self-Finance', label: 'Self-Finance (SF)' },
  { value: 'Evening', label: 'Evening (Eve)' }
];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];

const DRAFT_STORAGE_KEY = 'ulm_borrower_form_draft_v3';
const LAST_SAVED_VALUES_KEY = 'ulm_borrower_last_saved_fields_v2';

// Helper to calculate student valid until date: 30 June of (Session Year + Duration)
function computeStudentValidUntil(sessionStr: string, degree: string): string {
  let startYear = new Date().getFullYear();
  const match = (sessionStr || '').match(/(\d{2,4})/);
  if (match) {
    const val = parseInt(match[1], 10);
    if (val < 100) {
      startYear = 2000 + val;
    } else {
      startYear = val;
    }
  }
  let duration = 4;
  const upperDeg = (degree || '').trim().toUpperCase();
  if (upperDeg === 'ADP' || upperDeg === 'MS' || upperDeg === 'MPHIL') {
    duration = 2;
  } else if (upperDeg === 'PHD') {
    duration = 3;
  } else if (upperDeg === 'BS') {
    duration = 4;
  }
  const endYear = startYear + duration;
  return `${endYear}-06-30`;
}

export const AddEditBorrowerModal: React.FC<AddEditBorrowerModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onUpdate,
  borrowerToEdit,
  allBorrowers,
  onOpenExisting,
  onCreated,
}) => {
  const isEditMode = Boolean(borrowerToEdit);

  // Form Fields
  const [role, setRole] = useState<BorrowerRole>('Student');
  const [universityId, setUniversityId] = useState('');
  const [name, setName] = useState('');
  const [nameUrdu, setNameUrdu] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [department, setDepartment] = useState('Computer Science');
  const [customDept, setCustomDept] = useState('');
  
  // Student Specific
  const [rollNumber, setRollNumber] = useState('');
  const [degreeLevel, setDegreeLevel] = useState('BS');
  const [studyMode, setStudyMode] = useState('Regular');
  const [program, setProgram] = useState('Computer Science');
  const [session, setSession] = useState('FA23');
  const [semester, setSemester] = useState<number>(1);

  // Faculty / Staff Specific
  const [employeeNo, setEmployeeNo] = useState('');
  const [designation, setDesignation] = useState('Assistant Professor');

  // General Fields
  const [bloodGroup, setBloodGroup] = useState('Unknown');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [joinedDate, setJoinedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState('');
  const [borrowLimit, setBorrowLimit] = useState(3);
  const [status, setStatus] = useState<BorrowerStatus>('active');
  const [notes, setNotes] = useState('');

  // UI & Validation States
  const [idPatternWarning, setIdPatternWarning] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState<{ message: string; existingId?: string; existingName?: string } | null>(null);
  const [samePersonWarning, setSamePersonWarning] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Live Card Preview States
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');
  const [showMobilePreview, setShowMobilePreview] = useState(false);

  // Photo Crop Modal State
  const [rawPhotoToCrop, setRawPhotoToCrop] = useState<string | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

  // Last entered values (for "Save & Next" & "Same as above")
  const [lastSaved, setLastSaved] = useState<Record<string, any>>(() => {
    try {
      const data = localStorage.getItem(LAST_SAVED_VALUES_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  });

  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // Load draft or populate for edit
  useEffect(() => {
    if (!isOpen) return;

    if (borrowerToEdit) {
      setRole(borrowerToEdit.role || 'Student');
      setUniversityId(borrowerToEdit.university_id || borrowerToEdit.student_id || '');
      setName(borrowerToEdit.name || '');
      setNameUrdu(borrowerToEdit.name_urdu || '');
      setFatherName(borrowerToEdit.father_name || '');
      setDepartment(borrowerToEdit.department || 'Computer Science');
      setRollNumber(borrowerToEdit.roll_number || '');
      setDegreeLevel(borrowerToEdit.degree_level || 'BS');
      setStudyMode(borrowerToEdit.study_mode || 'Regular');
      setProgram(borrowerToEdit.program || '');
      setSession(borrowerToEdit.session || '');
      setSemester(borrowerToEdit.semester || 1);
      setEmployeeNo(borrowerToEdit.employee_no || '');
      setDesignation(borrowerToEdit.designation || 'Assistant Professor');
      setBloodGroup(borrowerToEdit.blood_group || 'Unknown');
      setPhone(borrowerToEdit.phone || '');
      setEmail(borrowerToEdit.email || '');
      setAddress(borrowerToEdit.address || '');
      setPhotoUrl(borrowerToEdit.photo_url || borrowerToEdit.photo_path || '');
      setJoinedDate(borrowerToEdit.joined_date || new Date().toISOString().split('T')[0]);
      setValidUntil(borrowerToEdit.valid_until || '');
      setBorrowLimit(borrowerToEdit.borrow_limit || (borrowerToEdit.role === 'Faculty' ? 10 : borrowerToEdit.role === 'Staff' ? 5 : 3));
      setStatus(borrowerToEdit.status || 'active');
      setNotes(borrowerToEdit.notes || '');
      setDuplicateError(null);
      setSamePersonWarning(null);
      setFormError(null);
    } else {
      // Check saved draft
      try {
        const draftStr = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (draftStr) {
          const draft = JSON.parse(draftStr);
          setRole(draft.role || 'Student');
          setUniversityId(draft.universityId || '');
          setName(draft.name || '');
          setNameUrdu(draft.nameUrdu || '');
          setFatherName(draft.fatherName || '');
          setDepartment(draft.department || 'Computer Science');
          setRollNumber(draft.rollNumber || '');
          setDegreeLevel(draft.degreeLevel || 'BS');
          setStudyMode(draft.studyMode || 'Regular');
          setProgram(draft.program || 'Computer Science');
          setSession(draft.session || 'FA23');
          setSemester(draft.semester || 1);
          setEmployeeNo(draft.employeeNo || '');
          setDesignation(draft.designation || 'Assistant Professor');
          setBloodGroup(draft.bloodGroup || 'Unknown');
          setPhone(draft.phone || '');
          setEmail(draft.email || '');
          setAddress(draft.address || '');
          setPhotoUrl(draft.photoUrl || '');
          setJoinedDate(draft.joinedDate || new Date().toISOString().split('T')[0]);
          setValidUntil(draft.validUntil || computeStudentValidUntil(draft.session || 'FA23', draft.degreeLevel || 'BS'));
          setBorrowLimit(draft.borrowLimit || 3);
          setStatus(draft.status || 'active');
          setNotes(draft.notes || '');
        } else {
          resetNewForm();
        }
      } catch {
        resetNewForm();
      }
    }
  }, [isOpen, borrowerToEdit]);

  const resetNewForm = () => {
    setRole('Student');
    setUniversityId('');
    setName('');
    setNameUrdu('');
    setFatherName('');
    setDepartment('Computer Science');
    setRollNumber('');
    setDegreeLevel('BS');
    setStudyMode('Regular');
    setProgram('Computer Science');
    setSession('FA23');
    setSemester(1);
    setEmployeeNo('');
    setDesignation('Assistant Professor');
    setBloodGroup('Unknown');
    setPhone('');
    setEmail('');
    setAddress('');
    setPhotoUrl('');
    setJoinedDate(new Date().toISOString().split('T')[0]);
    setValidUntil(computeStudentValidUntil('FA23', 'BS'));
    setBorrowLimit(3);
    setStatus('active');
    setNotes('');
    setDuplicateError(null);
    setSamePersonWarning(null);
    setFormError(null);
  };

  // Auto-compute valid until when session or degree level changes in student mode (if user hasn't typed a custom override)
  const handleSessionChange = (newSession: string) => {
    setSession(newSession);
    if (role === 'Student' && !borrowerToEdit) {
      setValidUntil(computeStudentValidUntil(newSession, degreeLevel));
    }
  };

  const handleDegreeLevelChange = (newDegree: string) => {
    setDegreeLevel(newDegree);
    if (role === 'Student' && !borrowerToEdit) {
      setValidUntil(computeStudentValidUntil(session, newDegree));
    }
  };

  // Save draft on change when adding new
  useEffect(() => {
    if (!isOpen || isEditMode) return;
    const draft = {
      role,
      universityId,
      name,
      nameUrdu,
      fatherName,
      department,
      rollNumber,
      degreeLevel,
      studyMode,
      program,
      session,
      semester,
      employeeNo,
      designation,
      bloodGroup,
      phone,
      email,
      address,
      photoUrl,
      joinedDate,
      validUntil,
      borrowLimit,
      status,
      notes,
    };
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // ignore
    }
  }, [
    isOpen,
    isEditMode,
    role,
    universityId,
    name,
    nameUrdu,
    fatherName,
    department,
    rollNumber,
    degreeLevel,
    studyMode,
    program,
    session,
    semester,
    employeeNo,
    designation,
    bloodGroup,
    phone,
    email,
    address,
    photoUrl,
    joinedDate,
    validUntil,
    borrowLimit,
    status,
    notes,
  ]);

  // Adjust default limit when role changes
  const handleRoleChange = (newRole: BorrowerRole) => {
    setRole(newRole);
    if (!isEditMode) {
      if (newRole === 'Faculty') {
        setBorrowLimit(10);
        setValidUntil('');
      } else if (newRole === 'Staff') {
        setBorrowLimit(5);
        setValidUntil('');
      } else {
        setBorrowLimit(3);
        setValidUntil(computeStudentValidUntil(session, degreeLevel));
      }
    }
  };

  // Auto-fill Session and Program from University ID pattern
  const handleUniversityIdChange = (raw: string) => {
    setUniversityId(raw);
    setDuplicateError(null);

    const trimmed = raw.trim();
    if (!trimmed) {
      setIdPatternWarning(null);
      return;
    }

    const match = trimmed.match(/^ULM-([A-Z]{2}\d{2})-([A-Z]+)-(\d{3,4})$/i);
    if (match) {
      setIdPatternWarning(null);
      if (role === 'Student') {
        const detectedSession = match[1].toUpperCase();
        const detectedProgram = match[2].toUpperCase();
        setSession(detectedSession);
        setProgram(detectedProgram);
        setValidUntil(computeStudentValidUntil(detectedSession, degreeLevel));
      }
    } else {
      setIdPatternWarning('Format note: Standard student ID follows pattern ULM-FA23-BCS-042 (Faculty & Staff IDs may vary).');
    }

    // Live duplicate check
    const existing = allBorrowers.find(
      b => (b.university_id || b.student_id).trim().toUpperCase() === trimmed.toUpperCase() && 
           b.status !== 'left' &&
           (!borrowerToEdit || b.id !== borrowerToEdit.id)
    );
    if (existing) {
      setDuplicateError({
        message: `Already exists: ${existing.name}`,
        existingId: existing.id,
        existingName: existing.name
      });
    }
  };

  // Name & Phone similarity warning
  useEffect(() => {
    if (!name.trim() || !phone.trim()) {
      setSamePersonWarning(null);
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length >= 7) {
      const match = allBorrowers.find(
        b => b.name.toLowerCase().trim() === name.toLowerCase().trim() &&
             b.phone.replace(/\D/g, '') === cleanPhone &&
             (!borrowerToEdit || b.id !== borrowerToEdit.id)
      );
      if (match) {
        setSamePersonWarning(`Notice: A borrower with name "${match.name}" and phone "${match.phone}" is already in database (${match.university_id}).`);
      } else {
        setSamePersonWarning(null);
      }
    } else {
      setSamePersonWarning(null);
    }
  }, [name, phone, allBorrowers, borrowerToEdit]);

  // Browse photo and open Drag-and-Zoom Crop Modal
  const handlePhotoBrowse = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawData = event.target?.result as string;
      if (rawData) {
        setRawPhotoToCrop(rawData);
        setIsCropModalOpen(true);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // "Same as above" helper: copies value from last saved entry
  const applySameAsAbove = (field: string) => {
    if (field in lastSaved && lastSaved[field] !== undefined) {
      const val = lastSaved[field];
      if (field === 'role') handleRoleChange(val);
      else if (field === 'department') setDepartment(val);
      else if (field === 'degreeLevel') handleDegreeLevelChange(val);
      else if (field === 'studyMode') setStudyMode(val);
      else if (field === 'program') setProgram(val);
      else if (field === 'session') handleSessionChange(val);
      else if (field === 'semester') setSemester(val);
      else if (field === 'bloodGroup') setBloodGroup(val);
      else if (field === 'validUntil') setValidUntil(val);
      else if (field === 'borrowLimit') setBorrowLimit(val);
      else if (field === 'designation') setDesignation(val);
      else if (field === 'address') setAddress(val);
    }
  };

  // Pakistani phone normalizer
  const normalizePakistaniPhone = (raw: string): string => {
    let digits = raw.replace(/\D/g, '');
    if (digits.startsWith('92') && digits.length >= 12) {
      digits = '0' + digits.substring(2);
    }
    if (digits.length === 11 && digits.startsWith('03')) {
      return `${digits.substring(0, 4)}-${digits.substring(4)}`;
    }
    return raw.trim();
  };

  // Collect & Validate
  const handleSave = (isSaveAndNext: boolean = false) => {
    setFormError(null);

    if (!universityId.trim()) {
      setFormError('University ID is required.');
      return;
    }
    if (!name.trim()) {
      setFormError('Full Name is required.');
      return;
    }
    if (!department.trim()) {
      setFormError('Department is required.');
      return;
    }

    // Phone validation
    const normPhone = normalizePakistaniPhone(phone);
    if (phone.trim() && !/^(\+92\s?3\d{2}|03\d{2})[- ]?\d{7}$/.test(phone.trim())) {
      setFormError('Please enter a valid Pakistani phone number format (03XX-XXXXXXX or +92 3XX XXXXXXX).');
      return;
    }

    // Email validation
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFormError('Please enter a valid university email address.');
      return;
    }

    // Check duplicate ID again
    const dup = allBorrowers.find(
      b => (b.university_id || b.student_id).trim().toUpperCase() === universityId.trim().toUpperCase() &&
           b.status !== 'left' &&
           (!borrowerToEdit || b.id !== borrowerToEdit.id)
    );
    if (dup) {
      setDuplicateError({
        message: `Already exists: ${dup.name}`,
        existingId: dup.id,
        existingName: dup.name
      });
      return;
    }

    const borrowerPayload = {
      role,
      university_id: universityId.trim().toUpperCase(),
      barcode: universityId.trim().toUpperCase(),
      name: name.trim(),
      name_urdu: nameUrdu.trim() || undefined,
      father_name: role === 'Student' ? fatherName.trim() : undefined,
      department: department.trim(),
      roll_number: role === 'Student' ? (rollNumber.trim() || undefined) : undefined,
      degree_level: role === 'Student' ? degreeLevel : undefined,
      study_mode: role === 'Student' ? studyMode : undefined,
      program: role === 'Student' ? program.trim() : (role === 'Faculty' ? 'Faculty' : 'Staff'),
      session: role === 'Student' ? session.trim().toUpperCase() : undefined,
      semester: role === 'Student' ? semester : null,
      employee_no: role !== 'Student' ? (employeeNo.trim() || undefined) : undefined,
      designation: role !== 'Student' ? designation.trim() : undefined,
      blood_group: bloodGroup !== 'Unknown' ? bloodGroup : undefined,
      phone: normPhone || '0300-0000000',
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      photo_url: photoUrl || undefined,
      photo_path: photoUrl || undefined,
      joined_date: joinedDate || new Date().toISOString().split('T')[0],
      valid_until: validUntil ? validUntil : null,
      borrow_limit: borrowLimit,
      status,
      notes: notes.trim() || undefined,
      student_id: universityId.trim().toUpperCase(),
    };

    if (isEditMode && borrowerToEdit && onUpdate) {
      const res = onUpdate(borrowerToEdit.id, borrowerPayload);
      if (!res.success) {
        setFormError(res.message);
        return;
      }
      onClose();
    } else {
      const res = onSave(borrowerPayload);
      if (!res.success) {
        setFormError(res.message);
        if (res.existingBorrowerId) {
          setDuplicateError({
            message: res.message,
            existingId: res.existingBorrowerId
          });
        }
        return;
      }

      // Save fields to memory for "Save & Next" and "Same as above"
      const remembered = {
        role,
        department,
        degreeLevel,
        studyMode,
        program,
        session,
        semester,
        bloodGroup,
        validUntil,
        borrowLimit,
        designation,
        address,
      };
      setLastSaved(remembered);
      try {
        localStorage.setItem(LAST_SAVED_VALUES_KEY, JSON.stringify(remembered));
      } catch {
        // ignore
      }

      if (res.borrower && onCreated) {
        onCreated(res.borrower);
      }

      if (isSaveAndNext) {
        setUniversityId('');
        setName('');
        setNameUrdu('');
        setRollNumber('');
        setEmployeeNo('');
        setFatherName('');
        setPhone('');
        setEmail('');
        setPhotoUrl('');
        setNotes('');
        setDuplicateError(null);
        setSamePersonWarning(null);
        setFormError(null);
        try {
          localStorage.removeItem(DRAFT_STORAGE_KEY);
        } catch {
          // ignore
        }
      } else {
        try {
          localStorage.removeItem(DRAFT_STORAGE_KEY);
        } catch {
          // ignore
        }
        onClose();
      }
    }
  };

  // Keyboard navigation: Enter = "Save & Next" when adding
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
      e.preventDefault();
      if (isEditMode) {
        handleSave(false);
      } else {
        handleSave(true);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  // Live Card Preview Data Object
  const previewMember: Borrower = useMemo(() => {
    const uid = universityId.trim().toUpperCase() || 'ULM-FA23-BCS-042';
    return {
      id: borrowerToEdit?.id || 'temp-preview',
      role,
      university_id: uid,
      barcode: uid,
      name: name.trim() || 'Muhammad Bilal Ahmad',
      name_urdu: nameUrdu.trim(),
      father_name: fatherName.trim(),
      department: department.trim() || 'Computer Science',
      roll_number: role === 'Student' ? (rollNumber.trim() || 'BSCS-23-42') : undefined,
      degree_level: degreeLevel,
      study_mode: studyMode,
      program: role === 'Student' ? (program.trim() || 'Computer Science') : role,
      session: role === 'Student' ? (session.trim() || 'FA23') : undefined,
      semester: role === 'Student' ? semester : null,
      employee_no: role !== 'Student' ? (employeeNo.trim() || uid) : undefined,
      designation: role !== 'Student' ? designation : undefined,
      blood_group: bloodGroup !== 'Unknown' ? bloodGroup : 'O+',
      phone: phone || '0300-1234567',
      email: email || undefined,
      address: address || undefined,
      photo_url: photoUrl || undefined,
      photo_path: photoUrl || undefined,
      joined_date: joinedDate,
      valid_until: validUntil || (role === 'Student' ? '2027-06-30' : 'PERMANENT'),
      borrow_limit: borrowLimit,
      status,
      notes: notes || undefined,
      student_id: uid,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true,
    };
  }, [
    borrowerToEdit,
    role,
    universityId,
    name,
    nameUrdu,
    fatherName,
    department,
    rollNumber,
    degreeLevel,
    studyMode,
    program,
    session,
    semester,
    employeeNo,
    designation,
    bloodGroup,
    phone,
    email,
    address,
    photoUrl,
    joinedDate,
    validUntil,
    borrowLimit,
    status,
    notes,
  ]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[9999] w-screen h-screen flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-150"
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="borrower-dialog-title"
      >
        {/* Unified Frosted Crystal Modal Container */}
        <div
          className="ulm-preserve-glass w-full max-w-[1040px] max-h-[90vh] flex flex-col rounded-[26px] bg-gradient-to-br from-white/95 via-white/90 to-white/85 dark:from-[#1B1130]/95 dark:via-[#130B24]/95 dark:to-[#0D071A]/95 backdrop-blur-2xl backdrop-saturate-[180%] border border-white/80 dark:border-white/[0.14] shadow-[0_28px_80px_rgba(15,23,42,0.32)] dark:shadow-[0_28px_80px_rgba(0,0,0,0.85)] overflow-hidden transition-all text-slate-900 dark:text-slate-100"
        >
          {/* Header */}
          <div className="shrink-0 px-6 py-4 bg-white/70 dark:bg-white/[0.03] border-b border-slate-200/80 dark:border-white/[0.10] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-500/[0.14] border border-amber-500/35 flex items-center justify-center text-amber-700 dark:text-[#FFD147] shrink-0">
                <UserPlus className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 id="borrower-dialog-title" className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-cinzel leading-tight tracking-wide truncate">
                  {isEditMode ? 'Edit Library Borrower Profile' : 'Enroll Borrower (Add Person)'}
                </h2>
                <p className="text-[11px] text-slate-600 dark:text-[#B3AABD] font-sans mt-0.5 truncate">
                  Institutional Registration · Smart CR80 Member Identification System
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Mobile Card Preview Toggle Button */}
              <button
                type="button"
                onClick={() => setShowMobilePreview(!showMobilePreview)}
                className="lg:hidden px-3 py-1.5 rounded-xl bg-amber-500/[0.14] border border-amber-500/35 text-amber-800 dark:text-[#FFD147] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Card Preview</span>
                {showMobilePreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100/80 hover:bg-slate-200/80 dark:bg-white/[0.05] dark:hover:bg-white/[0.12] border border-slate-200/80 dark:border-white/[0.10] transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* Main 12-Column Content Area: Form (7 cols) + Live CR80 Preview (5 cols) */}
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">

            {/* LEFT FORM COLUMN (lg:col-span-7) */}
            <div className="lg:col-span-7 overflow-y-auto p-5 sm:p-6 space-y-4 border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-white/[0.10]">

              {/* Form Error Banner */}
              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/12 border border-rose-500/35 text-rose-700 dark:text-rose-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Duplicate University ID Blocking Banner */}
              {duplicateError && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    <div>
                      <span className="font-bold">{duplicateError.message}</span>
                      <p className="text-[11px] text-rose-700/80 dark:text-rose-300/80 mt-0.5">
                        University ID must be strictly unique in the institutional database.
                      </p>
                    </div>
                  </div>
                  {duplicateError.existingId && onOpenExisting && (
                    <button
                      type="button"
                      onClick={() => onOpenExisting(duplicateError.existingId!)}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs transition-colors"
                    >
                      <span>Open Record</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {/* Same Person Warning (Name + Phone) */}
              {samePersonWarning && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/35 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>{samePersonWarning}</span>
                </div>
              )}

              {/* Collapsible Mobile Card Preview (Visible only on narrow screens when toggled) */}
              {showMobilePreview && (
                <div className="lg:hidden p-3.5 rounded-2xl bg-slate-100/80 dark:bg-white/[0.04] border border-amber-500/35 flex flex-col items-center gap-3">
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[11px] font-mono text-amber-700 dark:text-[#FFD147] font-bold flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" /> Live Member Card
                    </span>
                    <div className="flex items-center gap-1 bg-white/80 dark:bg-[#110A20]/90 p-1 rounded-lg border border-slate-200 dark:border-white/[0.12] text-[11px]">
                      <button
                        type="button"
                        onClick={() => setPreviewSide('front')}
                        className={`px-2.5 py-0.5 rounded-md font-semibold cursor-pointer ${previewSide === 'front' ? 'bg-[#BC881B] text-[#1A1A1A]' : 'text-slate-600 dark:text-slate-400'}`}
                      >
                        Front
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewSide('back')}
                        className={`px-2.5 py-0.5 rounded-md font-semibold cursor-pointer ${previewSide === 'back' ? 'bg-[#BC881B] text-[#1A1A1A]' : 'text-slate-600 dark:text-slate-400'}`}
                      >
                        Back
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto w-full flex justify-center py-1 ulm-preserve-dark rounded-xl">
                    <MemberCard member={previewMember} side={previewSide} scale={0.82} />
                  </div>
                </div>
              )}

              {/* Top Segmented Selector: [Student | Faculty | Staff] */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5 font-['Plus_Jakarta_Sans']">
                  Institutional Role <span className="text-amber-600 dark:text-[#FFD147]">*</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5 bg-slate-200/70 dark:bg-white/[0.04] p-1 rounded-xl border border-slate-300/80 dark:border-white/[0.12]">
                  {(['Student', 'Faculty', 'Staff'] as BorrowerRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => handleRoleChange(r)}
                      className={`h-9 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        role === r
                          ? 'bg-gradient-to-r from-[#BC881B] to-[#D4A02A] text-[#1A1A1A] shadow-sm border border-[#FFD147]/60'
                          : 'text-slate-600 dark:text-[#B3AABD] hover:text-slate-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-white/[0.06]'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5 shrink-0" />
                      <span>{r}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 1. University ID (8 cols) & Blood Group (4 cols) */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-end">
                <div className="sm:col-span-8">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5 font-['Plus_Jakarta_Sans']">
                    University ID (Unique Barcode ID) <span className="text-amber-600 dark:text-[#FFD147]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={universityId}
                    onChange={(e) => handleUniversityIdChange(e.target.value)}
                    placeholder="e.g. ULM-FA23-BCS-042"
                    className="ulm-compact-control w-full h-10 px-3.5 rounded-xl bg-white dark:bg-[#110A20]/85 border border-slate-300/90 dark:border-white/[0.14] text-[12.5px] font-['JetBrains_Mono'] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#BC881B] focus:ring-2 focus:ring-[#BC881B]/20 transition-all"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5 font-['Plus_Jakarta_Sans']">
                    Blood Group
                  </label>
                  <CustomSelect
                    value={bloodGroup}
                    onChange={(val) => setBloodGroup(String(val))}
                    options={BLOOD_GROUPS.map((b) => ({ value: b, label: b }))}
                    compact
                  />
                </div>
              </div>
              {idPatternWarning && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 -mt-2 leading-tight font-sans">
                  {idPatternWarning}
                </p>
              )}

              {/* 2. Full Name (English) & Name in Urdu (اردو نام) Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-end">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5 font-['Plus_Jakarta_Sans']">
                    Full Name (English) <span className="text-amber-600 dark:text-[#FFD147]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Muhammad Bilal Ahmad"
                    className="ulm-compact-control w-full h-10 px-3.5 rounded-xl bg-white dark:bg-[#110A20]/85 border border-slate-300/90 dark:border-white/[0.14] text-[12.5px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#BC881B] focus:ring-2 focus:ring-[#BC881B]/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-amber-800 dark:text-[#FFD147] whitespace-nowrap truncate mb-1.5 font-['Plus_Jakarta_Sans']">
                    Name in Urdu (اردو نام)
                  </label>
                  <input
                    type="text"
                    dir="rtl"
                    value={nameUrdu}
                    onChange={(e) => setNameUrdu(e.target.value)}
                    placeholder="محمد بلال احمد"
                    className="ulm-compact-control w-full h-10 px-3.5 rounded-xl bg-white dark:bg-[#110A20]/85 border border-slate-300/90 dark:border-white/[0.14] text-sm text-amber-800 dark:text-[#FFD147] placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#BC881B] focus:ring-2 focus:ring-[#BC881B]/20 font-urdu transition-all"
                    style={{ fontFamily: 'var(--font-urdu)' }}
                  />
                </div>
              </div>

              {/* 3. STUDENT ACADEMIC PROFILE (Only for students) */}
              {role === 'Student' && (
                <div className="rounded-[20px] p-4 bg-white/70 dark:bg-white/[0.03] border border-amber-400/35 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-amber-800 dark:text-[#FFD147] font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 shrink-0" /> Student Academic Profile
                    </span>
                  </div>

                  {/* Sub-Row A: Roll Number | Degree Level | Study Mode */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5 font-['Plus_Jakarta_Sans']">
                        Roll Number
                      </label>
                      <input
                        type="text"
                        value={rollNumber}
                        onChange={(e) => setRollNumber(e.target.value)}
                        placeholder="BSCS-23-42"
                        className="ulm-compact-control w-full h-10 px-3.5 rounded-xl bg-white dark:bg-[#110A20]/85 border border-slate-300/90 dark:border-white/[0.14] text-[12.5px] font-['JetBrains_Mono'] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#BC881B]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5 font-['Plus_Jakarta_Sans']">
                        Degree Level
                      </label>
                      <CustomSelect
                        value={degreeLevel}
                        onChange={(val) => handleDegreeLevelChange(String(val))}
                        options={DEGREE_LEVELS.map((d) => ({ value: d, label: d }))}
                        compact
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5 font-['Plus_Jakarta_Sans']">
                        Study Mode
                      </label>
                      <CustomSelect
                        value={studyMode}
                        onChange={(val) => setStudyMode(String(val))}
                        options={STUDY_MODES}
                        compact
                      />
                    </div>
                  </div>

                  {/* Sub-Row B: Degree Program | Session | Semester (1-8) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5 font-['Plus_Jakarta_Sans']">
                        Degree Program
                      </label>
                      <input
                        type="text"
                        value={program}
                        onChange={(e) => setProgram(e.target.value)}
                        placeholder="e.g. Computer Science"
                        className="ulm-compact-control w-full h-10 px-3.5 rounded-xl bg-white dark:bg-[#110A20]/85 border border-slate-300/90 dark:border-white/[0.14] text-[12.5px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#BC881B]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5 font-['Plus_Jakarta_Sans']">
                        Session
                      </label>
                      <input
                        type="text"
                        value={session}
                        onChange={(e) => handleSessionChange(e.target.value)}
                        placeholder="e.g. FA23, SP24"
                        className="ulm-compact-control w-full h-10 px-3.5 rounded-xl bg-white dark:bg-[#110A20]/85 border border-slate-300/90 dark:border-white/[0.14] text-[12.5px] font-['JetBrains_Mono'] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#BC881B]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5 font-['Plus_Jakarta_Sans']">
                        Semester (1–8)
                      </label>
                      <CustomSelect
                        value={semester}
                        onChange={(val) => setSemester(Number(val))}
                        options={[1, 2, 3, 4, 5, 6, 7, 8].map((s) => ({ value: s, label: `Semester ${s}` }))}
                        compact
                      />
                    </div>
                  </div>

                  {/* Sub-Row C: Full-width Father Name */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5 font-['Plus_Jakarta_Sans']">
                      Father Name
                    </label>
                    <input
                      type="text"
                      value={fatherName}
                      onChange={(e) => setFatherName(e.target.value)}
                      placeholder="e.g. Gulzar Ahmad"
                      className="ulm-compact-control w-full h-10 px-3.5 rounded-xl bg-white dark:bg-[#110A20]/85 border border-slate-300/90 dark:border-white/[0.14] text-[12.5px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#BC881B]"
                    />
                  </div>
                </div>
              )}

              {/* 4. FACULTY / STAFF PROFILE (Only for Faculty and Staff) */}
              {role !== 'Student' && (
                <div className="rounded-[20px] p-4 bg-white/70 dark:bg-white/[0.03] border border-sky-400/35 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-sky-700 dark:text-sky-300 font-bold">
                      {role} Institutional Appointment &amp; Employee Details
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-end">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5 font-['Plus_Jakarta_Sans']">
                        Designation Rank
                      </label>
                      <CustomSelect
                        value={designation}
                        onChange={(val) => setDesignation(val)}
                        options={FACULTY_STAFF_DESIGNATIONS.map((d) => ({ value: d, label: d }))}
                        compact
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5 font-['Plus_Jakarta_Sans']">
                        Employee No / Staff ID
                      </label>
                      <input
                        type="text"
                        value={employeeNo}
                        onChange={(e) => setEmployeeNo(e.target.value)}
                        placeholder="e.g. EMP-1042 or ULM-FAC-05"
                        className="ulm-compact-control w-full h-10 px-3.5 rounded-xl bg-white dark:bg-[#110A20]/85 border border-slate-300/90 dark:border-white/[0.14] text-[12.5px] font-['JetBrains_Mono'] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#BC881B]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 5. Department Selection */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5 font-['Plus_Jakarta_Sans']">
                  Department <span className="text-amber-600 dark:text-[#FFD147]">*</span>
                </label>
                <CustomSelect
                  value={department}
                  onChange={(val) => setDepartment(val)}
                  options={Array.from(new Set([...DEFAULT_DEPARTMENTS, ...(customDept ? [customDept] : [])])).map((d) => ({ value: d, label: d }))}
                  searchable
                  allowAdd
                  onAddNew={(newDept) => {
                    setCustomDept(newDept);
                    setDepartment(newDept);
                  }}
                  addNewPlaceholder="Type new department name..."
                  compact
                />
              </div>

              {/* 6. Phone & Email Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-end">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5 font-['Plus_Jakarta_Sans']">
                    Mobile Phone (03XX-XXXXXXX)
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0300-1234567 or +92 300..."
                    className="ulm-compact-control w-full h-10 px-3.5 rounded-xl bg-white dark:bg-[#110A20]/85 border border-slate-300/90 dark:border-white/[0.14] text-[12.5px] font-['JetBrains_Mono'] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#BC881B]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5 font-['Plus_Jakarta_Sans']">
                    University Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="member@ulm.edu.pk (Optional)"
                    className="ulm-compact-control w-full h-10 px-3.5 rounded-xl bg-white dark:bg-[#110A20]/85 border border-slate-300/90 dark:border-white/[0.14] text-[12.5px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#BC881B]"
                  />
                </div>
              </div>

              {/* 7. Address */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5 font-['Plus_Jakarta_Sans']">
                  Campus / Residential Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Hostels / Lakki Marwat Campus Address"
                  className="ulm-compact-control w-full h-10 px-3.5 rounded-xl bg-white dark:bg-[#110A20]/85 border border-slate-300/90 dark:border-white/[0.14] text-[12.5px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#BC881B]"
                />
              </div>

              {/* 8. Compact Frosted Crystal Passport Photo Dropzone */}
              <div className="flex items-center justify-between gap-3.5 p-3 rounded-2xl bg-white/70 dark:bg-white/[0.03] border border-dashed border-slate-300 dark:border-white/[0.16]">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-[60px] rounded-xl overflow-hidden bg-slate-100 dark:bg-[#110A20] border border-amber-500/45 flex items-center justify-center shrink-0">
                    {photoUrl ? (
                      <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-[9px] font-mono text-slate-500 dark:text-slate-400 text-center p-1 leading-tight">
                        4:5 Photo
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-800 dark:text-white block truncate">
                      Member Portrait Photo (4:5 · 300 × 375 px)
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-[#B3AABD] mt-0.5 truncate">
                      Drag-and-zoom crop ready for CR80 Smart Card printing
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoBrowse}
                    className="hidden"
                    id="borrower-modal-photo-input"
                  />
                  <label
                    htmlFor="borrower-modal-photo-input"
                    className="!mb-0 !inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-slate-800 dark:text-white border border-slate-300/90 dark:border-white/[0.14] text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <Upload className="w-3.5 h-3.5 text-amber-600 dark:text-[#FFD147]" />
                    <span>{photoUrl ? 'Change' : 'Upload'}</span>
                  </label>
                  {photoUrl && (
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      className="p-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-500/12 border border-rose-400/35 cursor-pointer transition-colors"
                      title="Remove photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* 9. Joined Date, Valid Until, Borrow Limit, Status */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5 font-['Plus_Jakarta_Sans']">
                    Joined Date
                  </label>
                  <input
                    type="date"
                    value={joinedDate}
                    onChange={(e) => setJoinedDate(e.target.value)}
                    className="ulm-compact-control w-full h-10 px-2.5 rounded-xl bg-white dark:bg-[#110A20]/85 border border-slate-300/90 dark:border-white/[0.14] text-[12px] text-slate-900 dark:text-white focus:outline-none focus:border-[#BC881B]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5 font-['Plus_Jakarta_Sans']">
                    Valid Until
                  </label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="ulm-compact-control w-full h-10 px-2.5 rounded-xl bg-white dark:bg-[#110A20]/85 border border-slate-300/90 dark:border-white/[0.14] text-[12px] text-slate-900 dark:text-white focus:outline-none focus:border-[#BC881B]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5 font-['Plus_Jakarta_Sans']">
                    Max Books Limit
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={borrowLimit}
                    onChange={(e) => setBorrowLimit(Number(e.target.value))}
                    className="ulm-compact-control w-full h-10 px-3 rounded-xl bg-white dark:bg-[#110A20]/85 border border-slate-300/90 dark:border-white/[0.14] text-[12.5px] font-['JetBrains_Mono'] text-slate-900 dark:text-white focus:outline-none focus:border-[#BC881B]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5 font-['Plus_Jakarta_Sans']">
                    Status
                  </label>
                  <CustomSelect
                    value={status}
                    onChange={(val) => setStatus(val as BorrowerStatus)}
                    options={[
                      { value: 'active', label: 'Active' },
                      { value: 'suspended', label: 'Suspended' },
                      { value: 'left', label: 'Left' },
                    ]}
                    compact
                  />
                </div>
              </div>

              {/* 10. Notes */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap truncate mb-1.5 font-['Plus_Jakarta_Sans']">
                  Institutional Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Verified by HOD, special library clearance, or remarks..."
                  className="ulm-compact-control w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#110A20]/85 border border-slate-300/90 dark:border-white/[0.14] text-[12.5px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#BC881B]"
                />
              </div>
            </div>

            {/* RIGHT COLUMN: DEDICATED LIVE CR80 CARD PREVIEW (lg:col-span-5) */}
            <div className="hidden lg:flex lg:col-span-5 overflow-y-auto p-5 bg-slate-900/[0.025] dark:bg-white/[0.02] flex-col justify-between gap-4">
              <div className="w-full space-y-4">
                {/* Preview Header + Front/Back Switcher */}
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200/80 dark:border-white/[0.10]">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/[0.14] border border-amber-500/30 flex items-center justify-center text-amber-700 dark:text-[#FFD147] shrink-0">
                      <CreditCard className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white font-cinzel leading-none">
                        Live CR80 Preview
                      </h4>
                      <p className="text-[10.5px] text-slate-500 dark:text-[#B3AABD] mt-0.5 truncate">
                        Updates in real-time as you type
                      </p>
                    </div>
                  </div>

                  {/* Side Switcher */}
                  <div className="flex items-center gap-1 bg-slate-200/75 dark:bg-white/[0.05] p-1 rounded-xl border border-slate-300/80 dark:border-white/[0.12] text-xs shrink-0">
                    <button
                      type="button"
                      onClick={() => setPreviewSide('front')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                        previewSide === 'front'
                          ? 'bg-[#BC881B] text-[#1A1A1A] shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Front
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewSide('back')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                        previewSide === 'back'
                          ? 'bg-[#BC881B] text-[#1A1A1A] shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Back
                    </button>
                  </div>
                </div>

                {/* Scaled CR80 Preview Wrapper — Fits cleanly inside lg:col-span-5 without clipping */}
                <div className="py-2 flex justify-center items-center ulm-preserve-dark rounded-2xl bg-slate-900/[0.04] dark:bg-black/25 border border-slate-200/70 dark:border-white/[0.08]">
                  <div className="transition-transform duration-200 hover:scale-[1.015]">
                    <MemberCard member={previewMember} side={previewSide} scale={0.84} />
                  </div>
                </div>

                {/* Frosted Crystal CARD SPECIFICATIONS Sub-Card */}
                <div className="rounded-[18px] p-4 bg-white/75 dark:bg-white/[0.035] border border-slate-200/85 dark:border-white/[0.12] text-[11px] font-['JetBrains_Mono'] text-slate-700 dark:text-slate-300 space-y-2">
                  <div className="text-amber-800 dark:text-[#FFD147] font-bold uppercase text-[10.5px] tracking-wider pb-1.5 border-b border-slate-200/80 dark:border-white/[0.10] flex items-center justify-between">
                    <span>Card Specifications</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">CR80 · ISO 7810</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400">Card ID:</span>
                    <span className="text-amber-800 dark:text-[#FFD147] font-bold truncate">{previewMember.university_id}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400">Cardholder:</span>
                    <span className="text-slate-900 dark:text-white font-semibold truncate max-w-[200px]">{previewMember.name}</span>
                  </div>
                  {previewMember.name_urdu && (
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500 dark:text-slate-400">اردو نام:</span>
                      <span className="text-amber-800 dark:text-[#FFD147] font-urdu">{previewMember.name_urdu}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400">Valid Until:</span>
                    <span className="text-slate-900 dark:text-slate-100 font-semibold">{previewMember.valid_until || 'PERMANENT'}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400">Circulation Limit:</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">{previewMember.borrow_limit} Books</span>
                  </div>
                  <div className="pt-2 mt-1 border-t border-slate-200/75 dark:border-white/[0.08] text-[10.5px] text-slate-500 dark:text-[#B3AABD] text-center font-sans font-medium">
                    CR80 Dual-Sided Thermal PVC Print Ready
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Footer Actions */}
          <div className="shrink-0 px-6 py-4 bg-white/80 dark:bg-white/[0.03] border-t border-slate-200/80 dark:border-white/[0.10] flex flex-wrap items-center justify-between gap-3">
            <span className="text-[11px] font-mono text-slate-500 dark:text-[#B3AABD]">
              {isEditMode ? 'Editing Borrower Profile' : 'Tip: Press [Enter] for rapid "Save & Next"'}
            </span>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-4 rounded-xl bg-slate-200/85 hover:bg-slate-300/85 dark:bg-white/[0.07] dark:hover:bg-white/[0.13] text-slate-800 dark:text-slate-100 border border-slate-300/80 dark:border-white/[0.14] text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>

              {!isEditMode && (
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  disabled={Boolean(duplicateError)}
                  className="h-9 px-4 rounded-xl bg-amber-500/[0.14] hover:bg-amber-500/25 text-amber-900 dark:text-[#FFD147] border border-amber-500/40 font-bold text-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                  title="Save this record and keep role, department and class context ready for the next person"
                >
                  <span>Save &amp; Next</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={Boolean(duplicateError)}
                className="h-9 px-5 rounded-xl bg-gradient-to-r from-[#BC881B] to-[#D4A02A] hover:brightness-110 active:scale-[0.98] text-[#1A1A1A] font-bold text-xs shadow-md border border-[#FFD147]/50 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isEditMode ? 'Save Changes' : 'Save & Close'}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Photo Crop Modal (Drag-and-Zoom 4:5 Portrait Crop) */}
      <PhotoCropModal
        isOpen={isCropModalOpen}
        imageSrc={rawPhotoToCrop || ''}
        onCropComplete={(croppedData) => {
          setPhotoUrl(croppedData);
        }}
        onClose={() => {
          setIsCropModalOpen(false);
          setRawPhotoToCrop(null);
        }}
      />
    </>,
    document.body
  );
};

export default AddEditBorrowerModal;
