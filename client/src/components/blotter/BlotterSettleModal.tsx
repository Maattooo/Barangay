import React, { useState, useEffect } from 'react';
import { X, Scale, Loader2, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import { BlotterRecord, BlotterStatus, UpdateBlotterInput } from '../../types/admin';

interface BlotterSettleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  record: BlotterRecord | null;
}

export const BlotterSettleModal: React.FC<BlotterSettleModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  record
}) => {
  const [status, setStatus] = useState<BlotterStatus>('Settled');
  const [settlementNotes, setSettlementNotes] = useState('');
  const [incidentDetails, setIncidentDetails] = useState('');
  const [incidentLocation, setIncidentLocation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (record) {
      setStatus(record.status);
      setSettlementNotes(record.settlement_notes || '');
      setIncidentDetails(record.incident_details || '');
      setIncidentLocation(record.incident_location || '');
      setError(null);
    }
  }, [record]);

  if (!isOpen || !record) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation: Settlement notes mandatory when status is Settled or Dismissed
    if ((status === 'Settled' || status === 'Dismissed') && !settlementNotes.trim()) {
      setError(`Settlement notes are mandatory when transitioning case status to ${status}.`);
      return;
    }

    if (!incidentDetails.trim()) {
      setError('Incident details cannot be empty.');
      return;
    }

    const payload: UpdateBlotterInput = {
      status,
      settlement_notes: settlementNotes.trim(),
      incident_details: incidentDetails.trim(),
      incident_location: incidentLocation.trim()
    };

    setIsSubmitting(true);
    try {
      await api.updateBlotter(record.id, payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update blotter case.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settle-modal-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-none shadow-none max-w-xl w-full border border-zinc-300 overflow-hidden my-8">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 bg-zinc-50">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-zinc-100 text-zinc-800 rounded-none border border-zinc-200">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h2 id="settle-modal-title" className="text-sm font-bold text-zinc-950 uppercase tracking-tight">
                Update / Settle Blotter Case
              </h2>
              <p className="text-[11px] font-mono text-zinc-500 uppercase">
                Case No: <span className="font-bold text-zinc-900">{record.case_number}</span>
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
              className="p-2.5 bg-red-50 border border-red-200 rounded-none text-xs text-red-800 font-medium font-mono flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Case summary overview */}
          <div className="p-3 bg-zinc-50 rounded-none border border-zinc-200 grid grid-cols-2 gap-2 text-xs font-mono">
            <div>
              <span className="text-zinc-400 block text-[10px] uppercase">Complainant:</span>
              <span className="font-semibold text-zinc-900 font-sans">{record.complainant_name}</span>
            </div>
            <div>
              <span className="text-zinc-400 block text-[10px] uppercase">Respondent:</span>
              <span className="font-semibold text-zinc-900 font-sans">{record.respondent_name}</span>
            </div>
            <div>
              <span className="text-zinc-400 block text-[10px] uppercase">Incident Type:</span>
              <span className="font-medium text-zinc-700 font-sans">{record.incident_type}</span>
            </div>
            <div>
              <span className="text-zinc-400 block text-[10px] uppercase">Current Status:</span>
              <span className="font-bold text-zinc-950">{record.status}</span>
            </div>
          </div>

          {/* Status transition dropdown */}
          <div className="space-y-1">
            <label htmlFor="update_status" className="block text-xs font-mono font-semibold uppercase text-zinc-700">
              New Case Status <span className="text-red-500">*</span>
            </label>
            <select
              id="update_status"
              name="update_status"
              aria-label="New Case Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as BlotterStatus)}
              className="w-full px-3 py-1.5 text-xs sm:text-sm font-mono border border-zinc-300 rounded-none bg-white text-zinc-900 focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors"
            >
              <option value="Active">Active (Blocks Issuance)</option>
              <option value="Under Mediation">Under Mediation (Blocks Issuance)</option>
              <option value="Settled">Settled (Cleared - Amicable Agreement)</option>
              <option value="Dismissed">Dismissed (Cleared - Lack of Merit / Withdrawn)</option>
              <option value="CFA Issued">CFA Issued (Certificate to File Action)</option>
            </select>
          </div>

          {/* Settlement notes */}
          <div className="space-y-1">
            <label htmlFor="settlement_notes" className="block text-xs font-mono font-semibold uppercase text-zinc-700">
              Settlement / Resolution Notes {(status === 'Settled' || status === 'Dismissed') && <span className="text-red-500">*</span>}
            </label>
            <textarea
              id="settlement_notes"
              name="settlement_notes"
              aria-label="Settlement Notes"
              rows={3}
              value={settlementNotes}
              onChange={(e) => setSettlementNotes(e.target.value)}
              placeholder="State Lupon mediation outcome, agreement terms, or dismissal rationale..."
              className="w-full px-3 py-1.5 text-xs sm:text-sm border border-zinc-300 rounded-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors"
            />
          </div>

          {/* Incident location */}
          <div className="space-y-1">
            <label htmlFor="edit_incident_location" className="block text-xs font-mono font-semibold uppercase text-zinc-700">
              Incident Location
            </label>
            <input
              id="edit_incident_location"
              name="edit_incident_location"
              type="text"
              value={incidentLocation}
              onChange={(e) => setIncidentLocation(e.target.value)}
              className="w-full px-3 py-1.5 text-xs sm:text-sm border border-zinc-300 rounded-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors"
            />
          </div>

          {/* Incident details */}
          <div className="space-y-1">
            <label htmlFor="edit_incident_details" className="block text-xs font-mono font-semibold uppercase text-zinc-700">
              Incident Details
            </label>
            <textarea
              id="edit_incident_details"
              name="edit_incident_details"
              rows={3}
              value={incidentDetails}
              onChange={(e) => setIncidentDetails(e.target.value)}
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
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-mono font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-none uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BlotterSettleModal;
