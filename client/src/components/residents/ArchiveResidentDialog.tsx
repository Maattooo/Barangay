import React, { useState } from 'react';
import { AlertTriangle, Archive, X } from 'lucide-react';
import { Resident } from '../../types/resident';
import api from '../../services/api';

export interface ArchiveResidentDialogProps {
  isOpen: boolean;
  resident: Resident | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ArchiveResidentDialog: React.FC<ArchiveResidentDialogProps> = ({
  isOpen,
  resident,
  onClose,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !resident) return null;

  const residentFullName = `${resident.first_name} ${resident.last_name}${
    resident.suffix ? ` ${resident.suffix}` : ''
  }`;

  const handleConfirmArchive = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.archiveResident(resident.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to archive resident');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      data-testid="archive-resident-dialog"
    >
      <div className="relative w-full max-w-md bg-white rounded-none shadow-none border border-zinc-300 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 bg-red-50/60">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-red-100 text-red-700 rounded-none border border-red-200">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-950 uppercase tracking-tight">Archive Resident Profile</h3>
              <p className="text-[11px] font-mono text-zinc-500 uppercase">Soft-delete confirmation</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1 text-zinc-400 hover:text-zinc-700 rounded-none hover:bg-zinc-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3.5">
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-none text-xs text-red-800 font-medium">
              {error}
            </div>
          )}

          <div className="text-xs sm:text-sm text-zinc-700">
            Are you sure you want to archive{' '}
            <strong className="text-zinc-950 font-semibold">{residentFullName}</strong> from{' '}
            <strong className="text-zinc-950 font-semibold">{resident.purok}</strong>?
          </div>

          <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-none text-xs font-mono text-zinc-700 space-y-1">
            <div className="font-semibold text-zinc-900 uppercase tracking-wider">
              Notice on Archival:
            </div>
            <p className="text-[11px] leading-relaxed">
              Archiving sets the record to inactive (<code>is_archived = 1</code>). Historical certificates, blotter logs, and audit entries referencing this resident will remain intact.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-zinc-200 bg-zinc-50">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-3.5 py-1.5 text-xs font-mono font-medium text-zinc-800 bg-white border border-zinc-300 rounded-none hover:bg-zinc-100 uppercase tracking-wider transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmArchive}
            disabled={loading}
            data-testid="confirm-archive-btn"
            className="px-3.5 py-1.5 text-xs font-mono font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-none uppercase tracking-wider transition-colors flex items-center gap-1.5"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-none animate-spin" />
                <span>Archiving...</span>
              </>
            ) : (
              <>
                <Archive className="w-3.5 h-3.5" />
                <span>Confirm Archive</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ArchiveResidentDialog;
