import React from 'react';
import { AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { BlotterCaseSummary } from '../../types/certificates';

export interface BlotterAlertCardProps {
  cases: BlotterCaseSummary[];
  isOverride: boolean;
  onOverrideChange: (checked: boolean) => void;
  overrideReason: string;
  onReasonChange: (reason: string) => void;
  validationError?: string | null;
}

export const BlotterAlertCard: React.FC<BlotterAlertCardProps> = ({
  cases,
  isOverride,
  onOverrideChange,
  overrideReason,
  onReasonChange,
  validationError
}) => {
  const trimmedLength = overrideReason.trim().length;
  const isReasonValid = trimmedLength >= 10;

  return (
    <div
      data-testid="blotter-gatekeeper-warning-card"
      className="p-4 sm:p-5 rounded-none bg-red-50/60 border-l-4 border-l-red-600 border border-red-300 text-red-950 space-y-4 shadow-none"
    >
      {/* Alert Header */}
      <div className="flex items-start gap-3">
        <div className="p-2 bg-red-100 text-red-700 rounded-none border border-red-200 flex-shrink-0 mt-0.5">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm sm:text-base font-black text-red-950 uppercase tracking-tight flex items-center gap-2 flex-wrap">
            <span>Red Gatekeeper Warning: Active Blotter Record Found</span>
            <span className="px-1.5 py-0.5 bg-red-200 text-red-900 text-[10px] font-mono font-bold uppercase rounded-none">
              {cases.length} {cases.length === 1 ? 'Case' : 'Cases'}
            </span>
          </h3>
          <p className="text-xs text-red-800 font-mono mt-1 leading-relaxed">
            This resident has pending or unresolved blotter cases. Standard certificate issuance is locked.
            An administrative override with formal justification is strictly required to proceed.
          </p>
        </div>
      </div>

      {/* Cases Table */}
      <div className="overflow-x-auto rounded-none border border-red-200 bg-white">
        <table className="w-full text-left text-xs" data-testid="blotter-cases-table">
          <thead className="bg-red-100/70 text-red-950 font-mono font-bold border-b border-red-200 uppercase text-[10px] tracking-wider">
            <tr>
              <th className="px-3 py-2">Case Number</th>
              <th className="px-3 py-2">Complainant</th>
              <th className="px-3 py-2">Incident Type</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Date Recorded</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-red-100 font-sans">
            {cases.map((c, idx) => (
              <tr key={c.id || c.case_number || idx} className="hover:bg-red-50/40">
                <td className="px-3 py-2 font-mono font-bold text-red-950">{c.case_number}</td>
                <td className="px-3 py-2 text-zinc-900 font-medium">{c.complainant_name}</td>
                <td className="px-3 py-2 text-zinc-700">{c.incident_type}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-none text-[10px] font-mono font-bold uppercase bg-red-100 text-red-800 border border-red-200">
                    {c.status}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-zinc-600">{c.date_recorded}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Override Authorization Controls */}
      <div className="pt-2 border-t border-red-200 space-y-3 font-mono">
        <label className="flex items-start gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            id="authorize-override-checkbox"
            data-testid="authorize-override-checkbox"
            checked={isOverride}
            onChange={(e) => onOverrideChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded-none border-red-400 text-red-700 focus:ring-0 focus:ring-offset-0"
          />
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-red-950">
              Authorize Issuance Override
            </span>
            <p className="text-[11px] text-red-800 font-mono mt-0.5">
              Check this box to acknowledge that this resident has active blotter records and authorize clearance issuance under official discretion.
            </p>
          </div>
        </label>

        {/* Revealed Textarea when Override is Checked */}
        {isOverride && (
          <div className="space-y-1.5 pl-6" data-testid="override-reason-container">
            <div className="flex items-center justify-between">
              <label htmlFor="blotter_override_reason" className="text-xs font-bold uppercase tracking-wider text-red-950">
                Mandatory Override Justification:
              </label>
              <span className={`text-[10px] font-mono font-bold uppercase ${isReasonValid ? 'text-emerald-700' : 'text-red-700'}`}>
                {trimmedLength} / 10 chars min
              </span>
            </div>
            <textarea
              id="blotter_override_reason"
              data-testid="blotter_override_reason"
              rows={3}
              value={overrideReason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="e.g. Approved by Punong Barangay for urgent hospital assistance"
              className="w-full text-xs p-2.5 rounded-none border border-red-300 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-red-600 focus:border-red-600 font-sans"
            />
            {(!isReasonValid || validationError) && (
              <p
                data-testid="override-validation-error"
                className="text-[11px] text-red-700 font-mono font-medium flex items-center gap-1"
              >
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  {validationError || 'Override justification must contain at least 10 non-whitespace characters.'}
                </span>
              </p>
            )}
            {isReasonValid && (
              <p className="text-[11px] text-emerald-700 font-mono font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Valid override justification recorded. Advancement unlocked.</span>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export interface BlotterAlertModalProps extends BlotterAlertCardProps {
  isOpen?: boolean;
  onClose?: () => void;
  onConfirm?: () => void;
}

export const BlotterAlertModal: React.FC<BlotterAlertModalProps> = (props) => {
  const { isOpen = true, onClose, onConfirm, ...cardProps } = props;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 no-print">
      <div className="bg-white rounded-none shadow-none max-w-2xl w-full p-5 space-y-4 border border-zinc-300">
        <BlotterAlertCard {...cardProps} />
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-none border border-zinc-300 text-xs font-mono font-medium uppercase tracking-wider text-zinc-800 hover:bg-zinc-100 transition-colors"
            >
              Cancel
            </button>
          )}
          {onConfirm && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={!cardProps.isOverride || cardProps.overrideReason.trim().length < 10}
              className="px-4 py-1.5 rounded-none bg-red-700 hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-mono font-bold uppercase tracking-wider text-white transition-colors"
            >
              Confirm Override
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlotterAlertModal;
