import React, { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { X, Printer, Loader2, AlertCircle, FileDown, FileText } from 'lucide-react';
import CertificatePrintSheet, { PAPER_SIZE_SPECS } from './CertificatePrintSheet';
import {
  CreateIssuanceInput,
  PrintableIssuancePayload,
  BarangayOfficial,
  SingleIssuanceResponse,
  PaperSize
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
    paper_size?: PaperSize;
    header_html?: string;
    header_config_json?: string;
    footer_html?: string;
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
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [issuedPayload, setIssuedPayload] = useState<PrintableIssuancePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initialPaperSize: PaperSize =
    issuedPayload?.paper_size ||
    issuance?.paper_size ||
    previewData?.paper_size ||
    'short';

  const [selectedPaperSize, setSelectedPaperSize] = useState<PaperSize>(initialPaperSize);

  useEffect(() => {
    const nextSize =
      issuedPayload?.paper_size ||
      issuance?.paper_size ||
      previewData?.paper_size ||
      'short';
    setSelectedPaperSize(nextSize);
  }, [issuedPayload?.paper_size, issuance?.paper_size, previewData?.paper_size, isOpen]);

  if (!isOpen) return null;

  // Derive active display values whether in create or reprint mode
  const isReprint = mode === 'reprint' || Boolean(issuance && !createPayload);

  const activeHtml =
    issuedPayload?.html ||
    (isReprint ? issuance?.html || '' : previewData?.html || '');

  const activeHeaderHtml =
    issuedPayload?.header_html ??
    (isReprint ? issuance?.header_html : previewData?.header_html);

  const activeHeaderConfigJson =
    issuedPayload?.header_config_json ??
    (isReprint ? issuance?.header_config_json : previewData?.header_config_json);

  const activeFooterHtml =
    issuedPayload?.footer_html ??
    (isReprint ? issuance?.footer_html : previewData?.footer_html);

  const activeTitle =
    issuedPayload?.title_header ||
    (isReprint
      ? issuance?.title_header || issuance?.template_name || 'BARANGAY CERTIFICATE'
      : previewData?.title_header || 'BARANGAY CERTIFICATE');

  const activeSidebarVal =
    issuedPayload?.show_officials_sidebar !== undefined
      ? issuedPayload.show_officials_sidebar
      : isReprint
      ? issuance?.show_officials_sidebar ?? 1
      : previewData?.show_officials_sidebar ?? 1;

  const activeOfficials =
    issuedPayload?.sidebar_officials ||
    (isReprint ? issuance?.sidebar_officials || [] : previewData?.sidebar_officials || []);

  const activeControlNo =
    issuedPayload?.issuance?.control_number ||
    (isReprint
      ? issuance?.control_number || ''
      : previewData?.control_number_preview || 'CERT-2026-PREVIEW');

  const activeSignatoryName = isReprint
    ? issuance?.signatory_name_snapshot || previewData?.signatory_name
    : previewData?.signatory_name;

  const activeSignatoryPos = isReprint
    ? issuance?.signatory_position_snapshot || previewData?.signatory_position
    : previewData?.signatory_position;

  const activeIsOic = isReprint
    ? Boolean(issuance?.is_oic_signing)
    : Boolean(previewData?.is_oic_signing);

  const activeResidentName = isReprint
    ? issuance?.resident_name || previewData?.resident_name
    : previewData?.resident_name;

  const handleIssueAndPrint = async () => {
    if (isSubmitting) return;

    if (isReprint || issuedPayload) {
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

  const handleExportDocx = async () => {
    if (isExportingDocx) return;
    setIsExportingDocx(true);
    setError(null);
    try {
      const targetIssuanceId = issuedPayload?.issuance?.id || issuance?.id;
      if (targetIssuanceId) {
        await api.exportIssuanceDocxById(targetIssuanceId, selectedPaperSize);
      } else if (createPayload) {
        await api.exportPreviewIssuanceDocx({
          ...createPayload,
          paper_size: selectedPaperSize
        });
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to export MS Word (.docx) document.');
    } finally {
      setIsExportingDocx(false);
    }
  };

  const activePaperSpec = PAPER_SIZE_SPECS[selectedPaperSize];

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/75 flex items-start justify-center p-2 sm:p-4 md:p-6"
      data-testid="print-preview-modal"
    >
      <div className="relative bg-zinc-100 rounded-none shadow-none w-full max-w-6xl flex flex-col my-auto border border-zinc-400 overflow-hidden max-h-[95vh]">
        {/* Modal Header (Hidden during print) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-white border-b border-zinc-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-900 text-white rounded-none border border-zinc-900">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-950 uppercase tracking-tight">
                {isReprint ? 'Reprint / Inspection View' : 'Live Interactive Print Preview'}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-zinc-500 font-mono">
                  {activePaperSpec.shortLabel} ({activePaperSpec.dimensionsLabel})
                </span>
                <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded-none bg-zinc-100 text-zinc-800 border border-zinc-300">
                  {activeControlNo}
                </span>
              </div>
            </div>
          </div>

          {/* Coupon Bond Size Selector & Close */}
          <div className="flex items-center gap-3">
            <div
              className="flex items-center border border-zinc-300 bg-zinc-50 p-0.5"
              role="group"
              aria-label="Coupon Bond Paper Size"
            >
              <span className="px-2 text-[10px] font-mono uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                Coupon:
              </span>
              {(['short', 'a4', 'long'] as PaperSize[]).map((sizeKey) => {
                const isSelected = selectedPaperSize === sizeKey;
                const label =
                  sizeKey === 'short'
                    ? 'Short (8.5×11")'
                    : sizeKey === 'a4'
                    ? 'A4 (210×297mm)'
                    : 'Long (8.5×13")';
                return (
                  <button
                    key={sizeKey}
                    type="button"
                    data-testid={`paper-size-btn-${sizeKey}`}
                    onClick={() => setSelectedPaperSize(sizeKey)}
                    className={`px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider transition-colors rounded-none ${
                      isSelected
                        ? 'bg-zinc-900 text-white font-semibold'
                        : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/60'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

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
              paperSize={selectedPaperSize}
              headerHtml={activeHeaderHtml}
              headerConfigJson={activeHeaderConfigJson}
              footerHtml={activeFooterHtml}
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
        <div className="no-print flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-white border-t border-zinc-200 font-mono">
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
              onClick={handleExportDocx}
              disabled={isExportingDocx || isSubmitting}
              data-testid="export-docx-button"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-none border border-zinc-800 bg-white hover:bg-zinc-100 text-zinc-900 text-xs font-mono font-semibold uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              {isExportingDocx ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Download .docx</span>
                </>
              )}
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
