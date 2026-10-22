import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ResidentsPage from './pages/ResidentsPage';
import CertificatesPage from './pages/CertificatesPage';
import NewCertificatePage from './pages/NewCertificatePage';
import BlotterPage from './pages/BlotterPage';
import NewBlotterPage from './pages/NewBlotterPage';
import OfficialsPage from './pages/OfficialsPage';
import TemplatesPage from './pages/TemplatesPage';
import AuditLogsPage from './pages/AuditLogsPage';
import SettingsPage from './pages/SettingsPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import NotFoundPage from './pages/NotFoundPage';
import { Loader2 } from 'lucide-react';

export const RootRedirect: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Root redirect */}
      <Route path="/" element={<RootRedirect />} />

      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* Protected Routes framed in MainLayout */}
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          {/* Accessible to all authenticated roles (Admin, Clerk, Treasurer, Lupon) */}
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/residents" element={<ResidentsPage />} />

          {/* Accessible to Admin, Clerk, Treasurer */}
          <Route element={<ProtectedRoute allowedRoles={['Admin', 'Clerk', 'Treasurer']} />}>
            <Route path="/certificates" element={<CertificatesPage />} />
            <Route path="/certificates/new" element={<NewCertificatePage />} />
          </Route>

          {/* Accessible to Admin, Lupon */}
          <Route element={<ProtectedRoute allowedRoles={['Admin', 'Lupon']} />}>
            <Route path="/blotter" element={<BlotterPage />} />
            <Route path="/blotter/new" element={<NewBlotterPage />} />
          </Route>

          {/* Accessible strictly to Admin */}
          <Route element={<ProtectedRoute allowedRoles={['Admin']} />}>
            <Route path="/officials" element={<OfficialsPage />} />
            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/audit-logs" element={<AuditLogsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Route>

      {/* Fallback 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
