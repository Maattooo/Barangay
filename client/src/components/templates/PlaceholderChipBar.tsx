import React, { useState } from 'react';
import { Tag, User, Receipt, Calendar, Award, Scale, Search } from 'lucide-react';

interface PlaceholderChipBarProps {
  onInsertPlaceholder: (tag: string) => void;
  activeTargetLabel?: string;
  templateCategory?: 'certificate' | 'blotter';
}

export interface PlaceholderGroup {
  category: string;
  icon: React.ReactNode;
  tags: { tag: string; label: string }[];
}

export const PLACEHOLDER_GROUPS: PlaceholderGroup[] = [
  {
    category: 'Resident Variables',
    icon: <User className="w-3.5 h-3.5" />,
    tags: [
      { tag: '{{full_name}}', label: 'Full Name' },
      { tag: '{{age}}', label: 'Age' },
      { tag: '{{birthdate}}', label: 'Birthdate' },
      { tag: '{{sex}}', label: 'Sex' },
      { tag: '{{civil_status}}', label: 'Civil Status' },
      { tag: '{{pronoun_he_she}}', label: 'he / she' },
      { tag: '{{pronoun_his_her}}', label: 'his / her' },
      { tag: '{{purok}}', label: 'Purok' },
      { tag: '{{address}}', label: 'Full Address' }
    ]
  },
  {
    category: 'Transaction & Cedula',
    icon: <Receipt className="w-3.5 h-3.5" />,
    tags: [
      { tag: '{{purpose}}', label: 'Purpose' },
      { tag: '{{control_number}}', label: 'Control #' },
      { tag: '{{or_number}}', label: 'O.R. #' },
      { tag: '{{amount_paid}}', label: 'Amount Paid' },
      { tag: '{{ctc_number}}', label: 'CTC / Cedula #' },
      { tag: '{{ctc_date_issued}}', label: 'CTC Date' },
      { tag: '{{ctc_place_issued}}', label: 'CTC Place' }
    ]
  },
  {
    category: 'Header & Date Variables',
    icon: <Calendar className="w-3.5 h-3.5" />,
    tags: [
      { tag: '{{day_ordinal}}', label: 'Day Ordinal (21st)' },
      { tag: '{{month_year}}', label: 'Month & Year' },
      { tag: '{{date_today}}', label: 'Full Date' },
      { tag: '{{barangay_name}}', label: 'Barangay Name' },
      { tag: '{{municipality_name}}', label: 'Municipality' },
      { tag: '{{province_name}}', label: 'Province' }
    ]
  },
  {
    category: 'Officials & Signatory',
    icon: <Award className="w-3.5 h-3.5" />,
    tags: [
      { tag: '{{punong_barangay}}', label: 'Punong Barangay' },
      { tag: '{{barangay_secretary}}', label: 'Secretary' },
      { tag: '{{barangay_treasurer}}', label: 'Treasurer' },
      { tag: '{{signatory_name}}', label: 'Signatory Name' },
      { tag: '{{signatory_title}}', label: 'Signatory Title' }
    ]
  },
  {
    category: 'Blotter & KP Variables',
    icon: <Scale className="w-3.5 h-3.5" />,
    tags: [
      { tag: '{{case_number}}', label: 'Blotter Case #' },
      { tag: '{{complainant_name}}', label: 'Complainant' },
      { tag: '{{respondent_name}}', label: 'Respondent' },
      { tag: '{{incident_type}}', label: 'Incident Type' },
      { tag: '{{incident_location}}', label: 'Location' },
      { tag: '{{incident_details}}', label: 'Narrative' },
      { tag: '{{date_incident}}', label: 'Date of Incident' },
      { tag: '{{date_recorded}}', label: 'Date Recorded' },
      { tag: '{{status}}', label: 'Case Status' },
      { tag: '{{settlement_notes}}', label: 'Settlement Terms' },
      { tag: '{{hearing_date}}', label: 'Hearing Schedule' }
    ]
  }
];

export const PlaceholderChipBar: React.FC<PlaceholderChipBarProps> = ({
  onInsertPlaceholder,
  activeTargetLabel = 'Document Body'
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');

  const filteredGroups = PLACEHOLDER_GROUPS.filter((group) =>
    selectedGroup === 'ALL' ? true : group.category === selectedGroup
  )
    .map((group) => ({
      ...group,
      tags: group.tags.filter(
        (t) =>
          !searchQuery.trim() ||
          t.tag.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
          t.label.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    }))
    .filter((group) => group.tags.length > 0);

  return (
    <div className="bg-zinc-50 border border-zinc-200 rounded-none p-3.5 space-y-3 font-mono">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Tag className="w-3.5 h-3.5 text-zinc-800" />
          <h3 className="text-xs font-bold text-zinc-950 uppercase tracking-wider">
            Clickable Dynamic Placeholder Tags
          </h3>
          <span className="text-[10px] px-1.5 py-0.5 bg-zinc-900 text-white uppercase tracking-wider">
            Target: {activeTargetLabel}
          </span>
        </div>

        {/* Quick Search & Category Filter */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3 h-3 text-zinc-400 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter tags..."
              aria-label="Filter placeholder tags"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-6 pr-2 py-1 text-[11px] font-mono border border-zinc-300 bg-white rounded-none w-36 focus:border-zinc-900 outline-none"
            />
          </div>
          <select
            aria-label="Filter placeholder category"
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="px-2 py-1 text-[11px] font-mono border border-zinc-300 bg-white rounded-none text-zinc-800 focus:border-zinc-900 outline-none"
          >
            <option value="ALL">All Categories</option>
            {PLACEHOLDER_GROUPS.map((g) => (
              <option key={g.category} value={g.category}>
                {g.category}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2.5">
        {filteredGroups.map((group) => (
          <div key={group.category} className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-zinc-600">
              {group.icon}
              <span>{group.category}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {group.tags.map(({ tag, label }) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onInsertPlaceholder(tag)}
                  title={`Insert ${tag} (${label}) into ${activeTargetLabel}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-none text-xs font-mono font-medium bg-white hover:bg-zinc-900 text-zinc-800 hover:text-white border border-zinc-300 hover:border-zinc-900 transition-colors cursor-pointer group"
                >
                  <span className="font-bold text-zinc-950 group-hover:text-white">{tag}</span>
                  <span className="text-[10px] text-zinc-500 group-hover:text-zinc-300 font-sans">
                    ({label})
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlaceholderChipBar;
