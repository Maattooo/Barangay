import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileCheck2,
  Search,
  User,
  AlertTriangle,
  Printer,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import api from '../services/api';
import { Resident } from '../types/resident';
import {
  CertificateTemplate,
  BarangayOfficial,
  BlotterCheckResponse,
  PreviewIssuanceResponse,
  CreateIssuanceInput
} from '../types/certificates';
import { BlotterAlertCard } from '../components/certificates/BlotterAlertModal';
import PrintPreviewModal from '../components/certificates/PrintPreviewModal';

// Step 3: Certificate Details State
const PURPOSE_PRESETS = [
  'Local Employment',
  'Bank Requirement',
  'Medical Assistance',
  'Scholarship Application',
  'Postal ID / Valid ID',
  'Business Permit',
  'Building Permit',
  'Legal Documentation'
];

export const NewCertificatePage: React.FC = () => {
  const navigate = useNavigate();

  // Wizard Navigation: Step 1 (Resident), Step 2 (Blotter Gatekeeper), Step 3 (Details), Step 4 (Signatory & Preview)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Resident Selection State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Resident[]>([]);
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);

  // Step 2: Blotter Gatekeeper State
  const [isCheckingBlotter, setIsCheckingBlotter] = useState(false);
  const [blotterStatus, setBlotterStatus] = useState<BlotterCheckResponse | null>(null);
  const [isOverrideAuthorized, setIsOverrideAuthorized] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [gatekeeperError, setGatekeeperError] = useState<string | null>(null);

  // Step 3: Certificate Details State
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('');
  const [purpose, setPurpose] = useState('');
  const [amountPaid, setAmountPaid] = useState<number>(50);
  const [isFreeExempt, setIsFreeExempt] = useState(false);
  const [orNumber, setOrNumber] = useState('');
  const [ctcNumber, setCtcNumber] = useState('');
  const [ctcDateIssued, setCtcDateIssued] = useState('');
  const [ctcPlaceIssued, setCtcPlaceIssued] = useState('');
  const [barangayLogoUrl, setBarangayLogoUrl] = useState('');
  const [cityLogoUrl, setCityLogoUrl] = useState('');

  // Step 4: Signatory Assignment & Preview State
  const [officials, setOfficials] = useState<BarangayOfficial[]>([]);
  const [selectedSignatoryId, setSelectedSignatoryId] = useState<number | ''>('');
  const [isOicSigning, setIsOicSigning] = useState(false);

  // Preview & Print Modal State
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewIssuanceResponse | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Active blotter check request tracking to prevent race conditions
  const activeResidentCheckIdRef = useRef<number | null>(null);

  // Fetch initial templates, officials, and system settings
  useEffect(() => {
    let isMounted = true;

    api.getSystemInfo()
      .then((info) => {
        if (!isMounted) return;
        const s = info?.settings || {};
        const municipality = s.municipality_name || s.municipality;
        const province = s.province_name || s.province;
        const place = [municipality, province].filter(Boolean).join(', ');
        if (place) {
          setCtcPlaceIssued((prev) => (prev ? prev : place));
        }
        if (s.barangay_logo_url) setBarangayLogoUrl(s.barangay_logo_url as string);
        if (s.city_logo_url) setCityLogoUrl(s.city_logo_url as string);
      })
      .catch(() => {});

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    setCtcDateIssued(`${y}-${m}-${d}`);

    api.getTemplates()
      .then((data: CertificateTemplate[]) => {
        if (!isMounted) return;
        setTemplates(data.filter((t: CertificateTemplate) => t.is_active === 1));
      })
      .catch((err: unknown) => console.error('Failed to load templates:', err));

    api.getOfficials()
      .then((data: BarangayOfficial[]) => {
        if (!isMounted) return;
        const active = data.filter((o: BarangayOfficial) => o.is_active === 1);
        setOfficials(active);
        // Default to Punong Barangay or first active official
        const pb = active.find((o: BarangayOfficial) => o.position === 'Punong Barangay');
        if (pb) {
          setSelectedSignatoryId(pb.id);
        } else if (active.length > 0) {
          setSelectedSignatoryId(active[0].id);
        }
      })
      .catch((err: unknown) => console.error('Failed to load officials:', err));

    return () => {
      isMounted = false;
    };
  }, []);

  // Debounced resident search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.getResidents({ search: searchQuery.trim(), limit: 5 });
        setSearchResults(res.data);
      } catch (err: unknown) {
        console.error('Resident search failed:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Trigger automated blotter gatekeeper check when a resident is selected
  const triggerBlotterCheck = async (resident: Resident) => {
    activeResidentCheckIdRef.current = resident.id;
    setIsCheckingBlotter(true);
    setGatekeeperError(null);
    setBlotterStatus(null);
    setIsOverrideAuthorized(false);
    setOverrideReason('');

    try {
      const result = await api.checkResidentBlotter(resident.id);
      if (activeResidentCheckIdRef.current === resident.id) {
        setBlotterStatus(result);
      }
    } catch (err: any) {
      if (activeResidentCheckIdRef.current === resident.id) {
        setGatekeeperError(err?.message || 'Failed to verify blotter records for resident.');
      }
    } finally {
      if (activeResidentCheckIdRef.current === resident.id) {
        setIsCheckingBlotter(false);
      }
    }
  };

  const handleSelectResident = (resident: Resident) => {
    setSelectedResident(resident);
    setSearchQuery('');
    setSearchResults([]);
    triggerBlotterCheck(resident);
    setCurrentStep(2);
  };

  const handleResetResident = () => {
    activeResidentCheckIdRef.current = null;
    setSelectedResident(null);
    setBlotterStatus(null);
    setIsOverrideAuthorized(false);
    setOverrideReason('');
    setGatekeeperError(null);
    setCurrentStep(1);
  };

  // Step 2 Gatekeeper Validation logic: Can proceed if cleared OR (override authorized AND valid reason >= 10 chars)
  const canProceedFromStep2 = useMemo(() => {
    if (!blotterStatus) return false;
    if (blotterStatus.cleared) return true;
    return isOverrideAuthorized && overrideReason.trim().length >= 10;
  }, [blotterStatus, isOverrideAuthorized, overrideReason]);

  const handleProceedToStep3 = () => {
    if (!canProceedFromStep2) {
      if (blotterStatus && !blotterStatus.cleared) {
        if (!isOverrideAuthorized) {
          setGatekeeperError('Clearance is locked due to active blotter records. You must authorize an override to proceed.');
        } else if (overrideReason.trim().length < 10) {
          setGatekeeperError('Override justification must contain at least 10 non-whitespace characters.');
        }
      }
      return;
    }
    setGatekeeperError(null);
    setCurrentStep(3);
  };

  // Handle template selection and default fee prefill
  const handleTemplateChange = (templateId: number) => {
    setSelectedTemplateId(templateId);
    const tpl = templates.find((t: CertificateTemplate) => t.id === templateId);
    if (tpl) {
      if (!isFreeExempt) {
        setAmountPaid(tpl.default_fee);
      }
    }
  };

  const handleFreeExemptToggle = (checked: boolean) => {
    setIsFreeExempt(checked);
    if (checked) {
      setAmountPaid(0);
      setOrNumber('FREE / EXEMPT');
    } else {
      const tpl = templates.find((t: CertificateTemplate) => t.id === selectedTemplateId);
      setAmountPaid(tpl ? tpl.default_fee : 50);
      if (orNumber === 'FREE / EXEMPT') {
        setOrNumber('');
      }
    }
  };

  const handleAmountChange = (val: number) => {
    setAmountPaid(val);
    if (val === 0) {
      setIsFreeExempt(true);
      setOrNumber('FREE / EXEMPT');
    } else if (isFreeExempt) {
      setIsFreeExempt(false);
      if (orNumber === 'FREE / EXEMPT') {
        setOrNumber('');
      }
    }
  };

  // Step 3 Validation: Template and Purpose are required
  const canProceedFromStep3 = useMemo(() => {
    return Boolean(selectedTemplateId && purpose.trim().length > 0);
  }, [selectedTemplateId, purpose]);

  // Request HTML Live Preview from server
  const handlePreviewCertificate = async () => {
    if (!selectedResident || selectedTemplateId === '' || !selectedSignatoryId) {
      setFormError('Please complete all required fields before generating preview.');
      return;
    }

    setFormError(null);
    setIsPreviewLoading(true);

    const payload = {
      resident_id: selectedResident.id,
      template_id: Number(selectedTemplateId),
      purpose: purpose.trim(),
      or_number: orNumber.trim() || (amountPaid === 0 ? 'FREE / EXEMPT' : ''),
      amount_paid: amountPaid,
      ctc_number: ctcNumber.trim() || undefined,
      ctc_date_issued: ctcDateIssued.trim() || undefined,
      ctc_place_issued: ctcPlaceIssued.trim() || undefined,
      signatory_official_id: Number(selectedSignatoryId),
      is_oic_signing: isOicSigning ? 1 : 0,
      is_override: isOverrideAuthorized,
      blotter_override_reason: isOverrideAuthorized ? overrideReason.trim() : undefined
    };

    try {
      const res = await api.previewIssuance(payload);
      setPreviewData(res);
      setIsPreviewModalOpen(true);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to generate certificate preview.');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const selectedSignatory = useMemo(() => {
    return officials.find((o: BarangayOfficial) => o.id === selectedSignatoryId);
  }, [officials, selectedSignatoryId]);

  // Prepared CreateIssuanceInput payload for the preview modal
  const createIssuancePayload: CreateIssuanceInput | undefined = useMemo(() => {
    if (!selectedResident || selectedTemplateId === '' || !selectedSignatoryId) {
      return undefined;
    }
    return {
      resident_id: selectedResident.id,
      template_id: Number(selectedTemplateId),
      purpose: purpose.trim(),
      or_number: orNumber.trim() || (amountPaid === 0 ? 'FREE / EXEMPT' : ''),
      amount_paid: amountPaid,
      ctc_number: ctcNumber.trim() || undefined,
      ctc_date_issued: ctcDateIssued.trim() || undefined,
      ctc_place_issued: ctcPlaceIssued.trim() || undefined,
      signatory_official_id: Number(selectedSignatoryId),
      is_oic_signing: isOicSigning ? 1 : 0,
      is_override: isOverrideAuthorized,
      blotter_override_reason: isOverrideAuthorized ? overrideReason.trim() : undefined
    };
  }, [
    selectedResident,
    selectedTemplateId,
    selectedSignatoryId,
    purpose,
    orNumber,
    amountPaid,
    ctcNumber,
    ctcDateIssued,
    ctcPlaceIssued,
    isOicSigning,
    isOverrideAuthorized,
    overrideReason
  ]);

  return (
    <div className="space-y-4">
      {/* Wizard Header */}
      <div className="bg-white p-4 sm:p-5 rounded-none border border-zinc-200 shadow-none flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-zinc-100 text-zinc-800 rounded-none border border-zinc-200">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-zinc-950 uppercase tracking-tight">
              Issue Official Certificate
            </h1>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">
              4-Step Guided Issuance Wizard with Blotter Gatekeeper &amp; Live Print
            </p>
          </div>
        </div>

        {/* Wizard Progress Stepper */}
        <div className="flex items-center gap-1 sm:gap-1.5 font-mono">
          {[
            { step: 1, label: 'Resident' },
            { step: 2, label: 'Gatekeeper' },
            { step: 3, label: 'Details' },
            { step: 4, label: 'Signatory' }
          ].map((item, idx) => {
            const isActive = currentStep === item.step;
            const isCompleted = currentStep > item.step;
            return (
              <React.Fragment key={item.step}>
                {idx > 0 && (
                  <div className={`h-px w-3 sm:w-4 ${isCompleted ? 'bg-zinc-900' : 'bg-zinc-200'}`} />
                )}
                <button
                  type="button"
                  onClick={() => {
                    // Allow navigating back or forward if validated
                    if (item.step === 1) setCurrentStep(1);
                    else if (item.step === 2 && selectedResident) setCurrentStep(2);
                    else if (item.step === 3 && selectedResident && canProceedFromStep2) setCurrentStep(3);
                    else if (item.step === 4 && selectedResident && canProceedFromStep2 && canProceedFromStep3) setCurrentStep(4);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-none text-xs font-semibold uppercase tracking-wider transition-colors ${
                    isActive
                      ? 'bg-zinc-900 text-white'
                      : isCompleted
                      ? 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 border border-zinc-300'
                      : 'bg-zinc-50 text-zinc-400 border border-zinc-200 cursor-not-allowed'
                  }`}
                >
                  <span className="font-mono text-[10px]">
                    0{item.step}
                  </span>
                  <span className="hidden sm:inline text-[11px]">{item.label}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Selected Resident Persistent Summary Card (Visible across steps 2, 3, 4) */}
      {selectedResident && (
        <div
          data-testid="resident-summary-card"
          className="bg-white p-4 sm:p-5 rounded-none border border-zinc-200 shadow-none flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-zinc-100 text-zinc-800 rounded-none border border-zinc-200 flex-shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-black text-zinc-950 uppercase tracking-tight">
                  {[selectedResident.first_name, selectedResident.middle_name, selectedResident.last_name, selectedResident.suffix]
                    .filter(Boolean)
                    .join(' ')
                    .toUpperCase()}
                </h3>
                <span className="px-2 py-0.5 rounded-none text-[10px] font-mono font-bold uppercase bg-zinc-100 text-zinc-800 border border-zinc-200">
                  {selectedResident.purok}
                </span>
                {selectedResident.is_senior && (
                  <span className="px-2 py-0.5 rounded-none text-[10px] font-mono font-bold uppercase bg-amber-50 text-amber-800 border border-amber-300">
                    Senior Citizen
                  </span>
                )}
                {selectedResident.is_pwd === 1 && (
                  <span className="px-2 py-0.5 rounded-none text-[10px] font-mono font-bold uppercase bg-zinc-100 text-zinc-800 border border-zinc-300">
                    PWD
                  </span>
                )}
                {selectedResident.is_4ps === 1 && (
                  <span className="px-2 py-0.5 rounded-none text-[10px] font-mono font-bold uppercase bg-blue-50 text-blue-800 border border-blue-300">
                    4Ps
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs font-mono text-zinc-600 flex-wrap">
                <span><strong>Birthdate:</strong> {selectedResident.birthdate}</span>
                <span><strong>Age:</strong> {selectedResident.age} years old</span>
                <span><strong>Sex:</strong> {selectedResident.sex}</span>
                <span><strong>Civil Status:</strong> {selectedResident.civil_status}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetResident}
            data-testid="change-resident-button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-none border border-zinc-300 text-xs font-mono font-semibold uppercase tracking-wider text-zinc-800 hover:bg-zinc-100 transition-colors self-start md:self-center"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Change Resident</span>
          </button>
        </div>
      )}

      {/* STEP 1: Resident Search & Selection */}
      {currentStep === 1 && (
        <div className="bg-white p-4 sm:p-5 rounded-none border border-zinc-200 shadow-none space-y-4">
          <div className="border-b border-zinc-200 pb-3">
            <h2 className="text-sm font-bold text-zinc-950 uppercase tracking-tight">Step 1: Select Resident</h2>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">Search the Registry of Barangay Inhabitants (RBI) by first or last name</p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              id="resident-search-input"
              data-testid="resident-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search resident by name (e.g. Juan Dela Cruz)..."
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-none border border-zinc-300 bg-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
              autoFocus
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-2.5 w-4 h-4 text-zinc-600 animate-spin" />
            )}
          </div>

          {/* Search Results List */}
          {searchResults.length > 0 && (
            <div className="divide-y divide-zinc-200 rounded-none border border-zinc-200 bg-white overflow-hidden shadow-none font-mono text-xs">
              {searchResults.map((resident) => (
                <div
                  key={resident.id}
                  data-testid={`resident-result-${resident.id}`}
                  className="p-3 hover:bg-zinc-50 flex items-center justify-between gap-4 transition-colors"
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold font-sans text-zinc-950 uppercase">
                      {[resident.first_name, resident.middle_name, resident.last_name, resident.suffix].filter(Boolean).join(' ')}
                    </p>
                    <p className="text-[11px] text-zinc-500 font-mono">
                      {resident.purok} • Born {resident.birthdate} ({resident.age} yrs) • {resident.civil_status}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectResident(resident)}
                    data-testid={`select-resident-btn-${resident.id}`}
                    className="px-3 py-1 bg-zinc-900 hover:bg-black text-white text-xs font-mono font-semibold uppercase tracking-wider rounded-none transition-colors"
                  >
                    Select
                  </button>
                </div>
              ))}
            </div>
          )}

          {searchQuery && !isSearching && searchResults.length === 0 && (
            <div className="p-8 text-center text-zinc-500 font-mono text-xs border border-dashed border-zinc-300 rounded-none">
              No matching resident found in RBI records. Check spelling or register resident first.
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Automated Blotter Gatekeeper Verification */}
      {currentStep === 2 && selectedResident && (
        <div className="bg-white p-4 sm:p-5 rounded-none border border-zinc-200 shadow-none space-y-4">
          <div className="border-b border-zinc-200 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-zinc-950 uppercase tracking-tight">Step 2: Automated Blotter Gatekeeper Check</h2>
              <p className="text-xs text-zinc-500 font-mono mt-0.5">Verifying Lupong Tagapamayapa records for active dispute filings</p>
            </div>
            {isCheckingBlotter && (
              <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-600">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Checking records...</span>
              </div>
            )}
          </div>

          {/* Cleared Banner */}
          {blotterStatus && blotterStatus.cleared && (
            <div
              data-testid="blotter-cleared-badge"
              className="p-4 rounded-none bg-emerald-50/70 border-l-4 border-l-emerald-600 border border-emerald-300 text-emerald-950 flex items-start gap-3 shadow-none"
            >
              <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-none border border-emerald-200 flex-shrink-0 mt-0.5">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-emerald-950 uppercase tracking-tight">
                  Cleared: No Pending Blotter Record
                </h3>
                <p className="text-xs text-emerald-800 font-mono mt-0.5 leading-relaxed">
                  Automated gatekeeper verification confirmed zero active, mediation, or CFA cases filed against this resident.
                  Advancement unlocked.
                </p>
              </div>
            </div>
          )}

          {/* Red Warning Card when Flagged */}
          {blotterStatus && !blotterStatus.cleared && (
            <BlotterAlertCard
              cases={blotterStatus.cases}
              isOverride={isOverrideAuthorized}
              onOverrideChange={setIsOverrideAuthorized}
              overrideReason={overrideReason}
              onReasonChange={setOverrideReason}
              validationError={gatekeeperError}
            />
          )}

          {/* Step 2 Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-zinc-200">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-none border border-zinc-300 text-xs font-mono font-semibold uppercase tracking-wider text-zinc-800 hover:bg-zinc-100 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Resident</span>
            </button>

            <button
              type="button"
              onClick={handleProceedToStep3}
              disabled={!canProceedFromStep2}
              data-testid="proceed-to-step-3-button"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-none bg-zinc-900 hover:bg-black text-white text-xs font-mono font-semibold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-none"
            >
              <span>Proceed to Certificate Details</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Certificate Details & Fees */}
      {currentStep === 3 && (
        <div className="bg-white p-4 sm:p-5 rounded-none border border-zinc-200 shadow-none space-y-5">
          <div className="border-b border-zinc-200 pb-3">
            <h2 className="text-sm font-bold text-zinc-950 uppercase tracking-tight">Step 3: Certificate Details &amp; Accounting</h2>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">Configure certificate template type, purpose, and fee assessment</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Template Selector */}
            <div className="space-y-1 md:col-span-2">
              <label htmlFor="certificate-template-select" className="text-xs font-mono font-semibold uppercase text-zinc-700">
                Certificate Template <span className="text-red-500">*</span>
              </label>
              <select
                id="certificate-template-select"
                data-testid="certificate-template-select"
                value={selectedTemplateId}
                onChange={(e) => handleTemplateChange(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs sm:text-sm font-mono rounded-none border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
              >
                <option value="">-- Choose Certificate Template --</option>
                {templates.map((tpl: CertificateTemplate) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.template_name} ({tpl.template_code}) — Default Fee: ₱{tpl.default_fee.toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            {/* Purpose */}
            <div className="space-y-1 md:col-span-2">
              <label htmlFor="certificate-purpose-input" className="text-xs font-mono font-semibold uppercase text-zinc-700">
                Purpose of Certification <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                list="purpose-presets-list"
                id="certificate-purpose-input"
                data-testid="certificate-purpose-input"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. Local Employment, Bank Requirement, Medical Assistance, Postal ID..."
                className="w-full px-3 py-1.5 text-xs sm:text-sm rounded-none border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
              />
              <datalist id="purpose-presets-list">
                {PURPOSE_PRESETS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>

              {/* Purpose Quick Preset Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] font-mono text-zinc-500 uppercase">Quick Presets:</span>
                {PURPOSE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setPurpose(preset)}
                    className={`px-2 py-0.5 text-[11px] font-mono rounded-none border transition-colors ${
                      purpose === preset
                        ? 'bg-zinc-900 text-white border-zinc-900 font-semibold'
                        : 'bg-zinc-100 text-zinc-700 border-zinc-200 hover:bg-zinc-200'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount Paid */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="certificate-fee-input" className="text-xs font-mono font-semibold uppercase text-zinc-700">
                  Amount Paid (PHP)
                </label>
                <label className="flex items-center gap-1.5 text-xs font-mono text-zinc-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFreeExempt}
                    onChange={(e) => handleFreeExemptToggle(e.target.checked)}
                    className="h-3.5 w-3.5 rounded-none border-zinc-300 text-zinc-900 focus:ring-0"
                  />
                  <span>Free / Exempt</span>
                </label>
              </div>
              <input
                type="number"
                id="certificate-fee-input"
                data-testid="certificate-fee-input"
                step="0.01"
                min="0"
                value={amountPaid}
                disabled={isFreeExempt}
                onChange={(e) => handleAmountChange(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 text-xs sm:text-sm font-mono rounded-none border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 disabled:bg-zinc-100 disabled:text-zinc-400 transition-colors"
              />
            </div>

            {/* Official Receipt (OR) Number */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="certificate-or-input" className="text-xs font-mono font-semibold uppercase text-zinc-700">
                  Official Receipt (OR) Number
                </label>
                {!isFreeExempt && (
                  <button
                    type="button"
                    onClick={() => {
                      const yr = new Date().getFullYear();
                      const rand = Math.floor(10000 + Math.random() * 90000);
                      setOrNumber(`OR-${yr}-${rand}`);
                    }}
                    className="text-[10px] font-mono text-zinc-600 hover:text-zinc-950 underline"
                  >
                    Auto-Generate OR
                  </button>
                )}
              </div>
              <input
                type="text"
                id="certificate-or-input"
                data-testid="certificate-or-input"
                value={orNumber}
                onChange={(e) => setOrNumber(e.target.value)}
                placeholder={isFreeExempt ? 'FREE / EXEMPT' : 'e.g. OR-2026-99124'}
                className="w-full px-3 py-1.5 text-xs sm:text-sm font-mono rounded-none border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
              />
            </div>

            {/* Community Tax Certificate (CTC / Cedula) Optional Fields */}
            <div className="md:col-span-2 pt-2 border-t border-zinc-200 space-y-2">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-700">
                Community Tax Certificate (Cedula) Details (Optional)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <label htmlFor="ctc-number-input" className="text-[11px] font-mono text-zinc-600">
                    CTC Number
                  </label>
                  <input
                    type="text"
                    id="ctc-number-input"
                    data-testid="ctc-number-input"
                    value={ctcNumber}
                    onChange={(e) => setCtcNumber(e.target.value)}
                    placeholder="e.g. CTC-08129482"
                    className="w-full px-2.5 py-1 text-xs font-mono rounded-none border border-zinc-300 bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="ctc-date-input" className="text-[11px] font-mono text-zinc-600">
                    Date Issued
                  </label>
                  <input
                    type="date"
                    id="ctc-date-input"
                    data-testid="ctc-date-input"
                    value={ctcDateIssued}
                    onChange={(e) => setCtcDateIssued(e.target.value)}
                    className="w-full px-2.5 py-1 text-xs font-mono rounded-none border border-zinc-300 bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="ctc-place-input" className="text-[11px] font-mono text-zinc-600">
                    Place Issued
                  </label>
                  <input
                    type="text"
                    id="ctc-place-input"
                    data-testid="ctc-place-input"
                    value={ctcPlaceIssued}
                    onChange={(e) => setCtcPlaceIssued(e.target.value)}
                    placeholder="e.g. Los Baños, Laguna"
                    className="w-full px-2.5 py-1 text-xs rounded-none border border-zinc-300 bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900 transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-zinc-200">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-none border border-zinc-300 text-xs font-mono font-semibold uppercase tracking-wider text-zinc-800 hover:bg-zinc-100 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Gatekeeper</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              disabled={!canProceedFromStep3}
              data-testid="proceed-to-step-4-button"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-none bg-zinc-900 hover:bg-black text-white text-xs font-mono font-semibold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-none"
            >
              <span>Proceed to Signatory Selection</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Signatory Assignment & Preview */}
      {currentStep === 4 && (
        <div className="bg-white p-4 sm:p-5 rounded-none border border-zinc-200 shadow-none space-y-5">
          <div className="border-b border-zinc-200 pb-3">
            <h2 className="text-sm font-bold text-zinc-950 uppercase tracking-tight">Step 4: Signatory Assignment &amp; Final Review</h2>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">Designate the authorized signatory official and preview the legal document</p>
          </div>

          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs font-mono rounded-none flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Signatory Dropdown */}
            <div className="space-y-1">
              <label htmlFor="signatory-official-select" className="text-xs font-mono font-semibold uppercase text-zinc-700">
                Signatory Official <span className="text-red-500">*</span>
              </label>
              <select
                id="signatory-official-select"
                data-testid="signatory-official-select"
                value={selectedSignatoryId}
                onChange={(e) => setSelectedSignatoryId(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs sm:text-sm font-mono rounded-none border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
              >
                <option value="">-- Choose Signatory Official --</option>
                {officials.map((official: BarangayOfficial) => (
                  <option key={official.id} value={official.id}>
                    {official.full_name} — {official.position} {official.committee ? `(${official.committee})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* OIC Toggle Checkbox */}
            <div className="p-3 rounded-none border border-zinc-200 bg-zinc-50 space-y-1 font-mono">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="oic-signing-toggle"
                  data-testid="oic-signing-toggle"
                  checked={isOicSigning}
                  onChange={(e) => setIsOicSigning(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded-none border-zinc-300 text-zinc-900 focus:ring-0"
                />
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                    Sign as Officer-in-Charge (OIC) / By Authority of the Punong Barangay
                  </span>
                  <p className="text-[11px] text-zinc-500 font-sans mt-0.5">
                    When enabled, the signatory title reflects "Sangguniang Barangay Member" with the subtitle "By Authority of the Punong Barangay".
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Step 4 Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-zinc-200">
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-none border border-zinc-300 text-xs font-mono font-semibold uppercase tracking-wider text-zinc-800 hover:bg-zinc-100 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Details</span>
            </button>

            <button
              type="button"
              onClick={handlePreviewCertificate}
              disabled={isPreviewLoading || !selectedSignatoryId}
              data-testid="preview-certificate-button"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-none bg-zinc-900 hover:bg-black text-white text-xs font-mono font-semibold uppercase tracking-wider transition-colors disabled:opacity-50 shadow-none"
            >
              {isPreviewLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating Preview...</span>
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  <span>Preview Certificate</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Interactive Print Preview Modal */}
      {isPreviewModalOpen && previewData && (
        <PrintPreviewModal
          isOpen={isPreviewModalOpen}
          onClose={() => setIsPreviewModalOpen(false)}
          mode="create"
          createPayload={createIssuancePayload}
          barangayLogoUrl={barangayLogoUrl}
          cityLogoUrl={cityLogoUrl}
          previewData={{
            html: previewData.html,
            title_header: previewData.title_header,
            show_officials_sidebar: previewData.show_officials_sidebar,
            control_number_preview: previewData.control_number_preview,
            sidebar_officials: previewData.sidebar_officials,
            resident_name: selectedResident ? `${selectedResident.first_name} ${selectedResident.last_name}` : undefined,
            signatory_name: selectedSignatory?.full_name,
            signatory_position: selectedSignatory?.position,
            is_oic_signing: isOicSigning
          }}
          onSuccess={(result) => {
            setIsPreviewModalOpen(false);
            const residentName = selectedResident ? `${selectedResident.first_name} ${selectedResident.last_name}` : 'resident';
            navigate('/certificates', {
              state: {
                successMessage: `Certificate ${result.issuance.control_number} successfully issued for ${residentName}.`
              }
            });
          }}
        />
      )}
    </div>
  );
};

export default NewCertificatePage;
