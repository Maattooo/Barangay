import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Building2, KeyRound, User, AlertCircle, Loader2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already authenticated, redirect to target or dashboard
  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location.state]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError('Please provide both username and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid username or password';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] flex flex-col justify-center items-center p-4 selection:bg-white selection:text-black">
      <div className="w-full max-w-md bg-[#121214] border border-zinc-800 rounded-none shadow-none overflow-hidden">
        {/* Header & Branding */}
        <div className="p-6 text-center border-b border-zinc-800 bg-[#0E0E10]">
          <div className="inline-flex p-3 bg-zinc-800 border border-zinc-700 text-white rounded-none mb-3">
            <Building2 className="w-6 h-6 text-zinc-100" />
          </div>
          <h1 className="text-base font-black tracking-tight text-white uppercase">
            {settings.barangay_name ? `${settings.barangay_name} Operations Portal` : 'Barangay Operations Portal'}
          </h1>
          <p className="text-[11px] font-mono text-zinc-400 mt-0.5 uppercase tracking-wider">
            {settings.municipality_name ? `${settings.municipality_name} • Civil Registry & Document Terminal` : 'Civil Registry & Document Terminal'}
          </p>
          <div className="mt-3 inline-flex items-center gap-2 px-2.5 py-1 text-[10px] font-mono font-medium text-emerald-400 bg-emerald-950/30 border border-emerald-800/60 rounded-none">
            <span className="w-1.5 h-1.5 rounded-none bg-emerald-400 animate-pulse"></span>
            <span className="uppercase tracking-widest">Offline Local LAN Mode</span>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-7 space-y-5">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3 bg-red-950/40 border border-red-800 text-red-200 text-xs font-medium rounded-none"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
            <div>
              <label
                htmlFor="username"
                className="block text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-300 mb-1.5"
              >
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter workstation username"
                  className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-700 rounded-none text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-colors"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-300 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter account password"
                  className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-700 rounded-none text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-white hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 font-bold rounded-none transition-colors flex items-center justify-center gap-2 mt-4 text-xs font-mono uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <span>Sign In to Workstation</span>
              )}
            </button>
          </form>
        </div>

        {/* Footer Info */}
        <div className="px-6 py-2.5 bg-[#0C0C0E] border-t border-zinc-800 text-center text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
          Standalone Embedded Workstation &bull; Port 3000
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
