import React from 'react';
import { Tag, User, Receipt, Calendar, Award } from 'lucide-react';

interface PlaceholderChipBarProps {
  onInsertPlaceholder: (tag: string) => void;
}

interface PlaceholderGroup {
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
    category: 'Transaction Variables',
    icon: <Receipt className="w-3.5 h-3.5" />,
    tags: [
      { tag: '{{purpose}}', label: 'Purpose' },
      { tag: '{{control_number}}', label: 'Control #' },
      { tag: '{{or_number}}', label: 'O.R. #' },
      { tag: '{{amount_paid}}', label: 'Amount Paid' }
    ]
  },
  {
    category: 'Date Variables',
    icon: <Calendar className="w-3.5 h-3.5" />,
    tags: [
      { tag: '{{day_ordinal}}', label: 'Day Ordinal (e.g. 21st)' },
      { tag: '{{month_year}}', label: 'Month & Year' }
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
  }
];

export const PlaceholderChipBar: React.FC<PlaceholderChipBarProps> = ({
  onInsertPlaceholder
}) => {
  return (
    <div className="bg-zinc-50 border border-zinc-200 rounded-none p-3.5 space-y-3 font-mono">
      <div className="flex items-center gap-2">
        <Tag className="w-3.5 h-3.5 text-zinc-700" />
        <h3 className="text-xs font-bold text-zinc-950 uppercase tracking-wider">
          Clickable Dynamic Placeholder Tags
        </h3>
        <span className="text-[10px] text-zinc-500 font-sans">
          (Click tag to insert at cursor position into template)
        </span>
      </div>

      <div className="space-y-2.5">
        {PLACEHOLDER_GROUPS.map((group) => (
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
                  title={`Insert ${tag} (${label})`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-none text-xs font-mono font-medium bg-white hover:bg-zinc-100 text-zinc-800 hover:text-black border border-zinc-300 hover:border-zinc-900 transition-colors cursor-pointer"
                >
                  <span className="font-bold text-zinc-950">{tag}</span>
                  <span className="text-[10px] text-zinc-500 font-sans">({label})</span>
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
