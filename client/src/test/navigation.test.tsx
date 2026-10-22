import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { AppRoutes } from '../App';
import Sidebar from '../components/layout/Sidebar';
import Topbar from '../components/layout/Topbar';
import api from '../services/api';
import { UserRole } from '../types/auth';

const mockUserWithRole = (role: UserRole) => ({
  id: 10,
  username: role.toLowerCase(),
  full_name: `${role} Officer`,
  role,
  official_id: 1
});

describe('Navigation, RBAC Guards & Shell Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    api.setToken(null);
  });

  describe('2. Protected Route Navigation & RBAC Enforcement', () => {
    it('Unauthenticated attempt to access /dashboard or /residents immediately redirects to /login', async () => {
      // Unauthenticated response
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes('/api/auth/me')) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </MemoryRouter>
      );

      // Should be redirected to /login
      await waitFor(() => {
        expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /sign in to workstation/i })).toBeInTheDocument();
      });

      // Test with /residents as well
      const { unmount } = render(
        <MemoryRouter initialEntries={['/residents']}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByLabelText(/username/i)[0]).toBeInTheDocument();
      });
      unmount();
    });

    it('Authenticated Clerk attempting to navigate to /officials, /templates, or /audit-logs is blocked and presented with Access Denied', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes('/api/auth/me')) {
          return new Response(JSON.stringify({ user: mockUserWithRole('Clerk') }), { status: 200 });
        }
        if (url.includes('/api/system/info')) {
          return new Response(
            JSON.stringify({ lan_ips: ['192.168.1.10'], settings: { barangay_name: 'Test Barangay' } }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });

      // Try /officials
      const { unmount: unmount1 } = render(
        <MemoryRouter initialEntries={['/officials']}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/access denied/i)).toBeInTheDocument();
      });
      unmount1();

      // Try /templates
      const { unmount: unmount2 } = render(
        <MemoryRouter initialEntries={['/templates']}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/access denied/i)).toBeInTheDocument();
      });
      unmount2();

      // Try /audit-logs
      const { unmount: unmount3 } = render(
        <MemoryRouter initialEntries={['/audit-logs']}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/access denied/i)).toBeInTheDocument();
      });
      unmount3();
    });

    it('Authenticated Lupon attempting to navigate to /certificates is blocked and presented with Access Denied', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes('/api/auth/me')) {
          return new Response(JSON.stringify({ user: mockUserWithRole('Lupon') }), { status: 200 });
        }
        if (url.includes('/api/system/info')) {
          return new Response(
            JSON.stringify({ lan_ips: ['192.168.1.10'], settings: { barangay_name: 'Test Barangay' } }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });

      const { unmount } = render(
        <MemoryRouter initialEntries={['/certificates']}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/access denied/i)).toBeInTheDocument();
      });
      unmount();
    });

    it('Defensive Null-Role Guard: Authenticated user with null role attempting to navigate to Admin route is blocked and redirected to /unauthorized', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes('/api/auth/me')) {
          return new Response(
            JSON.stringify({
              user: {
                id: 99,
                username: 'noroleuser',
                full_name: 'No Role User',
                role: null,
                official_id: null
              }
            }),
            { status: 200 }
          );
        }
        if (url.includes('/api/system/info')) {
          return new Response(
            JSON.stringify({ lan_ips: ['192.168.1.10'], settings: { barangay_name: 'Test Barangay' } }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });

      const { unmount } = render(
        <MemoryRouter initialEntries={['/officials']}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/access denied/i)).toBeInTheDocument();
      });
      expect(screen.queryByRole('heading', { name: /barangay officials roster/i })).not.toBeInTheDocument();
      unmount();
    });

    it('Authenticated Admin can successfully access all route trees', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes('/api/auth/me')) {
          return new Response(JSON.stringify({ user: mockUserWithRole('Admin') }), { status: 200 });
        }
        if (url.includes('/api/system/info')) {
          return new Response(
            JSON.stringify({ lan_ips: ['192.168.1.10'], settings: { barangay_name: 'Barangay San Jose' } }),
            { status: 200 }
          );
        }
        if (url.includes('/api/residents/stats')) {
          return new Response(
            JSON.stringify({
              total_residents: 100,
              seniors: 10,
              pwds: 5,
              four_ps: 2,
              voters: 80,
              active_blotters: 0,
              purok_counts: {}
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify([]), { status: 200 });
      });

      // Admin accesses /officials
      const { unmount: u1 } = render(
        <MemoryRouter initialEntries={['/officials']}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </MemoryRouter>
      );
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /barangay officials roster/i })).toBeInTheDocument();
      });
      u1();

      // Admin accesses /templates
      const { unmount: u2 } = render(
        <MemoryRouter initialEntries={['/templates']}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </MemoryRouter>
      );
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /certificate templates/i })).toBeInTheDocument();
      });
      u2();

      // Admin accesses /audit-logs
      const { unmount: u3 } = render(
        <MemoryRouter initialEntries={['/audit-logs']}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </MemoryRouter>
      );
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /transparency audit trail/i })).toBeInTheDocument();
      });
      u3();

      // Admin accesses /certificates
      const { unmount: u4 } = render(
        <MemoryRouter initialEntries={['/certificates']}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </MemoryRouter>
      );
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /certificate issuance/i })).toBeInTheDocument();
      });
      u4();

      // Admin accesses /blotter
      const { unmount: u5 } = render(
        <MemoryRouter initialEntries={['/blotter']}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </MemoryRouter>
      );
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /blotter records/i })).toBeInTheDocument();
      });
      u5();
    });
  });

  describe('3. Role-Aware Sidebar Link Filtering', () => {
    const setupSidebarForRole = async (role: UserRole) => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes('/api/auth/me')) {
          return new Response(JSON.stringify({ user: mockUserWithRole(role) }), { status: 200 });
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });

      render(
        <MemoryRouter>
          <AuthProvider>
            <Sidebar />
          </AuthProvider>
        </MemoryRouter>
      );

      // Wait for auth to settle
      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
      });
    };

    it('When user role is Admin: Assert Dashboard, Residents, Certificates, Blotter, Officials, Templates, Audit Logs, and Settings links are visible', async () => {
      await setupSidebarForRole('Admin');

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Residents')).toBeInTheDocument();
      expect(screen.getByText('Certificates')).toBeInTheDocument();
      expect(screen.getByText('Blotter')).toBeInTheDocument();
      expect(screen.getByText('Officials')).toBeInTheDocument();
      expect(screen.getByText('Templates')).toBeInTheDocument();
      expect(screen.getByText('Audit Logs')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('When user role is Clerk: Assert Dashboard, Residents, and Certificates links are visible; Blotter, Officials, Templates, Audit Logs, and Settings links are NOT rendered', async () => {
      await setupSidebarForRole('Clerk');

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Residents')).toBeInTheDocument();
      expect(screen.getByText('Certificates')).toBeInTheDocument();

      expect(screen.queryByText('Blotter')).not.toBeInTheDocument();
      expect(screen.queryByText('Officials')).not.toBeInTheDocument();
      expect(screen.queryByText('Templates')).not.toBeInTheDocument();
      expect(screen.queryByText('Audit Logs')).not.toBeInTheDocument();
      expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    });

    it('When user role is Treasurer: Assert Dashboard, Residents, and Certificates links are visible; Blotter, Officials, Templates, Audit Logs, and Settings links are NOT rendered', async () => {
      await setupSidebarForRole('Treasurer');

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Residents')).toBeInTheDocument();
      expect(screen.getByText('Certificates')).toBeInTheDocument();

      expect(screen.queryByText('Blotter')).not.toBeInTheDocument();
      expect(screen.queryByText('Officials')).not.toBeInTheDocument();
      expect(screen.queryByText('Templates')).not.toBeInTheDocument();
      expect(screen.queryByText('Audit Logs')).not.toBeInTheDocument();
      expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    });

    it('When user role is Lupon: Assert Dashboard, Residents, and Blotter links are visible; Certificates, Officials, Templates, Audit Logs, and Settings links are NOT rendered', async () => {
      await setupSidebarForRole('Lupon');

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Residents')).toBeInTheDocument();
      expect(screen.getByText('Blotter')).toBeInTheDocument();

      expect(screen.queryByText('Certificates')).not.toBeInTheDocument();
      expect(screen.queryByText('Officials')).not.toBeInTheDocument();
      expect(screen.queryByText('Templates')).not.toBeInTheDocument();
      expect(screen.queryByText('Audit Logs')).not.toBeInTheDocument();
      expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    });
  });

  describe('4. Topbar LAN IP Badge Rendering', () => {
    it('Mock GET /api/system/info returning { lan_ips: ["192.168.1.50"], settings: { barangay_name: "Barangay San Jose" } } and verify rendering', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes('/api/auth/me')) {
          return new Response(JSON.stringify({ user: mockUserWithRole('Admin') }), { status: 200 });
        }
        if (url.includes('/api/system/info')) {
          return new Response(
            JSON.stringify({
              lan_ips: ['192.168.1.50'],
              db_size_bytes: 40960,
              settings: {
                barangay_name: 'Barangay San Jose'
              }
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });

      render(
        <MemoryRouter>
          <AuthProvider>
            <Topbar />
          </AuthProvider>
        </MemoryRouter>
      );

      // Assert Topbar displays Host: http://192.168.1.50:3000
      await waitFor(() => {
        expect(screen.getByText(/host: http:\/\/192\.168\.1\.50:3000/i)).toBeInTheDocument();
      });

      // Assert Topbar displays Barangay branding "Barangay San Jose"
      expect(screen.getByText('Barangay San Jose')).toBeInTheDocument();

      // Assert user role badge renders with correct label and color theme
      const roleBadge = screen.getByTestId('user-role-badge');
      expect(roleBadge).toHaveTextContent(/admin/i);
      expect(roleBadge).toHaveClass('bg-purple-100');
      expect(roleBadge).toHaveClass('text-purple-800');
    });
  });
});
