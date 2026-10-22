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
    <div className="space-y-6">
      {/* Top Welcome & Refresh Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Executive Dashboard</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time demographic indicators, purok distribution &amp; active records
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Quick Action Buttons */}
      <div className="flex flex-wrap items-center gap-3" data-testid="quick-actions">
        {canNewResident && (
          <Link
            to="/residents?action=new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>New Resident</span>
          </Link>
        )}

        {canIssueCert && (
          <Link
            to="/certificates/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow transition-colors"
          >
            <FileCheck2 className="w-4 h-4" />
            <span>Issue Certificate</span>
          </Link>
        )}

        {canRecordBlotter && (
          <Link
            to="/blotter/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-bold shadow transition-colors"
          >
            <FileWarning className="w-4 h-4" />
            <span>Record Blotter Case</span>
          </Link>
        )}
      </div>

      {isLoading && !stats ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-500 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm font-medium">Aggregating demographic metrics...</p>
        </div>
      ) : (
        <>
          {/* Statistical Metric Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* Total Population */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Population</span>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 tracking-tight" data-testid="metric-total-residents">
                {stats?.total_residents !== undefined ? stats.total_residents.toLocaleString() : '0'}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Active registered inhabitants</div>
            </div>

            {/* Senior Citizens */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Senior Citizens</span>
                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                  <UserCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 tracking-tight" data-testid="metric-seniors">
                {stats?.seniors !== undefined ? stats.seniors.toLocaleString() : '0'}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Ages 60 and above</div>
            </div>

            {/* PWDs */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Persons with Disabilities
                </span>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <Accessibility className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 tracking-tight" data-testid="metric-pwds">
                {stats?.pwds !== undefined ? stats.pwds.toLocaleString() : '0'}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Verified PWD beneficiaries</div>
            </div>

            {/* 4Ps Beneficiaries */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">4Ps Beneficiaries</span>
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                  <HeartHandshake className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 tracking-tight" data-testid="metric-four-ps">
                {stats?.four_ps !== undefined ? stats.four_ps.toLocaleString() : '0'}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">DSWD registered households</div>
            </div>

            {/* Registered Voters */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Registered Voters</span>
                <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
                  <Vote className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 tracking-tight" data-testid="metric-voters">
                {stats?.voters !== undefined ? stats.voters.toLocaleString() : '0'}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">COMELEC precinct validated</div>
            </div>

            {/* Active Blotters */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Blotters</span>
                <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                  <ShieldAlert className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 tracking-tight" data-testid="metric-active-blotters">
                {stats?.active_blotters !== undefined ? stats.active_blotters.toLocaleString() : '0'}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Unsettled / Mediation cases</div>
            </div>
          </div>

          {/* Sector Breakdown Secondary Chips */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Sector Demographics Summary
            </h3>
            <div className="flex flex-wrap gap-2.5">
              <div className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Solo Parents:</span>
                <span className="font-bold text-slate-900">{stats?.solo_parents ?? 0}</span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Indigents:</span>
                <span className="font-bold text-slate-900">{stats?.indigents ?? 0}</span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Youth / SK (15-30):</span>
                <span className="font-bold text-slate-900">{stats?.youth ?? 0}</span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Minors (&lt;18):</span>
                <span className="font-bold text-slate-900">{stats?.minors ?? 0}</span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">OFW:</span>
                <span className="font-bold text-slate-900">{stats?.ofw ?? 0}</span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Out-of-School Youth:</span>
                <span className="font-bold text-slate-900">{stats?.osy ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Grid: Purok Distribution & Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Purok Distribution Widget */}
            <div className="lg:col-span-1 bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
              <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
                <Building className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">Purok Inhabitant Distribution</h3>
              </div>

              {purokList.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs text-slate-400 py-6">
                  No purok distribution data recorded
                </div>
              ) : (
                <div className="space-y-3.5 flex-1 overflow-y-auto max-h-80 pr-1" data-testid="purok-distribution">
                  {purokList.map((item) => {
                    const total = stats?.total_residents || 1;
                    const percent = Math.round((item.count / total) * 100);
                    return (
                      <div key={item.purok} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-slate-700">{item.purok}</span>
                          <span className="font-mono font-medium text-slate-500">
                            {item.count.toLocaleString()} ({percent}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
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
            <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col space-y-6">
              {/* Recent Certificates (Admin, Clerk, Treasurer) */}
              {canIssueCert && (
                <div>
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <FileCheck2 className="w-4 h-4 text-emerald-600" />
                      <h3 className="font-bold text-slate-900 text-sm">Recent Certificate Issuances</h3>
                    </div>
                    <Link
                      to="/certificates"
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      View All
                    </Link>
                  </div>

                  {recentIssuances.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3 text-center">No recent certificates issued yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-slate-400 border-b border-slate-100">
                            <th className="pb-2 font-semibold">Tracking #</th>
                            <th className="pb-2 font-semibold">Template</th>
                            <th className="pb-2 font-semibold">Resident</th>
                            <th className="pb-2 font-semibold">Issued Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {recentIssuances.slice(0, 5).map((iss) => (
                            <tr key={iss.id} className="hover:bg-slate-50">
                              <td className="py-2 font-mono font-semibold text-slate-900">
                                {iss.control_number || iss.tracking_code || '—'}
                              </td>
                              <td className="py-2">{iss.template_name || iss.template_type || '—'}</td>
                              <td className="py-2 font-medium">{iss.resident_name}</td>
                              <td className="py-2 text-slate-500 font-mono">
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
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <FileWarning className="w-4 h-4 text-amber-600" />
                      <h3 className="font-bold text-slate-900 text-sm">Recent Blotter Entries</h3>
                    </div>
                    <Link to="/blotter" className="text-xs text-blue-600 hover:text-blue-800 font-semibold">
                      View All
                    </Link>
                  </div>

                  {recentBlotters.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3 text-center">No active blotter cases recorded.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-slate-400 border-b border-slate-100">
                            <th className="pb-2 font-semibold">Case #</th>
                            <th className="pb-2 font-semibold">Incident Type</th>
                            <th className="pb-2 font-semibold">Complainant / Respondent</th>
                            <th className="pb-2 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {recentBlotters.slice(0, 5).map((blt) => (
                            <tr key={blt.id} className="hover:bg-slate-50">
                              <td className="py-2 font-mono font-semibold text-slate-900">{blt.case_number}</td>
                              <td className="py-2">{blt.incident_type}</td>
                              <td className="py-2 font-medium">
                                {blt.complainant_name} vs. {blt.respondent_name}
                              </td>
                              <td className="py-2">
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                  {blt.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Message if user has neither permission */}
              {!canIssueCert && !canRecordBlotter && (
                <div className="text-center py-6 text-xs text-slate-400">
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
