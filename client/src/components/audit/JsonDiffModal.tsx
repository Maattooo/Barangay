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
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-none shadow-none max-w-2xl w-full border border-zinc-300 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 bg-zinc-50">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-zinc-100 text-zinc-800 rounded-none border border-zinc-200">
              <GitCompare className="w-4 h-4" />
            </div>
            <div>
              <h2 id="diff-modal-title" className="text-sm font-bold text-zinc-950 uppercase tracking-tight">
                Visual JSON Diff Inspector
              </h2>
              <p className="text-xs text-zinc-500 font-mono">
                Audit Event #{logEntry.id} &bull; Action:{' '}
                <span className="font-bold text-zinc-900">{logEntry.action}</span> &bull; Entity:{' '}
                <span className="font-bold text-zinc-900 uppercase">{logEntry.entity_type}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 text-zinc-400 hover:text-zinc-950 rounded-none transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[calc(85vh-120px)] overflow-y-auto font-mono text-xs">
          {/* Audit Meta Context */}
          <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-none space-y-1">
            <p className="text-zinc-800 font-medium font-sans">
              <span className="text-zinc-500 font-mono text-xs uppercase font-bold">Summary: </span>
              {logEntry.summary_text}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-zinc-600 text-[11px] pt-1 border-t border-zinc-100">
              <span>
                Editor: <strong className="text-zinc-900 font-sans">{logEntry.username_snapshot}</strong> ({logEntry.user_role_snapshot})
              </span>
              <span>
                Client IP: <strong className="text-zinc-900">{logEntry.client_ip}</strong>
              </span>
              <span>
                Timestamp: <strong className="text-zinc-900">{logEntry.created_at}</strong>
              </span>
            </div>
          </div>

          {/* Diff comparison table */}
          {changedKeys.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-zinc-300 rounded-none text-zinc-500 text-xs space-y-1">
              <ShieldCheck className="w-6 h-6 text-zinc-400 mx-auto" />
              <p className="font-semibold text-zinc-700">No field-level JSON diffs recorded</p>
              <p className="text-zinc-400 text-[11px]">
                This event did not contain before/after data snapshots or was an immutable single-state transaction.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-zinc-500 px-1">
                <span>Field Name</span>
                <span>Before &rarr; After Comparison</span>
              </div>

              <div className="border border-zinc-200 rounded-none overflow-hidden divide-y divide-zinc-200 text-xs">
                {changedKeys.map((key) => {
                  const hasOld = key in oldData;
                  const hasNew = key in newData;
                  const oldVal = formatValue(oldData[key]);
                  const newVal = formatValue(newData[key]);

                  return (
                    <div
                      key={key}
                      className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-50 transition-colors"
                    >
                      <span className="font-mono font-bold text-zinc-900 text-xs w-44 shrink-0 truncate">
                        {key}
                      </span>

                      <div className="flex-1 flex items-center gap-2 flex-wrap">
                        {/* Old value (Red strikethrough) */}
                        {hasOld ? (
                          <span
                            data-testid={`diff-old-${key}`}
                            className="px-2 py-0.5 rounded-none bg-red-50 text-red-800 border border-red-300 line-through font-mono text-xs"
                          >
                            {oldVal}
                          </span>
                        ) : (
                          <span className="text-zinc-400 italic text-[11px]">(none)</span>
                        )}

                        <ArrowRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />

                        {/* New value (Green highlight) */}
                        {hasNew ? (
                          <span
                            data-testid={`diff-new-${key}`}
                            className="px-2 py-0.5 rounded-none bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold font-mono text-xs"
                          >
                            {newVal}
                          </span>
                        ) : (
                          <span className="text-zinc-400 italic text-[11px]">(removed)</span>
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
        <div className="flex items-center justify-end px-5 py-3 border-t border-zinc-200 bg-zinc-50 font-mono">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-mono font-medium uppercase tracking-wider text-zinc-800 hover:bg-zinc-100 rounded-none border border-zinc-300 transition-colors cursor-pointer"
          >
            Close Diff View
          </button>
        </div>
      </div>
    </div>
  );
};

export default JsonDiffModal;
