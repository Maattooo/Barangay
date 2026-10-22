import React, { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { SystemInfoResponse } from '../../types/system';

export const MainLayout: React.FC = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [barangayName, setBarangayName] = useState('Barangay Poblacion');

  const handleSystemInfoLoaded = useCallback((info: SystemInfoResponse) => {
    if (info.settings?.barangay_name) {
      setBarangayName(info.settings.barangay_name);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      <div className="flex flex-1 min-h-screen">
        {/* Desktop Persistent Sidebar */}
        <div className="hidden md:flex md:flex-shrink-0">
          <Sidebar barangayName={barangayName} />
        </div>

        {/* Mobile Drawer Sidebar Overlay */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-40 md:hidden flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
              onClick={() => setMobileSidebarOpen(false)}
              aria-hidden="true"
            />
            {/* Drawer */}
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-900 z-50 animate-slide-in">
              <Sidebar onClose={() => setMobileSidebarOpen(false)} barangayName={barangayName} />
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Topbar
            onMenuClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            onSystemInfoLoaded={handleSystemInfoLoaded}
          />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default MainLayout;
