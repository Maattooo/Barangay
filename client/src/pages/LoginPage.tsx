import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Building2, KeyRound, User, AlertCircle, Shield, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDemoHelper, setShowDemoHelper] = useState(true);

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
      // Navigation is handled inside login() or triggered by isAuthenticated effect
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid username or password';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutofill = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError(null);
  };

  const demoAccounts = [
    { label: 'Admin (Secretary)', user: 'admin', pass: 'admin123', badgeColor: 'bg-purple-100 text-purple-800 border-purple-200' },
    { label: 'Clerk (Staff)', user: 'clerk', pass: 'clerk123', badgeColor: 'bg-blue-100 text-blue-800 border-blue-200' },
    { label: 'Treasurer', user: 'treasurer', pass: 'treasurer123', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    { label: 'Lupon Tagapamayapa', user: 'lupon', pass: 'lupon123', badgeColor: 'bg-amber-100 text-amber-800 border-amber-200' }
  ];

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header Header & Branding */}
        <div className="bg-slate-800 p-6 text-center text-white border-b border-slate-700">
          <div className="inline-flex p-3 bg-blue-600 rounded-2xl shadow-lg mb-3">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-white">Barangay Management System</h1>
          <p className="text-xs text-slate-300 mt-1">Registry of Inhabitants &amp; Certificate Issuance</p>
          <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Offline Local LAN Workstation
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm animate-fade-in"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
            <div>
              <label htmlFor="username" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
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
                  placeholder="Enter your workstation username"
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your account password"
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-lg shadow transition-colors flex items-center justify-center gap-2 mt-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 text-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Sign In to Workstation</span>
              )}
            </button>
          </form>

          {/* Quick Demo Login Helper */}
          <div className="pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowDemoHelper(!showDemoHelper)}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-600 hover:text-slate-900 py-1 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-blue-600" />
                Quick Demo Login Helper
              </span>
              {showDemoHelper ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showDemoHelper && (
              <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <p className="text-[11px] text-slate-500 leading-tight">
                  Click any seeded account below to autofill credentials for testing:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {demoAccounts.map((acc) => (
                    <button
                      key={acc.user}
                      type="button"
                      aria-label={`Demo ${acc.label}`}
                      onClick={() => handleAutofill(acc.user, acc.pass)}
                      className="p-2 text-left bg-white border border-slate-200 hover:border-blue-400 rounded-md shadow-sm transition-all text-xs group"
                    >
                      <div className="font-semibold text-slate-800 flex items-center justify-between">
                        <span>{acc.user}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded border font-medium ${acc.badgeColor}`}>
                          {acc.label.split(' ')[0]}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">pass: {acc.pass}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 text-center text-[11px] text-slate-500">
          Standalone Embedded Workstation &bull; Host: 0.0.0.0:3000
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
