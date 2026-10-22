import React, { useState, useEffect } from 'react';
import { X, Search, ShieldAlert, Loader2, Check } from 'lucide-react';
import api from '../../services/api';
import { CreateBlotterInput, BlotterStatus } from '../../types/admin';
import { Resident } from '../../types/resident';

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

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setError(null);
  };

  const handleSelectComplainant = (resident: Resident) => {
    const fullName = `${resident.first_name} ${resident.middle_name ? resident.middle_name + ' ' : ''}${resident.last_name}${resident.suffix ? ' ' + resident.suffix : ''}`.trim();
    setComplainantName(fullName);
    setComplainantId(resident.id);
    setComplainantResults([]);
    setComplainantQuery('');
  };

  const handleSelectRespondent = (resident: Resident) => {
    const fullName = `${resident.first_name} ${resident.middle_name ? resident.middle_name + ' ' : ''}${resident.last_name}${resident.suffix ? ' ' + resident.suffix : ''}`.trim();
    setRespondentName(fullName);
    setRespondentId(resident.id);
    setRespondentResults([]);
    setRespondentQuery('');
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

    const payload: CreateBlotterInput = {
      complainant_name: complainantName.trim(),
      complainant_id: complainantId,
      respondent_name: respondentName.trim(),
      respondent_id: respondentId,
      incident_type: incidentType.trim(),
      incident_location: incidentLocation.trim(),
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
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-8 animate-in fade-in duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 id="blotter-modal-title" className="text-base font-bold text-slate-900">
                Record New Blotter Case
              </h2>
              <p className="text-xs text-slate-500">
                Katarungang Pambarangay Incident Entry &amp; Resident Gatekeeper Linkage
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[calc(85vh-120px)] overflow-y-auto">
          {error && (
            <div
              role="alert"
              className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium"
            >
              {error}
            </div>
          )}

          {/* Complainant Section */}
          <div className="space-y-1.5">
            <label htmlFor="complainant_name" className="block text-xs font-semibold text-slate-700">
              Complainant Full Name <span className="text-red-500">*</span>
            </label>
            <input
              id="complainant_name"
              name="complainant_name"
              type="text"
              required
              value={complainantName}
              onChange={(e) => setComplainantName(e.target.value)}
              placeholder="e.g. Maria Santos Dela Cruz"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
            />
            {/* Search resident helper */}
            <div className="relative pt-1">
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Or search resident masterlist to autofill..."
                  value={complainantQuery}
                  onChange={(e) => setComplainantQuery(e.target.value)}
                  className="w-full text-xs text-slate-600 border-b border-dashed border-slate-300 focus:border-amber-500 outline-none pb-0.5"
                />
                {isSearchingComplainant && <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin" />}
              </div>
              {complainantResults.length > 0 && (
                <ul className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto divide-y divide-slate-100">
                  {complainantResults.map((r) => (
                    <li
                      key={r.id}
                      onClick={() => handleSelectComplainant(r)}
                      className="px-3 py-1.5 text-xs text-slate-700 hover:bg-amber-50 hover:text-amber-800 cursor-pointer flex justify-between"
                    >
                      <span className="font-medium">
                        {r.first_name} {r.last_name}
                      </span>
                      <span className="text-slate-400">{r.purok}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Respondent Section */}
          <div className="space-y-1.5">
            <label htmlFor="respondent_name" className="block text-xs font-semibold text-slate-700">
              Respondent Full Name <span className="text-red-500">*</span>
            </label>
            <input
              id="respondent_name"
              name="respondent_name"
              type="text"
              required
              value={respondentName}
              onChange={(e) => setRespondentName(e.target.value)}
              placeholder="e.g. Pedro Reyes Penduko"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
            />
            {respondentId && (
              <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                <Check className="w-3 h-3" /> Linked to Resident Registry (ID: {respondentId}) — Certificate Gatekeeper active.
              </p>
            )}
            {/* Search resident helper */}
            <div className="relative pt-1">
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Or search resident masterlist to link respondent ID..."
                  value={respondentQuery}
                  onChange={(e) => setRespondentQuery(e.target.value)}
                  className="w-full text-xs text-slate-600 border-b border-dashed border-slate-300 focus:border-amber-500 outline-none pb-0.5"
                />
                {isSearchingRespondent && <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin" />}
              </div>
              {respondentResults.length > 0 && (
                <ul className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto divide-y divide-slate-100">
                  {respondentResults.map((r) => (
                    <li
                      key={r.id}
                      onClick={() => handleSelectRespondent(r)}
                      className="px-3 py-1.5 text-xs text-slate-700 hover:bg-amber-50 hover:text-amber-800 cursor-pointer flex justify-between"
                    >
                      <span className="font-medium">
                        {r.first_name} {r.last_name}
                      </span>
                      <span className="text-slate-400">{r.purok}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Incident Type & Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="incident_type" className="block text-xs font-semibold text-slate-700">
                Incident Type / Cause <span className="text-red-500">*</span>
              </label>
              <input
                id="incident_type"
                name="incident_type"
                type="text"
                required
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value)}
                placeholder="e.g. Physical Injury, Boundary Dispute"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="status" className="block text-xs font-semibold text-slate-700">
                Initial Status
              </label>
              <select
                id="status"
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as BlotterStatus)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="incident_location" className="block text-xs font-semibold text-slate-700">
                Incident Location
              </label>
              <input
                id="incident_location"
                name="incident_location"
                type="text"
                value={incidentLocation}
                onChange={(e) => setIncidentLocation(e.target.value)}
                placeholder="e.g. Purok 3 Basketball Court"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="date_incident" className="block text-xs font-semibold text-slate-700">
                Date of Incident
              </label>
              <input
                id="date_incident"
                name="date_incident"
                type="date"
                value={dateIncident}
                onChange={(e) => setDateIncident(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
              />
            </div>
          </div>

          {/* Details */}
          <div className="space-y-1.5">
            <label htmlFor="incident_details" className="block text-xs font-semibold text-slate-700">
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
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
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
