import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { SystemInfoResponse } from '../../types/system';
import api from '../../services/api';
import { Menu, LogOut, Copy, Check, Wifi, Building } from 'lucide-react';

interface TopbarProps {
  onMenuClick?: () => void;
  onSystemInfoLoaded?: (info: SystemInfoResponse) => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onMenuClick, onSystemInfoLoaded }) => {
  const { user, role, logout } = useAuth();
  const [systemInfo, setSystemInfo] = useState<SystemInfoResponse | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    api
      .getSystemInfo()
      .then((data) => {
        if (isMounted) {
          setSystemInfo(data);
          if (onSystemInfoLoaded) {
            onSystemInfoLoaded(data);
          }
        }
      })
      .catch((_err) => {
        // Fallback gracefully
      });

    return () => {
      isMounted = false;
    };
  }, [onSystemInfoLoaded]);

  const lanIp = systemInfo?.lan_ips?.[0] || '127.0.0.1';
  const hostUrl = `http://${lanIp}:3000`;
  const barangayName = systemInfo?.settings?.barangay_name || 'Barangay Poblacion';

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(hostUrl);
      } else {
        // Fallback for non-secure contexts
        const textarea = document.createElement('textarea');
        textarea.value = hostUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  const roleBadgeStyles: Record<string, string> = {
    Admin: 'bg-purple-100 text-purple-800 border-purple-200',
    Clerk: 'bg-blue-100 text-blue-800 border-blue-200',
    Treasurer: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    Lupon: 'bg-amber-100 text-amber-800 border-amber-200'
  };

  const badgeClass = role ? roleBadgeStyles[role] || 'bg-slate-100 text-slate-800 border-slate-200' : '';

  return (
    <header
      data-testid="topbar"
      className="bg-white border-b border-slate-200 h-16 px-4 flex items-center justify-between shadow-sm sticky top-0 z-20"
    >
      {/* Left: Mobile Toggle & Barangay Branding */}
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Toggle Navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <Building className="w-5 h-5 text-blue-600 hidden sm:block" />
          <span className="font-bold text-slate-900 text-base tracking-tight truncate max-w-[200px] sm:max-w-md">
            {barangayName}
          </span>
        </div>
      </div>

      {/* Center/Right: LAN IP Badge, User Profile & Logout */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Dynamic LAN IP Badge */}
        <div
          data-testid="lan-ip-badge"
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 shadow-inner"
        >
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <Wifi className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-mono font-medium hidden sm:inline">Host: {hostUrl}</span>
            <span className="font-mono font-medium sm:hidden">{lanIp}:3000</span>
          </div>
          <button
            onClick={handleCopy}
            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-200 rounded transition-colors flex items-center gap-1 text-[11px] font-medium"
            title="Copy Workstation URL"
            aria-label="Copy URL"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 hidden md:inline">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Copy URL</span>
              </>
            )}
          </button>
        </div>

        {/* User Info & Role Badge */}
        {user && (
          <div className="flex items-center gap-2.5 pl-2 sm:border-l sm:border-slate-200">
            <div className="hidden lg:block text-right">
              <div className="text-xs font-bold text-slate-900 leading-tight">{user.full_name}</div>
              <div className="text-[10px] text-slate-500 font-mono">@{user.username}</div>
            </div>
            {role && (
              <span
                data-testid="user-role-badge"
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wider ${badgeClass}`}
              >
                {role}
              </span>
            )}
          </div>
        )}

        {/* Logout Button */}
        <button
          onClick={() => logout()}
          data-testid="logout-button"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200 focus:outline-none focus:ring-2 focus:ring-red-500"
          title="Sign out of system"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
};

export default Topbar;
