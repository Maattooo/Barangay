import React, { useState, useEffect, useCallback } from 'react';
import { Award, Plus, Edit, RefreshCw, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { BarangayOfficial } from '../types/admin';
import OfficialFormModal from '../components/officials/OfficialFormModal';

export const OfficialsPage: React.FC = () => {
  const { role } = useAuth();
  const isAdmin = role === 'Admin';

  const [officials, setOfficials] = useState<BarangayOfficial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter: include inactive
  const [includeInactive, setIncludeInactive] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOfficial, setSelectedOfficial] = useState<BarangayOfficial | null>(null);

  const fetchOfficials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getOfficials(includeInactive);
      // Strictly sort by rank_order ASC
      const sorted = [...data].sort((a, b) => a.rank_order - b.rank_order);
      setOfficials(sorted);
    } catch (err: any) {
      setError(err?.message || 'Failed to load barangay officials roster.');
      setOfficials([]);
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => {
    fetchOfficials();
  }, [fetchOfficials]);

  const handleOpenAddModal = () => {
    setSelectedOfficial(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (official: BarangayOfficial) => {
    setSelectedOfficial(official);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-purple-100 text-purple-700 rounded-xl shadow-inner">
            <Award className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Barangay Officials Roster</h1>
            <p className="text-xs text-slate-500">
              Council Hierarchy &amp; Dynamic Certificate Signatories Registry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none border border-slate-200 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="w-3.5 h-3.5 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
            />
            <span>Show Inactive / Former</span>
          </label>

          <button
            onClick={() => fetchOfficials()}
            aria-label="Refresh officials list"
            className="p-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {isAdmin && (
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Official</span>
            </button>
          )}
        </div>
      </div>

      {/* Officials Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
            <p className="text-xs font-medium">Loading council roster...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 space-y-2">
            <p className="text-sm font-semibold">{error}</p>
            <button
              onClick={() => fetchOfficials()}
              className="text-xs text-purple-700 underline font-semibold"
            >
              Try again
            </button>
          </div>
        ) : officials.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Award className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No officials found in registry.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5 w-16 text-center">Rank</th>
                  <th className="px-5 py-3.5">Full Name</th>
                  <th className="px-5 py-3.5">Position &amp; Committee</th>
                  <th className="px-5 py-3.5">Term Dates</th>
                  <th className="px-5 py-3.5">Status</th>
                  {isAdmin && <th className="px-5 py-3.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {officials.map((official) => {
                  const isActive = Number(official.is_active) === 1;
                  return (
                    <tr key={official.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 text-center font-bold text-slate-700 bg-slate-50/50">
                        <span className="inline-block w-6 h-6 leading-6 text-center rounded-full bg-slate-200 text-slate-800 text-xs font-mono font-bold">
                          {official.rank_order}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-900">
                        {official.full_name}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-purple-900 block">
                          {official.position}
                        </span>
                        {official.committee && (
                          <span className="text-[11px] text-slate-500 block">
                            {official.committee}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">
                        {official.term_start || official.term_end ? (
                          <span>
                            {official.term_start || 'N/A'} &rarr; {official.term_end || 'Present'}
                          </span>
                        ) : (
                          <span className="text-slate-400">Not specified</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            <XCircle className="w-3 h-3" />
                            <span>Former</span>
                          </span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleOpenEditModal(official)}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors"
                          >
                            <Edit className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <OfficialFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => fetchOfficials()}
        official={selectedOfficial}
      />
    </div>
  );
};

export default OfficialsPage;
