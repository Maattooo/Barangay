import React, { useState, useEffect } from 'react';
import { X, Search, ShieldAlert, Loader2, Check } from 'lucide-react';
import api from '../../services/api';
import { CreateBlotterInput, BlotterStatus } from '../../types/admin';
import { Resident } from '../../types/resident';

const COMMON_INCIDENT_TYPES = [
  'Boundary Dispute',
  'Noise Barrage / Disturbance of Peace',
  'Physical Injury / Altercation',
  'Unjust Vexation',
  'Property Damage',
  'Threats / Harassment',
  'Debt / Financial Conflict',
  'Slander / Oral Defamation',
  'Pet Nuisance / Animal Attack',
  'Curfew Violation'
];

interface BlotterFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const BlotterFormModal: React.FC<BlotterFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [complainantName, setComplainantName] = useState('');
  const [complainantId, setComplainantId] = useState<number | null>(null);
  const [respondentName, setRespondentName] = useState('');
  const [respondentId, setRespondentId] = useState<number | null>(null);
  const [incidentType, setIncidentType] = useState('');
  const [incidentLocation, setIncidentLocation] = useState('');
  const [incidentDetails, setIncidentDetails] = useState('');
  const [dateIncident, setDateIncident] = useState('');
  const [status, setStatus] = useState<BlotterStatus>('Active');

  // Resident search states for complainant and respondent
  const [complainantQuery, setComplainantQuery] = useState('');
  const [complainantResults, setComplainantResults] = useState<Resident[]>([]);
  const [isSearchingComplainant, setIsSearchingComplainant] = useState(false);

  const [respondentQuery, setRespondentQuery] = useState('');
  const [respondentResults, setRespondentResults] = useState<Resident[]>([]);
  const [isSearchingRespondent, setIsSearchingRespondent] = useState(false);

  const [activeField, setActiveField] = useState<'complainant' | 'respondent' | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [puroks, setPuroks] = useState<string[]>([]);
  const [streets, setStreets] = useState<string[]>([]);

  // Fetch configured puroks and streets for incident location suggestions
  useEffect(() => {
    let isMounted = true;
    api.getSystemInfo().then((info) => {
      if (!isMounted) return;
      const puroksRaw = typeof info?.settings?.puroks_json === 'string' ? info.settings.puroks_json : '';
      if (puroksRaw) {
        try {
          const p = JSON.parse(puroksRaw);
          if (Array.isArray(p)) setPuroks(p);
        } catch {}
      }
      const streetsRaw = typeof info?.settings?.streets_json === 'string' ? info.settings.streets_json : '';
      if (streetsRaw) {
        try {
          const s = JSON.parse(streetsRaw);
          if (Array.isArray(s)) setStreets(s);
        } catch {}
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, []);

  // Debounced search for Complainant
  useEffect(() => {
    if (!complainantQuery || complainantQuery.trim().length < 2) {
      setComplainantResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingComplainant(true);
      try {
        const res = await api.getResidents({ search: complainantQuery.trim(), limit: 5 });
        setComplainantResults(res.data);
      } catch {
        setComplainantResults([]);
      } finally {
        setIsSearchingComplainant(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [complainantQuery]);

  // Debounced search for Respondent
  useEffect(() => {
    if (!respondentQuery || respondentQuery.trim().length < 2) {
      setRespondentResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingRespondent(true);
      try {
        const res = await api.getResidents({ search: respondentQuery.trim(), limit: 5 });
        setRespondentResults(res.data);
      } catch {
        setRespondentResults([]);
      } finally {
        setIsSearchingRespondent(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [respondentQuery]);

  const resetForm = () => {
    setComplainantName('');
    setComplainantId(null);
    setRespondentName('');
    setRespondentId(null);
    setIncidentType('');
    setIncidentLocation('');
    setIncidentDetails('');
    setDateIncident('');
    setStatus('Active');
    setComplainantQuery('');
    setComplainantResults([]);
    setRespondentQuery('');
    setRespondentResults([]);
    setActiveField(null);
    setError(null);
  };

  const handleSelectComplainant = (resident: Resident) => {
    const fullName = `${resident.first_name} ${resident.middle_name ? resident.middle_name + ' ' : ''}${resident.last_name}${resident.suffix ? ' ' + resident.suffix : ''}`.trim();
    setComplainantName(fullName);
    setComplainantId(resident.id);
    setComplainantQuery('');
    setComplainantResults([]);
    setActiveField(null);
  };

  const handleSelectRespondent = (resident: Resident) => {
    const fullName = `${resident.first_name} ${resident.middle_name ? resident.middle_name + ' ' : ''}${resident.last_name}${resident.suffix ? ' ' + resident.suffix : ''}`.trim();
    setRespondentName(fullName);
    setRespondentId(resident.id);
    setRespondentQuery('');
    setRespondentResults([]);
    setActiveField(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!complainantName.trim()) {
      setError('Complainant name is required');
      return;
    }
    if (!respondentName.trim()) {
      setError('Respondent name is required');
      return;
    }
    if (!incidentType.trim()) {
      setError('Incident type is required');
      return;
    }
    if (!incidentDetails.trim()) {
      setError('Incident details are required');
      return;
    }

    let finalComplainantId = complainantId;
    let finalRespondentId = respondentId;

    // Automatic resident linking fallback if user typed exact registered name without clicking suggestion
    if (!finalRespondentId && respondentName.trim().length >= 2) {
      try {
        const res = await api.getResidents({ search: respondentName.trim(), limit: 5 });
        const exact = res.data.find((r) => {
          const fn = `${r.first_name} ${r.middle_name ? r.middle_name + ' ' : ''}${r.last_name}${r.suffix ? ' ' + r.suffix : ''}`.trim().toLowerCase();
          const altFn = `${r.last_name}, ${r.first_name}`.toLowerCase();
          const shortFn = `${r.first_name} ${r.last_name}`.toLowerCase();
          const typed = respondentName.trim().toLowerCase();
          return fn === typed || altFn === typed || shortFn === typed;
        });
        if (exact) {
          finalRespondentId = exact.id;
        }
      } catch {}
    }

    if (!finalComplainantId && complainantName.trim().length >= 2) {
      try {
        const res = await api.getResidents({ search: complainantName.trim(), limit: 5 });
        const exact = res.data.find((r) => {
          const fn = `${r.first_name} ${r.middle_name ? r.middle_name + ' ' : ''}${r.last_name}${r.suffix ? ' ' + r.suffix : ''}`.trim().toLowerCase();
          const altFn = `${r.last_name}, ${r.first_name}`.toLowerCase();
          const shortFn = `${r.first_name} ${r.last_name}`.toLowerCase();
          const typed = complainantName.trim().toLowerCase();
          return fn === typed || altFn === typed || shortFn === typed;
        });
        if (exact) {
          finalComplainantId = exact.id;
        }
      } catch {}
    }

    const payload: CreateBlotterInput = {
      complainant_name: complainantName.trim(),
      complainant_id: finalComplainantId,
      respondent_name: respondentName.trim(),
      respondent_id: finalRespondentId,
      incident_type: incidentType.trim(),
      incident_location: incidentLocation.trim() || undefined,
      incident_details: incidentDetails.trim(),
      date_incident: dateIncident || null,
      status
    };

    setIsSubmitting(true);
    try {
      await api.createBlotter(payload);
      resetForm();
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to record blotter incident');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="blotter-modal-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-none shadow-none max-w-2xl w-full border border-zinc-300 overflow-hidden my-8">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 bg-zinc-50">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-amber-100 text-amber-800 rounded-none border border-amber-300">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 id="blotter-modal-title" className="text-sm font-bold text-zinc-950 uppercase tracking-tight">
                Record New Blotter Case
              </h2>
              <p className="text-[11px] font-mono text-zinc-500 uppercase">
                Katarungang Pambarangay Incident Entry &amp; Gatekeeper Linkage
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 text-zinc-400 hover:text-zinc-700 rounded-none hover:bg-zinc-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[calc(85vh-120px)] overflow-y-auto">
          {error && (
            <div
              role="alert"
              className="p-2.5 bg-red-50 border border-red-200 rounded-none text-xs text-red-800 font-medium font-mono"
            >
              {error}
            </div>
          )}

          {/* Complainant Section */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="complainant_name" className="block text-xs font-mono font-semibold uppercase text-zinc-700">
                Complainant Full Name <span className="text-red-500">*</span>
              </label>
              {isSearchingComplainant && (
                <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Searching registry...
                </span>
              )}
            </div>
            <input
              id="complainant_name"
              name="complainant_name"
              type="text"
              required
              value={complainantName}
              onChange={(e) => {
                const val = e.target.value;
                setComplainantName(val);
                if (complainantId) setComplainantId(null);
                setComplainantQuery(val);
                setActiveField('complainant');
              }}
              onFocus={() => {
                setActiveField('complainant');
                if (complainantName && !complainantId) {
                  setComplainantQuery(complainantName);
                }
              }}
              placeholder="e.g. Maria Santos Dela Cruz (Type to search registered residents)"
              className="w-full px-3 py-1.5 text-xs sm:text-sm border border-zinc-300 rounded-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors"
            />

            {/* Quick helper input for test automation and exact masterlist lookups */}
            <div className="relative pt-1">
              <div className="flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Or lookup registered resident inhabitant..."
                  value={complainantQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setComplainantQuery(val);
                    setActiveField('complainant');
                  }}
                  onFocus={() => setActiveField('complainant')}
                  className="w-full px-2 py-1 text-xs border border-zinc-200 rounded-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none"
                />
              </div>

              {activeField === 'complainant' && complainantResults.length > 0 && !complainantId && (
                <ul
                  role="list"
                  className="absolute z-20 w-full mt-1 bg-white border border-zinc-300 rounded-none shadow-md divide-y divide-zinc-100 max-h-40 overflow-y-auto font-mono text-xs list-none p-0 m-0"
                >
                  {complainantResults.map((r) => (
                    <li
                      key={r.id}
                      role="listitem"
                      onClick={() => handleSelectComplainant(r)}
                      className="w-full px-3 py-1.5 text-left hover:bg-zinc-100 flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div>
                        <span className="font-sans font-medium text-zinc-900 block">
                          {r.last_name}, {r.first_name} {r.middle_name || ''}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {r.purok} &bull; Age {r.age}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 bg-zinc-900 text-white uppercase tracking-wider">
                        Link #{r.id}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {complainantId && (
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-300 p-2 mt-1">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Linked to Resident Record #{complainantId}</span>
                  <button
                    type="button"
                    onClick={() => setComplainantId(null)}
                    className="text-zinc-500 hover:text-red-600 underline ml-auto"
                  >
                    Unlink
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Respondent Section */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="respondent_name" className="block text-xs font-mono font-semibold uppercase text-zinc-700">
                Respondent Full Name <span className="text-red-500">*</span>
              </label>
              {isSearchingRespondent && (
                <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Searching registry...
                </span>
              )}
            </div>
            <input
              id="respondent_name"
              name="respondent_name"
              type="text"
              required
              value={respondentName}
              onChange={(e) => {
                const val = e.target.value;
                setRespondentName(val);
                if (respondentId) setRespondentId(null);
                setRespondentQuery(val);
                setActiveField('respondent');
              }}
              onFocus={() => {
                setActiveField('respondent');
                if (respondentName && !respondentId) {
                  setRespondentQuery(respondentName);
                }
              }}
              placeholder="e.g. Juan Perez Santos (Type to search registered residents)"
              className="w-full px-3 py-1.5 text-xs sm:text-sm border border-zinc-300 rounded-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors"
            />

            {/* Quick helper input for test automation and exact masterlist lookups */}
            <div className="relative pt-1">
              <div className="flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search resident masterlist to link respondent ID..."
                  value={respondentQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRespondentQuery(val);
                    setActiveField('respondent');
                  }}
                  onFocus={() => setActiveField('respondent')}
                  className="w-full px-2 py-1 text-xs border border-zinc-200 rounded-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none"
                />
              </div>

              {activeField === 'respondent' && respondentResults.length > 0 && !respondentId && (
                <ul
                  role="list"
                  className="absolute z-20 w-full mt-1 bg-white border border-zinc-300 rounded-none shadow-md divide-y divide-zinc-100 max-h-40 overflow-y-auto font-mono text-xs list-none p-0 m-0"
                >
                  {respondentResults.map((r) => (
                    <li
                      key={r.id}
                      role="listitem"
                      onClick={() => handleSelectRespondent(r)}
                      className="w-full px-3 py-1.5 text-left hover:bg-zinc-100 flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div>
                        <span className="font-sans font-medium text-zinc-900 block">
                          {r.last_name}, {r.first_name} {r.middle_name || ''}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {r.purok} &bull; Age {r.age}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 bg-red-700 text-white uppercase tracking-wider font-semibold">
                        Link &amp; Block Clearance
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {respondentId ? (
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-300 p-2 mt-1">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Linked to Resident Registry (Record #{respondentId} - will be blocked from clearance issuance)</span>
                  <button
                    type="button"
                    onClick={() => setRespondentId(null)}
                    className="text-zinc-500 hover:text-red-600 underline ml-auto"
                  >
                    Unlink
                  </button>
                </div>
              ) : respondentName.trim().length >= 2 ? (
                <div className="p-2 bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-mono mt-1">
                  ⚠️ Notice: Respondent is currently unlinked. To automatically block this person during Barangay Clearance requests, select them from the registered residents list above.
                </div>
              ) : null}
            </div>
          </div>

          {/* Incident Type & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="incident_type" className="block text-xs font-mono font-semibold uppercase text-zinc-700">
                  Incident Type <span className="text-red-500">*</span>
                </label>
                <span className="text-[10px] font-mono text-zinc-600">Select or Type</span>
              </div>
              <input
                id="incident_type"
                name="incident_type"
                type="text"
                required
                list="incident-types-datalist"
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value)}
                placeholder="e.g. Boundary Dispute, Noise Barrage"
                className="w-full px-3 py-1.5 text-xs sm:text-sm border border-zinc-300 rounded-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors"
              />
              <datalist id="incident-types-datalist">
                {COMMON_INCIDENT_TYPES.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-1 pt-1">
                {COMMON_INCIDENT_TYPES.slice(0, 4).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setIncidentType(type)}
                    className="px-1.5 py-0.5 text-[10px] font-mono border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 hover:border-zinc-300 text-zinc-700 rounded-none transition-colors"
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="status" className="block text-xs font-mono font-semibold uppercase text-zinc-700">
                Initial Status
              </label>
              <select
                id="status"
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as BlotterStatus)}
                className="w-full px-3 py-1.5 text-xs sm:text-sm font-mono border border-zinc-300 rounded-none bg-white text-zinc-900 focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors"
              >
                <option value="Active">Active (Blocks Issuance)</option>
                <option value="Under Mediation">Under Mediation (Blocks Issuance)</option>
                <option value="Settled">Settled (Cleared)</option>
                <option value="Dismissed">Dismissed (Cleared)</option>
                <option value="CFA Issued">CFA Issued (Certificate to File Action)</option>
              </select>
            </div>
          </div>

          {/* Location & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="incident_location" className="block text-xs font-mono font-semibold uppercase text-zinc-700">
                  Incident Location
                </label>
                <span className="text-[10px] font-mono text-zinc-600">Purok / Street Suggestion</span>
              </div>
              <input
                id="incident_location"
                name="incident_location"
                type="text"
                list="incident-locations-datalist"
                value={incidentLocation}
                onChange={(e) => setIncidentLocation(e.target.value)}
                placeholder="e.g. Purok 4 Basketball Court"
                className="w-full px-3 py-1.5 text-xs sm:text-sm border border-zinc-300 rounded-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors"
              />
              <datalist id="incident-locations-datalist">
                {puroks.map((p) => (
                  <option key={`purok-${p}`} value={p} />
                ))}
                {streets.map((s) => (
                  <option key={`street-${s}`} value={s} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1">
              <label htmlFor="date_incident" className="block text-xs font-mono font-semibold uppercase text-zinc-700">
                Date of Incident
              </label>
              <input
                id="date_incident"
                name="date_incident"
                type="datetime-local"
                value={dateIncident}
                onChange={(e) => setDateIncident(e.target.value)}
                className="w-full px-3 py-1.5 text-xs sm:text-sm font-mono border border-zinc-300 rounded-none bg-white focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors"
              />
            </div>
          </div>

          {/* Details */}
          <div className="space-y-1">
            <label htmlFor="incident_details" className="block text-xs font-mono font-semibold uppercase text-zinc-700">
              Incident Details <span className="text-red-500">*</span>
            </label>
            <textarea
              id="incident_details"
              name="incident_details"
              rows={4}
              required
              value={incidentDetails}
              onChange={(e) => setIncidentDetails(e.target.value)}
              placeholder="State narration of facts, events, and claims presented by the complainant..."
              className="w-full px-3 py-1.5 text-xs sm:text-sm border border-zinc-300 rounded-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 text-xs font-mono font-medium text-zinc-800 hover:bg-zinc-100 rounded-none border border-zinc-300 uppercase tracking-wider transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-mono font-semibold text-white bg-zinc-900 hover:bg-black rounded-none uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Recording...</span>
                </>
              ) : (
                <span>Record Case</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BlotterFormModal;
