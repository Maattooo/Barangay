import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import DashboardPage from '../pages/DashboardPage';
import api from '../services/api';
import { UserRole } from '../types/auth';

const mockUserWithRole = (role: UserRole) => ({
  id: 10,
  username: role.toLowerCase(),
  full_name: `${role} Officer`,
  role,
  official_id: 1
});

describe('Dashboard Statistics & Quick Action Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    api.setToken(null);
  });

  describe('5. Dashboard Statistics Metric Cards', () => {
    it('Mock GET /api/residents/stats and assert all metric cards and purok distribution render accurately', async () => {
      const mockStatsPayload = {
        total_residents: 1250,
        seniors: 180,
        pwds: 45,
        four_ps: 92,
        voters: 850,
        active_blotters: 3,
        solo_parents: 30,
        indigents: 150,
        youth: 310,
        minors: 290,
        ofw: 25,
        osy: 12,
        purok_counts: [{ purok: 'Purok 1', count: 400 }]
      };

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes('/api/auth/me')) {
          return new Response(JSON.stringify({ user: mockUserWithRole('Admin') }), { status: 200 });
        }
        if (url.includes('/api/residents/stats')) {
          return new Response(JSON.stringify(mockStatsPayload), { status: 200 });
        }
        if (url.includes('/api/issuances')) {
          return new Response(JSON.stringify({ issuances: [] }), { status: 200 });
        }
        if (url.includes('/api/blotter')) {
          return new Response(JSON.stringify({ records: [] }), { status: 200 });
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider>
            <DashboardPage />
          </AuthProvider>
        </MemoryRouter>
      );

      // 1. Assert Total Population card displays 1,250
      await waitFor(() => {
        expect(screen.getByTestId('metric-total-residents')).toHaveTextContent('1,250');
      });

      // 2. Assert Senior Citizens card displays 180
      expect(screen.getByTestId('metric-seniors')).toHaveTextContent('180');

      // 3. Assert PWD card displays 45
      expect(screen.getByTestId('metric-pwds')).toHaveTextContent('45');

      // 4. Assert 4Ps Beneficiaries card displays 92
      expect(screen.getByTestId('metric-four-ps')).toHaveTextContent('92');

      // 5. Assert Registered Voters card displays 850
      expect(screen.getByTestId('metric-voters')).toHaveTextContent('850');

      // 6. Assert Active Blotter Cases card displays 3
      expect(screen.getByTestId('metric-active-blotters')).toHaveTextContent('3');

      // 7. Assert Purok distribution widget renders Purok 1 with count 400
      const purokWidget = screen.getByTestId('purok-distribution');
      expect(purokWidget).toBeInTheDocument();
      expect(purokWidget).toHaveTextContent('Purok 1');
      expect(purokWidget).toHaveTextContent('400');
    });

    it('Recent Issuances table renders control_number and template_name correctly', async () => {
      const mockIssuances = [
        {
          id: 1,
          control_number: 'CERT-2026-00001',
          template_name: 'Barangay Clearance',
          resident_name: 'Juan Dela Cruz',
          issued_at: '2026-10-22T08:00:00.000Z'
        }
      ];

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes('/api/auth/me')) {
          return new Response(JSON.stringify({ user: mockUserWithRole('Admin') }), { status: 200 });
        }
        if (url.includes('/api/residents/stats')) {
          return new Response(
            JSON.stringify({
              total_residents: 100,
              seniors: 10,
              pwds: 5,
              four_ps: 2,
              voters: 70,
              active_blotters: 0,
              purok_counts: []
            }),
            { status: 200 }
          );
        }
        if (url.includes('/api/issuances')) {
          return new Response(JSON.stringify({ issuances: mockIssuances }), { status: 200 });
        }
        if (url.includes('/api/blotter')) {
          return new Response(JSON.stringify({ records: [] }), { status: 200 });
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider>
            <DashboardPage />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('CERT-2026-00001')).toBeInTheDocument();
        expect(screen.getByText('Barangay Clearance')).toBeInTheDocument();
      });
      expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
    });
  });

  describe('6. Dashboard Quick Action Buttons Role Visibility', () => {
    const renderDashboardWithRole = async (role: UserRole) => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes('/api/auth/me')) {
          return new Response(JSON.stringify({ user: mockUserWithRole(role) }), { status: 200 });
        }
        if (url.includes('/api/residents/stats')) {
          return new Response(
            JSON.stringify({
              total_residents: 100,
              seniors: 10,
              pwds: 5,
              four_ps: 2,
              voters: 70,
              active_blotters: 1,
              purok_counts: []
            }),
            { status: 200 }
          );
        }
        if (url.includes('/api/issuances')) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        if (url.includes('/api/blotter')) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });

      const utils = render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider>
            <DashboardPage />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('quick-actions')).toBeInTheDocument();
      });

      return utils;
    };

    it('User as Clerk: "New Resident" and "Issue Certificate" buttons exist; "Record Blotter Case" button does NOT exist', async () => {
      const { unmount } = await renderDashboardWithRole('Clerk');

      expect(screen.getByRole('link', { name: /new resident/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /issue certificate/i })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /record blotter case/i })).not.toBeInTheDocument();

      unmount();
    });

    it('User as Lupon: "Record Blotter Case" button exists; "New Resident" and "Issue Certificate" buttons do NOT exist', async () => {
      const { unmount } = await renderDashboardWithRole('Lupon');

      expect(screen.getByRole('link', { name: /record blotter case/i })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /new resident/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /issue certificate/i })).not.toBeInTheDocument();

      unmount();
    });

    it('User as Admin: all three quick action buttons exist', async () => {
      const { unmount } = await renderDashboardWithRole('Admin');

      expect(screen.getByRole('link', { name: /new resident/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /issue certificate/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /record blotter case/i })).toBeInTheDocument();

      unmount();
    });
  });
});
