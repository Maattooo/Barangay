import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Plus } from 'lucide-react';

export const BlotterPage: React.FC = () => {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-100 text-amber-700 rounded-lg">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Blotter Records</h1>
            <p className="text-xs text-slate-500">Katarungang Pambarangay Peace &amp; Order Incident Registry</p>
          </div>
        </div>
        <Link
          to="/blotter/new"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Incident</span>
        </Link>
      </div>
      <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-500 text-sm">
        Blotter Case Table &amp; Mediation Status Tracking will be mounted in Phase 11.
      </div>
    </div>
  );
};

export default BlotterPage;
