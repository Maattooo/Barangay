import React from 'react';
import { Users } from 'lucide-react';

export const ResidentsPage: React.FC = () => {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-blue-100 text-blue-700 rounded-lg">
          <Users className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Residents Registry</h1>
          <p className="text-xs text-slate-500">Registry of Barangay Inhabitants (RBI) Masterlist</p>
        </div>
      </div>
      <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-500 text-sm">
        Resident Registry Table &amp; Sector Filters will be mounted in Phase 10.
      </div>
    </div>
  );
};

export default ResidentsPage;
