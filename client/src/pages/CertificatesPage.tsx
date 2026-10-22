import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, Plus } from 'lucide-react';

export const CertificatesPage: React.FC = () => {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-lg">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Certificate Issuance</h1>
            <p className="text-xs text-slate-500">Official Barangay Clearances, Indigency, and Residency</p>
          </div>
        </div>
        <Link
          to="/certificates/new"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Issue New</span>
        </Link>
      </div>
      <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-500 text-sm">
        Certificate Issuance History Table &amp; Search will be mounted in Phase 11.
      </div>
    </div>
  );
};

export default CertificatesPage;
