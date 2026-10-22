import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ResidentStats, RecentIssuance, RecentBlotter } from '../types/dashboard';
import api from '../services/api';
import {
  Users,
  UserCheck,
  HeartHandshake,
  ShieldAlert,
  Vote,
  Accessibility,
  UserPlus,
  FileCheck2,
  FileWarning,
  RefreshCw,
  Loader2,
  Building,
  AlertCircle
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { role } = useAuth();
  const [stats, setStats] = useState<ResidentStats | null>(null);
  const [recentIssuances, setRecentIssuances] = useState<RecentIssuance[]>([]);
  const [recentBlotters, setRecentBlotters] = useState<RecentBlotter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canNewResident = role === 'Admin' || role === 'Clerk';
  const canIssueCert = role === 'Admin' || role === 'Clerk' || role === 'Treasurer';
  const canRecordBlotter = role === 'Admin' || role === 'Lupon';

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch stats
      const statsData = await api.getResidentStats();
      setStats(statsData);

      // 2. Fetch Recent Issuances if authorized
      if (canIssueCert) {
        try {
          const issuancesRes = await api.getRecentIssuances(5);
          if (Array.isArray(issuancesRes)) {
            setRecentIssuances(issuancesRes);
          } else if (issuancesRes?.issuances && Array.isArray(issuancesRes.issuances)) {
            setRecentIssuances(issuancesRes.issuances);
          } else if (issuancesRes?.data && Array.isArray(issuancesRes.data)) {
            setRecentIssuances(issuancesRes.data);
          }
        } catch {
          // Keep empty if failed
        }
      }

      // 3. Fetch Recent Blotters if authorized
      if (canRecordBlotter) {
        try {
          const blottersRes = await api.getRecentBlotters(5);
          if (Array.isArray(blottersRes)) {
            setRecentBlotters(blottersRes);
          } else if (blottersRes?.records && Array.isArray(blottersRes.records)) {
            setRecentBlotters(blottersRes.records);
          } else if (blottersRes?.data && Array.isArray(blottersRes.data)) {
            setRecentBlotters(blottersRes.data);
          }
        } catch {
          // Keep empty if failed
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch executive dashboard metrics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [role]);

  // Normalize purok counts
  let purokList: Array<{ purok: string; count: number }> = [];
  if (Array.isArray(stats?.purok_counts)) {
    purokList = stats.purok_counts;
  } else if (stats?.purok_counts && typeof stats.purok_counts === 'object') {
    purokList = Object.entries(stats.purok_counts).map(([purok, count]) => ({
      purok,
      count: Number(count)
    }));
  }

  return (
    <div className="space-y-5">
      {/* Top Welcome & Refresh Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 border border-zinc-200 rounded-none shadow-none">
        <div>
          <h1 className="text-lg sm:text-xl font-black text-zinc-950 uppercase tracking-tight">
            Executive Operations Dashboard
          </h1>
          <p className="text-xs text-zinc-500 font-mono mt-0.5">
            Real-time demographic indicators, civil registry &amp; active blotter docket
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-mono font-medium text-zinc-800 bg-white hover:bg-zinc-100 border border-zinc-300 rounded-none transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-900"
          title="Refresh metrics"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          className="p-3 bg-red-50 border border-red-200 rounded-none text-red-800 text-xs flex items-center gap-2.5 font-medium"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Quick Action Buttons */}
      <div className="flex flex-wrap items-center gap-2.5" data-testid="quick-actions">
        {canNewResident && (
          <Link
            to="/residents?action=new"
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-mono font-semibold uppercase tracking-wider rounded-none shadow-none transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-900"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>New Resident</span>
          </Link>
        )}

        {canIssueCert && (
          <Link
            to="/certificates/new"
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-mono font-semibold uppercase tracking-wider rounded-none shadow-none transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-700"
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>Issue Certificate</span>
          </Link>
        )}

        {canRecordBlotter && (
          <Link
            to="/blotter/new"
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-amber-700 hover:bg-amber-800 text-white text-xs font-mono font-semibold uppercase tracking-wider rounded-none shadow-none transition-colors focus:outline-none focus:ring-1 focus:ring-amber-700"
          >
            <FileWarning className="w-3.5 h-3.5" />
            <span>Record Blotter Case</span>
          </Link>
        )}
      </div>

      {isLoading && !stats ? (
        <div className="py-16 flex flex-col items-center justify-center text-zinc-500 space-y-2 border border-zinc-200 bg-white">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-900" />
          <p className="text-xs font-mono uppercase tracking-wider">Aggregating demographic metrics...</p>
        </div>
      ) : (
        <>
          {/* Statistical Metric Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {/* Total Population */}
            <div className="bg-white p-3.5 border border-zinc-200 rounded-none shadow-none flex flex-col justify-between">
              <div className="flex items-center justify-between text-zinc-500 mb-2">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-500">
                  Total Population
                </span>
                <div className="p-1.5 bg-zinc-100 text-zinc-700 rounded-none border border-zinc-200">
                  <Users className="w-3.5 h-3.5" />
                </div>
              </div>
              <div
                className="text-2xl font-mono font-black text-zinc-950 tracking-tight"
                data-testid="metric-total-residents"
              >
                {stats?.total_residents !== undefined ? stats.total_residents.toLocaleString() : '0'}
              </div>
              <div className="text-[10px] font-mono text-zinc-400 mt-1 uppercase tracking-wider">
                Active Inhabitants
              </div>
            </div>

            {/* Senior Citizens */}
            <div className="bg-white p-3.5 border border-zinc-200 rounded-none shadow-none flex flex-col justify-between">
              <div className="flex items-center justify-between text-zinc-500 mb-2">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-500">
                  Senior Citizens
                </span>
                <div className="p-1.5 bg-zinc-100 text-zinc-700 rounded-none border border-zinc-200">
                  <UserCheck className="w-3.5 h-3.5" />
                </div>
              </div>
              <div
                className="text-2xl font-mono font-black text-zinc-950 tracking-tight"
                data-testid="metric-seniors"
              >
                {stats?.seniors !== undefined ? stats.seniors.toLocaleString() : '0'}
              </div>
              <div className="text-[10px] font-mono text-zinc-400 mt-1 uppercase tracking-wider">
                Ages 60 and above
              </div>
            </div>

            {/* PWDs */}
            <div className="bg-white p-3.5 border border-zinc-200 rounded-none shadow-none flex flex-col justify-between">
              <div className="flex items-center justify-between text-zinc-500 mb-2">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-500">
                  PWD
                </span>
                <div className="p-1.5 bg-zinc-100 text-zinc-700 rounded-none border border-zinc-200">
                  <Accessibility className="w-3.5 h-3.5" />
                </div>
              </div>
              <div
                className="text-2xl font-mono font-black text-zinc-950 tracking-tight"
                data-testid="metric-pwds"
              >
                {stats?.pwds !== undefined ? stats.pwds.toLocaleString() : '0'}
              </div>
              <div className="text-[10px] font-mono text-zinc-400 mt-1 uppercase tracking-wider">
                Verified PWD
              </div>
            </div>

            {/* 4Ps Beneficiaries */}
            <div className="bg-white p-3.5 border border-zinc-200 rounded-none shadow-none flex flex-col justify-between">
              <div className="flex items-center justify-between text-zinc-500 mb-2">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-500">
                  4Ps Beneficiaries
                </span>
                <div className="p-1.5 bg-zinc-100 text-zinc-700 rounded-none border border-zinc-200">
                  <HeartHandshake className="w-3.5 h-3.5" />
                </div>
              </div>
              <div
                className="text-2xl font-mono font-black text-zinc-950 tracking-tight"
                data-testid="metric-four-ps"
              >
                {stats?.four_ps !== undefined ? stats.four_ps.toLocaleString() : '0'}
              </div>
              <div className="text-[10px] font-mono text-zinc-400 mt-1 uppercase tracking-wider">
                DSWD Households
              </div>
            </div>

            {/* Registered Voters */}
            <div className="bg-white p-3.5 border border-zinc-200 rounded-none shadow-none flex flex-col justify-between">
              <div className="flex items-center justify-between text-zinc-500 mb-2">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-500">
                  Voters
                </span>
                <div className="p-1.5 bg-zinc-100 text-zinc-700 rounded-none border border-zinc-200">
                  <Vote className="w-3.5 h-3.5" />
                </div>
              </div>
              <div
                className="text-2xl font-mono font-black text-zinc-950 tracking-tight"
                data-testid="metric-voters"
              >
                {stats?.voters !== undefined ? stats.voters.toLocaleString() : '0'}
              </div>
              <div className="text-[10px] font-mono text-zinc-400 mt-1 uppercase tracking-wider">
                COMELEC Validated
              </div>
            </div>

            {/* Active Blotters */}
            <div className="bg-white p-3.5 border border-zinc-200 rounded-none shadow-none flex flex-col justify-between">
              <div className="flex items-center justify-between text-zinc-500 mb-2">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-500">
                  Active Blotters
                </span>
                <div className="p-1.5 bg-red-50 text-red-700 rounded-none border border-red-200">
                  <ShieldAlert className="w-3.5 h-3.5" />
                </div>
              </div>
              <div
                className="text-2xl font-mono font-black text-red-700 tracking-tight"
                data-testid="metric-active-blotters"
              >
                {stats?.active_blotters !== undefined ? stats.active_blotters.toLocaleString() : '0'}
              </div>
              <div className="text-[10px] font-mono text-zinc-400 mt-1 uppercase tracking-wider">
                Unsettled Cases
              </div>
            </div>
          </div>

          {/* Sector Breakdown Secondary Chips */}
          <div className="bg-white p-4 border border-zinc-200 rounded-none shadow-none">
            <h3 className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-500 mb-2.5">
              Sector Demographics Docket
            </h3>
            <div className="flex flex-wrap gap-2">
              <div className="px-2.5 py-1 rounded-none bg-zinc-50 border border-zinc-200 flex items-center gap-2 text-xs font-mono">
                <span className="text-zinc-500">Solo Parents:</span>
                <span className="font-bold text-zinc-950">{stats?.solo_parents ?? 0}</span>
              </div>
              <div className="px-2.5 py-1 rounded-none bg-zinc-50 border border-zinc-200 flex items-center gap-2 text-xs font-mono">
                <span className="text-zinc-500">Indigents:</span>
                <span className="font-bold text-zinc-950">{stats?.indigents ?? 0}</span>
              </div>
              <div className="px-2.5 py-1 rounded-none bg-zinc-50 border border-zinc-200 flex items-center gap-2 text-xs font-mono">
                <span className="text-zinc-500">Youth (15-30):</span>
                <span className="font-bold text-zinc-950">{stats?.youth ?? 0}</span>
              </div>
              <div className="px-2.5 py-1 rounded-none bg-zinc-50 border border-zinc-200 flex items-center gap-2 text-xs font-mono">
                <span className="text-zinc-500">Minors (&lt;18):</span>
                <span className="font-bold text-zinc-950">{stats?.minors ?? 0}</span>
              </div>
              <div className="px-2.5 py-1 rounded-none bg-zinc-50 border border-zinc-200 flex items-center gap-2 text-xs font-mono">
                <span className="text-zinc-500">OFW:</span>
                <span className="font-bold text-zinc-950">{stats?.ofw ?? 0}</span>
              </div>
              <div className="px-2.5 py-1 rounded-none bg-zinc-50 border border-zinc-200 flex items-center gap-2 text-xs font-mono">
                <span className="text-zinc-500">OSY:</span>
                <span className="font-bold text-zinc-950">{stats?.osy ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Grid: Purok Distribution & Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Purok Distribution Widget */}
            <div className="lg:col-span-1 bg-white p-4 border border-zinc-200 rounded-none shadow-none flex flex-col">
              <div className="flex items-center gap-2 pb-2.5 mb-3 border-b border-zinc-200">
                <Building className="w-4 h-4 text-zinc-700" />
                <h3 className="font-mono font-bold text-zinc-950 text-xs uppercase tracking-wider">
                  Purok Inhabitant Distribution
                </h3>
              </div>

              {purokList.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs font-mono text-zinc-400 py-6 uppercase">
                  No purok distribution recorded
                </div>
              ) : (
                <div className="space-y-3 flex-1 overflow-y-auto max-h-80 pr-1" data-testid="purok-distribution">
                  {purokList.map((item) => {
                    const total = stats?.total_residents || 1;
                    const percent = Math.round((item.count / total) * 100);
                    return (
                      <div key={item.purok} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-medium text-zinc-800">{item.purok}</span>
                          <span className="font-mono text-zinc-600">
                            {item.count.toLocaleString()} ({percent}%)
                          </span>
                        </div>
                        <div className="w-full bg-zinc-100 rounded-none h-1.5 overflow-hidden">
                          <div
                            className="bg-zinc-900 h-1.5 rounded-none transition-all duration-200"
                            style={{ width: `${Math.min(100, Math.max(5, percent))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent Activity Snapshot */}
            <div className="lg:col-span-2 bg-white p-4 border border-zinc-200 rounded-none shadow-none flex flex-col space-y-5">
              {/* Recent Certificates (Admin, Clerk, Treasurer) */}
              {canIssueCert && (
                <div>
                  <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-zinc-200">
                    <div className="flex items-center gap-2">
                      <FileCheck2 className="w-4 h-4 text-emerald-700" />
                      <h3 className="font-mono font-bold text-zinc-950 text-xs uppercase tracking-wider">
                        Recent Certificate Issuances
                      </h3>
                    </div>
                    <Link
                      to="/certificates"
                      className="text-xs font-mono font-medium text-blue-700 hover:text-blue-900 hover:underline uppercase tracking-wider"
                    >
                      View All
                    </Link>
                  </div>

                  {recentIssuances.length === 0 ? (
                    <p className="text-xs font-mono text-zinc-400 py-3 text-center uppercase">
                      No recent certificates issued yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-zinc-500 font-mono text-[11px] uppercase tracking-wider border-b border-zinc-200">
                            <th className="pb-1.5 font-semibold">Control #</th>
                            <th className="pb-1.5 font-semibold">Template</th>
                            <th className="pb-1.5 font-semibold">Resident</th>
                            <th className="pb-1.5 font-semibold">Issued Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 text-zinc-700 font-mono">
                          {recentIssuances.slice(0, 5).map((iss) => (
                            <tr key={iss.id} className="hover:bg-zinc-50">
                              <td className="py-2 font-semibold text-zinc-950">
                                {iss.control_number || iss.tracking_code || '—'}
                              </td>
                              <td className="py-2 text-zinc-800 font-sans">
                                {iss.template_name || iss.template_type || '—'}
                              </td>
                              <td className="py-2 font-medium text-zinc-900 font-sans">{iss.resident_name}</td>
                              <td className="py-2 text-zinc-500">
                                {iss.issued_at ? iss.issued_at.slice(0, 10) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Recent Blotters (Admin, Lupon) */}
              {canRecordBlotter && (
                <div>
                  <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-zinc-200">
                    <div className="flex items-center gap-2">
                      <FileWarning className="w-4 h-4 text-amber-700" />
                      <h3 className="font-mono font-bold text-zinc-950 text-xs uppercase tracking-wider">
                        Recent Blotter Entries
                      </h3>
                    </div>
                    <Link
                      to="/blotter"
                      className="text-xs font-mono font-medium text-blue-700 hover:text-blue-900 hover:underline uppercase tracking-wider"
                    >
                      View All
                    </Link>
                  </div>

                  {recentBlotters.length === 0 ? (
                    <p className="text-xs font-mono text-zinc-400 py-3 text-center uppercase">
                      No active blotter cases recorded.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-zinc-500 font-mono text-[11px] uppercase tracking-wider border-b border-zinc-200">
                            <th className="pb-1.5 font-semibold">Case #</th>
                            <th className="pb-1.5 font-semibold">Incident Type</th>
                            <th className="pb-1.5 font-semibold">Parties</th>
                            <th className="pb-1.5 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 text-zinc-700">
                          {recentBlotters.slice(0, 5).map((blt) => {
                            const statusColor =
                              blt.status === 'Open'
                                ? 'bg-red-50 text-red-800 border-red-300'
                                : blt.status === 'Pending'
                                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-300';
                            return (
                              <tr key={blt.id} className="hover:bg-zinc-50">
                                <td className="py-2 font-mono font-semibold text-zinc-950">{blt.case_number}</td>
                                <td className="py-2 text-zinc-800">{blt.incident_type}</td>
                                <td className="py-2 font-medium text-zinc-900">
                                  {blt.complainant_name} vs. {blt.respondent_name}
                                </td>
                                <td className="py-2">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded-none text-[10px] font-mono font-bold uppercase border ${statusColor}`}
                                  >
                                    {blt.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Message if user has neither permission */}
              {!canIssueCert && !canRecordBlotter && (
                <div className="text-center py-6 text-xs font-mono text-zinc-400 uppercase">
                  Select a section from the navigation menu to begin.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardPage;
