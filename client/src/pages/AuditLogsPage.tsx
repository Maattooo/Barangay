import React, { useState, useEffect, useCallback } from 'react';
import {
  History,
  Search,
  RefreshCw,
  Loader2,
  GitCompare,
  ChevronLeft,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import api from '../services/api';
import { AuditLogEntry, AuditAction, AuditEntityType, UserAccount } from '../types/admin';
import JsonDiffModal from '../components/audit/JsonDiffModal';

const AUDIT_ACTIONS: AuditAction[] = [
  'LOGIN',
  'CREATE',
  'UPDATE',
  'ARCHIVE',
  'RESTORE',
  'PRINT_CERTIFICATE',
  'BLOTTER_OVERRIDE',
  'IMPORT_EXCEL',
  'EXPORT_EXCEL',
  'SYSTEM_BACKUP'
];

const AUDIT_ENTITY_TYPES: AuditEntityType[] = [
  'resident',
  'blotter',
  'official',
  'template',
  'issuance',
  'user'
];

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Staff users for user dropdown filter
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // Filters
  const [search, setSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  // Diff modal state
  const [diffLogEntry, setDiffLogEntry] = useState<AuditLogEntry | null>(null);

  // Fetch staff users on mount for user filter dropdown
  useEffect(() => {
    let isMounted = true;
    const fetchUsers = async () => {
      try {
        const userList = await api.getUsers();
        if (isMounted) {
          setUsers(userList || []);
        }
      } catch (err) {
        // Non-blocking partial-failure handling: audit logs can still function
        console.error('Failed to load user accounts for audit filter:', err);
      }
    };
    fetchUsers();
    return () => {
      isMounted = false;
    };
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAuditLogs({
        search: search.trim() || undefined,
        user_id: selectedUserId ? (Number(selectedUserId) as any) : undefined,
        action: selectedAction || undefined,
        entity_type: selectedEntity || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        page,
        limit
      });
      setLogs(res.data);
      setTotalPages(res.pagination.totalPages || 1);
      setTotalLogs(res.pagination.total || 0);
    } catch (err: any) {
      setError(err?.message || 'Failed to load audit logs.');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [search, selectedUserId, selectedAction, selectedEntity, startDate, endDate, page, limit]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const handleUserChange = (userId: string) => {
    setSelectedUserId(userId);
    setPage(1);
  };

  const handleActionChange = (action: string) => {
    setSelectedAction(action);
    setPage(1);
  };

  const handleEntityChange = (entity: string) => {
    setSelectedEntity(entity);
    setPage(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const getActionBadge = (action: AuditAction) => {
    switch (action) {
      case 'CREATE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            CREATE
          </span>
        );
      case 'UPDATE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            UPDATE
          </span>
        );
      case 'ARCHIVE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800 border border-red-200">
            ARCHIVE
          </span>
        );
      case 'RESTORE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
            RESTORE
          </span>
        );
      case 'PRINT_CERTIFICATE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
            PRINT_CERTIFICATE
          </span>
        );
      case 'BLOTTER_OVERRIDE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            BLOTTER_OVERRIDE
          </span>
        );
      case 'LOGIN':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
            LOGIN
          </span>
        );
      case 'IMPORT_EXCEL':
      case 'EXPORT_EXCEL':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-200">
            {action}
          </span>
        );
      case 'SYSTEM_BACKUP':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
            SYSTEM_BACKUP
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
            {action}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-purple-100 text-purple-700 rounded-xl shadow-inner">
            <History className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Transparency Audit Trail
            </h1>
            <p className="text-xs text-slate-500">
              Immutable forensic ledger &bull; Who modified what, when, and from which workstation IP
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchAuditLogs()}
            aria-label="Refresh audit logs"
            className="p-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Search Summary / User */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label="Search audit summary"
              placeholder="Search user, summary text, or IP..."
              value={search}
              onChange={handleSearchChange}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition"
            />
          </div>

          {/* User Filter */}
          <div>
            <select
              aria-label="Filter by user"
              value={selectedUserId}
              onChange={(e) => handleUserChange(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition font-medium"
            >
              <option value="">All Users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.username})
                </option>
              ))}
            </select>
          </div>

          {/* Action Filter */}
          <div>
            <select
              aria-label="Filter by action"
              value={selectedAction}
              onChange={(e) => handleActionChange(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition font-medium"
            >
              <option value="">All Actions</option>
              {AUDIT_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* Entity Type Filter */}
          <div>
            <select
              aria-label="Filter by entity type"
              value={selectedEntity}
              onChange={(e) => handleEntityChange(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition font-medium"
            >
              <option value="">All Entity Types</option>
              {AUDIT_ENTITY_TYPES.map((et) => (
                <option key={et} value={et}>
                  {et}
                </option>
              ))}
            </select>
          </div>

          {/* Date range inputs */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              aria-label="Start date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-1/2 px-2 py-1.5 text-[11px] border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
            />
            <span className="text-slate-400 text-xs">&rarr;</span>
            <input
              type="date"
              aria-label="End date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-1/2 px-2 py-1.5 text-[11px] border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
            <p className="text-xs font-medium">Loading audit logs...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 space-y-2">
            <p className="text-sm font-semibold">{error}</p>
            <button
              onClick={() => fetchAuditLogs()}
              className="text-xs text-purple-700 underline font-semibold cursor-pointer"
            >
              Try again
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <ShieldAlert className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No audit log records found.</p>
            <p className="text-xs text-slate-400">Try adjusting your filters or date range.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5 whitespace-nowrap">Timestamp</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">User</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Action</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Entity</th>
                  <th className="px-5 py-3.5">Summary</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Client IP</th>
                  <th className="px-5 py-3.5 text-right whitespace-nowrap">Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {logs.map((log) => {
                  const hasDiff =
                    (log.old_data_json && log.old_data_json !== '{}') ||
                    (log.new_data_json && log.new_data_json !== '{}') ||
                    log.action === 'UPDATE';

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {log.created_at}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="font-semibold text-slate-900 block">
                          {log.username_snapshot}
                        </span>
                        <span className="text-[10px] text-slate-400">{log.user_role_snapshot}</span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">{getActionBadge(log.action)}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="font-mono text-[11px] text-slate-600">
                          {log.entity_type} {log.entity_id ? `#${log.entity_id}` : ''}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-800 font-medium max-w-md">
                        {log.summary_text}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap font-mono text-slate-500 text-[11px]">
                        {log.client_ip}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        {hasDiff ? (
                          <button
                            type="button"
                            onClick={() => setDiffLogEntry(log)}
                            aria-label={`View Diff for event #${log.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors cursor-pointer"
                          >
                            <GitCompare className="w-3 h-3" />
                            <span>View Diff</span>
                          </button>
                        ) : (
                          <span className="text-slate-300 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && totalLogs > 0 && (
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
            <div>
              Showing <span className="font-semibold text-slate-900">{(page - 1) * limit + 1}</span> to{' '}
              <span className="font-semibold text-slate-900">
                {Math.min(page * limit, totalLogs)}
              </span>{' '}
              of <span className="font-semibold text-slate-900">{totalLogs}</span> events
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Previous page"
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
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
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Visual JSON Diff Modal */}
      <JsonDiffModal
        isOpen={!!diffLogEntry}
        onClose={() => setDiffLogEntry(null)}
        logEntry={diffLogEntry}
      />
    </div>
  );
};

export default AuditLogsPage;
