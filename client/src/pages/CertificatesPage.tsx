import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  Search,
  AlertTriangle,
  Printer,
  Loader2,
  CheckCircle,
  AlertCircle,
  X
} from 'lucide-react';
import api from '../services/api';
import {
  IssuanceListItem,
  CertificateTemplate,
  SingleIssuanceResponse
} from '../types/certificates';
import PrintPreviewModal from '../components/certificates/PrintPreviewModal';

export const CertificatesPage: React.FC = () => {
  const [issuances, setIssuances] = useState<IssuanceListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success and Reprint Error Notification States
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [reprintError, setReprintError] = useState<string | null>(null);

  const location = useLocation();
  const navigate = useNavigate();

  // Inspect location state for issuance success feedback and clear it to prevent redisplay on refresh
  useEffect(() => {
    if (location.state && (location.state as any).successMessage) {
      setSuccessMessage((location.state as any).successMessage);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [templateFilter, setTemplateFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Template dropdown choices
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);

  // Reprint / Inspection modal state
  const [reprintModalOpen, setReprintModalOpen] = useState(false);
  const [selectedIssuance, setSelectedIssuance] = useState<SingleIssuanceResponse | null>(null);
  const [reprintingId, setReprintingId] = useState<number | null>(null);

  // Load templates for filter dropdown
  useEffect(() => {
    api.getTemplates()
      .then((data: CertificateTemplate[]) =>
        setTemplates(data.filter((t) => (t.template_category || 'certificate') === 'certificate'))
      )
      .catch((err: unknown) => console.error('Failed to load templates:', err));
  }, []);

  // Fetch issuances
  const fetchIssuances = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getIssuances({
        search: searchTerm.trim() || undefined,
        template_id: templateFilter || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        page,
        limit: 10
      });
      setIssuances(res.data);
      setTotalPages(res.pagination.totalPages || 1);
      setTotalCount(res.pagination.total || 0);
    } catch (err: any) {
      setError(err?.message || 'Failed to load certificate issuances.');
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, templateFilter, startDate, endDate, page]);

  useEffect(() => {
    fetchIssuances();
  }, [fetchIssuances]);

  // Handle Reprint click
  const handleOpenReprint = async (item: IssuanceListItem) => {
    setReprintingId(item.id);
    setReprintError(null);
    try {
      const details = await api.getIssuanceById(item.id);
      setSelectedIssuance(details);
      setReprintModalOpen(true);
    } catch (err: any) {
      setReprintError(err?.message || 'Failed to load issuance details for reprinting.');
    } finally {
      setReprintingId(null);
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setTemplateFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div className="bg-white p-4 sm:p-5 rounded-none border border-zinc-200 shadow-none flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-zinc-100 text-zinc-800 rounded-none border border-zinc-200">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-zinc-950 uppercase tracking-tight">
              Certificate Issuance History
            </h1>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">
              Official log of Barangay Clearances, Indigency, and Residency certifications
            </p>
          </div>
        </div>

        <Link
          to="/certificates/new"
          data-testid="issue-new-certificate-btn"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-none bg-zinc-900 hover:bg-black text-white text-xs font-mono font-semibold uppercase tracking-wider transition-colors shadow-none"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Issue New Certificate</span>
        </Link>
      </div>

      {/* Success Feedback Banner */}
      {successMessage && (
        <div
          role="status"
          data-testid="issuance-success-banner"
          className="p-3 bg-emerald-50 border-l-4 border-l-emerald-600 border border-emerald-200 text-emerald-900 rounded-none flex items-center justify-between gap-3 shadow-none transition-all"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="text-xs font-mono font-medium">{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            data-testid="dismiss-success-banner"
            className="p-1 text-emerald-700 hover:text-emerald-950 hover:bg-emerald-100 rounded-none transition-colors"
            aria-label="Dismiss success banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* In-App Reprint Error Alert Banner */}
      {reprintError && (
        <div
          role="alert"
          data-testid="reprint-error-banner"
          className="p-3 bg-red-50 border-l-4 border-l-red-600 border border-red-200 text-red-900 rounded-none flex items-center justify-between gap-3 shadow-none transition-all"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span className="text-xs font-mono font-medium">{reprintError}</span>
          </div>
          <button
            type="button"
            onClick={() => setReprintError(null)}
            data-testid="dismiss-reprint-error-banner"
            className="p-1 text-red-700 hover:text-red-950 hover:bg-red-100 rounded-none transition-colors"
            aria-label="Dismiss reprint error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Controls Bar */}
      <div className="bg-white p-3.5 rounded-none border border-zinc-200 shadow-none space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* Search input */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-400" />
            <input
              type="text"
              id="search-issuances-input"
              data-testid="search-issuances-input"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search by resident name or control number..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-none border border-zinc-300 bg-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
            />
          </div>

          {/* Template filter */}
          <div>
            <select
              id="filter-template-select"
              data-testid="filter-template-select"
              value={templateFilter}
              onChange={(e) => {
                setTemplateFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs rounded-none border border-zinc-300 bg-white text-zinc-800 font-mono focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
            >
              <option value="">All Certificate Types</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.template_name}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <input
              type="date"
              id="filter-start-date"
              data-testid="filter-start-date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs font-mono rounded-none border border-zinc-300 bg-white text-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
            />
          </div>

          {/* End Date */}
          <div>
            <input
              type="date"
              id="filter-end-date"
              data-testid="filter-end-date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs font-mono rounded-none border border-zinc-300 bg-white text-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
            />
          </div>
        </div>

        {/* Filter Summary & Reset */}
        <div className="flex items-center justify-between text-xs text-zinc-500 font-mono pt-1 border-t border-zinc-100">
          <div>
            Showing <strong className="text-zinc-900">{issuances.length}</strong> of <strong className="text-zinc-900">{totalCount}</strong> issued records
          </div>
          {(searchTerm || templateFilter || startDate || endDate) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-zinc-800 hover:text-black font-semibold underline uppercase text-[11px] tracking-wider"
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs font-mono rounded-none flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white rounded-none border border-zinc-200 shadow-none overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" data-testid="issuances-history-table">
            <thead className="bg-zinc-50 text-zinc-700 font-mono font-semibold border-b border-zinc-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3">Control Number</th>
                <th className="px-4 py-3">Resident Name</th>
                <th className="px-4 py-3">Certificate Type</th>
                <th className="px-4 py-3">Purpose</th>
                <th className="px-4 py-3">Fee / OR Number</th>
                <th className="px-4 py-3">Signatory Snapshot</th>
                <th className="px-4 py-3">Date Issued</th>
                <th className="px-4 py-3">Issuing Clerk</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-zinc-900 font-sans">
              {isLoading && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-zinc-500 font-mono">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 text-zinc-700 animate-spin" />
                      <span>Loading issuance history...</span>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && issuances.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-zinc-500 font-mono">
                    <FileText className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                    <p className="font-semibold text-zinc-800">No certificate issuances found</p>
                    <p className="text-[11px] text-zinc-400 mt-1">Adjust search filters or issue a new certificate.</p>
                  </td>
                </tr>
              )}

              {!isLoading && issuances.map((item) => (
                <tr key={item.id} data-testid={`issuance-row-${item.id}`} className="hover:bg-zinc-50 transition-colors">
                  {/* Control Number & Blotter Override Warning Badge */}
                  <td className="px-4 py-3 font-mono font-bold text-zinc-950 whitespace-nowrap">
                    <div>
                      <span>{item.control_number}</span>
                      {item.had_active_blotter === 1 && (
                        <div className="mt-1">
                          <span
                            data-testid={`blotter-override-badge-${item.id}`}
                            title={item.blotter_override_reason ? `Override Reason: ${item.blotter_override_reason}` : 'Blotter Override Authorized'}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-none text-[10px] font-mono font-bold uppercase bg-red-50 text-red-800 border border-red-300 cursor-help"
                          >
                            <AlertTriangle className="w-3 h-3 text-red-600 flex-shrink-0" />
                            <span>Blotter Override</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Resident Name */}
                  <td className="px-4 py-3 font-medium text-zinc-900 whitespace-nowrap">
                    {item.resident_name || `Resident #${item.resident_id}`}
                  </td>

                  {/* Template Name */}
                  <td className="px-4 py-3 text-zinc-700 whitespace-nowrap">
                    {item.template_name || `Template #${item.template_id}`}
                  </td>

                  {/* Purpose */}
                  <td className="px-4 py-3 text-zinc-600 max-w-xs truncate" title={item.purpose}>
                    {item.purpose}
                  </td>

                  {/* Amount Paid / OR Number */}
                  <td className="px-4 py-3 whitespace-nowrap font-mono">
                    <span className="font-bold text-zinc-900">
                      {item.amount_paid > 0 ? `₱${item.amount_paid.toFixed(2)}` : 'FREE'}
                    </span>
                    <span className="text-zinc-500 text-[10px] block">
                      {item.or_number || 'FREE / EXEMPT'}
                    </span>
                  </td>

                  {/* Signatory Snapshot */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="font-bold text-zinc-900 text-[11px] uppercase">{item.signatory_name_snapshot}</p>
                    <p className="text-[10px] text-zinc-500 font-mono">
                      {item.is_oic_signing ? 'Sangguniang Barangay Member (OIC)' : item.signatory_position_snapshot}
                    </p>
                  </td>

                  {/* Date Issued */}
                  <td className="px-4 py-3 text-zinc-600 whitespace-nowrap text-[11px] font-mono">
                    {item.issued_at}
                  </td>

                  {/* Issuing Clerk */}
                  <td className="px-4 py-3 text-zinc-700 whitespace-nowrap text-[11px] font-mono">
                    {item.issued_by_name || `User #${item.issued_by_user_id}`}
                  </td>

                  {/* Action */}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleOpenReprint(item)}
                      disabled={reprintingId === item.id}
                      data-testid={`reprint-btn-${item.id}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-none border border-zinc-300 hover:bg-zinc-100 text-zinc-800 text-xs font-mono font-medium uppercase tracking-wider transition-colors disabled:opacity-50"
                    >
                      {reprintingId === item.id ? (
                        <Loader2 className="w-3.5 h-3.5 text-zinc-500 animate-spin" />
                      ) : (
                        <Printer className="w-3.5 h-3.5 text-zinc-600" />
                      )}
                      <span>Reprint / View</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 bg-zinc-50 text-xs font-mono text-zinc-600">
            <div>
              Page <strong className="text-zinc-900">{page}</strong> of <strong className="text-zinc-900">{totalPages}</strong>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 rounded-none border border-zinc-300 bg-white hover:bg-zinc-100 uppercase tracking-wider text-[11px] font-mono disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 rounded-none border border-zinc-300 bg-white hover:bg-zinc-100 uppercase tracking-wider text-[11px] font-mono disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reprint Modal */}
      {reprintModalOpen && selectedIssuance && (
        <PrintPreviewModal
          isOpen={reprintModalOpen}
          onClose={() => setReprintModalOpen(false)}
          mode="reprint"
          issuance={selectedIssuance}
          previewData={{
            html: selectedIssuance.html || '',
            title_header: selectedIssuance.title_header,
            show_officials_sidebar: selectedIssuance.show_officials_sidebar,
            control_number_preview: selectedIssuance.control_number,
            sidebar_officials: selectedIssuance.sidebar_officials,
            resident_name: selectedIssuance.resident_name,
            signatory_name: selectedIssuance.signatory_name_snapshot,
            signatory_position: selectedIssuance.signatory_position_snapshot,
            is_oic_signing: selectedIssuance.is_oic_signing
          }}
        />
      )}
    </div>
  );
};

export default CertificatesPage;
