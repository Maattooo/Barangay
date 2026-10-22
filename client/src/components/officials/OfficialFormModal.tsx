import React, { useState, useEffect } from 'react';
import { X, Award, Loader2, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import {
  BarangayOfficial,
  CreateOfficialInput,
  UpdateOfficialInput,
  OfficialPosition
} from '../../types/admin';

interface OfficialFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  official: BarangayOfficial | null; // null if adding new official
}

const ALLOWED_POSITIONS: OfficialPosition[] = [
  'Punong Barangay',
  'Sangguniang Barangay Member',
  'SK Chairperson',
  'Barangay Secretary',
  'Barangay Treasurer'
];

export const OfficialFormModal: React.FC<OfficialFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  official
}) => {
  const isEditing = !!official;

  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState<OfficialPosition>('Sangguniang Barangay Member');
  const [committee, setCommittee] = useState('');
  const [rankOrder, setRankOrder] = useState<number>(2);
  const [termStart, setTermStart] = useState('');
  const [termEnd, setTermEnd] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (official) {
      setFullName(official.full_name);
      setPosition(official.position);
      setCommittee(official.committee || '');
      setRankOrder(official.rank_order);
      setTermStart(official.term_start || '');
      setTermEnd(official.term_end || '');
      setIsActive(Number(official.is_active) === 1);
    } else {
      setFullName('');
      setPosition('Sangguniang Barangay Member');
      setCommittee('');
      setRankOrder(2);
      setTermStart('');
      setTermEnd('');
      setIsActive(true);
    }
    setError(null);
  }, [official, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Full Name is required.');
      return;
    }

    if (!ALLOWED_POSITIONS.includes(position)) {
      setError('Please select a valid council position.');
      return;
    }

    if (isNaN(rankOrder) || rankOrder <= 0) {
      setError('Rank order must be a positive integer.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && official) {
        const payload: UpdateOfficialInput = {
          full_name: fullName.trim(),
          position,
          committee: committee.trim() || null,
          rank_order: Number(rankOrder),
          term_start: termStart || null,
          term_end: termEnd || null,
          is_active: isActive ? 1 : 0
        };
        await api.updateOfficial(official.id, payload);
      } else {
        const payload: CreateOfficialInput = {
          full_name: fullName.trim(),
          position,
          committee: committee.trim() || null,
          rank_order: Number(rankOrder),
          term_start: termStart || null,
          term_end: termEnd || null,
          is_active: isActive ? 1 : 0
        };
        await api.createOfficial(payload);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save official.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="official-modal-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-8 animate-in fade-in duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 id="official-modal-title" className="text-base font-bold text-slate-900">
                {isEditing ? 'Edit Barangay Official' : 'Add Barangay Official'}
              </h2>
              <p className="text-xs text-slate-500">
                Council hierarchy for certificates and leadership roster
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
              className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-1.5">
            <label htmlFor="official_full_name" className="block text-xs font-semibold text-slate-700">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              id="official_full_name"
              name="official_full_name"
              aria-label="Full Name"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. HON. JUAN DELA CRUZ"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition"
            />
          </div>

          {/* Position */}
          <div className="space-y-1.5">
            <label htmlFor="official_position" className="block text-xs font-semibold text-slate-700">
              Position <span className="text-red-500">*</span>
            </label>
            <select
              id="official_position"
              name="official_position"
              aria-label="Position"
              value={position}
              onChange={(e) => setPosition(e.target.value as OfficialPosition)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition"
            >
              {ALLOWED_POSITIONS.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
          </div>

          {/* Committee */}
          <div className="space-y-1.5">
            <label htmlFor="official_committee" className="block text-xs font-semibold text-slate-700">
              Committee Assignment
            </label>
            <input
              id="official_committee"
              name="official_committee"
              aria-label="Committee Assignment"
              type="text"
              value={committee}
              onChange={(e) => setCommittee(e.target.value)}
              placeholder="e.g. Committee on Health / Committee on Peace and Order"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition"
            />
          </div>

          {/* Rank Order */}
          <div className="space-y-1.5">
            <label htmlFor="official_rank_order" className="block text-xs font-semibold text-slate-700">
              Rank Order <span className="text-red-500">*</span>
            </label>
            <input
              id="official_rank_order"
              name="official_rank_order"
              aria-label="Rank Order"
              type="number"
              min="1"
              required
              value={rankOrder}
              onChange={(e) => setRankOrder(parseInt(e.target.value, 10) || 1)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition"
            />
            <p className="text-[11px] text-slate-500">
              1 = Punong Barangay, 2-8 = Kagawads, 9 = SK Chairperson, 10 = Secretary, 11 = Treasurer
            </p>
          </div>

          {/* Term Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="term_start" className="block text-xs font-semibold text-slate-700">
                Term Start Date
              </label>
              <input
                id="term_start"
                name="term_start"
                aria-label="Term Start Date"
                type="date"
                value={termStart}
                onChange={(e) => setTermStart(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="term_end" className="block text-xs font-semibold text-slate-700">
                Term End Date
              </label>
              <input
                id="term_end"
                name="term_end"
                aria-label="Term End Date"
                type="date"
                value={termEnd}
                onChange={(e) => setTermEnd(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition"
              />
            </div>
          </div>

          {/* Active status checkbox */}
          <div className="flex items-center gap-2 pt-2">
            <input
              id="is_active"
              name="is_active"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
            />
            <label htmlFor="is_active" className="text-xs font-semibold text-slate-700 select-none">
              Currently Active Council Official (included in certificate printouts)
            </label>
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
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{isEditing ? 'Save Changes' : 'Add Official'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OfficialFormModal;
