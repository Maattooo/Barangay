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
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-none text-[10px] font-mono font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-300">
            CREATE
          </span>
        );
      case 'UPDATE':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-none text-[10px] font-mono font-bold uppercase bg-blue-50 text-blue-800 border border-blue-300">
            UPDATE
          </span>
        );
      case 'ARCHIVE':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-none text-[10px] font-mono font-bold uppercase bg-red-50 text-red-800 border border-red-300">
            ARCHIVE
          </span>
        );
      case 'RESTORE':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-none text-[10px] font-mono font-bold uppercase bg-teal-50 text-teal-800 border border-teal-300">
            RESTORE
          </span>
        );
      case 'PRINT_CERTIFICATE':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-none text-[10px] font-mono font-bold uppercase bg-zinc-900 text-white border border-zinc-900">
            PRINT_CERTIFICATE
          </span>
        );
      case 'BLOTTER_OVERRIDE':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-none text-[10px] font-mono font-bold uppercase bg-amber-50 text-amber-800 border border-amber-300">
            BLOTTER_OVERRIDE
          </span>
        );
      case 'LOGIN':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-none text-[10px] font-mono font-bold uppercase bg-zinc-100 text-zinc-700 border border-zinc-300">
            LOGIN
          </span>
        );
      case 'IMPORT_EXCEL':
      case 'EXPORT_EXCEL':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-none text-[10px] font-mono font-bold uppercase bg-zinc-100 text-zinc-800 border border-zinc-300">
            {action}
          </span>
        );
      case 'SYSTEM_BACKUP':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-none text-[10px] font-mono font-bold uppercase bg-zinc-100 text-zinc-800 border border-zinc-300">
            SYSTEM_BACKUP
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-none text-[10px] font-mono font-bold uppercase bg-zinc-100 text-zinc-800 border border-zinc-300">
            {action}
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
            <History className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-zinc-950 uppercase tracking-tight">
              Transparency Audit Trail
            </h1>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">
              Immutable forensic ledger &bull; Who modified what, when, and from which workstation IP
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchAuditLogs()}
            aria-label="Refresh audit logs"
            className="p-1.5 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 rounded-none border border-zinc-300 transition-colors cursor-pointer"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-none border border-zinc-200 shadow-none space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          {/* Search Summary / User */}
          <div className="relative lg:col-span-2">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label="Search audit summary"
              placeholder="Search user, summary text, or IP..."
              value={search}
              onChange={handleSearchChange}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-zinc-300 rounded-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors"
            />
          </div>

          {/* User Filter */}
          <div>
            <select
              aria-label="Filter by user"
              value={selectedUserId}
              onChange={(e) => handleUserChange(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs font-mono border border-zinc-300 rounded-none bg-white text-zinc-800 focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors"
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
              className="w-full px-2.5 py-1.5 text-xs font-mono border border-zinc-300 rounded-none bg-white text-zinc-800 focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors"
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
              className="w-full px-2.5 py-1.5 text-xs font-mono border border-zinc-300 rounded-none bg-white text-zinc-800 focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors"
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
          <div className="flex items-center gap-1 font-mono">
            <input
              type="date"
              aria-label="Start date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-1/2 px-2 py-1 text-[11px] border border-zinc-300 rounded-none focus:ring-1 focus:ring-zinc-900 outline-none"
            />
            <span className="text-zinc-400 text-xs">&rarr;</span>
            <input
              type="date"
              aria-label="End date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-1/2 px-2 py-1 text-[11px] border border-zinc-300 rounded-none focus:ring-1 focus:ring-zinc-900 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-none border border-zinc-200 shadow-none overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-zinc-500 font-mono flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 text-zinc-600 animate-spin" />
            <p className="text-xs">Loading audit logs...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-700 space-y-2 font-mono">
            <p className="text-xs font-semibold">{error}</p>
            <button
              onClick={() => fetchAuditLogs()}
              className="text-xs text-zinc-900 underline font-semibold cursor-pointer uppercase tracking-wider"
            >
              Try again
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-zinc-400 space-y-2 font-mono">
            <ShieldAlert className="w-8 h-8 mx-auto text-zinc-300" />
            <p className="text-xs font-medium text-zinc-600">No audit log records found.</p>
            <p className="text-[11px] text-zinc-400">Try adjusting your filters or date range.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-700 uppercase tracking-wider font-mono font-semibold border-b border-zinc-200 text-[11px]">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap">Timestamp</th>
                  <th className="px-4 py-3 whitespace-nowrap">User</th>
                  <th className="px-4 py-3 whitespace-nowrap">Action</th>
                  <th className="px-4 py-3 whitespace-nowrap">Entity</th>
                  <th className="px-4 py-3">Summary</th>
                  <th className="px-4 py-3 whitespace-nowrap">Client IP</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-900 font-sans">
                {logs.map((log) => {
                  const hasDiff =
                    (log.old_data_json && log.old_data_json !== '{}') ||
                    (log.new_data_json && log.new_data_json !== '{}') ||
                    log.action === 'UPDATE';

                  return (
                    <tr key={log.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-zinc-600 font-mono text-[11px]">
                        {log.created_at}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-bold text-zinc-950 block">
                          {log.username_snapshot}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono uppercase">{log.user_role_snapshot}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{getActionBadge(log.action)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-[11px] text-zinc-700 uppercase">
                          {log.entity_type} {log.entity_id ? `#${log.entity_id}` : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-900 font-medium max-w-md">
                        {log.summary_text}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-zinc-600 text-[11px]">
                        {log.client_ip}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {hasDiff ? (
                          <button
                            type="button"
                            onClick={() => setDiffLogEntry(log)}
                            aria-label={`View Diff for event #${log.id}`}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono font-medium uppercase tracking-wider text-zinc-800 bg-white hover:bg-zinc-100 border border-zinc-300 rounded-none transition-colors cursor-pointer"
                          >
                            <GitCompare className="w-3 h-3 text-zinc-600" />
                            <span>View Diff</span>
                          </button>
                        ) : (
                          <span className="text-zinc-400 font-mono text-xs">-</span>
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 bg-zinc-50 text-xs font-mono text-zinc-600">
            <div>
              Showing <span className="font-bold text-zinc-900">{(page - 1) * limit + 1}</span> to{' '}
              <span className="font-bold text-zinc-900">
                {Math.min(page * limit, totalLogs)}
              </span>{' '}
              of <span className="font-bold text-zinc-900">{totalLogs}</span> events
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Previous page"
                className="p-1 rounded-none border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono px-2">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                aria-label="Next page"
                className="p-1 rounded-none border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 transition-colors cursor-pointer"
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
