import React from 'react';
import {
  Edit2,
  Archive,
  ChevronLeft,
  ChevronRight,
  Users,
  Award,
  Accessibility,
  Landmark,
  UserCheck,
  HeartHandshake,
  Vote,
  Sparkles,
  Plane,
  BookX
} from 'lucide-react';
import { Resident } from '../../types/resident';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types/auth';

export interface ResidentTableProps {
  residents: Resident[];
  loading: boolean;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  onLimitChange: (newLimit: number) => void;
  onEdit: (resident: Resident) => void;
  onArchive: (resident: Resident) => void;
  userRole?: UserRole | null;
}

export const ResidentTable: React.FC<ResidentTableProps> = ({
  residents,
  loading,
  total,
  page,
  limit,
  totalPages,
  onPageChange,
  onLimitChange,
  onEdit,
  onArchive,
  userRole: propUserRole
}) => {
  const { role: contextRole } = useAuth();
  const currentRole = propUserRole !== undefined ? propUserRole : contextRole;

  const canEdit = currentRole === 'Admin' || currentRole === 'Clerk';
  const canArchive = currentRole === 'Admin';

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-none text-[11px] font-mono font-medium bg-emerald-50 text-emerald-800 border border-emerald-300">
            Active
          </span>
        );
      case 'Moved Out':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-none text-[11px] font-mono font-medium bg-amber-50 text-amber-800 border border-amber-300">
            Moved Out
          </span>
        );
      case 'Deceased':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-none text-[11px] font-mono font-medium bg-zinc-100 text-zinc-700 border border-zinc-300">
            Deceased
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-none text-[11px] font-mono font-medium bg-zinc-100 text-zinc-700 border border-zinc-300">
            {status}
          </span>
        );
    }
  };

  const renderSectorBadges = (resident: Resident) => {
    const badges: { label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [];

    if (resident.is_senior) {
      badges.push({ label: 'Senior', icon: Award, color: 'bg-zinc-100 text-zinc-800 border-zinc-300' });
    }
    if (resident.is_pwd) {
      badges.push({ label: 'PWD', icon: Accessibility, color: 'bg-zinc-100 text-zinc-800 border-zinc-300' });
    }
    if (resident.is_4ps) {
      badges.push({ label: '4Ps', icon: Landmark, color: 'bg-emerald-50 text-emerald-800 border-emerald-300' });
    }
    if (resident.is_solo_parent) {
      badges.push({ label: 'Solo Parent', icon: UserCheck, color: 'bg-zinc-100 text-zinc-800 border-zinc-300' });
    }
    if (resident.is_indigent) {
      badges.push({ label: 'Indigent', icon: HeartHandshake, color: 'bg-amber-50 text-amber-800 border-amber-300' });
    }
    if (resident.is_voter) {
      badges.push({ label: 'Voter', icon: Vote, color: 'bg-zinc-100 text-zinc-800 border-zinc-300' });
    }
    if (resident.is_youth) {
      badges.push({ label: 'Youth', icon: Sparkles, color: 'bg-zinc-100 text-zinc-800 border-zinc-300' });
    }
    if (resident.is_ofw) {
      badges.push({ label: 'OFW', icon: Plane, color: 'bg-zinc-100 text-zinc-800 border-zinc-300' });
    }
    if (resident.is_osy) {
      badges.push({ label: 'OSY', icon: BookX, color: 'bg-zinc-100 text-zinc-800 border-zinc-300' });
    }

    if (badges.length === 0) {
      return <span className="text-xs font-mono text-zinc-400">—</span>;
    }

    return (
      <div className="flex items-center gap-1 flex-wrap">
        {badges.map((b) => {
          const Icon = b.icon;
          return (
            <span
              key={b.label}
              title={b.label}
              className={`inline-flex items-center justify-center w-6 h-6 rounded-none text-[10px] font-mono font-medium border cursor-default ${b.color}`}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="sr-only">{b.label}</span>
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-3" data-testid="resident-table-container">
      <div className="overflow-x-auto rounded-none border border-zinc-200 bg-white shadow-none">
        <table className="min-w-full divide-y divide-zinc-200 text-left text-sm" data-testid="resident-table">
          <thead className="bg-zinc-50 text-zinc-600 font-mono font-semibold text-[11px] tracking-wider uppercase border-b border-zinc-200">
            <tr>
              <th scope="col" className="px-3.5 py-2.5">Resident Name</th>
              <th scope="col" className="px-3.5 py-2.5">Age / Sex</th>
              <th scope="col" className="px-3.5 py-2.5">Purok / Address</th>
              <th scope="col" className="px-3.5 py-2.5">Special Sectors</th>
              <th scope="col" className="px-3.5 py-2.5">Civil Status &amp; Nationality</th>
              <th scope="col" className="px-3.5 py-2.5">Status</th>
              {(canEdit || canArchive) && (
                <th scope="col" className="px-3.5 py-2.5 text-right">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white font-sans text-xs">
            {loading ? (
              <tr>
                <td colSpan={canEdit || canArchive ? 7 : 6} className="px-4 py-12 text-center text-zinc-500 font-mono">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="w-6 h-6 border-2 border-zinc-900 border-t-transparent rounded-none animate-spin" />
                    <p className="text-xs uppercase tracking-wider">Loading residents ledger...</p>
                  </div>
                </td>
              </tr>
            ) : residents.length === 0 ? (
              <tr>
                <td colSpan={canEdit || canArchive ? 7 : 6} className="px-4 py-12 text-center text-zinc-500" data-testid="table-empty-state">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="p-2.5 bg-zinc-100 border border-zinc-200 text-zinc-400 rounded-none">
                      <Users className="w-6 h-6" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-sm font-bold text-zinc-900 uppercase">No residents found</p>
                      <p className="text-xs text-zinc-500 max-w-sm">
                        No inhabitants match the selected filters or search terms. Try clearing filters or adding a new resident.
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              residents.map((resident) => {
                const fullName = `${resident.last_name}, ${resident.first_name}${
                  resident.middle_name ? ` ${resident.middle_name}` : ''
                }${resident.suffix ? ` ${resident.suffix}` : ''}`;

                return (
                  <tr
                    key={resident.id}
                    data-testid={`resident-row-${resident.id}`}
                    className="hover:bg-zinc-50 transition-colors"
                  >
                    <td className="px-3.5 py-2.5 font-medium text-zinc-950 whitespace-nowrap">
                      {fullName}
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap font-mono text-zinc-700">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-zinc-900">{resident.age} yrs</span>
                        <span className="text-zinc-400">•</span>
                        <span>{resident.sex}</span>
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <div className="font-medium text-zinc-900">{resident.purok}</div>
                      {resident.house_no_street && (
                        <div className="text-[11px] text-zinc-500 truncate max-w-xs">{resident.house_no_street}</div>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5">
                      {renderSectorBadges(resident)}
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      <div className="text-zinc-900 font-medium">{resident.civil_status}</div>
                      <div className="text-[11px] font-mono text-zinc-500 uppercase">{resident.nationality}</div>
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      {renderStatusBadge(resident.residency_status)}
                    </td>
                    {(canEdit || canArchive) && (
                      <td className="px-3.5 py-2.5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => onEdit(resident)}
                              data-testid={`edit-resident-${resident.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-medium text-zinc-800 bg-white border border-zinc-300 rounded-none hover:bg-zinc-100 hover:border-zinc-400 transition-colors"
                            >
                              <Edit2 className="w-3 h-3 text-zinc-600" />
                              <span>Edit</span>
                            </button>
                          )}
                          {canArchive && (
                            <button
                              type="button"
                              onClick={() => onArchive(resident)}
                              data-testid={`archive-resident-${resident.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-medium text-red-700 bg-white border border-red-300 rounded-none hover:bg-red-50 hover:border-red-400 transition-colors"
                            >
                              <Archive className="w-3 h-3 text-red-600" />
                              <span>Archive</span>
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 text-xs font-mono text-zinc-600" data-testid="pagination-controls">
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            data-testid="page-limit-select"
            className="px-2 py-1 bg-white border border-zinc-300 rounded-none text-xs font-mono font-medium text-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
          <span className="text-zinc-400">|</span>
          <span>
            Showing {residents.length > 0 ? (page - 1) * limit + 1 : 0} to{' '}
            {Math.min(page * limit, total)} of {total} residents
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-medium">
            Page {page} of {totalPages || 1}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => onPageChange(page - 1)}
              data-testid="prev-page-btn"
              className="p-1 rounded-none border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => onPageChange(page + 1)}
              data-testid="next-page-btn"
              className="p-1 rounded-none border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResidentTable;
