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

  const badgeClass = role ? roleBadgeStyles[role] || 'bg-zinc-100 text-zinc-800 border-zinc-200' : '';

  return (
    <header
      data-testid="topbar"
      className="bg-white border-b border-zinc-200 h-14 px-4 flex items-center justify-between sticky top-0 z-20 rounded-none select-none"
    >
      {/* Left: Mobile Toggle & Barangay Branding */}
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="md:hidden p-1.5 rounded-none text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            aria-label="Toggle Navigation"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <Building className="w-4 h-4 text-zinc-700 hidden sm:block" />
          <span className="font-bold text-zinc-950 text-sm tracking-tight uppercase truncate max-w-[200px] sm:max-w-md">
            {barangayName}
          </span>
        </div>
      </div>

      {/* Center/Right: LAN IP Badge, User Profile & Logout */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Dynamic LAN IP Badge */}
        <div
          data-testid="lan-ip-badge"
          className="flex items-center gap-2 px-2.5 py-1 rounded-none bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 font-mono"
        >
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-none bg-emerald-500 animate-pulse"></span>
            <Wifi className="w-3.5 h-3.5 text-zinc-500" />
            <span className="hidden sm:inline">Host: {hostUrl}</span>
            <span className="sm:hidden">{lanIp}:3000</span>
          </div>
          <button
            onClick={handleCopy}
            className="p-1 text-zinc-500 hover:text-zinc-950 hover:bg-zinc-200 rounded-none transition-colors flex items-center gap-1 text-[11px] font-medium"
            title="Copy Workstation URL"
            aria-label="Copy URL"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-600" />
                <span className="text-emerald-700 hidden md:inline">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span className="hidden md:inline">Copy</span>
              </>
            )}
          </button>
        </div>

        {/* User Info & Role Badge */}
        {user && (
          <div className="flex items-center gap-2.5 pl-2 sm:border-l sm:border-zinc-200">
            <div className="hidden lg:block text-right">
              <div className="text-xs font-bold text-zinc-900 leading-tight">{user.full_name}</div>
              <div className="text-[10px] text-zinc-500 font-mono">@{user.username}</div>
            </div>
            {role && (
              <span
                data-testid="user-role-badge"
                className={`px-2 py-0.5 rounded-none text-[11px] font-mono font-semibold uppercase tracking-wider border ${badgeClass}`}
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
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 hover:text-white hover:bg-red-600 rounded-none border border-red-200 hover:border-red-600 transition-colors focus:outline-none focus:ring-1 focus:ring-red-600"
          title="Sign out of system"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
};

export default Topbar;
