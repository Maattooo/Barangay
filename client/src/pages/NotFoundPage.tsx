import React from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div
      data-testid="not-found-page"
      className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center"
    >
      <div className="p-4 bg-slate-100 text-slate-600 rounded-2xl shadow-sm mb-4">
        <HelpCircle className="w-12 h-12 text-slate-500" />
      </div>
      <h1 className="text-2xl font-black text-slate-900 tracking-tight">404 - Page Not Found</h1>
      <p className="text-sm text-slate-600 max-w-md mt-2 leading-relaxed">
        The requested address does not correspond to any active route in the Barangay System.
      </p>
      <div className="mt-6">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Go to Dashboard</span>
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
