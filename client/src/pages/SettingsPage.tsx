import React from 'react';
import { Settings } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-purple-100 text-purple-700 rounded-lg">
          <Settings className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">System Settings &amp; Backups</h1>
          <p className="text-xs text-slate-500">Barangay header metadata, user management, and hot backups</p>
        </div>
      </div>
      <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-500 text-sm">
        Barangay Settings &amp; SQLite Hot Backup will be mounted in Phase 12.
      </div>
    </div>
  );
};

export default SettingsPage;
