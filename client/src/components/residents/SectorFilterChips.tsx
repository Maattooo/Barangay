import React from 'react';
import {
  Award,
  Accessibility,
  Landmark,
  UserCheck,
  HeartHandshake,
  Vote,
  Sparkles,
  Plane,
  BookX,
  Check,
  X,
  Filter
} from 'lucide-react';
import { ResidentSector } from '../../types/resident';

export interface SectorDefinition {
  key: ResidentSector;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  activeClass: string;
}

export const SECTOR_DEFINITIONS: SectorDefinition[] = [
  {
    key: 'senior',
    label: 'Senior Citizen',
    icon: Award,
    activeClass: 'bg-blue-600 text-white border-blue-600 shadow-sm'
  },
  {
    key: 'pwd',
    label: 'PWD',
    icon: Accessibility,
    activeClass: 'bg-purple-600 text-white border-purple-600 shadow-sm'
  },
  {
    key: '4ps',
    label: '4Ps Beneficiary',
    icon: Landmark,
    activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
  },
  {
    key: 'solo_parent',
    label: 'Solo Parent',
    icon: UserCheck,
    activeClass: 'bg-rose-600 text-white border-rose-600 shadow-sm'
  },
  {
    key: 'indigent',
    label: 'Indigent',
    icon: HeartHandshake,
    activeClass: 'bg-amber-600 text-white border-amber-600 shadow-sm'
  },
  {
    key: 'voter',
    label: 'Registered Voter',
    icon: Vote,
    activeClass: 'bg-teal-600 text-white border-teal-600 shadow-sm'
  },
  {
    key: 'youth',
    label: 'Youth / SK',
    icon: Sparkles,
    activeClass: 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
  },
  {
    key: 'ofw',
    label: 'OFW',
    icon: Plane,
    activeClass: 'bg-sky-600 text-white border-sky-600 shadow-sm'
  },
  {
    key: 'osy',
    label: 'Out-of-School Youth (OSY)',
    icon: BookX,
    activeClass: 'bg-slate-700 text-white border-slate-700 shadow-sm'
  }
];

export interface SectorFilterChipsProps {
  selectedSectors: ResidentSector[];
  onToggleSector: (sector: ResidentSector) => void;
  onClearSectors: () => void;
  className?: string;
}

export const SectorFilterChips: React.FC<SectorFilterChipsProps> = ({
  selectedSectors,
  onToggleSector,
  onClearSectors,
  className = ''
}) => {
  const hasActiveSectors = selectedSectors.length > 0;

  return (
    <div className={`space-y-2 ${className}`} data-testid="sector-filter-chips-bar">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span>Combinatorial Sector Filters ({selectedSectors.length} active)</span>
        </div>
        {hasActiveSectors && (
          <button
            type="button"
            onClick={onClearSectors}
            data-testid="clear-sectors-btn"
            className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 transition-colors px-2 py-0.5 rounded hover:bg-red-50"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear All Sectors</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {SECTOR_DEFINITIONS.map((sector) => {
          const isActive = selectedSectors.includes(sector.key);
          const Icon = sector.icon;

          return (
            <button
              key={sector.key}
              type="button"
              role="button"
              aria-pressed={isActive}
              data-testid={`chip-${sector.key}`}
              onClick={() => onToggleSector(sector.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 cursor-pointer ${
                isActive
                  ? sector.activeClass
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-xs'
              }`}
            >
              {isActive ? (
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              ) : (
                <Icon className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span>{sector.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SectorFilterChips;
