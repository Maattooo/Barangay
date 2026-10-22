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
    <div className="space-y-4">
      {/* Header Card */}
      <div className="bg-white p-4 sm:p-5 rounded-none border border-zinc-200 shadow-none flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-zinc-100 text-zinc-800 rounded-none border border-zinc-200">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-zinc-950 uppercase tracking-tight">
              Barangay Officials Roster
            </h1>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">
              Council Hierarchy &amp; Dynamic Certificate Signatories Registry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-mono text-zinc-700 cursor-pointer select-none border border-zinc-300 px-3 py-1.5 rounded-none bg-zinc-50 hover:bg-zinc-100 transition-colors">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="w-3.5 h-3.5 text-zinc-900 rounded-none border-zinc-300 focus:ring-0"
            />
            <span>Show Inactive / Former</span>
          </label>

          <button
            onClick={() => fetchOfficials()}
            aria-label="Refresh officials list"
            className="p-1.5 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 rounded-none border border-zinc-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {isAdmin && (
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-none bg-zinc-900 hover:bg-black text-white text-xs font-mono font-semibold uppercase tracking-wider transition-colors shadow-none"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Official</span>
            </button>
          )}
        </div>
      </div>

      {/* Officials Table */}
      <div className="bg-white rounded-none border border-zinc-200 shadow-none overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-zinc-500 font-mono flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 text-zinc-600 animate-spin" />
            <p className="text-xs">Loading council roster...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-700 space-y-2 font-mono">
            <p className="text-xs font-semibold">{error}</p>
            <button
              onClick={() => fetchOfficials()}
              className="text-xs text-zinc-900 underline font-semibold uppercase tracking-wider"
            >
              Try again
            </button>
          </div>
        ) : officials.length === 0 ? (
          <div className="p-12 text-center text-zinc-400 space-y-2 font-mono">
            <Award className="w-8 h-8 mx-auto text-zinc-300" />
            <p className="text-xs font-medium text-zinc-600">No officials found in registry.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-700 uppercase tracking-wider font-mono font-semibold border-b border-zinc-200 text-[11px]">
                <tr>
                  <th className="px-4 py-3 w-16 text-center">Rank</th>
                  <th className="px-4 py-3">Full Name</th>
                  <th className="px-4 py-3">Position &amp; Committee</th>
                  <th className="px-4 py-3">Term Dates</th>
                  <th className="px-4 py-3">Status</th>
                  {isAdmin && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-900 font-sans">
                {officials.map((official) => {
                  const isActive = Number(official.is_active) === 1;
                  return (
                    <tr key={official.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3 text-center bg-zinc-50/50">
                        <span className="inline-block px-2 py-0.5 rounded-none bg-zinc-100 text-zinc-900 text-xs font-mono font-bold border border-zinc-200">
                          {official.rank_order}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-zinc-950 uppercase">
                        {official.full_name}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-zinc-900 block font-mono text-[11px] uppercase">
                          {official.position}
                        </span>
                        {official.committee && (
                          <span className="text-[10px] text-zinc-500 block font-mono">
                            {official.committee}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 whitespace-nowrap font-mono text-[11px]">
                        {official.term_start || official.term_end ? (
                          <span>
                            {official.term_start || 'N/A'} &rarr; {official.term_end || 'Present'}
                          </span>
                        ) : (
                          <span className="text-zinc-400">Not specified</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-none text-[10px] font-mono font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-none text-[10px] font-mono font-bold uppercase bg-zinc-100 text-zinc-600 border border-zinc-200">
                            <XCircle className="w-3 h-3 text-zinc-400" />
                            <span>Former</span>
                          </span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleOpenEditModal(official)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-semibold uppercase tracking-wider text-zinc-800 bg-white hover:bg-zinc-100 border border-zinc-300 rounded-none transition-colors"
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
