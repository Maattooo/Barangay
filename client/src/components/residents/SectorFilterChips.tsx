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
    activeClass: 'bg-zinc-900 text-white border-zinc-900 shadow-none'
  },
  {
    key: 'pwd',
    label: 'PWD',
    icon: Accessibility,
    activeClass: 'bg-zinc-900 text-white border-zinc-900 shadow-none'
  },
  {
    key: '4ps',
    label: '4Ps Beneficiary',
    icon: Landmark,
    activeClass: 'bg-zinc-900 text-white border-zinc-900 shadow-none'
  },
  {
    key: 'solo_parent',
    label: 'Solo Parent',
    icon: UserCheck,
    activeClass: 'bg-zinc-900 text-white border-zinc-900 shadow-none'
  },
  {
    key: 'indigent',
    label: 'Indigent',
    icon: HeartHandshake,
    activeClass: 'bg-zinc-900 text-white border-zinc-900 shadow-none'
  },
  {
    key: 'voter',
    label: 'Registered Voter',
    icon: Vote,
    activeClass: 'bg-zinc-900 text-white border-zinc-900 shadow-none'
  },
  {
    key: 'youth',
    label: 'Youth / SK',
    icon: Sparkles,
    activeClass: 'bg-zinc-900 text-white border-zinc-900 shadow-none'
  },
  {
    key: 'ofw',
    label: 'OFW',
    icon: Plane,
    activeClass: 'bg-zinc-900 text-white border-zinc-900 shadow-none'
  },
  {
    key: 'osy',
    label: 'Out-of-School Youth (OSY)',
    icon: BookX,
    activeClass: 'bg-zinc-900 text-white border-zinc-900 shadow-none'
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
      <div className="flex items-center justify-between text-[11px] font-mono font-semibold text-zinc-500 uppercase tracking-wider">
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-zinc-400" />
          <span>Combinatorial Sector Filters ({selectedSectors.length} active)</span>
        </div>
        {hasActiveSectors && (
          <button
            type="button"
            onClick={onClearSectors}
            data-testid="clear-sectors-btn"
            className="flex items-center gap-1 text-[11px] font-mono font-medium text-red-600 hover:text-white hover:bg-red-600 transition-colors px-2 py-0.5 rounded-none border border-red-200 uppercase tracking-wider"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear All Sectors</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
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
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-none text-xs font-mono font-medium border transition-colors cursor-pointer ${
                isActive
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100 hover:border-zinc-400'
              }`}
            >
              {isActive ? (
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              ) : (
                <Icon className="w-3.5 h-3.5 text-zinc-500" />
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
