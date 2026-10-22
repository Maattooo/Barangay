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
      .then((data: CertificateTemplate[]) => setTemplates(data))
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
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Certificate Issuance History</h1>
            <p className="text-xs text-slate-500">Official log of Barangay Clearances, Indigency, and Residency certifications</p>
          </div>
        </div>

        <Link
          to="/certificates/new"
          data-testid="issue-new-certificate-btn"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm hover:shadow"
        >
          <Plus className="w-4 h-4" />
          <span>Issue New Certificate</span>
        </Link>
      </div>

      {/* Success Feedback Banner */}
      {successMessage && (
        <div
          role="status"
          data-testid="issuance-success-banner"
          className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center justify-between gap-3 shadow-sm transition-all"
        >
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span className="text-xs sm:text-sm font-medium">{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            data-testid="dismiss-success-banner"
            className="p-1 text-emerald-600 hover:text-emerald-900 hover:bg-emerald-100 rounded-lg transition-colors"
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
          className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-center justify-between gap-3 shadow-sm transition-all"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <span className="text-xs sm:text-sm font-medium">{reprintError}</span>
          </div>
          <button
            type="button"
            onClick={() => setReprintError(null)}
            data-testid="dismiss-reprint-error-banner"
            className="p-1 text-red-600 hover:text-red-900 hover:bg-red-100 rounded-lg transition-colors"
            aria-label="Dismiss reprint error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Controls Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search input */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
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
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
              className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
              className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
              className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Filter Summary & Reset */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
          <div>
            Showing <strong className="text-slate-800">{issuances.length}</strong> of <strong className="text-slate-800">{totalCount}</strong> issued records
          </div>
          {(searchTerm || templateFilter || startDate || endDate) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-emerald-600 hover:text-emerald-700 font-semibold"
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" data-testid="issuances-history-table">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3.5">Control Number</th>
                <th className="px-4 py-3.5">Resident Name</th>
                <th className="px-4 py-3.5">Certificate Type</th>
                <th className="px-4 py-3.5">Purpose</th>
                <th className="px-4 py-3.5">Fee / OR Number</th>
                <th className="px-4 py-3.5">Signatory Snapshot</th>
                <th className="px-4 py-3.5">Date Issued</th>
                <th className="px-4 py-3.5">Issuing Clerk</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {isLoading && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
                      <span>Loading issuance history...</span>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && issuances.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-500">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No certificate issuances found</p>
                    <p className="text-[11px] text-slate-400 mt-1">Adjust search filters or issue a new certificate.</p>
                  </td>
                </tr>
              )}

              {!isLoading && issuances.map((item) => (
                <tr key={item.id} data-testid={`issuance-row-${item.id}`} className="hover:bg-slate-50/75 transition-colors">
                  {/* Control Number & Blotter Override Warning Badge */}
                  <td className="px-4 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                    <div>
                      <span>{item.control_number}</span>
                      {item.had_active_blotter === 1 && (
                        <div className="mt-1">
                          <span
                            data-testid={`blotter-override-badge-${item.id}`}
                            title={item.blotter_override_reason ? `Override Reason: ${item.blotter_override_reason}` : 'Blotter Override Authorized'}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200 cursor-help"
                          >
                            <AlertTriangle className="w-3 h-3 text-red-600 flex-shrink-0" />
                            <span>Blotter Override</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Resident Name */}
                  <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                    {item.resident_name || `Resident #${item.resident_id}`}
                  </td>

                  {/* Template Name */}
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                    {item.template_name || `Template #${item.template_id}`}
                  </td>

                  {/* Purpose */}
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={item.purpose}>
                    {item.purpose}
                  </td>

                  {/* Amount Paid / OR Number */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-semibold text-slate-800">
                      {item.amount_paid > 0 ? `₱${item.amount_paid.toFixed(2)}` : 'FREE'}
                    </span>
                    <span className="text-slate-400 text-[11px] block">
                      {item.or_number || 'FREE / EXEMPT'}
                    </span>
                  </td>

                  {/* Signatory Snapshot */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="font-bold text-slate-900 text-[11px] uppercase">{item.signatory_name_snapshot}</p>
                    <p className="text-[10px] text-slate-500">
                      {item.is_oic_signing ? 'Sangguniang Barangay Member (OIC)' : item.signatory_position_snapshot}
                    </p>
                  </td>

                  {/* Date Issued */}
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-[11px]">
                    {item.issued_at}
                  </td>

                  {/* Issuing Clerk */}
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap text-[11px] font-medium">
                    {item.issued_by_name || `User #${item.issued_by_user_id}`}
                  </td>

                  {/* Action */}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleOpenReprint(item)}
                      disabled={reprintingId === item.id}
                      data-testid={`reprint-btn-${item.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      {reprintingId === item.id ? (
                        <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin" />
                      ) : (
                        <Printer className="w-3.5 h-3.5 text-slate-500" />
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
            <div>
              Page <strong className="text-slate-800">{page}</strong> of <strong className="text-slate-800">{totalPages}</strong>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50"
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
