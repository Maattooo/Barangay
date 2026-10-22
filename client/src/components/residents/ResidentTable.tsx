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
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Active
          </span>
        );
      case 'Moved Out':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            Moved Out
          </span>
        );
      case 'Deceased':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            Deceased
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const renderSectorBadges = (resident: Resident) => {
    const badges: { label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [];

    if (resident.is_senior) {
      badges.push({ label: 'Senior', icon: Award, color: 'bg-blue-100 text-blue-700 border-blue-200' });
    }
    if (resident.is_pwd) {
      badges.push({ label: 'PWD', icon: Accessibility, color: 'bg-purple-100 text-purple-700 border-purple-200' });
    }
    if (resident.is_4ps) {
      badges.push({ label: '4Ps', icon: Landmark, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' });
    }
    if (resident.is_solo_parent) {
      badges.push({ label: 'Solo Parent', icon: UserCheck, color: 'bg-rose-100 text-rose-700 border-rose-200' });
    }
    if (resident.is_indigent) {
      badges.push({ label: 'Indigent', icon: HeartHandshake, color: 'bg-amber-100 text-amber-700 border-amber-200' });
    }
    if (resident.is_voter) {
      badges.push({ label: 'Voter', icon: Vote, color: 'bg-teal-100 text-teal-700 border-teal-200' });
    }
    if (resident.is_youth) {
      badges.push({ label: 'Youth', icon: Sparkles, color: 'bg-indigo-100 text-indigo-700 border-indigo-200' });
    }
    if (resident.is_ofw) {
      badges.push({ label: 'OFW', icon: Plane, color: 'bg-sky-100 text-sky-700 border-sky-200' });
    }
    if (resident.is_osy) {
      badges.push({ label: 'OSY', icon: BookX, color: 'bg-slate-100 text-slate-700 border-slate-300' });
    }

    if (badges.length === 0) {
      return <span className="text-xs text-slate-400 italic">None</span>;
    }

    return (
      <div className="flex flex-wrap gap-1 max-w-xs">
        {badges.map((b) => {
          const Icon = b.icon;
          return (
            <span
              key={b.label}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium border ${b.color}`}
            >
              <Icon className="w-3 h-3" />
              <span>{b.label}</span>
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4" data-testid="resident-table-container">
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-xs">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm" data-testid="resident-table">
          <thead className="bg-slate-50 text-slate-700 font-semibold text-xs tracking-wider uppercase">
            <tr>
              <th scope="col" className="px-4 py-3">Resident Name</th>
              <th scope="col" className="px-4 py-3">Age / Sex</th>
              <th scope="col" className="px-4 py-3">Purok / Address</th>
              <th scope="col" className="px-4 py-3">Special Sectors</th>
              <th scope="col" className="px-4 py-3">Civil Status &amp; Nationality</th>
              <th scope="col" className="px-4 py-3">Status</th>
              {(canEdit || canArchive) && (
                <th scope="col" className="px-4 py-3 text-right">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {loading ? (
              <tr>
                <td colSpan={canEdit || canArchive ? 7 : 6} className="px-4 py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-medium">Loading residents masterlist...</p>
                  </div>
                </td>
              </tr>
            ) : residents.length === 0 ? (
              <tr>
                <td colSpan={canEdit || canArchive ? 7 : 6} className="px-4 py-12 text-center text-slate-500" data-testid="table-empty-state">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="p-3 bg-slate-100 rounded-full text-slate-400">
                      <Users className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-slate-800">No residents found</p>
                      <p className="text-xs text-slate-500 max-w-sm">
                        No inhabitants match the selected filters or search terms. Try clearing some filters or adding a new resident.
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
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                      {fullName}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-800">{resident.age} yrs</span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-600">{resident.sex}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{resident.purok}</div>
                      {resident.house_no_street && (
                        <div className="text-xs text-slate-500 truncate max-w-xs">{resident.house_no_street}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {renderSectorBadges(resident)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-slate-800">{resident.civil_status}</div>
                      <div className="text-xs text-slate-500">{resident.nationality}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {renderStatusBadge(resident.residency_status)}
                    </td>
                    {(canEdit || canArchive) && (
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => onEdit(resident)}
                              data-testid={`edit-resident-${resident.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 hover:border-blue-300 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                          )}
                          {canArchive && (
                            <button
                              type="button"
                              onClick={() => onArchive(resident)}
                              data-testid={`archive-resident-${resident.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 hover:border-red-300 transition-colors"
                            >
                              <Archive className="w-3.5 h-3.5" />
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
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 text-xs text-slate-600" data-testid="pagination-controls">
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            data-testid="page-limit-select"
            className="px-2 py-1 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
          <span className="text-slate-400">|</span>
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
              className="p-1 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => onPageChange(page + 1)}
              data-testid="next-page-btn"
              className="p-1 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
