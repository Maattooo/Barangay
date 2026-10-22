import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Edit3,
  Archive,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { BlotterRecord, BlotterStatus } from '../types/admin';
import BlotterFormModal from '../components/blotter/BlotterFormModal';
import BlotterSettleModal from '../components/blotter/BlotterSettleModal';
import BlotterArchiveModal from '../components/blotter/BlotterArchiveModal';

export const BlotterPage: React.FC = () => {
  const { role } = useAuth();
  const isAdmin = role === 'Admin';

  const [records, setRecords] = useState<BlotterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [settleRecord, setSettleRecord] = useState<BlotterRecord | null>(null);
  const [archiveRecord, setArchiveRecord] = useState<BlotterRecord | null>(null);

  const fetchBlotters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getBlotters({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        page,
        limit
      });
      setRecords(res.data);
      setTotalPages(res.pagination.totalPages || 1);
      setTotalRecords(res.pagination.total || 0);
    } catch (err: any) {
      setError(err?.message || 'Failed to load blotter records.');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page, limit]);

  useEffect(() => {
    fetchBlotters();
  }, [fetchBlotters]);

  const handleStatusFilterChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setPage(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const getStatusBadge = (status: BlotterStatus) => {
    switch (status) {
      case 'Active':
      case 'CFA Issued':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
            {status}
          </span>
        );
      case 'Under Mediation':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            {status}
          </span>
        );
      case 'Settled':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            {status}
          </span>
        );
      case 'Dismissed':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-amber-100 text-amber-700 rounded-xl shadow-inner">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Blotter Records</h1>
            <p className="text-xs text-slate-500">
              Katarungang Pambarangay Peace &amp; Order Incident Registry &amp; Clearance Gatekeeper
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchBlotters()}
            aria-label="Refresh records"
            className="p-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsFormModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Record New Case</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            aria-label="Search blotter records"
            placeholder="Search case #, complainant, respondent..."
            value={search}
            onChange={handleSearchChange}
            className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            className="w-full sm:w-48 px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition font-medium"
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Under Mediation">Under Mediation</option>
            <option value="Settled">Settled</option>
            <option value="Dismissed">Dismissed</option>
            <option value="CFA Issued">CFA Issued</option>
          </select>
        </div>
      </div>

      {/* Blotter Cases Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
            <p className="text-xs font-medium">Loading blotter cases...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 space-y-2">
            <p className="text-sm font-semibold">{error}</p>
            <button
              onClick={() => fetchBlotters()}
              className="text-xs text-amber-700 underline font-semibold"
            >
              Try again
            </button>
          </div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <FileText className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No blotter records found.</p>
            <p className="text-xs text-slate-400">
              Try adjusting your search criteria or record a new incident report.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Case Number</th>
                  <th className="px-5 py-3.5">Complainant</th>
                  <th className="px-5 py-3.5">Respondent</th>
                  <th className="px-5 py-3.5">Incident Type</th>
                  <th className="px-5 py-3.5">Date Recorded</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-bold text-slate-900">
                      {rec.case_number}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-800">
                      {rec.complainant_name}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900">
                      {rec.respondent_name}
                      {rec.respondent_id ? (
                        <span className="block text-[10px] text-emerald-600 font-normal">
                          Linked Resident #{rec.respondent_id}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]">
                        {rec.incident_type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                      {rec.date_recorded ? rec.date_recorded.split(' ')[0] : 'N/A'}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {getStatusBadge(rec.status)}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap space-x-2">
                      <button
                        onClick={() => setSettleRecord(rec)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Update / Settle</span>
                      </button>

                      {isAdmin && (
                        <button
                          onClick={() => setArchiveRecord(rec)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                          title="Archive Case"
                        >
                          <Archive className="w-3 h-3" />
                          <span>Archive</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && totalRecords > 0 && (
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
            <div>
              Showing <span className="font-semibold text-slate-900">{(page - 1) * limit + 1}</span> to{' '}
              <span className="font-semibold text-slate-900">
                {Math.min(page * limit, totalRecords)}
              </span>{' '}
              of <span className="font-semibold text-slate-900">{totalRecords}</span> cases
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Previous page"
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-medium px-2">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                aria-label="Next page"
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <BlotterFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSuccess={() => fetchBlotters()}
      />

      <BlotterSettleModal
        isOpen={!!settleRecord}
        onClose={() => setSettleRecord(null)}
        onSuccess={() => fetchBlotters()}
        record={settleRecord}
      />

      <BlotterArchiveModal
        isOpen={!!archiveRecord}
        onClose={() => setArchiveRecord(null)}
        onSuccess={() => fetchBlotters()}
        record={archiveRecord}
      />
    </div>
  );
};

export default BlotterPage;
