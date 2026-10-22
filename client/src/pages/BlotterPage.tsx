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
          <span className="inline-flex items-center px-2 py-0.5 rounded-none text-[11px] font-mono font-bold uppercase bg-red-50 text-red-800 border border-red-300">
            {status}
          </span>
        );
      case 'Under Mediation':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-none text-[11px] font-mono font-bold uppercase bg-amber-50 text-amber-800 border border-amber-300">
            {status}
          </span>
        );
      case 'Settled':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-none text-[11px] font-mono font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-300">
            {status}
          </span>
        );
      case 'Dismissed':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-none text-[11px] font-mono font-bold uppercase bg-zinc-100 text-zinc-700 border border-zinc-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="bg-white p-4 sm:p-5 rounded-none border border-zinc-200 shadow-none flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-zinc-100 text-zinc-800 rounded-none border border-zinc-200">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-zinc-950 uppercase tracking-tight">
              Blotter Records
            </h1>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">
              Katarungang Pambarangay peace &amp; order registry &amp; clearance gatekeeper
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchBlotters()}
            aria-label="Refresh records"
            className="p-1.5 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 rounded-none border border-zinc-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsFormModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-none bg-zinc-900 hover:bg-black text-white text-xs font-mono font-semibold uppercase tracking-wider transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record New Case</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-none border border-zinc-200 shadow-none flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            aria-label="Search blotter records"
            placeholder="Search case #, complainant, respondent..."
            value={search}
            onChange={handleSearchChange}
            className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm border border-zinc-300 rounded-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            className="w-full sm:w-48 px-3 py-1.5 text-xs font-mono border border-zinc-300 rounded-none bg-white text-zinc-800 focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors"
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
      <div className="bg-white rounded-none border border-zinc-200 shadow-none overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-zinc-500 flex flex-col items-center justify-center gap-2 font-mono">
            <Loader2 className="w-6 h-6 text-zinc-900 animate-spin" />
            <p className="text-xs uppercase tracking-wider">Loading blotter cases...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 space-y-2">
            <p className="text-xs font-mono font-semibold">{error}</p>
            <button
              onClick={() => fetchBlotters()}
              className="text-xs font-mono text-zinc-900 underline uppercase"
            >
              Try again
            </button>
          </div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center text-zinc-400 space-y-2">
            <FileText className="w-8 h-8 mx-auto text-zinc-300" />
            <p className="text-sm font-bold text-zinc-900 uppercase">No blotter records found.</p>
            <p className="text-xs text-zinc-500">
              Try adjusting your search criteria or record a new incident report.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-600 font-mono uppercase tracking-wider text-[11px] font-semibold border-b border-zinc-200">
                <tr>
                  <th className="px-3.5 py-2.5">Case Number</th>
                  <th className="px-3.5 py-2.5">Complainant</th>
                  <th className="px-3.5 py-2.5">Respondent</th>
                  <th className="px-3.5 py-2.5">Incident Type</th>
                  <th className="px-3.5 py-2.5">Date Recorded</th>
                  <th className="px-3.5 py-2.5">Status</th>
                  <th className="px-3.5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-700">
                {records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-3.5 py-2.5 font-mono font-bold text-zinc-950">
                      {rec.case_number}
                    </td>
                    <td className="px-3.5 py-2.5 font-medium text-zinc-800">
                      {rec.complainant_name}
                    </td>
                    <td className="px-3.5 py-2.5 font-semibold text-zinc-950">
                      {rec.respondent_name}
                      {rec.respondent_id ? (
                        <span className="block text-[10px] font-mono text-emerald-700 font-normal">
                          Linked Resident #{rec.respondent_id}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span className="px-1.5 py-0.5 rounded-none bg-zinc-100 text-zinc-700 font-mono text-[11px] border border-zinc-200">
                        {rec.incident_type}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-zinc-500 font-mono whitespace-nowrap">
                      {rec.date_recorded ? rec.date_recorded.split(' ')[0] : 'N/A'}
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      {getStatusBadge(rec.status)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right whitespace-nowrap space-x-1.5">
                      <button
                        onClick={() => setSettleRecord(rec)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-medium text-emerald-800 bg-white hover:bg-emerald-50 border border-emerald-300 rounded-none transition-colors"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Update / Settle</span>
                      </button>

                      {isAdmin && (
                        <button
                          onClick={() => setArchiveRecord(rec)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-medium text-red-700 bg-white hover:bg-red-50 border border-red-300 rounded-none transition-colors"
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
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-200 bg-zinc-50 text-xs font-mono text-zinc-600">
            <div>
              Showing <span className="font-semibold text-zinc-950">{(page - 1) * limit + 1}</span> to{' '}
              <span className="font-semibold text-zinc-950">
                {Math.min(page * limit, totalRecords)}
              </span>{' '}
              of <span className="font-semibold text-zinc-950">{totalRecords}</span> cases
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Previous page"
                className="p-1 rounded-none border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-mono px-2">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                aria-label="Next page"
                className="p-1 rounded-none border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
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
