import React, { useState } from 'react';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { BlotterRecord } from '../../types/admin';

interface BlotterArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  record: BlotterRecord | null;
}

export const BlotterArchiveModal: React.FC<BlotterArchiveModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  record
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !record) return null;

  const handleArchive = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await api.archiveBlotter(record.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to archive blotter case.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="archive-modal-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden my-8 animate-in fade-in duration-150 p-6 space-y-4">
        <div className="flex items-center gap-3 text-red-600">
          <div className="p-2.5 bg-red-100 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 id="archive-modal-title" className="text-base font-bold text-slate-900">
              Archive Blotter Case
            </h3>
            <p className="text-xs text-slate-500 font-mono">{record.case_number}</p>
          </div>
        </div>

        <p className="text-sm text-slate-600">
          Are you sure you want to archive this case involving{' '}
          <span className="font-semibold text-slate-800">{record.respondent_name}</span>? Archiving will hide the case from active clearance gatekeeper checks.
        </p>

        {error && (
          <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-300 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleArchive}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Archiving...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Archive Case</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BlotterArchiveModal;
