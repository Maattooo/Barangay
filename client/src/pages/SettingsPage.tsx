import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Database,
  Network,
  Users,
  Download,
  Plus,
  Edit,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Copy,
  Check
} from 'lucide-react';
import api from '../services/api';
import { UserAccount } from '../types/admin';
import UserFormModal from '../components/settings/UserFormModal';

export const SettingsPage: React.FC = () => {
  // System Info & Settings
  const [lanIps, setLanIps] = useState<string[]>([]);
  const [dbSizeBytes, setDbSizeBytes] = useState<number>(0);

  // Barangay Metadata Form fields
  const [barangayName, setBarangayName] = useState('');
  const [municipalityName, setMunicipalityName] = useState('');
  const [provinceName, setProvinceName] = useState('');
  const [regionName, setRegionName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Backup State
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);

  // User Accounts
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);

  // LAN IP copy state
  const [copiedIp, setCopiedIp] = useState(false);

  // Fetch System Info
  const fetchSystemInfo = useCallback(async () => {
    try {
      const info = await api.getSystemInfo();
      setLanIps(info.lan_ips || ['127.0.0.1']);
      setDbSizeBytes(info.db_size_bytes || 0);

      const s = info.settings || {};
      setBarangayName((s.barangay_name as string) || (s.name as string) || 'Barangay Harapin Ang Bukas');
      setMunicipalityName((s.municipality_name as string) || (s.municipality as string) || 'Mandaluyong City');
      setProvinceName((s.province_name as string) || (s.province as string) || 'Metro Manila');
      setRegionName((s.region_name as string) || (s.region as string) || 'National Capital Region (NCR)');
      setContactEmail((s.contact_email as string) || (s.email as string) || 'barangay@gov.ph');
    } catch {
      // Graceful fallback defaults if network or offline
      setLanIps(['127.0.0.1']);
      setBarangayName('Barangay Harapin Ang Bukas');
      setMunicipalityName('Mandaluyong City');
      setProvinceName('Metro Manila');
      setRegionName('NCR');
      setContactEmail('barangay@gov.ph');
    }
  }, []);

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    setUsersError(null);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err: any) {
      setUsersError(err?.message || 'Failed to load user accounts.');
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    fetchSystemInfo();
    fetchUsers();
  }, [fetchSystemInfo, fetchUsers]);

  // Handle Save Barangay Metadata
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSaved(false);
    setSettingsError(null);

    const payload: Record<string, string> = {
      barangay_name: barangayName.trim(),
      municipality_name: municipalityName.trim(),
      province_name: provinceName.trim(),
      region_name: regionName.trim(),
      contact_email: contactEmail.trim()
    };

    try {
      await api.updateSystemSettings(payload);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 4000);
    } catch (err: any) {
      // Even if server doesn't support system_settings endpoint, provide clear feedback
      setSettingsError(err?.message || 'Settings update acknowledged.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Handle Hot Backup Download
  const handleDownloadBackup = async () => {
    setIsBackingUp(true);
    setBackupSuccess(false);
    setBackupError(null);

    try {
      await api.downloadDatabaseBackup();
      setBackupSuccess(true);
      setTimeout(() => setBackupSuccess(false), 4000);
    } catch (err: any) {
      setBackupError(err?.message || 'Failed to download SQLite backup.');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleCopyLanUrl = (url: string) => {
    navigator.clipboard?.writeText(url);
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 2000);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const primaryIp = lanIps.find((ip) => ip !== '127.0.0.1') || lanIps[0] || '127.0.0.1';
  const hostUrl = `http://${primaryIp}:3000`;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-purple-100 text-purple-700 rounded-xl shadow-inner">
            <Settings className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              System Settings &amp; Maintenance
            </h1>
            <p className="text-xs text-slate-500">
              Barangay header metadata, multi-desk LAN networking, user security, and hot backups
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Barangay Metadata Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
            <Settings className="w-5 h-5 text-purple-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Barangay Metadata</h2>
              <p className="text-[11px] text-slate-500">
                Official names displayed on certificate letterheads and clearances
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-3.5">
            {settingsSaved && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Barangay metadata saved successfully!</span>
              </div>
            )}
            {settingsError && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{settingsError}</span>
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="barangay_name" className="block text-xs font-semibold text-slate-700">
                Barangay Name <span className="text-red-500">*</span>
              </label>
              <input
                id="barangay_name"
                name="barangay_name"
                aria-label="Barangay Name"
                type="text"
                required
                value={barangayName}
                onChange={(e) => setBarangayName(e.target.value)}
                placeholder="e.g. Barangay Harapin Ang Bukas"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="municipality_name"
                  className="block text-xs font-semibold text-slate-700"
                >
                  City / Municipality <span className="text-red-500">*</span>
                </label>
                <input
                  id="municipality_name"
                  name="municipality_name"
                  aria-label="City / Municipality"
                  type="text"
                  required
                  value={municipalityName}
                  onChange={(e) => setMunicipalityName(e.target.value)}
                  placeholder="e.g. Mandaluyong City"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="province_name" className="block text-xs font-semibold text-slate-700">
                  Province <span className="text-red-500">*</span>
                </label>
                <input
                  id="province_name"
                  name="province_name"
                  aria-label="Province"
                  type="text"
                  required
                  value={provinceName}
                  onChange={(e) => setProvinceName(e.target.value)}
                  placeholder="e.g. Metro Manila"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="region_name" className="block text-xs font-semibold text-slate-700">
                  Region
                </label>
                <input
                  id="region_name"
                  name="region_name"
                  aria-label="Region"
                  type="text"
                  value={regionName}
                  onChange={(e) => setRegionName(e.target.value)}
                  placeholder="e.g. NCR"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="contact_email" className="block text-xs font-semibold text-slate-700">
                  Official Email / Contact
                </label>
                <input
                  id="contact_email"
                  name="contact_email"
                  aria-label="Official Email"
                  type="text"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="e.g. barangay@gov.ph"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
              >
                {savingSettings ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Update Barangay Metadata</span>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* 2. Multi-Desk LAN Instructions & Database Hot Backup */}
        <div className="space-y-6">
          {/* Multi-Desk LAN Instructions Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <Network className="w-5 h-5 text-blue-600" />
              <div>
                <h2 className="text-sm font-bold text-slate-900">Multi-Desk LAN Connection</h2>
                <p className="text-[11px] text-slate-500">
                  Connect other barangay workstations without internet access
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Open Chrome or Edge on any computer connected to the same Barangay Hall Wi-Fi or router
              and navigate to:
            </p>

            <div className="flex items-center gap-2 p-3 bg-slate-900 rounded-xl text-emerald-400 font-mono text-xs justify-between">
              <span className="font-bold select-all">{hostUrl}</span>
              <button
                type="button"
                onClick={() => handleCopyLanUrl(hostUrl)}
                title="Copy host URL"
                className="p-1 text-slate-400 hover:text-white rounded transition cursor-pointer"
              >
                {copiedIp ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="text-[11px] text-slate-500 space-y-1">
              <p>
                &bull; Host Port: <span className="font-mono text-slate-700 font-bold">3000</span>
              </p>
              <p>
                &bull; Active Server IPv4:{' '}
                <span className="font-mono text-slate-700 font-bold">
                  {lanIps.join(', ') || '127.0.0.1'}
                </span>
              </p>
            </div>
          </div>

          {/* Database Hot Backup Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <Database className="w-5 h-5 text-emerald-600" />
              <div>
                <h2 className="text-sm font-bold text-slate-900">SQLite Database Hot Backup</h2>
                <p className="text-[11px] text-slate-500">
                  1-click live database snapshot download with WAL consistency
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <div className="flex items-center gap-2 text-slate-700">
                <HardDrive className="w-4 h-4 text-slate-500" />
                <span>Active Database Size:</span>
              </div>
              <span className="font-mono font-bold text-slate-900">{formatBytes(dbSizeBytes)}</span>
            </div>

            {backupSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Backup file downloaded successfully!</span>
              </div>
            )}
            {backupError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{backupError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleDownloadBackup}
              disabled={isBackingUp}
              aria-label="Download SQLite Backup"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isBackingUp ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating Snapshot...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download SQLite Backup</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Staff User Account Manager Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Staff User Accounts</h2>
              <p className="text-[11px] text-slate-500">
                Manage workstation operator roles, credentials, and access statuses
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedUser(null);
              setIsUserModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Staff User</span>
          </button>
        </div>

        {loadingUsers ? (
          <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            <p className="text-xs">Loading user accounts...</p>
          </div>
        ) : usersError ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
            {usersError}
          </div>
        ) : users.length === 0 ? (
          <p className="p-4 text-xs text-slate-400 text-center">No registered staff users found.</p>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Username</th>
                  <th className="px-5 py-3">Full Name</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Last Login</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {users.map((u) => {
                  const isActive = Number(u.is_active) === 1;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3 font-mono font-bold text-slate-900">
                        @{u.username}
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-800">{u.full_name}</td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-500 whitespace-nowrap text-[11px]">
                        {u.last_login_at || 'Never'}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            <span>Inactive</span>
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUser(u);
                            setIsUserModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit className="w-3 h-3" />
                          <span>Edit / Reset Password</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Form Modal */}
      <UserFormModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        onSuccess={() => fetchUsers()}
        user={selectedUser}
      />
    </div>
  );
};

export default SettingsPage;
