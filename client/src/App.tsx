import { useEffect, useState } from 'react';
import { Building2, ShieldCheck, Wifi, HardDrive, Server, CheckCircle2, Activity, RefreshCw } from 'lucide-react';

interface HealthData {
  status: string;
  timestamp: string;
}

export function App() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/health');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data: HealthData = await res.json();
      setHealth(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to connect to backend server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      {/* Header Bar */}
      <header className="bg-slate-900 text-white shadow-md border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-lg shadow-sm">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Barangay Management System</h1>
              <p className="text-xs text-slate-300">Registry of Barangay Inhabitants & Certificate Issuance System</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Offline / Local LAN Ready
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
              <Server className="w-3.5 h-3.5" />
              Port: 3000
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full space-y-8">
        {/* Banner Section */}
        <section className="bg-white rounded-xl border border-slate-300 p-6 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900">
                Phase 01: Project Scaffolding & Infrastructure
              </h2>
              <p className="text-slate-600 text-sm max-w-2xl leading-relaxed">
                The core monorepo foundation is operational. Express backend is bound to <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs font-mono font-bold text-slate-800">0.0.0.0:3000</code>,
                Vite React SPA is bundled offline with zero CDN dependencies, and Tailwind utility styling is active.
              </p>
            </div>

            {/* Health Status Card */}
            <div className="bg-slate-50 border border-slate-300 rounded-lg p-4 min-w-[280px] shadow-inner">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-blue-600" />
                  API Health Status
                </span>
                <button
                  onClick={fetchHealth}
                  disabled={loading}
                  className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors"
                  title="Refresh status"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {loading ? (
                <p className="text-xs text-slate-500">Checking /api/health...</p>
              ) : error ? (
                <div className="text-xs text-red-600 font-medium">
                  <span>Backend unreachable:</span>
                  <div className="font-mono text-[11px] mt-0.5">{error}</div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Status: {health?.status}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Time: {health?.timestamp}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="bg-white rounded-xl border border-slate-300 p-5 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Wifi className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Multi-Desk Local LAN</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Express binds to <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">0.0.0.0:3000</code>. Staff across the barangay hall can access the system via local IP with zero client-side installation.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-white rounded-xl border border-slate-300 p-5 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <HardDrive className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">SQLite WAL Resilience</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Single-file database storage in <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">data/</code> configured with Write-Ahead Logging (WAL) for brownout and power-loss resilience.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-white rounded-xl border border-slate-300 p-5 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">100% Offline Asset Delivery</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              All styles, icons, and fonts are compiled directly into static bundles. No internet access or external CDN connections required.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-300 py-4 text-center text-xs text-slate-500">
        Barangay Management &amp; Certificate Issuance System &bull; Local Host Mode &bull; Express + React + Tailwind
      </footer>
    </div>
  );
}

export default App;
