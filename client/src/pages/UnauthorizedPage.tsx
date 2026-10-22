import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldX, ArrowLeft } from 'lucide-react';

export const UnauthorizedPage: React.FC = () => {
  return (
    <div
      data-testid="unauthorized-page"
      className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center"
    >
      <div className="p-4 bg-red-100 text-red-600 rounded-2xl shadow-sm mb-4">
        <ShieldX className="w-12 h-12" />
      </div>
      <h1 className="text-2xl font-black text-slate-900 tracking-tight">Access Denied</h1>
      <p className="text-sm text-slate-600 max-w-md mt-2 leading-relaxed">
        Your role lacks authorization to access this section under the Barangay System Section 5.5 Access Control Matrix.
      </p>
      <div className="mt-6">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
