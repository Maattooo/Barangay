import { AuthResponse, UserProfile } from '../types/auth';
import { SystemInfoResponse } from '../types/system';
import { ResidentStats } from '../types/dashboard';

const TOKEN_KEY = 'barangay_auth_token';

class ApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem(TOKEN_KEY);
    }
  }

  public getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem(TOKEN_KEY);
    }
    return this.token;
  }

  public setToken(token: string | null): void {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    }
  }

  public async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});

    // Ensure content type defaults to application/json for non-FormData
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const currentToken = this.getToken();
    if (currentToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${currentToken}`);
    }

    const config: RequestInit = {
      ...options,
      headers,
      credentials: 'include' // Send and receive HTTP-only cookies
    };

    let res: Response;
    try {
      res = await fetch(endpoint, config);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Network error: server unreachable');
    }

    // Try parsing JSON error response if !res.ok
    if (!res.ok) {
      let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const errorData = await res.json();
        if (errorData && typeof errorData.error === 'string') {
          errorMessage = errorData.error;
        } else if (errorData && typeof errorData.message === 'string') {
          errorMessage = errorData.message;
        }
      } catch {
        // Response was not JSON
      }
      const error = new Error(errorMessage);
      (error as any).status = res.status;
      throw error;
    }

    // For 204 No Content
    if (res.status === 204) {
      return {} as T;
    }

    return (await res.json()) as T;
  }

  // --- Auth Endpoints ---

  public async login(username: string, password: string): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  }

  public async getMe(): Promise<{ user: UserProfile }> {
    return this.request<{ user: UserProfile }>('/api/auth/me', {
      method: 'GET'
    });
  }

  public async logout(): Promise<void> {
    try {
      await this.request<{ message: string }>('/api/auth/logout', {
        method: 'POST'
      });
    } finally {
      this.setToken(null);
    }
  }

  // --- System Endpoints ---

  public async getSystemInfo(): Promise<SystemInfoResponse> {
    return this.request<SystemInfoResponse>('/api/system/info', {
      method: 'GET'
    });
  }

  // --- Resident / Dashboard Endpoints ---

  public async getResidentStats(): Promise<ResidentStats> {
    return this.request<ResidentStats>('/api/residents/stats', {
      method: 'GET'
    });
  }

  // --- Recent Activity Endpoints ---

  public async getRecentIssuances(limit = 5): Promise<any> {
    return this.request<any>(`/api/issuances?limit=${limit}&page=1`, {
      method: 'GET'
    });
  }

  public async getRecentBlotters(limit = 5): Promise<any> {
    return this.request<any>(`/api/blotter?limit=${limit}&page=1`, {
      method: 'GET'
    });
  }
}

export const api = new ApiClient();
export default api;
