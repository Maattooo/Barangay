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
  Check,
  MapPin,
  Info
} from 'lucide-react';
import api from '../services/api';
import { useSettings } from '../context/SettingsContext';
import { UserAccount } from '../types/admin';
import UserFormModal from '../components/settings/UserFormModal';

export const SettingsPage: React.FC = () => {
  const { updateSettings } = useSettings();

  // System Info & Settings
  const [lanIps, setLanIps] = useState<string[]>([]);
  const [dbSizeBytes, setDbSizeBytes] = useState<number>(0);

  // Barangay Metadata Form fields
  const [barangayName, setBarangayName] = useState('');
  const [municipalityName, setMunicipalityName] = useState('');
  const [provinceName, setProvinceName] = useState('');
  const [regionName, setRegionName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [barangayLogoUrl, setBarangayLogoUrl] = useState('');
  const [cityLogoUrl, setCityLogoUrl] = useState('');
  const [barangaySealMeta, setBarangaySealMeta] = useState<{ sizeStr: string; dims: string } | null>(null);
  const [citySealMeta, setCitySealMeta] = useState<{ sizeStr: string; dims: string } | null>(null);
  const [sealValidationError, setSealValidationError] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Territory (Puroks & Streets) State
  const [puroksList, setPuroksList] = useState<string[]>([
    'Purok 1',
    'Purok 2',
    'Purok 3',
    'Purok 4',
    'Sitio Centro',
    'Sitio Riverside'
  ]);
  const [newPurok, setNewPurok] = useState('');
  const [streetsList, setStreetsList] = useState<string[]>([
    'Rizal St.',
    'Bonifacio St.',
    'Mabini St.',
    'Dahlia St.',
    'Riverside Ave.',
    'Sampaguita St.'
  ]);
  const [newStreet, setNewStreet] = useState('');
  const [savingTerritory, setSavingTerritory] = useState(false);
  const [territorySaved, setTerritorySaved] = useState(false);
  const [territoryError, setTerritoryError] = useState<string | null>(null);

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
      if (s.barangay_logo_url) setBarangayLogoUrl(s.barangay_logo_url as string);
      if (s.city_logo_url) setCityLogoUrl(s.city_logo_url as string);

      if (s.puroks_json) {
        try {
          const parsed = JSON.parse(s.puroks_json as string);
          if (Array.isArray(parsed) && parsed.length > 0) setPuroksList(parsed);
        } catch {}
      }
      if (s.streets_json) {
        try {
          const parsed = JSON.parse(s.streets_json as string);
          if (Array.isArray(parsed) && parsed.length > 0) setStreetsList(parsed);
        } catch {}
      }
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
      contact_email: contactEmail.trim(),
      barangay_logo_url: barangayLogoUrl,
      city_logo_url: cityLogoUrl,
      puroks_json: JSON.stringify(puroksList),
      streets_json: JSON.stringify(streetsList)
    };

    try {
      await updateSettings(payload);

      // Auto-sync letterhead across certificate and blotter templates with the new metadata and seals
      const updatedHeaderConfig = {
        showLeftSeal: true,
        showRightSeal: true,
        sealSizePx: 64,
        borderStyle: 'double',
        alignment: 'center',
        barangayLogoUrl: barangayLogoUrl,
        cityLogoUrl: cityLogoUrl
      };
      const updatedHeaderHtml = `<p style="margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Republic of the Philippines</p>
<p style="margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Province of {{province_name}}</p>
<p style="margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">City of {{municipality_name}}</p>
<h2 style="font-size: 16px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; margin: 4px 0 2px 0;">BARANGAY {{barangay_name}}</h2>
<p style="margin: 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">OFFICE OF THE PUNONG BARANGAY</p>`;

      try {
        await api.syncHeaderAcrossTemplates({
          header_html: updatedHeaderHtml,
          header_config_json: JSON.stringify(updatedHeaderConfig)
        });
      } catch {
        // Non-blocking sync fallback
      }

      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 5000);
    } catch (err: any) {
      setSettingsError(err?.message || 'Settings update acknowledged.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Handle Save Territory
  const handleSaveTerritory = async () => {
    setSavingTerritory(true);
    setTerritorySaved(false);
    setTerritoryError(null);

    const payload: Record<string, string> = {
      puroks_json: JSON.stringify(puroksList),
      streets_json: JSON.stringify(streetsList)
    };

    try {
      await api.updateSystemSettings(payload);
      setTerritorySaved(true);
      setTimeout(() => setTerritorySaved(false), 4000);
    } catch (err: any) {
      setTerritoryError(err?.message || 'Failed to save territory registry.');
    } finally {
      setSavingTerritory(false);
    }
  };

  const handleAddPurok = () => {
    const trimmed = newPurok.trim();
    if (!trimmed) return;
    if (!puroksList.includes(trimmed)) {
      setPuroksList([...puroksList, trimmed]);
    }
    setNewPurok('');
  };

  const handleRemovePurok = (purokToRemove: string) => {
    setPuroksList(puroksList.filter((p) => p !== purokToRemove));
  };

  const handleAddStreet = () => {
    const trimmed = newStreet.trim();
    if (!trimmed) return;
    if (!streetsList.includes(trimmed)) {
      setStreetsList([...streetsList, trimmed]);
    }
    setNewStreet('');
  };

  const handleRemoveStreet = (streetToRemove: string) => {
    setStreetsList(streetsList.filter((s) => s !== streetToRemove));
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'barangay' | 'city') => {
    setSealValidationError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Allowed image formats: PNG, SVG, JPG, WEBP
    const validExtensions = /\.(png|jpe?g|webp|svg)$/i;
    const isImageMime = file.type.startsWith('image/');

    if (!isImageMime && !validExtensions.test(file.name)) {
      setSealValidationError(
        `Invalid file "${file.name}". Acceptable seal formats: PNG, SVG, JPG, or WEBP.`
      );
      e.target.value = '';
      return;
    }

    // Maximum file size limit: 2 MB
    const maxSizeBytes = 2 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      setSealValidationError(
        `File "${file.name}" exceeds the 2 MB limit (${sizeMb} MB). Please compress or choose a file under 2 MB.`
      );
      e.target.value = '';
      return;
    }

    const sizeKb = Math.round(file.size / 1024);
    const sizeStr = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(2)} MB` : `${sizeKb} KB`;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const dataUrl = loadEvent.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const meta = { sizeStr, dims: `${img.naturalWidth}×${img.naturalHeight}px` };
        if (type === 'barangay') {
          setBarangayLogoUrl(dataUrl);
          setBarangaySealMeta(meta);
        } else {
          setCityLogoUrl(dataUrl);
          setCitySealMeta(meta);
        }
      };
      img.onerror = () => {
        const meta = { sizeStr, dims: 'Vector/Custom' };
        if (type === 'barangay') {
          setBarangayLogoUrl(dataUrl);
          setBarangaySealMeta(meta);
        } else {
          setCityLogoUrl(dataUrl);
          setCitySealMeta(meta);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
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
    <div className="space-y-4">
      {/* Header Card */}
      <div className="bg-white p-4 sm:p-5 rounded-none border border-zinc-200 shadow-none flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-zinc-100 text-zinc-800 rounded-none border border-zinc-200">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-zinc-950 uppercase tracking-tight">
              System Settings &amp; Maintenance
            </h1>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">
              Barangay header metadata, multi-desk LAN networking, user security, and hot backups
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 1. Barangay Metadata Card */}
        <div className="bg-white p-4 sm:p-5 rounded-none border border-zinc-200 shadow-none space-y-4">
          <div className="flex items-center gap-2.5 pb-2.5 border-b border-zinc-200">
            <Settings className="w-4 h-4 text-zinc-800" />
            <div>
              <h2 className="text-sm font-bold text-zinc-950 uppercase tracking-tight">Barangay Metadata</h2>
              <p className="text-[11px] text-zinc-500 font-mono">
                Official names displayed on certificate letterheads and clearances
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-3 font-mono text-xs">
            {settingsSaved && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-none text-xs text-emerald-800 font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Barangay metadata saved and letterheads synchronized across all print templates!</span>
              </div>
            )}
            {settingsError && (
              <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-none text-xs text-amber-800 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{settingsError}</span>
              </div>
            )}
            {sealValidationError && (
              <div className="p-2.5 bg-red-50 border border-red-300 rounded-none text-xs text-red-800 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{sealValidationError}</span>
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="barangay_name" className="block text-xs font-semibold uppercase text-zinc-700">
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
                className="w-full px-3 py-1.5 text-xs font-sans border border-zinc-300 rounded-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="municipality_name"
                  className="block text-xs font-semibold uppercase text-zinc-700"
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
                  className="w-full px-3 py-1.5 text-xs font-sans border border-zinc-300 rounded-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="province_name" className="block text-xs font-semibold uppercase text-zinc-700">
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
                  className="w-full px-3 py-1.5 text-xs font-sans border border-zinc-300 rounded-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="region_name" className="block text-xs font-semibold uppercase text-zinc-700">
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
                  className="w-full px-3 py-1.5 text-xs font-sans border border-zinc-300 rounded-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="contact_email" className="block text-xs font-semibold uppercase text-zinc-700">
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
                  className="w-full px-3 py-1.5 text-xs font-sans border border-zinc-300 rounded-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors"
                />
              </div>
            </div>

            {/* Official Logos / Seals */}
            <div className="pt-2 border-t border-zinc-200 space-y-2">
              <span className="block text-xs font-semibold uppercase text-zinc-700">
                Official Letterhead Seals &amp; Logos
              </span>

              {/* Specifications Card */}
              <div className="p-2.5 bg-zinc-50 border border-zinc-200 text-zinc-600 text-[11px] font-mono flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-zinc-800 uppercase tracking-tight">Accepted Seal Specifications</p>
                  <p className="text-[10px] text-zinc-500">
                    Formats: <span className="text-zinc-800 font-semibold">PNG, SVG, JPG, WEBP</span> &bull; Max Size: <span className="text-zinc-800 font-semibold">2 MB</span> &bull; Recommended: <span className="text-zinc-800 font-semibold">Transparent PNG (512&times;512px to 1024&times;1024px, 1:1 square)</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Barangay Seal */}
                <div className="p-2.5 border border-zinc-200 bg-zinc-50 rounded-none space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase text-zinc-700">Barangay Seal</span>
                    {barangayLogoUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setBarangayLogoUrl('');
                          setBarangaySealMeta(null);
                        }}
                        className="text-[10px] text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {barangayLogoUrl ? (
                    <div className="flex items-center gap-2.5">
                      <div className="w-12 h-12 border border-zinc-300 bg-white p-0.5 flex items-center justify-center shrink-0">
                        <img
                          src={barangayLogoUrl}
                          alt="Barangay Seal Preview"
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                      <div className="space-y-0.5 overflow-hidden">
                        <div className="text-[10px] text-emerald-700 font-mono font-medium">Custom Seal Active</div>
                        {barangaySealMeta ? (
                          <div className="text-[10px] text-zinc-500 font-mono">
                            {barangaySealMeta.dims} &bull; {barangaySealMeta.sizeStr}
                          </div>
                        ) : (
                          <div className="text-[10px] text-zinc-400 font-mono">Loaded from Settings</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] text-zinc-400 font-mono">Default Circular Seal</div>
                  )}
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={(e) => handleImageFileChange(e, 'barangay')}
                    className="block w-full text-[10px] text-zinc-600 file:mr-2 file:py-1 file:px-2 file:rounded-none file:border file:border-zinc-300 file:text-[10px] file:bg-white file:text-zinc-800 hover:file:bg-zinc-100 cursor-pointer"
                  />
                </div>

                {/* City / Municipal Seal */}
                <div className="p-2.5 border border-zinc-200 bg-zinc-50 rounded-none space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase text-zinc-700">City / Municipal Seal</span>
                    {cityLogoUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setCityLogoUrl('');
                          setCitySealMeta(null);
                        }}
                        className="text-[10px] text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {cityLogoUrl ? (
                    <div className="flex items-center gap-2.5">
                      <div className="w-12 h-12 border border-zinc-300 bg-white p-0.5 flex items-center justify-center shrink-0">
                        <img
                          src={cityLogoUrl}
                          alt="City Seal Preview"
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                      <div className="space-y-0.5 overflow-hidden">
                        <div className="text-[10px] text-emerald-700 font-mono font-medium">Custom Seal Active</div>
                        {citySealMeta ? (
                          <div className="text-[10px] text-zinc-500 font-mono">
                            {citySealMeta.dims} &bull; {citySealMeta.sizeStr}
                          </div>
                        ) : (
                          <div className="text-[10px] text-zinc-400 font-mono">Loaded from Settings</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] text-zinc-400 font-mono">Default Circular Seal</div>
                  )}
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={(e) => handleImageFileChange(e, 'city')}
                    className="block w-full text-[10px] text-zinc-600 file:mr-2 file:py-1 file:px-2 file:rounded-none file:border file:border-zinc-300 file:text-[10px] file:bg-white file:text-zinc-800 hover:file:bg-zinc-100 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-none bg-zinc-900 hover:bg-black text-white text-xs font-mono font-semibold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer shadow-none"
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

        {/* 2. Barangay Territory: Puroks & Official Streets Card */}
        <div className="bg-white p-4 sm:p-5 rounded-none border border-zinc-200 shadow-none space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-zinc-200">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-zinc-100 text-zinc-800 rounded-none border border-zinc-200">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-zinc-950 uppercase tracking-tight">
                  Barangay Territory &amp; Street Registry
                </h2>
                <p className="text-[11px] text-zinc-500 font-mono">
                  Manage registered Puroks/Sitios and official Streets for RBI registration &amp; blotter linkage
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveTerritory}
              disabled={savingTerritory}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-none bg-zinc-900 hover:bg-black text-white text-xs font-mono font-semibold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer shadow-none self-start sm:self-auto"
            >
              {savingTerritory ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Territory Registry</span>
              )}
            </button>
          </div>

          {territorySaved && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-none text-xs text-emerald-800 font-mono font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Territory directory updated successfully!</span>
            </div>
          )}

          {territoryError && (
            <div className="p-2.5 bg-red-50 border border-red-300 rounded-none text-xs text-red-800 font-mono font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{territoryError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Puroks / Sitios Column */}
            <div className="space-y-2.5 border border-zinc-200 p-3 bg-zinc-50/50 rounded-none">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono uppercase text-zinc-900">
                  Puroks &amp; Sitios ({puroksList.length})
                </span>
              </div>

              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newPurok}
                  onChange={(e) => setNewPurok(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddPurok();
                    }
                  }}
                  placeholder="New Purok / Sitio name..."
                  className="flex-1 px-2.5 py-1 text-xs font-sans border border-zinc-300 rounded-none focus:ring-1 focus:ring-zinc-900 bg-white"
                />
                <button
                  type="button"
                  onClick={handleAddPurok}
                  className="px-3 py-1 bg-zinc-900 hover:bg-black text-white text-xs font-mono font-semibold uppercase rounded-none transition-colors"
                >
                  + Add
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pt-1">
                {puroksList.map((purok) => (
                  <span
                    key={purok}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium bg-white text-zinc-900 border border-zinc-300 rounded-none"
                  >
                    <span>{purok}</span>
                    <button
                      type="button"
                      onClick={() => handleRemovePurok(purok)}
                      className="text-zinc-400 hover:text-red-600 transition-colors font-bold"
                      title={`Remove ${purok}`}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Streets Column */}
            <div className="space-y-2.5 border border-zinc-200 p-3 bg-zinc-50/50 rounded-none">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono uppercase text-zinc-900">
                  Official Streets &amp; Roads ({streetsList.length})
                </span>
              </div>

              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newStreet}
                  onChange={(e) => setNewStreet(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddStreet();
                    }
                  }}
                  placeholder="New Street / Avenue / Alley..."
                  className="flex-1 px-2.5 py-1 text-xs font-sans border border-zinc-300 rounded-none focus:ring-1 focus:ring-zinc-900 bg-white"
                />
                <button
                  type="button"
                  onClick={handleAddStreet}
                  className="px-3 py-1 bg-zinc-900 hover:bg-black text-white text-xs font-mono font-semibold uppercase rounded-none transition-colors"
                >
                  + Add
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pt-1">
                {streetsList.map((street) => (
                  <span
                    key={street}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium bg-white text-zinc-900 border border-zinc-300 rounded-none"
                  >
                    <span>{street}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveStreet(street)}
                      className="text-zinc-400 hover:text-red-600 transition-colors font-bold"
                      title={`Remove ${street}`}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Multi-Desk LAN Instructions & Database Hot Backup */}
        <div className="space-y-4">
          {/* Multi-Desk LAN Instructions Card */}
          <div className="bg-white p-4 sm:p-5 rounded-none border border-zinc-200 shadow-none space-y-3">
            <div className="flex items-center gap-2.5 pb-2.5 border-b border-zinc-200">
              <Network className="w-4 h-4 text-zinc-800" />
              <div>
                <h2 className="text-sm font-bold text-zinc-950 uppercase tracking-tight">Multi-Desk LAN Connection</h2>
                <p className="text-[11px] text-zinc-500 font-mono">
                  Connect other barangay workstations without internet access
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed font-mono">
              Open Chrome or Edge on any computer connected to the same Barangay Hall Wi-Fi and navigate to:
            </p>

            <div className="flex items-center gap-2 p-2.5 bg-zinc-900 rounded-none text-zinc-100 font-mono text-xs justify-between border border-zinc-800">
              <span className="font-bold select-all">{hostUrl}</span>
              <button
                type="button"
                onClick={() => handleCopyLanUrl(hostUrl)}
                title="Copy host URL"
                className="p-1 text-zinc-400 hover:text-white rounded-none transition-colors cursor-pointer"
              >
                {copiedIp ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="text-[11px] text-zinc-500 font-mono space-y-0.5">
              <p>
                &bull; Host Port: <span className="font-mono text-zinc-900 font-bold">3000</span>
              </p>
              <p>
                &bull; Active Server IPv4:{' '}
                <span className="font-mono text-zinc-900 font-bold">
                  {lanIps.join(', ') || '127.0.0.1'}
                </span>
              </p>
            </div>
          </div>

          {/* Database Hot Backup Card */}
          <div className="bg-white p-4 sm:p-5 rounded-none border border-zinc-200 shadow-none space-y-3">
            <div className="flex items-center gap-2.5 pb-2.5 border-b border-zinc-200">
              <Database className="w-4 h-4 text-zinc-800" />
              <div>
                <h2 className="text-sm font-bold text-zinc-950 uppercase tracking-tight">SQLite Database Hot Backup</h2>
                <p className="text-[11px] text-zinc-500 font-mono">
                  1-click live database snapshot download with WAL consistency
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-zinc-50 border border-zinc-200 rounded-none text-xs font-mono">
              <div className="flex items-center gap-2 text-zinc-700">
                <HardDrive className="w-3.5 h-3.5 text-zinc-500" />
                <span>Active Database Size:</span>
              </div>
              <span className="font-bold text-zinc-950">{formatBytes(dbSizeBytes)}</span>
            </div>

            {backupSuccess && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-none text-xs text-emerald-800 font-mono font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Backup file downloaded successfully!</span>
              </div>
            )}
            {backupError && (
              <div className="p-2.5 bg-red-50 border border-red-300 rounded-none text-xs text-red-800 font-mono font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{backupError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleDownloadBackup}
              disabled={isBackingUp}
              aria-label="Download SQLite Backup"
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-none bg-zinc-900 hover:bg-black text-white text-xs font-mono font-semibold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer shadow-none"
            >
              {isBackingUp ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating Snapshot...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download SQLite Backup</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Staff User Account Manager Card */}
      <div className="bg-white rounded-none border border-zinc-200 shadow-none overflow-hidden p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2.5 border-b border-zinc-200">
          <div className="flex items-center gap-2.5">
            <Users className="w-4 h-4 text-zinc-800" />
            <div>
              <h2 className="text-sm font-bold text-zinc-950 uppercase tracking-tight">Staff User Accounts</h2>
              <p className="text-[11px] text-zinc-500 font-mono">
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
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-none bg-zinc-900 hover:bg-black text-white text-xs font-mono font-semibold uppercase tracking-wider transition-colors cursor-pointer shadow-none"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Staff User</span>
          </button>
        </div>

        {loadingUsers ? (
          <div className="p-8 text-center text-zinc-500 font-mono flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 text-zinc-600 animate-spin" />
            <p className="text-xs">Loading user accounts...</p>
          </div>
        ) : usersError ? (
          <div className="p-3 bg-red-50 border border-red-200 rounded-none text-xs font-mono text-red-800">
            {usersError}
          </div>
        ) : users.length === 0 ? (
          <p className="p-4 text-xs font-mono text-zinc-400 text-center">No registered staff users found.</p>
        ) : (
          <div className="overflow-x-auto border border-zinc-200 rounded-none">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-700 uppercase tracking-wider font-mono font-semibold border-b border-zinc-200 text-[11px]">
                <tr>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Full Name</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Last Login</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-900 font-sans">
                {users.map((u) => {
                  const isActive = Number(u.is_active) === 1;
                  return (
                    <tr key={u.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-zinc-950">
                        @{u.username}
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-900">{u.full_name}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-none text-[10px] font-mono font-bold uppercase bg-zinc-100 text-zinc-800 border border-zinc-200">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 whitespace-nowrap font-mono text-[11px]">
                        {u.last_login_at || 'Never'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase text-emerald-800">
                            <span className="w-1.5 h-1.5 bg-emerald-600" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase text-zinc-500">
                            <span className="w-1.5 h-1.5 bg-zinc-400" />
                            <span>Inactive</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUser(u);
                            setIsUserModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-medium uppercase tracking-wider text-zinc-800 bg-white hover:bg-zinc-100 border border-zinc-300 rounded-none transition-colors cursor-pointer"
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
