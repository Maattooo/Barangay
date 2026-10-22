import React from 'react';
import { FileWarning } from 'lucide-react';

export const NewBlotterPage: React.FC = () => {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-amber-100 text-amber-700 rounded-lg">
          <FileWarning className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Record Blotter Case</h1>
          <p className="text-xs text-slate-500">File a new incident report or dispute</p>
        </div>
      </div>
      <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-500 text-sm">
        Blotter Form Modal &amp; Katarungang Pambarangay Filing will be mounted in Phase 11.
      </div>
    </div>
  );
};

export default NewBlotterPage;
