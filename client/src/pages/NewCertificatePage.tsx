import React from 'react';
import { FileCheck2 } from 'lucide-react';

export const NewCertificatePage: React.FC = () => {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-lg">
          <FileCheck2 className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Issue Certificate</h1>
          <p className="text-xs text-slate-500">Step-by-step certificate issuance wizard</p>
        </div>
      </div>
      <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-500 text-sm">
        Certificate Issuance Wizard &amp; A4 Print Preview will be mounted in Phase 11.
      </div>
    </div>
  );
};

export default NewCertificatePage;
