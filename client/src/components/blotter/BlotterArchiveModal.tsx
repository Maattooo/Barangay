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
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-none shadow-none max-w-md w-full border border-zinc-300 overflow-hidden my-8 p-5 space-y-4">
        <div className="flex items-center gap-3 text-red-700">
          <div className="p-2 bg-red-100 text-red-700 rounded-none border border-red-200">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 id="archive-modal-title" className="text-sm font-bold text-zinc-950 uppercase tracking-tight">
              Archive Blotter Case
            </h3>
            <p className="text-xs text-zinc-500 font-mono">{record.case_number}</p>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-zinc-700">
          Are you sure you want to archive this case involving{' '}
          <span className="font-semibold text-zinc-950">{record.respondent_name}</span>? Archiving will hide the case from active clearance gatekeeper checks.
        </p>

        {error && (
          <div role="alert" className="p-2.5 bg-red-50 border border-red-200 rounded-none text-xs text-red-800 font-medium font-mono">
            {error}
          </div>
        )}

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
            type="button"
            onClick={handleArchive}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono font-semibold text-white bg-red-600 hover:bg-red-700 rounded-none uppercase tracking-wider transition-colors disabled:opacity-50"
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
