import React, { useState, useEffect } from 'react';
import { X, UserPlus, Save, AlertCircle } from 'lucide-react';
import {
  Resident,
  Sex,
  CivilStatus,
  ResidencyStatus,
  CreateResidentInput,
  UpdateResidentInput
} from '../../types/resident';
import api from '../../services/api';

export interface ResidentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (resident: Resident) => void;
  resident?: Resident | null; // If provided, edit mode; otherwise create mode
}

const DEFAULT_PUROKS = [
  'Purok 1',
  'Purok 2',
  'Purok 3',
  'Purok 4',
  'Purok 5',
  'Purok 6',
  'Purok 7',
  'Sitio Centro',
  'Sitio Riverside'
];

export const ResidentFormModal: React.FC<ResidentFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  resident
}) => {
  const isEdit = !!resident;

  // Form states
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [suffix, setSuffix] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [sex, setSex] = useState<Sex | ''>('');
  const [civilStatus, setCivilStatus] = useState<CivilStatus | ''>('');
  const [nationality, setNationality] = useState('Filipino');

  const [purok, setPurok] = useState('');
  const [houseNoStreet, setHouseNoStreet] = useState('');
  const [contactNo, setContactNo] = useState('');
  const [occupation, setOccupation] = useState('');
  const [residencyStatus, setResidencyStatus] = useState<ResidencyStatus>('Active');

  // Sector flags & IDs
  const [isVoter, setIsVoter] = useState(false);
  const [precinctNo, setPrecinctNo] = useState('');
  const [isPwd, setIsPwd] = useState(false);
  const [pwdIdNo, setPwdIdNo] = useState('');
  const [pwdDisabilityType, setPwdDisabilityType] = useState('');
  const [isSoloParent, setIsSoloParent] = useState(false);
  const [soloParentIdNo, setSoloParentIdNo] = useState('');
  const [is4ps, setIs4ps] = useState(false);
  const [isIndigent, setIsIndigent] = useState(false);
  const [isOfw, setIsOfw] = useState(false);
  const [isOsy, setIsOsy] = useState(false);
  const [seniorIdNo, setSeniorIdNo] = useState('');

  // Tab state
  const [activeTab, setActiveTab] = useState<'demographics' | 'address' | 'sectors'>('demographics');
  const [purokOptions, setPurokOptions] = useState<string[]>(DEFAULT_PUROKS);
  const [streetOptions, setStreetOptions] = useState<string[]>([]);

  // UI / Error state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Fetch dynamic territory settings when modal opens
  useEffect(() => {
    if (!isOpen) return;
    api.getSystemInfo()
      .then((info) => {
        const puroksRaw = typeof info?.settings?.puroks_json === 'string' ? info.settings.puroks_json : '';
        if (puroksRaw) {
          try {
            const parsed = JSON.parse(puroksRaw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setPurokOptions(parsed);
            }
          } catch {}
        }
        const streetsRaw = typeof info?.settings?.streets_json === 'string' ? info.settings.streets_json : '';
        if (streetsRaw) {
          try {
            const parsed = JSON.parse(streetsRaw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setStreetOptions(parsed);
            }
          } catch {}
        }
      })
      .catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    setActiveTab('demographics');
    if (resident) {
      setFirstName(resident.first_name || '');
      setMiddleName(resident.middle_name || '');
      setLastName(resident.last_name || '');
      setSuffix(resident.suffix || '');
      setBirthdate(resident.birthdate || '');
      setSex(resident.sex || '');
      setCivilStatus(resident.civil_status || '');
      setNationality(resident.nationality || 'Filipino');
      setPurok(resident.purok || '');
      setHouseNoStreet(resident.house_no_street || '');
      setContactNo(resident.contact_no || '');
      setOccupation(resident.occupation || '');
      setResidencyStatus(resident.residency_status || 'Active');

      setIsVoter(Boolean(resident.is_voter));
      setPrecinctNo(resident.precinct_no || '');
      setIsPwd(Boolean(resident.is_pwd));
      setPwdIdNo(resident.pwd_id_no || '');
      setPwdDisabilityType(resident.pwd_disability_type || '');
      setIsSoloParent(Boolean(resident.is_solo_parent));
      setSoloParentIdNo(resident.solo_parent_id_no || '');
      setIs4ps(Boolean(resident.is_4ps));
      setIsIndigent(Boolean(resident.is_indigent));
      setIsOfw(Boolean(resident.is_ofw));
      setIsOsy(Boolean(resident.is_osy));
      setSeniorIdNo(resident.senior_id_no || '');
    } else {
      // Reset form
      setFirstName('');
      setMiddleName('');
      setLastName('');
      setSuffix('');
      setBirthdate('');
      setSex('');
      setCivilStatus('');
      setNationality('Filipino');
      setPurok('');
      setHouseNoStreet('');
      setContactNo('');
      setOccupation('');
      setResidencyStatus('Active');

      setIsVoter(false);
      setPrecinctNo('');
      setIsPwd(false);
      setPwdIdNo('');
      setPwdDisabilityType('');
      setIsSoloParent(false);
      setSoloParentIdNo('');
      setIs4ps(false);
      setIsIndigent(false);
      setIsOfw(false);
      setIsOsy(false);
      setSeniorIdNo('');
    }
    setErrors({});
    setGeneralError(null);
  }, [resident, isOpen]);

  if (!isOpen) return null;

  const todayStr = new Date().toISOString().split('T')[0];

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!firstName.trim()) {
      newErrors.first_name = 'First name is required';
    }
    if (!lastName.trim()) {
      newErrors.last_name = 'Last name is required';
    }
    if (!birthdate.trim()) {
      newErrors.birthdate = 'Birthdate is required';
    } else if (birthdate > todayStr) {
      newErrors.birthdate = 'Birthdate cannot be a future date';
    }
    if (!sex) {
      newErrors.sex = 'Sex is required';
    }
    if (!civilStatus) {
      newErrors.civil_status = 'Civil status is required';
    }
    if (!purok.trim()) {
      newErrors.purok = 'Purok is required';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      if (newErrors.first_name || newErrors.last_name || newErrors.birthdate || newErrors.sex || newErrors.civil_status) {
        setActiveTab('demographics');
      } else if (newErrors.purok) {
        setActiveTab('address');
      }
      setGeneralError('Please correct the validation errors below before submitting.');
      return false;
    }

    setGeneralError(null);
    return true;
  };

  const hasDemographicsError = Boolean(
    errors.first_name || errors.last_name || errors.birthdate || errors.sex || errors.civil_status
  );
  const hasAddressError = Boolean(errors.purok);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    setGeneralError(null);

    const payload: CreateResidentInput = {
      first_name: firstName.trim(),
      middle_name: middleName.trim(),
      last_name: lastName.trim(),
      suffix: suffix.trim(),
      birthdate: birthdate.trim(),
      sex: sex as Sex,
      civil_status: civilStatus as CivilStatus,
      purok: purok.trim(),
      house_no_street: houseNoStreet.trim(),
      contact_no: contactNo.trim(),
      occupation: occupation.trim(),
      nationality: nationality.trim() || 'Filipino',
      residency_status: residencyStatus,

      is_voter: isVoter ? 1 : 0,
      precinct_no: isVoter ? precinctNo.trim() : '',
      is_pwd: isPwd ? 1 : 0,
      pwd_id_no: isPwd ? pwdIdNo.trim() : '',
      pwd_disability_type: isPwd ? pwdDisabilityType.trim() : '',
      is_solo_parent: isSoloParent ? 1 : 0,
      solo_parent_id_no: isSoloParent ? soloParentIdNo.trim() : '',
      is_4ps: is4ps ? 1 : 0,
      is_indigent: isIndigent ? 1 : 0,
      is_ofw: isOfw ? 1 : 0,
      is_osy: isOsy ? 1 : 0,
      senior_id_no: seniorIdNo.trim()
    };

    try {
      let savedResident: Resident;
      if (isEdit && resident) {
        savedResident = await api.updateResident(resident.id, payload as UpdateResidentInput);
      } else {
        savedResident = await api.createResident(payload);
      }
      onSuccess(savedResident);
      onClose();
    } catch (err: any) {
      setGeneralError(err.message || 'Failed to save resident record. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto"
      data-testid="resident-form-modal"
    >
      <div className="relative w-full max-w-3xl bg-white rounded-none shadow-none border border-zinc-300 overflow-hidden my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 bg-zinc-50">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-zinc-100 text-zinc-800 rounded-none border border-zinc-200">
              {isEdit ? <Save className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-sm font-black text-zinc-950 uppercase tracking-tight">
                {isEdit ? 'Edit Resident Profile' : 'Add New Inhabitant (RBI)'}
              </h2>
              <p className="text-[11px] font-mono text-zinc-500 uppercase">
                {isEdit
                  ? 'Update demographic details and sector identifiers'
                  : 'Register a new resident in the Registry of Barangay Inhabitants'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="close-modal-btn"
            className="p-1 text-zinc-400 hover:text-zinc-700 rounded-none hover:bg-zinc-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation Strip */}
        <div className="flex border-b border-zinc-200 bg-zinc-50 select-none font-mono text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('demographics')}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-2 border-b-2 font-bold uppercase tracking-wider transition-colors ${
              activeTab === 'demographics'
                ? 'border-zinc-950 bg-white text-zinc-950'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100'
            }`}
          >
            <span
              className={`w-4 h-4 flex items-center justify-center text-[10px] rounded-none ${
                activeTab === 'demographics' ? 'bg-zinc-900 text-white' : 'bg-zinc-200 text-zinc-700'
              }`}
            >
              1
            </span>
            <span>Demographics</span>
            {hasDemographicsError && <span className="w-1.5 h-1.5 bg-red-600 inline-block ml-1" />}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('address')}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-2 border-b-2 font-bold uppercase tracking-wider transition-colors ${
              activeTab === 'address'
                ? 'border-zinc-950 bg-white text-zinc-950'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100'
            }`}
          >
            <span
              className={`w-4 h-4 flex items-center justify-center text-[10px] rounded-none ${
                activeTab === 'address' ? 'bg-zinc-900 text-white' : 'bg-zinc-200 text-zinc-700'
              }`}
            >
              2
            </span>
            <span>Address &amp; Contact</span>
            {hasAddressError && <span className="w-1.5 h-1.5 bg-red-600 inline-block ml-1" />}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sectors')}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-2 border-b-2 font-bold uppercase tracking-wider transition-colors ${
              activeTab === 'sectors'
                ? 'border-zinc-950 bg-white text-zinc-950'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100'
            }`}
          >
            <span
              className={`w-4 h-4 flex items-center justify-center text-[10px] rounded-none ${
                activeTab === 'sectors' ? 'bg-zinc-900 text-white' : 'bg-zinc-200 text-zinc-700'
              }`}
            >
              3
            </span>
            <span>Special Sectors</span>
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {generalError && (
            <div
              className="p-3 bg-red-50 border border-red-200 rounded-none text-xs font-mono text-red-700 flex items-start gap-2"
              data-testid="form-general-error"
            >
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{generalError}</span>
            </div>
          )}

          {/* Section 1: Personal Demographics */}
          <div className={activeTab === 'demographics' ? 'space-y-4' : 'hidden'}>
            <div className="flex items-center justify-between border-b border-zinc-200 pb-1.5">
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider font-mono">
                [01] Personal Demographics
              </h3>
              <span className="text-[11px] font-mono text-zinc-500">Step 1 of 3</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1 font-mono uppercase">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Juan"
                  className={`w-full px-3 py-2 text-sm border rounded-none focus:outline-none focus:ring-1 focus:ring-zinc-900 ${
                    errors.first_name
                      ? 'border-red-400 focus:ring-red-200'
                      : 'border-zinc-300'
                  }`}
                />
                {errors.first_name && (
                  <p className="text-xs text-red-600 mt-1 font-mono">{errors.first_name}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1 font-mono uppercase">
                  Middle Name
                </label>
                <input
                  type="text"
                  name="middle_name"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  placeholder="e.g. Santos"
                  className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-none focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1 font-mono uppercase">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Dela Cruz"
                  className={`w-full px-3 py-2 text-sm border rounded-none focus:outline-none focus:ring-1 focus:ring-zinc-900 ${
                    errors.last_name
                      ? 'border-red-400 focus:ring-red-200'
                      : 'border-zinc-300'
                  }`}
                />
                {errors.last_name && (
                  <p className="text-xs text-red-600 mt-1 font-mono">{errors.last_name}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1 font-mono uppercase">Suffix</label>
                <input
                  type="text"
                  name="suffix"
                  value={suffix}
                  onChange={(e) => setSuffix(e.target.value)}
                  placeholder="Jr., Sr., III"
                  className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-none focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1 font-mono uppercase">
                  Birthdate <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="birthdate"
                  value={birthdate}
                  max={todayStr}
                  onChange={(e) => setBirthdate(e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-none focus:outline-none focus:ring-1 focus:ring-zinc-900 font-mono ${
                    errors.birthdate
                      ? 'border-red-400 focus:ring-red-200'
                      : 'border-zinc-300'
                  }`}
                />
                {errors.birthdate && (
                  <p className="text-xs text-red-600 mt-1 font-mono">{errors.birthdate}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1 font-mono uppercase">
                  Sex <span className="text-red-500">*</span>
                </label>
                <select
                  name="sex"
                  value={sex}
                  onChange={(e) => setSex(e.target.value as Sex)}
                  className={`w-full px-3 py-2 text-sm border rounded-none focus:outline-none focus:ring-1 focus:ring-zinc-900 ${
                    errors.sex
                      ? 'border-red-400 focus:ring-red-200'
                      : 'border-zinc-300'
                  }`}
                >
                  <option value="">Select Sex</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
                {errors.sex && <p className="text-xs text-red-600 mt-1 font-mono">{errors.sex}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1 font-mono uppercase">
                  Civil Status <span className="text-red-500">*</span>
                </label>
                <select
                  name="civil_status"
                  value={civilStatus}
                  onChange={(e) => setCivilStatus(e.target.value as CivilStatus)}
                  className={`w-full px-3 py-2 text-sm border rounded-none focus:outline-none focus:ring-1 focus:ring-zinc-900 ${
                    errors.civil_status
                      ? 'border-red-400 focus:ring-red-200'
                      : 'border-zinc-300'
                  }`}
                >
                  <option value="">Select Status</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Widowed">Widowed</option>
                  <option value="Separated">Separated</option>
                  <option value="Live-in">Live-in</option>
                </select>
                {errors.civil_status && (
                  <p className="text-xs text-red-600 mt-1 font-mono">{errors.civil_status}</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Address & Contact */}
          <div className={activeTab === 'address' ? 'space-y-4' : 'hidden'}>
            <div className="flex items-center justify-between border-b border-zinc-200 pb-1.5">
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider font-mono">
                [02] Address &amp; Contact Details
              </h3>
              <span className="text-[11px] font-mono text-zinc-500">Step 2 of 3</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1 font-mono uppercase">
                  Purok / Sitio <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    list="purok-list"
                    name="purok"
                    value={purok}
                    onChange={(e) => setPurok(e.target.value)}
                    placeholder="e.g. Purok 1"
                    className={`w-full px-3 py-2 text-sm border rounded-none focus:outline-none focus:ring-1 focus:ring-zinc-900 ${
                      errors.purok
                        ? 'border-red-400 focus:ring-red-200'
                        : 'border-zinc-300'
                    }`}
                  />
                  <datalist id="purok-list">
                    {purokOptions.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </div>
                {errors.purok && <p className="text-xs text-red-600 mt-1 font-mono">{errors.purok}</p>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-zinc-700 mb-1 font-mono uppercase">
                  House No. &amp; Street Address
                </label>
                <input
                  type="text"
                  list="street-list"
                  name="house_no_street"
                  value={houseNoStreet}
                  onChange={(e) => setHouseNoStreet(e.target.value)}
                  placeholder="e.g. 123 Rizal St."
                  className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-none focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
                <datalist id="street-list">
                  {streetOptions.map((st) => (
                    <option key={st} value={st} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1 font-mono uppercase">
                  Contact Number
                </label>
                <input
                  type="text"
                  name="contact_no"
                  value={contactNo}
                  onChange={(e) => setContactNo(e.target.value)}
                  placeholder="0917-000-0000"
                  className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-none focus:outline-none focus:ring-1 focus:ring-zinc-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1 font-mono uppercase">Occupation</label>
                <input
                  type="text"
                  name="occupation"
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  placeholder="e.g. Farmer / Merchant"
                  className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-none focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1 font-mono uppercase">Nationality</label>
                <input
                  type="text"
                  name="nationality"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-none focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1 font-mono uppercase">
                  Residency Status
                </label>
                <select
                  name="residency_status"
                  value={residencyStatus}
                  onChange={(e) => setResidencyStatus(e.target.value as ResidencyStatus)}
                  className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-none focus:outline-none focus:ring-1 focus:ring-zinc-900"
                >
                  <option value="Active">Active</option>
                  <option value="Moved Out">Moved Out</option>
                  <option value="Deceased">Deceased</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Special Sectors & Conditional IDs */}
          <div className={activeTab === 'sectors' ? 'space-y-4' : 'hidden'}>
            <div className="flex items-center justify-between border-b border-zinc-200 pb-1.5">
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider font-mono">
                [03] Special Sector Classifications &amp; Sector IDs
              </h3>
              <span className="text-[11px] font-mono text-zinc-500">Step 3 of 3</span>
            </div>

            {/* Checkbox Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-zinc-50 p-4 rounded-none border border-zinc-200">
              <label className="flex items-center gap-2 text-xs font-medium text-zinc-800 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_voter"
                  checked={isVoter}
                  onChange={(e) => setIsVoter(e.target.checked)}
                  className="rounded-none text-zinc-900 focus:ring-0"
                />
                <span>Registered Voter</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-zinc-800 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_pwd"
                  checked={isPwd}
                  onChange={(e) => setIsPwd(e.target.checked)}
                  className="rounded-none text-zinc-900 focus:ring-0"
                />
                <span>PWD</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-zinc-800 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_solo_parent"
                  checked={isSoloParent}
                  onChange={(e) => setIsSoloParent(e.target.checked)}
                  className="rounded-none text-zinc-900 focus:ring-0"
                />
                <span>Solo Parent</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-zinc-800 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_4ps"
                  checked={is4ps}
                  onChange={(e) => setIs4ps(e.target.checked)}
                  className="rounded-none text-zinc-900 focus:ring-0"
                />
                <span>4Ps Beneficiary</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-zinc-800 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_indigent"
                  checked={isIndigent}
                  onChange={(e) => setIsIndigent(e.target.checked)}
                  className="rounded-none text-zinc-900 focus:ring-0"
                />
                <span>Indigent</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-zinc-800 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_ofw"
                  checked={isOfw}
                  onChange={(e) => setIsOfw(e.target.checked)}
                  className="rounded-none text-zinc-900 focus:ring-0"
                />
                <span>OFW</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-zinc-800 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_osy"
                  checked={isOsy}
                  onChange={(e) => setIsOsy(e.target.checked)}
                  className="rounded-none text-zinc-900 focus:ring-0"
                />
                <span>Out-of-School Youth (OSY)</span>
              </label>
            </div>

            {/* Conditional ID Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isVoter && (
                <div data-testid="precinct-field">
                  <label className="block text-xs font-semibold text-zinc-700 mb-1 font-mono uppercase">
                    Precinct Number
                  </label>
                  <input
                    type="text"
                    name="precinct_no"
                    value={precinctNo}
                    onChange={(e) => setPrecinctNo(e.target.value)}
                    placeholder="e.g. 0012A"
                    className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-none focus:outline-none focus:ring-1 focus:ring-zinc-900 font-mono"
                  />
                </div>
              )}

              {isPwd && (
                <>
                  <div data-testid="pwd-id-field">
                    <label className="block text-xs font-semibold text-zinc-700 mb-1 font-mono uppercase">
                      PWD ID Number
                    </label>
                    <input
                      type="text"
                      name="pwd_id_no"
                      value={pwdIdNo}
                      onChange={(e) => setPwdIdNo(e.target.value)}
                      placeholder="e.g. PWD-2026-001"
                      className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-none focus:outline-none focus:ring-1 focus:ring-zinc-900 font-mono"
                    />
                  </div>
                  <div data-testid="pwd-disability-field">
                    <label className="block text-xs font-semibold text-zinc-700 mb-1 font-mono uppercase">
                      Disability Type
                    </label>
                    <input
                      type="text"
                      name="pwd_disability_type"
                      value={pwdDisabilityType}
                      onChange={(e) => setPwdDisabilityType(e.target.value)}
                      placeholder="e.g. Visual Impairment, Mobility"
                      className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-none focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>
                </>
              )}

              {isSoloParent && (
                <div data-testid="solo-parent-id-field">
                  <label className="block text-xs font-semibold text-zinc-700 mb-1 font-mono uppercase">
                    Solo Parent ID Number
                  </label>
                  <input
                    type="text"
                    name="solo_parent_id_no"
                    value={soloParentIdNo}
                    onChange={(e) => setSoloParentIdNo(e.target.value)}
                    placeholder="e.g. SP-2026-0042"
                    className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-none focus:outline-none focus:ring-1 focus:ring-zinc-900 font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1 font-mono uppercase">
                  Senior Citizen ID No. (OSCA)
                </label>
                <input
                  type="text"
                  name="senior_id_no"
                  value={seniorIdNo}
                  onChange={(e) => setSeniorIdNo(e.target.value)}
                  placeholder="e.g. OSCA-9921"
                  className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-none focus:outline-none focus:ring-1 focus:ring-zinc-900 font-mono"
                />
                <p className="text-[10px] text-zinc-400 font-mono mt-1">
                  Senior status is auto-computed when birthdate indicates age &ge; 60.
                </p>
              </div>
            </div>
          </div>

          {/* Modal Footer with Stepper Controls */}
          <div className="flex items-center justify-between gap-2 pt-4 border-t border-zinc-200">
            <div>
              {activeTab === 'demographics' ? (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="px-3.5 py-1.5 text-xs font-mono font-medium text-zinc-800 bg-white border border-zinc-300 rounded-none hover:bg-zinc-100 uppercase tracking-wider transition-colors"
                >
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveTab(activeTab === 'sectors' ? 'address' : 'demographics')}
                  className="px-3 py-1.5 text-xs font-mono font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded-none uppercase tracking-wider transition-colors"
                >
                  &larr; Previous Step
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {activeTab !== 'sectors' && (
                <button
                  type="button"
                  onClick={() => setActiveTab(activeTab === 'demographics' ? 'address' : 'sectors')}
                  className="px-3.5 py-1.5 text-xs font-mono font-semibold text-zinc-900 bg-zinc-100 hover:bg-zinc-200 border border-zinc-400 rounded-none uppercase tracking-wider transition-colors"
                >
                  {activeTab === 'demographics' ? 'Next: Address \u2192' : 'Next: Special Sectors \u2192'}
                </button>
              )}

              <button
                type="submit"
                disabled={submitting}
                data-testid="submit-resident-btn"
                className="px-4 py-1.5 text-xs font-mono font-semibold text-white bg-zinc-900 hover:bg-black disabled:opacity-50 rounded-none uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-none"
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-none animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    {isEdit ? <Save className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                    <span>{isEdit ? 'Save Changes' : 'Register Resident'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResidentFormModal;
