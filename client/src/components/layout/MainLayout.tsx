import React, { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { SystemInfoResponse } from '../../types/system';
import { useSettings } from '../../context/SettingsContext';

export const MainLayout: React.FC = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { settings } = useSettings();
  const [localBarangayName, setLocalBarangayName] = useState('');

  const handleSystemInfoLoaded = useCallback((info: SystemInfoResponse) => {
    if (info.settings?.barangay_name) {
      setLocalBarangayName(info.settings.barangay_name);
    }
  }, []);

  const activeBarangayName = localBarangayName || settings.barangay_name || 'Barangay Poblacion';
  const municipalityName = settings.municipality_name;

  return (
    <div className="h-full w-full overflow-hidden bg-[#F8F9FA] flex flex-col font-sans">
      <div className="flex flex-1 h-full min-h-0 overflow-hidden">
        {/* Desktop Persistent Sidebar with Collapsible Rail */}
        <div className="hidden md:flex md:flex-shrink-0 h-full overflow-hidden">
          <Sidebar
            barangayName={activeBarangayName}
            municipalityName={municipalityName}
            isCollapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </div>

        {/* Mobile Drawer Sidebar Overlay */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-40 md:hidden flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 transition-opacity"
              onClick={() => setMobileSidebarOpen(false)}
              aria-hidden="true"
            />
            {/* Drawer */}
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-[#121214] z-50">
              <Sidebar
                onClose={() => setMobileSidebarOpen(false)}
                barangayName={activeBarangayName}
                municipalityName={municipalityName}
              />
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <Topbar
            onMenuClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            onSystemInfoLoaded={handleSystemInfoLoaded}
          />
          <main className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default MainLayout;
