import React, { useState } from 'react';
import { flushSync } from 'react-dom';
import { X, Printer, Loader2, AlertCircle } from 'lucide-react';
import CertificatePrintSheet from './CertificatePrintSheet';
import {
  CreateIssuanceInput,
  PrintableIssuancePayload,
  BarangayOfficial,
  SingleIssuanceResponse
} from '../../types/certificates';
import api from '../../services/api';

export interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'create' | 'reprint';
  createPayload?: CreateIssuanceInput;
  previewData?: {
    html: string;
    title_header?: string;
    show_officials_sidebar?: number;
    control_number_preview?: string;
    sidebar_officials?: BarangayOfficial[];
    resident_name?: string;
    signatory_name?: string;
    signatory_position?: string;
    is_oic_signing?: number | boolean;
  };
  issuance?: SingleIssuanceResponse | null;
  barangayLogoUrl?: string;
  cityLogoUrl?: string;
  onSuccess?: (payload: PrintableIssuancePayload) => void;
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen,
  onClose,
  mode = 'create',
  createPayload,
  previewData,
  issuance,
  barangayLogoUrl,
  cityLogoUrl,
  onSuccess
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [issuedPayload, setIssuedPayload] = useState<PrintableIssuancePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Derive active display values whether in create or reprint mode
  const isReprint = mode === 'reprint' || Boolean(issuance && !createPayload);

  const activeHtml = issuedPayload?.html ||
    (isReprint ? (issuance?.html || '') : (previewData?.html || ''));

  const activeTitle = issuedPayload?.title_header ||
    (isReprint ? (issuance?.title_header || issuance?.template_name || 'BARANGAY CERTIFICATE') : (previewData?.title_header || 'BARANGAY CERTIFICATE'));

  const activeSidebarVal = issuedPayload?.show_officials_sidebar !== undefined
    ? issuedPayload.show_officials_sidebar
    : (isReprint
      ? (issuance?.show_officials_sidebar ?? 1)
      : (previewData?.show_officials_sidebar ?? 1));

  const activeOfficials = issuedPayload?.sidebar_officials ||
    (isReprint ? (issuance?.sidebar_officials || []) : (previewData?.sidebar_officials || []));

  const activeControlNo = issuedPayload?.issuance?.control_number ||
    (isReprint
      ? (issuance?.control_number || '')
      : (previewData?.control_number_preview || 'CERT-2026-PREVIEW'));

  const activeSignatoryName = isReprint
    ? (issuance?.signatory_name_snapshot || previewData?.signatory_name)
    : (previewData?.signatory_name);

  const activeSignatoryPos = isReprint
    ? (issuance?.signatory_position_snapshot || previewData?.signatory_position)
    : (previewData?.signatory_position);

  const activeIsOic = isReprint
    ? Boolean(issuance?.is_oic_signing)
    : Boolean(previewData?.is_oic_signing);

  const activeResidentName = isReprint
    ? (issuance?.resident_name || previewData?.resident_name)
    : (previewData?.resident_name);

  const handleIssueAndPrint = async () => {
    if (isSubmitting) return;

    if (isReprint) {
      window.print();
      return;
    }

    if (!createPayload) {
      setError('Issuance payload is missing.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await api.createIssuance(createPayload);
      flushSync(() => {
        setIssuedPayload(result);
      });

      // Trigger native browser print
      window.print();

      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to issue certificate. Please review details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70 flex items-start justify-center p-2 sm:p-4 md:p-6"
      data-testid="print-preview-modal"
    >
      <div className="relative bg-zinc-100 rounded-none shadow-none w-full max-w-5xl flex flex-col my-auto border border-zinc-400 overflow-hidden max-h-[95vh]">
        {/* Modal Header (Hidden during print) */}
        <div className="no-print flex items-center justify-between px-5 py-3.5 bg-white border-b border-zinc-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-100 text-zinc-800 rounded-none border border-zinc-200">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-950 uppercase tracking-tight">
                {isReprint ? 'Reprint / Inspection View' : 'Live Interactive Print Preview'}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-zinc-500 font-mono">Standard A4 Portrait (210mm × 297mm)</span>
                <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded-none bg-zinc-100 text-zinc-800 border border-zinc-300">
                  {activeControlNo}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              data-testid="modal-close-button"
              className="p-1.5 rounded-none text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 border border-transparent hover:border-zinc-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Error Notification (Hidden during print) */}
        {error && (
          <div className="no-print mx-5 mt-3 p-3 bg-red-50 border border-red-200 text-red-800 text-xs font-mono rounded-none flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Document Scroll Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center bg-zinc-200/80">
          <div className="shadow-lg bg-white border border-zinc-300">
            <CertificatePrintSheet
              html={activeHtml}
              titleHeader={activeTitle}
              showOfficialsSidebar={activeSidebarVal}
              sidebarOfficials={activeOfficials}
              controlNumber={activeControlNo}
              signatoryName={activeSignatoryName}
              signatoryPosition={activeSignatoryPos}
              isOicSigning={activeIsOic}
              residentName={activeResidentName}
              barangayLogoUrl={barangayLogoUrl}
              cityLogoUrl={cityLogoUrl}
            />
          </div>
        </div>

        {/* Modal Action Footer (Hidden during print) */}
        <div className="no-print flex items-center justify-between px-5 py-3.5 bg-white border-t border-zinc-200 font-mono">
          <div className="text-[11px] text-zinc-500">
            {isReprint
              ? 'Historical snapshot. Reprints maintain originally recorded signatory data.'
              : 'Submitting will assign a permanent control number and record an immutable audit event.'}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-none border border-zinc-300 text-xs font-mono font-medium uppercase tracking-wider text-zinc-800 hover:bg-zinc-100 transition-colors disabled:opacity-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleIssueAndPrint}
              disabled={isSubmitting}
              data-testid="issue-and-print-button"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-none bg-zinc-900 hover:bg-black text-white text-xs font-mono font-semibold uppercase tracking-wider transition-colors disabled:opacity-50 shadow-none"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing Issuance...</span>
                </>
              ) : (
                <>
                  <Printer className="w-3.5 h-3.5" />
                  <span>{isReprint ? 'Print Certificate' : 'Issue & Print'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintPreviewModal;
