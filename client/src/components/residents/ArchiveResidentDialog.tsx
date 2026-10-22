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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
      data-testid="archive-resident-dialog"
    >
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-red-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 text-red-600 rounded-lg">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Archive Resident Profile</h3>
              <p className="text-xs text-slate-500">Soft-delete confirmation</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="text-sm text-slate-600">
            Are you sure you want to archive{' '}
            <strong className="text-slate-900 font-semibold">{residentFullName}</strong> from{' '}
            <strong className="text-slate-900 font-semibold">{resident.purok}</strong>?
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <span>Notice on Archival:</span>
            </div>
            <p>
              Archiving sets the resident record to inactive (<code className="font-mono bg-amber-100 px-1 rounded">is_archived = 1</code>).
              Historical certificates, blotter logs, and audit entries referencing this resident will remain intact.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmArchive}
            disabled={loading}
            data-testid="confirm-archive-btn"
            className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Archiving...</span>
              </>
            ) : (
              <>
                <Archive className="w-4 h-4" />
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
