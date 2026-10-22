import React from 'react';
import { X, GitCompare, ArrowRight, ShieldCheck } from 'lucide-react';
import { AuditLogEntry } from '../../types/admin';

interface JsonDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  logEntry: AuditLogEntry | null;
}

export const JsonDiffModal: React.FC<JsonDiffModalProps> = ({
  isOpen,
  onClose,
  logEntry
}) => {
  if (!isOpen || !logEntry) return null;

  let oldData: Record<string, any> = {};
  let newData: Record<string, any> = {};

  try {
    if (logEntry.old_data_json) {
      oldData = typeof logEntry.old_data_json === 'string'
        ? JSON.parse(logEntry.old_data_json)
        : logEntry.old_data_json;
    }
  } catch {
    oldData = {};
  }

  try {
    if (logEntry.new_data_json) {
      newData = typeof logEntry.new_data_json === 'string'
        ? JSON.parse(logEntry.new_data_json)
        : logEntry.new_data_json;
    }
  } catch {
    newData = {};
  }

  // Collect all unique keys that changed between old and new
  const allKeys = Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]));
  const changedKeys = allKeys.filter((key) => {
    const oldVal = JSON.stringify(oldData[key]);
    const newVal = JSON.stringify(newData[key]);
    return oldVal !== newVal;
  });

  const formatValue = (val: any): string => {
    if (val === undefined || val === null) return 'null';
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="diff-modal-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-8 animate-in fade-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <h2 id="diff-modal-title" className="text-base font-bold text-slate-900">
                Visual JSON Diff Inspector
              </h2>
              <p className="text-xs text-slate-500">
                Audit Event #{logEntry.id} &bull; Action:{' '}
                <span className="font-semibold text-purple-700">{logEntry.action}</span> &bull; Entity:{' '}
                <span className="font-semibold text-slate-700">{logEntry.entity_type}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[calc(85vh-120px)] overflow-y-auto">
          {/* Audit Meta Context */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
            <p className="text-slate-700 font-medium">
              <span className="text-slate-400">Summary: </span>
              {logEntry.summary_text}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-slate-500 pt-1">
              <span>
                Editor: <strong className="text-slate-800">{logEntry.username_snapshot}</strong> ({logEntry.user_role_snapshot})
              </span>
              <span>
                Client IP: <strong className="font-mono text-slate-800">{logEntry.client_ip}</strong>
              </span>
              <span>
                Timestamp: <strong className="text-slate-800">{logEntry.created_at}</strong>
              </span>
            </div>
          </div>

          {/* Diff comparison table */}
          {changedKeys.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-500 text-xs space-y-2">
              <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-700">No field-level JSON diffs recorded</p>
              <p className="text-slate-400">
                This event did not contain before/after data snapshots or was an immutable single-state transaction.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                <span>Field Name</span>
                <span>Before &rarr; After Comparison</span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                {changedKeys.map((key) => {
                  const hasOld = key in oldData;
                  const hasNew = key in newData;
                  const oldVal = formatValue(oldData[key]);
                  const newVal = formatValue(newData[key]);

                  return (
                    <div
                      key={key}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors"
                    >
                      <span className="font-mono font-bold text-slate-800 text-xs w-44 shrink-0 truncate">
                        {key}
                      </span>

                      <div className="flex-1 flex items-center gap-2 flex-wrap">
                        {/* Old value (Red strikethrough) */}
                        {hasOld ? (
                          <span
                            data-testid={`diff-old-${key}`}
                            className="px-2.5 py-1 rounded bg-red-50 text-red-700 border border-red-200 line-through font-mono text-xs"
                          >
                            {oldVal}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">(none)</span>
                        )}

                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />

                        {/* New value (Green highlight) */}
                        {hasNew ? (
                          <span
                            data-testid={`diff-new-${key}`}
                            className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold font-mono text-xs"
                          >
                            {newVal}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">(removed)</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3.5 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg border border-slate-300 transition-colors cursor-pointer"
          >
            Close Diff View
          </button>
        </div>
      </div>
    </div>
  );
};

export default JsonDiffModal;
