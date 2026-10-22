import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types/auth';
import {
  LayoutDashboard,
  Users,
  FileText,
  ShieldAlert,
  Award,
  FileCode2,
  History,
  Settings,
  Building2,
  X
} from 'lucide-react';

interface SidebarProps {
  onClose?: () => void;
  barangayName?: string;
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
    roles: ['Admin', 'Clerk', 'Treasurer', 'Lupon']
  },
  {
    label: 'Residents',
    path: '/residents',
    icon: Users,
    roles: ['Admin', 'Clerk', 'Treasurer', 'Lupon']
  },
  {
    label: 'Certificates',
    path: '/certificates',
    icon: FileText,
    roles: ['Admin', 'Clerk', 'Treasurer']
  },
  {
    label: 'Blotter',
    path: '/blotter',
    icon: ShieldAlert,
    roles: ['Admin', 'Lupon']
  },
  {
    label: 'Officials',
    path: '/officials',
    icon: Award,
    roles: ['Admin']
  },
  {
    label: 'Templates',
    path: '/templates',
    icon: FileCode2,
    roles: ['Admin']
  },
  {
    label: 'Audit Logs',
    path: '/audit-logs',
    icon: History,
    roles: ['Admin']
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: Settings,
    roles: ['Admin']
  }
];

export const Sidebar: React.FC<SidebarProps> = ({ onClose, barangayName = 'Barangay System' }) => {
  const { role } = useAuth();

  const visibleItems = NAV_ITEMS.filter((item) => role && item.roles.includes(role));

  return (
    <aside
      data-testid="sidebar"
      className="w-64 bg-slate-900 text-slate-200 flex flex-col h-full border-r border-slate-800 select-none"
    >
      {/* Branding Header */}
      <div className="p-4 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg shadow-sm">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-white text-sm tracking-tight leading-tight line-clamp-1">
              {barangayName}
            </h2>
            <p className="text-[11px] text-slate-400">Barangay Portal</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto" aria-label="Main Navigation">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer System Status */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/50 text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>Offline LAN Mode Active</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
