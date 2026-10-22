import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  FileSpreadsheet,
  Download,
  Search,
  MapPin,
  RotateCcw,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  Resident,
  ResidentSector,
  ResidentFilters
} from '../types/resident';
import api from '../services/api';
import SectorFilterChips from '../components/residents/SectorFilterChips';
import ResidentTable from '../components/residents/ResidentTable';
import ResidentFormModal from '../components/residents/ResidentFormModal';
import ArchiveResidentDialog from '../components/residents/ArchiveResidentDialog';
import ExcelImportModal from '../components/residents/ExcelImportModal';

const PUROK_OPTIONS = [
  'Purok 1',
  'Purok 2',
  'Purok 3',
  'Purok 4',
  'Purok 5',
  'Purok 6',
  'Purok 7',
  'Sitio Centro',
  'Sitio Riverside'
];

export const ResidentsPage: React.FC = () => {
  const { role } = useAuth();

  // RBAC permissions
  const canAdd = role === 'Admin' || role === 'Clerk';
  const canImport = role === 'Admin';
  const canExport = role === 'Admin' || role === 'Clerk' || role === 'Treasurer';

  // Filter states
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedPurok, setSelectedPurok] = useState('');
  const [selectedSectors, setSelectedSectors] = useState<ResidentSector[]>([]);

  // Pagination states
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Data states
  const [residents, setResidents] = useState<Resident[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingResident, setEditingResident] = useState<Resident | null>(null);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [archivingResident, setArchivingResident] = useState<Resident | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);

  // 300ms Debounce for Search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch Residents
  const fetchResidents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: ResidentFilters = {
        page,
        limit
      };
      if (debouncedSearch.trim()) filters.search = debouncedSearch.trim();
      if (selectedPurok) filters.purok = selectedPurok;
      if (selectedSectors.length > 0) filters.sectors = selectedSectors;

      const res = await api.getResidents(filters);
      setResidents(res.data || []);
      setTotal(res.pagination?.total || 0);
      setTotalPages(res.pagination?.totalPages || 1);
    } catch (err: any) {
      setError(err.message || 'Failed to load residents.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedPurok, selectedSectors, page, limit]);

  useEffect(() => {
    fetchResidents();
  }, [fetchResidents]);

  // Sector filter handlers
  const handleToggleSector = (sector: ResidentSector) => {
    setSelectedSectors((prev) =>
      prev.includes(sector) ? prev.filter((s) => s !== sector) : [...prev, sector]
    );
    setPage(1);
  };

  const handleClearSectors = () => {
    setSelectedSectors([]);
    setPage(1);
  };

  const handlePurokChange = (purok: string) => {
    setSelectedPurok(purok);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setSelectedPurok('');
    setSelectedSectors([]);
    setPage(1);
  };

  const hasActiveFilters =
    debouncedSearch.trim().length > 0 || selectedPurok.length > 0 || selectedSectors.length > 0;

  // Export Excel
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const filters: ResidentFilters = {};
      if (debouncedSearch.trim()) filters.search = debouncedSearch.trim();
      if (selectedPurok) filters.purok = selectedPurok;
      if (selectedSectors.length > 0) filters.sectors = selectedSectors;

      await api.exportExcelResidents(filters);
    } catch (err: any) {
      setError(err.message || 'Failed to export residents to Excel.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="residents-page">
      {/* Top Header & Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-none border border-zinc-200 shadow-none">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-zinc-100 text-zinc-800 rounded-none border border-zinc-200">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-zinc-950 uppercase tracking-tight">
                Registry of Barangay Inhabitants (RBI)
              </h1>
              <span
                className="px-2 py-0.5 rounded-none text-xs font-mono font-medium bg-zinc-100 text-zinc-800 border border-zinc-300"
                data-testid="resident-total-badge"
              >
                {total} Residents
              </span>
            </div>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">
              Demographic records, sector classifications, and census registry
            </p>
          </div>
        </div>

        {/* Action Buttons with RBAC */}
        <div className="flex flex-wrap items-center gap-2">
          {canExport && (
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exporting}
              data-testid="export-excel-btn"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium text-zinc-800 bg-white border border-zinc-300 rounded-none hover:bg-zinc-100 hover:border-zinc-400 disabled:opacity-50 transition-colors uppercase tracking-wider"
            >
              {exporting ? (
                <div className="w-3.5 h-3.5 border-2 border-zinc-600 border-t-transparent rounded-none animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 text-zinc-600" />
              )}
              <span>{exporting ? 'Preparing...' : 'Export Excel'}</span>
            </button>
          )}

          {canImport && (
            <button
              type="button"
              onClick={() => setIsImportOpen(true)}
              data-testid="import-excel-btn"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-none hover:bg-emerald-100 transition-colors uppercase tracking-wider"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>Import Excel</span>
            </button>
          )}

          {canAdd && (
            <button
              type="button"
              onClick={() => {
                setEditingResident(null);
                setIsFormOpen(true);
              }}
              data-testid="new-resident-btn"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono font-semibold uppercase tracking-wider text-white bg-zinc-900 rounded-none hover:bg-black transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>New Resident</span>
            </button>
          )}
        </div>
      </div>

      {/* Search, Filters, and Sector Chips Bar */}
      <div className="bg-white p-4 rounded-none border border-zinc-200 shadow-none space-y-3.5">
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          {/* Debounced Search Bar */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by first name, last name, or middle name..."
              data-testid="resident-search-input"
              className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm border border-zinc-300 rounded-none bg-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
            />
          </div>

          {/* Purok Selector */}
          <div className="relative w-full sm:w-60">
            <MapPin className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={selectedPurok}
              onChange={(e) => handlePurokChange(e.target.value)}
              data-testid="purok-filter-select"
              className="w-full pl-9 pr-8 py-1.5 text-xs sm:text-sm border border-zinc-300 rounded-none bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
            >
              <option value="">All Puroks / Sitios</option>
              {PUROK_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              data-testid="reset-filters-btn"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-none border border-zinc-300 transition-colors whitespace-nowrap uppercase tracking-wider"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Combinatorial Sector Filter Chips Bar */}
        <div className="pt-2.5 border-t border-zinc-200">
          <SectorFilterChips
            selectedSectors={selectedSectors}
            onToggleSector={handleToggleSector}
            onClearSectors={handleClearSectors}
          />
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-none text-xs text-red-800 flex items-center justify-between font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchResidents}
            className="text-xs font-mono font-semibold text-red-700 hover:underline uppercase"
          >
            Retry
          </button>
        </div>
      )}

      {/* Resident Data Table */}
      <ResidentTable
        residents={residents}
        loading={loading}
        total={total}
        page={page}
        limit={limit}
        totalPages={totalPages}
        onPageChange={(newPage) => setPage(newPage)}
        onLimitChange={(newLimit) => {
          setLimit(newLimit);
          setPage(1);
        }}
        onEdit={(resident) => {
          setEditingResident(resident);
          setIsFormOpen(true);
        }}
        onArchive={(resident) => {
          setArchivingResident(resident);
          setIsArchiveOpen(true);
        }}
        userRole={role}
      />

      {/* Resident Add/Edit Modal */}
      <ResidentFormModal
        isOpen={isFormOpen}
        resident={editingResident}
        onClose={() => {
          setIsFormOpen(false);
          setEditingResident(null);
        }}
        onSuccess={() => {
          fetchResidents();
        }}
      />

      {/* Archive Confirmation Dialog */}
      <ArchiveResidentDialog
        isOpen={isArchiveOpen}
        resident={archivingResident}
        onClose={() => {
          setIsArchiveOpen(false);
          setArchivingResident(null);
        }}
        onSuccess={() => {
          fetchResidents();
        }}
      />

      {/* Excel Import Modal */}
      <ExcelImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={() => {
          fetchResidents();
        }}
      />
    </div>
  );
};

export default ResidentsPage;
