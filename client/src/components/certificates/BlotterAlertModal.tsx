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
      className="p-5 rounded-xl bg-red-50 border-2 border-red-300 text-red-950 space-y-4 shadow-sm"
    >
      {/* Alert Header */}
      <div className="flex items-start gap-3">
        <div className="p-2 bg-red-100 text-red-600 rounded-lg flex-shrink-0 mt-0.5">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-red-900 tracking-tight flex items-center gap-2">
            <span>Red Gatekeeper Warning: Active Blotter Record Found</span>
            <span className="px-2 py-0.5 bg-red-200 text-red-800 text-xs rounded-full font-bold">
              {cases.length} {cases.length === 1 ? 'Case' : 'Cases'}
            </span>
          </h3>
          <p className="text-xs text-red-700 mt-1">
            This resident has pending or unresolved blotter cases. Standard certificate issuance is locked.
            An administrative override with formal justification is strictly required to proceed.
          </p>
        </div>
      </div>

      {/* Cases Table */}
      <div className="overflow-x-auto rounded-lg border border-red-200 bg-white">
        <table className="w-full text-left text-xs" data-testid="blotter-cases-table">
          <thead className="bg-red-100/75 text-red-900 font-semibold border-b border-red-200">
            <tr>
              <th className="px-3 py-2">Case Number</th>
              <th className="px-3 py-2">Complainant</th>
              <th className="px-3 py-2">Incident Type</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Date Recorded</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-red-100">
            {cases.map((c, idx) => (
              <tr key={c.id || c.case_number || idx} className="hover:bg-red-50/50">
                <td className="px-3 py-2 font-mono font-bold text-red-900">{c.case_number}</td>
                <td className="px-3 py-2 text-slate-800 font-medium">{c.complainant_name}</td>
                <td className="px-3 py-2 text-slate-700">{c.incident_type}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800">
                    {c.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-600">{c.date_recorded}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Override Authorization Controls */}
      <div className="pt-2 border-t border-red-200 space-y-3">
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            id="authorize-override-checkbox"
            data-testid="authorize-override-checkbox"
            checked={isOverride}
            onChange={(e) => onOverrideChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
          />
          <div>
            <span className="text-xs font-bold text-red-950">
              Authorize Issuance Override
            </span>
            <p className="text-[11px] text-red-700">
              Check this box to acknowledge that this resident has active blotter records and authorize clearance issuance under official discretion.
            </p>
          </div>
        </label>

        {/* Revealed Textarea when Override is Checked */}
        {isOverride && (
          <div className="space-y-1.5 pl-7 animate-in fade-in duration-200" data-testid="override-reason-container">
            <div className="flex items-center justify-between">
              <label htmlFor="blotter_override_reason" className="text-xs font-bold text-red-900">
                Mandatory Override Justification:
              </label>
              <span className={`text-[11px] font-mono font-medium ${isReasonValid ? 'text-emerald-700' : 'text-red-600'}`}>
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
              className="w-full text-xs p-2.5 rounded-lg border border-red-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
            {(!isReasonValid || validationError) && (
              <p
                data-testid="override-validation-error"
                className="text-[11px] text-red-600 font-medium flex items-center gap-1"
              >
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  {validationError || 'Override justification must contain at least 10 non-whitespace characters.'}
                </span>
              </p>
            )}
            {isReasonValid && (
              <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-4">
        <BlotterAlertCard {...cardProps} />
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          )}
          {onConfirm && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={!cardProps.isOverride || cardProps.overrideReason.trim().length < 10}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white transition-colors"
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
