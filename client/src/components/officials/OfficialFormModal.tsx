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
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-none shadow-none max-w-lg w-full border border-zinc-300 overflow-hidden my-8">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 bg-zinc-50">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-zinc-100 text-zinc-800 rounded-none border border-zinc-200">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h2 id="official-modal-title" className="text-sm font-bold text-zinc-950 uppercase tracking-tight">
                {isEditing ? 'Edit Barangay Official' : 'Add Barangay Official'}
              </h2>
              <p className="text-xs text-zinc-500 font-mono">
                Council hierarchy for certificates and leadership roster
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 text-zinc-400 hover:text-zinc-950 rounded-none transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[calc(85vh-120px)] overflow-y-auto">
          {error && (
            <div
              role="alert"
              className="p-2.5 bg-red-50 border border-red-200 rounded-none text-xs font-mono text-red-800 font-medium flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-1">
            <label htmlFor="official_full_name" className="block text-xs font-mono font-semibold uppercase text-zinc-700">
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
              className="w-full px-3 py-1.5 text-xs sm:text-sm border border-zinc-300 rounded-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors"
            />
          </div>

          {/* Position */}
          <div className="space-y-1">
            <label htmlFor="official_position" className="block text-xs font-mono font-semibold uppercase text-zinc-700">
              Position <span className="text-red-500">*</span>
            </label>
            <select
              id="official_position"
              name="official_position"
              aria-label="Position"
              value={position}
              onChange={(e) => setPosition(e.target.value as OfficialPosition)}
              className="w-full px-3 py-1.5 text-xs sm:text-sm font-mono border border-zinc-300 rounded-none bg-white text-zinc-900 focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors"
            >
              {ALLOWED_POSITIONS.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
          </div>

          {/* Committee */}
          <div className="space-y-1">
            <label htmlFor="official_committee" className="block text-xs font-mono font-semibold uppercase text-zinc-700">
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
              className="w-full px-3 py-1.5 text-xs sm:text-sm border border-zinc-300 rounded-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors"
            />
          </div>

          {/* Rank Order */}
          <div className="space-y-1">
            <label htmlFor="official_rank_order" className="block text-xs font-mono font-semibold uppercase text-zinc-700">
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
              className="w-full px-3 py-1.5 text-xs sm:text-sm font-mono border border-zinc-300 rounded-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors"
            />
            <p className="text-[10px] text-zinc-500 font-mono">
              1 = Punong Barangay, 2-8 = Kagawads, 9 = SK Chairperson, 10 = Secretary, 11 = Treasurer
            </p>
          </div>

          {/* Term Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="term_start" className="block text-xs font-mono font-semibold uppercase text-zinc-700">
                Term Start Date
              </label>
              <input
                id="term_start"
                name="term_start"
                aria-label="Term Start Date"
                type="date"
                value={termStart}
                onChange={(e) => setTermStart(e.target.value)}
                className="w-full px-3 py-1.5 text-xs sm:text-sm font-mono border border-zinc-300 rounded-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="term_end" className="block text-xs font-mono font-semibold uppercase text-zinc-700">
                Term End Date
              </label>
              <input
                id="term_end"
                name="term_end"
                aria-label="Term End Date"
                type="date"
                value={termEnd}
                onChange={(e) => setTermEnd(e.target.value)}
                className="w-full px-3 py-1.5 text-xs sm:text-sm font-mono border border-zinc-300 rounded-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors"
              />
            </div>
          </div>

          {/* Active status checkbox */}
          <div className="flex items-center gap-2 pt-1 font-mono">
            <input
              id="is_active"
              name="is_active"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 text-zinc-900 rounded-none border-zinc-300 focus:ring-0"
            />
            <label htmlFor="is_active" className="text-xs text-zinc-800 select-none cursor-pointer">
              Currently Active Council Official (included in certificate printouts)
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 text-xs font-mono font-medium uppercase tracking-wider text-zinc-800 hover:bg-zinc-100 rounded-none border border-zinc-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-mono font-semibold uppercase tracking-wider text-white bg-zinc-900 hover:bg-black rounded-none transition-colors disabled:opacity-50 shadow-none"
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
