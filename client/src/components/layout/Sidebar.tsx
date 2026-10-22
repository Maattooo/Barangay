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
  X,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

interface SidebarProps {
  onClose?: () => void;
  barangayName?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
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

export const Sidebar: React.FC<SidebarProps> = ({
  onClose,
  barangayName = 'Barangay System',
  isCollapsed = false,
  onToggleCollapse
}) => {
  const { role } = useAuth();

  const visibleItems = NAV_ITEMS.filter((item) => role && item.roles.includes(role));

  return (
    <aside
      data-testid="sidebar"
      className={`${
        isCollapsed ? 'w-16' : 'w-64'
      } bg-[#121214] text-zinc-200 flex flex-col h-full border-r border-zinc-800 select-none transition-all duration-150 rounded-none`}
    >
      {/* Branding Header */}
      <div className="p-3.5 flex items-center justify-between border-b border-zinc-800 min-h-[56px]">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="p-2 bg-zinc-800 border border-zinc-700 text-white rounded-none flex-shrink-0">
            <Building2 className="w-4 h-4 text-zinc-100" />
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <h2 className="font-bold text-white text-xs tracking-tight uppercase truncate">
                {barangayName}
              </h2>
              <p className="text-[10px] font-mono text-zinc-400 tracking-wider uppercase">
                Station Portal
              </p>
            </div>
          )}
        </div>

        {/* Desktop Collapse Toggle */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="hidden md:flex p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-none border border-transparent hover:border-zinc-700 transition-colors"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse to rail'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Mobile Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-none"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto" aria-label="Main Navigation">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              title={isCollapsed ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center ${
                  isCollapsed ? 'justify-center px-2' : 'gap-3 px-3'
                } py-2 text-xs font-medium rounded-none transition-all duration-150 border-l-2 ${
                  isActive
                    ? 'bg-zinc-800/90 text-white font-semibold border-white shadow-none'
                    : 'text-zinc-400 border-transparent hover:bg-zinc-800/40 hover:text-zinc-100 hover:border-zinc-600'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer System Status */}
      <div className="p-3 border-t border-zinc-800 bg-[#0C0C0E] text-[10px] font-mono text-zinc-400">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'}`}>
          <span className="w-2 h-2 rounded-none bg-emerald-500 inline-block flex-shrink-0 animate-pulse"></span>
          {!isCollapsed && <span className="uppercase tracking-wider truncate">Offline LAN Active</span>}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
