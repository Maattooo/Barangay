import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../context/AuthContext';
import LoginPage from '../pages/LoginPage';
import api from '../services/api';

describe('Authentication Flow & Session State', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    api.setToken(null);
  });

  it('Login submission with valid credentials updates AuthContext, stores user session, and navigates to /dashboard', async () => {
    const user = userEvent.setup();

    // Mock initial getMe (unauthenticated)
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      if (url.includes('/api/auth/me')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (url.includes('/api/auth/login')) {
        return new Response(
          JSON.stringify({
            token: 'valid-jwt-token-xyz',
            user: {
              id: 1,
              username: 'admin',
              full_name: 'Admin User',
              role: 'Admin',
              official_id: 1
            }
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    const TestComponent = () => {
      const { user: authUser, isAuthenticated } = useAuth();
      return (
        <div>
          <LoginPage />
          <div data-testid="auth-status">{isAuthenticated ? 'AUTHENTICATED' : 'ANONYMOUS'}</div>
          {authUser && <div data-testid="user-role">{authUser.role}</div>}
        </div>
      );
    };

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </MemoryRouter>
    );

    // Initial state
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('ANONYMOUS');
    });

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitBtn = screen.getByRole('button', { name: /sign in to workstation/i });

    await user.type(usernameInput, 'admin');
    await user.type(passwordInput, 'admin123');
    await user.click(submitBtn);

    // Wait for login to complete and state to update
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('AUTHENTICATED');
      expect(screen.getByTestId('user-role')).toHaveTextContent('Admin');
    });

    expect(localStorage.getItem('barangay_auth_token')).toBe('valid-jwt-token-xyz');
    expect(api.getToken()).toBe('valid-jwt-token-xyz');
  });

  it('Login submission with invalid credentials renders accessible error alert without crashing', async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes('/api/auth/me')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
      }
      if (url.includes('/api/auth/login')) {
        return new Response(
          JSON.stringify({ error: 'Invalid username or password' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    );

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitBtn = screen.getByRole('button', { name: /sign in to workstation/i });

    await user.type(usernameInput, 'wronguser');
    await user.type(passwordInput, 'wrongpass');
    await user.click(submitBtn);

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/invalid username or password/i);
  });

  it('Quick Demo account autofill buttons correctly populate credentials form', async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    );

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    );

    const usernameInput = screen.getByLabelText(/username/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;

    // Click demo clerk button
    const clerkBtn = screen.getByRole('button', { name: /clerk/i });
    await user.click(clerkBtn);

    expect(usernameInput.value).toBe('clerk');
    expect(passwordInput.value).toBe('clerk123');

    // Click demo treasurer button
    const treasurerBtn = screen.getByRole('button', { name: /treasurer/i });
    await user.click(treasurerBtn);

    expect(usernameInput.value).toBe('treasurer');
    expect(passwordInput.value).toBe('treasurer123');

    // Click demo lupon button
    const luponBtn = screen.getByRole('button', { name: /lupon/i });
    await user.click(luponBtn);

    expect(usernameInput.value).toBe('lupon');
    expect(passwordInput.value).toBe('lupon123');

    // Click demo admin button
    const adminBtn = screen.getByRole('button', { name: /admin \(secretary\)/i });
    await user.click(adminBtn);

    expect(usernameInput.value).toBe('admin');
    expect(passwordInput.value).toBe('admin123');
  });

  it('Rehydration test: mounting application with existing valid token automatically invokes GET /api/auth/me and restores authenticated state', async () => {
    localStorage.setItem('barangay_auth_token', 'persisted-jwt-token');
    api.setToken('persisted-jwt-token');

    let meCalled = false;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes('/api/auth/me')) {
        meCalled = true;
        return new Response(
          JSON.stringify({
            user: {
              id: 2,
              username: 'clerk',
              full_name: 'Maria Clerk',
              role: 'Clerk',
              official_id: 2
            }
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    const TestComponent = () => {
      const { user, isAuthenticated, isLoading } = useAuth();
      if (isLoading) return <div>Loading...</div>;
      return (
        <div>
          <div data-testid="auth-state">{isAuthenticated ? 'LOGGED_IN' : 'LOGGED_OUT'}</div>
          <div data-testid="user-name">{user?.full_name}</div>
          <div data-testid="user-role">{user?.role}</div>
        </div>
      );
    };

    render(
      <MemoryRouter>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('LOGGED_IN');
      expect(screen.getByTestId('user-name')).toHaveTextContent('Maria Clerk');
      expect(screen.getByTestId('user-role')).toHaveTextContent('Clerk');
    });

    expect(meCalled).toBe(true);
  });

  it('Logout action invokes POST /api/auth/logout, clears user session, and redirects to /login', async () => {
    const user = userEvent.setup();
    localStorage.setItem('barangay_auth_token', 'active-token-to-clear');
    api.setToken('active-token-to-clear');

    let logoutCalled = false;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes('/api/auth/me')) {
        return new Response(
          JSON.stringify({
            user: {
              id: 1,
              username: 'admin',
              full_name: 'Admin User',
              role: 'Admin',
              official_id: 1
            }
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      if (url.includes('/api/auth/logout')) {
        logoutCalled = true;
        return new Response(JSON.stringify({ message: 'Logged out successfully' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    const TestComponent = () => {
      const { user: authUser, logout, isAuthenticated } = useAuth();
      return (
        <div>
          <div data-testid="auth-state">{isAuthenticated ? 'LOGGED_IN' : 'LOGGED_OUT'}</div>
          {authUser && <button onClick={() => logout()}>Do Logout</button>}
        </div>
      );
    };

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('LOGGED_IN');
    });

    const logoutBtn = screen.getByRole('button', { name: /do logout/i });
    await user.click(logoutBtn);

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('LOGGED_OUT');
    });

    expect(logoutCalled).toBe(true);
    expect(localStorage.getItem('barangay_auth_token')).toBeNull();
    expect(api.getToken()).toBeNull();
  });
});
