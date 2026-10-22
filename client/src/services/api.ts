import { AuthResponse, UserProfile } from '../types/auth';
import { SystemInfoResponse } from '../types/system';
import { ResidentStats } from '../types/dashboard';
import {
  Resident,
  ResidentFilters,
  CreateResidentInput,
  UpdateResidentInput,
  ExcelImportResult,
  PaginatedResidentsResponse
} from '../types/resident';
import {
  CertificateTemplate,
  BarangayOfficial,
  BlotterCheckResponse,
  PreviewIssuanceInput,
  PreviewIssuanceResponse,
  CreateIssuanceInput,
  PrintableIssuancePayload,
  IssuanceQueryParams,
  IssuanceListResponse,
  SingleIssuanceResponse
} from '../types/certificates';
import {
  BlotterRecord,
  CreateBlotterInput,
  UpdateBlotterInput,
  BlotterQueryFilter,
  BlotterListResponse,
  CreateOfficialInput,
  UpdateOfficialInput,
  UpdateTemplateInput,
  AuditLogFilters,
  AuditLogListResponse,
  UserAccount,
  CreateUserInput,
  UpdateUserInput
} from '../types/admin';

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

  // --- Resident RBI Endpoints ---

  public async getResidents(params: ResidentFilters = {}): Promise<PaginatedResidentsResponse> {
    const searchParams = new URLSearchParams();
    if (params.search) searchParams.set('search', params.search);
    if (params.purok) searchParams.set('purok', params.purok);
    if (params.sex) searchParams.set('sex', params.sex);
    if (params.civil_status) searchParams.set('civil_status', params.civil_status);
    if (params.sectors && params.sectors.length > 0) {
      searchParams.set('sectors', params.sectors.join(','));
    }
    if (params.page !== undefined) searchParams.set('page', String(params.page));
    if (params.limit !== undefined) searchParams.set('limit', String(params.limit));
    if (params.include_archived !== undefined) {
      searchParams.set('include_archived', String(params.include_archived));
    }

    const query = searchParams.toString();
    return this.request<PaginatedResidentsResponse>(`/api/residents${query ? `?${query}` : ''}`, {
      method: 'GET'
    });
  }

  public async getResident(id: number): Promise<Resident> {
    return this.request<Resident>(`/api/residents/${id}`, {
      method: 'GET'
    });
  }

  public async createResident(payload: CreateResidentInput): Promise<Resident> {
    return this.request<Resident>('/api/residents', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async updateResident(id: number, payload: UpdateResidentInput): Promise<Resident> {
    return this.request<Resident>(`/api/residents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }

  public async archiveResident(id: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/residents/${id}/archive`, {
      method: 'PATCH'
    });
  }

  public async importExcelResidents(file: File): Promise<ExcelImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    return this.request<ExcelImportResult>('/api/residents/import-excel', {
      method: 'POST',
      body: formData
    });
  }

  public async exportExcelResidents(params: ResidentFilters = {}): Promise<Blob> {
    const searchParams = new URLSearchParams();
    if (params.search) searchParams.set('search', params.search);
    if (params.purok) searchParams.set('purok', params.purok);
    if (params.sex) searchParams.set('sex', params.sex);
    if (params.civil_status) searchParams.set('civil_status', params.civil_status);
    if (params.sectors && params.sectors.length > 0) {
      searchParams.set('sectors', params.sectors.join(','));
    }
    if (params.include_archived !== undefined) {
      searchParams.set('include_archived', String(params.include_archived));
    }

    const query = searchParams.toString();
    const endpoint = `/api/residents/export-excel${query ? `?${query}` : ''}`;

    const headers = new Headers();
    const token = this.getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const res = await fetch(endpoint, {
      method: 'GET',
      headers,
      credentials: 'include'
    });

    if (!res.ok) {
      let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const errorData = await res.json();
        if (errorData?.error) errorMessage = errorData.error;
      } catch {
        // Not JSON
      }
      throw new Error(errorMessage);
    }

    const blob = await res.blob();

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const url = window.URL?.createObjectURL ? window.URL.createObjectURL(blob) : '';
      if (url) {
        const a = document.createElement('a');
        a.href = url;
        const contentDisposition = res.headers.get('Content-Disposition');
        let filename = 'barangay_residents.xlsx';
        if (contentDisposition) {
          const match = contentDisposition.match(/filename="?([^"]+)"?/);
          if (match && match[1]) {
            filename = match[1];
          }
        }
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        if (window.URL?.revokeObjectURL) {
          window.URL.revokeObjectURL(url);
        }
      }
    }

    return blob;
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

  // --- Certificate & Issuance Endpoints ---

  public async getTemplates(): Promise<CertificateTemplate[]> {
    return this.request<CertificateTemplate[]>('/api/templates', {
      method: 'GET'
    });
  }

  public async getOfficials(includeInactive = false): Promise<BarangayOfficial[]> {
    return this.request<BarangayOfficial[]>(`/api/officials${includeInactive ? '?include_inactive=true' : ''}`, {
      method: 'GET'
    });
  }

  public async checkResidentBlotter(residentId: number): Promise<BlotterCheckResponse> {
    return this.request<BlotterCheckResponse>(`/api/residents/${residentId}/blotter-check`, {
      method: 'GET'
    });
  }

  public async previewIssuance(payload: PreviewIssuanceInput): Promise<PreviewIssuanceResponse> {
    return this.request<PreviewIssuanceResponse>('/api/issuances/preview', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async createIssuance(payload: CreateIssuanceInput): Promise<PrintableIssuancePayload> {
    return this.request<PrintableIssuancePayload>('/api/issuances', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async getIssuances(params: IssuanceQueryParams = {}): Promise<IssuanceListResponse> {
    const searchParams = new URLSearchParams();
    if (params.start_date) searchParams.set('start_date', params.start_date);
    if (params.end_date) searchParams.set('end_date', params.end_date);
    if (params.template_id !== undefined && params.template_id !== '') {
      searchParams.set('template_id', String(params.template_id));
    }
    if (params.issued_by_user_id !== undefined && params.issued_by_user_id !== '') {
      searchParams.set('issued_by_user_id', String(params.issued_by_user_id));
    }
    if (params.had_active_blotter !== undefined && params.had_active_blotter !== '') {
      searchParams.set('had_active_blotter', String(params.had_active_blotter));
    }
    if (params.search) searchParams.set('search', params.search);
    if (params.page !== undefined) searchParams.set('page', String(params.page));
    if (params.limit !== undefined) searchParams.set('limit', String(params.limit));

    const query = searchParams.toString();
    return this.request<IssuanceListResponse>(`/api/issuances${query ? `?${query}` : ''}`, {
      method: 'GET'
    });
  }

  public async getIssuanceById(id: number): Promise<SingleIssuanceResponse> {
    return this.request<SingleIssuanceResponse>(`/api/issuances/${id}`, {
      method: 'GET'
    });
  }

  // --- Blotter Endpoints ---

  public async getBlotters(params: BlotterQueryFilter = {}): Promise<BlotterListResponse> {
    const searchParams = new URLSearchParams();
    if (params.search) searchParams.set('search', params.search);
    if (params.status) searchParams.set('status', params.status);
    if (params.respondent_id !== undefined) searchParams.set('respondent_id', String(params.respondent_id));
    if (params.is_archived !== undefined) searchParams.set('is_archived', String(params.is_archived));
    if (params.page !== undefined) searchParams.set('page', String(params.page));
    if (params.limit !== undefined) searchParams.set('limit', String(params.limit));

    const query = searchParams.toString();
    return this.request<BlotterListResponse>(`/api/blotter${query ? `?${query}` : ''}`, {
      method: 'GET'
    });
  }

  public async getBlotter(id: number): Promise<BlotterRecord> {
    return this.request<BlotterRecord>(`/api/blotter/${id}`, {
      method: 'GET'
    });
  }

  public async createBlotter(payload: CreateBlotterInput): Promise<BlotterRecord> {
    return this.request<BlotterRecord>('/api/blotter', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async updateBlotter(id: number, payload: UpdateBlotterInput): Promise<BlotterRecord> {
    return this.request<BlotterRecord>(`/api/blotter/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }

  public async archiveBlotter(id: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/blotter/${id}/archive`, {
      method: 'PATCH'
    });
  }

  // --- Barangay Officials Admin Endpoints ---

  public async createOfficial(payload: CreateOfficialInput): Promise<BarangayOfficial> {
    return this.request<BarangayOfficial>('/api/officials', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async updateOfficial(id: number, payload: UpdateOfficialInput): Promise<BarangayOfficial> {
    return this.request<BarangayOfficial>(`/api/officials/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }

  // --- Certificate Templates Admin Endpoints ---

  public async getTemplate(id: number | string): Promise<CertificateTemplate> {
    return this.request<CertificateTemplate>(`/api/templates/${id}`, {
      method: 'GET'
    });
  }

  public async updateTemplate(id: number | string, payload: UpdateTemplateInput): Promise<CertificateTemplate> {
    return this.request<CertificateTemplate>(`/api/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }

  // --- Transparency Audit Logs Endpoints ---

  public async getAuditLogs(params: AuditLogFilters = {}): Promise<AuditLogListResponse> {
    const searchParams = new URLSearchParams();
    if (params.user_id) searchParams.set('user_id', String(params.user_id));
    if (params.action) searchParams.set('action', params.action);
    if (params.entity_type) searchParams.set('entity_type', params.entity_type);
    if (params.start_date) searchParams.set('start_date', params.start_date);
    if (params.end_date) searchParams.set('end_date', params.end_date);
    if (params.search) searchParams.set('search', params.search);
    if (params.page !== undefined) searchParams.set('page', String(params.page));
    if (params.limit !== undefined) searchParams.set('limit', String(params.limit));

    const query = searchParams.toString();
    return this.request<AuditLogListResponse>(`/api/audit-logs${query ? `?${query}` : ''}`, {
      method: 'GET'
    });
  }

  // --- Staff User Management Endpoints ---

  public async getUsers(): Promise<UserAccount[]> {
    return this.request<UserAccount[]>('/api/users', {
      method: 'GET'
    });
  }

  public async createUser(payload: CreateUserInput): Promise<UserAccount> {
    return this.request<UserAccount>('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async updateUser(id: number, payload: UpdateUserInput): Promise<UserAccount> {
    return this.request<UserAccount>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }

  // --- Settings & Database Backup Endpoints ---

  public async updateSystemSettings(settings: Record<string, string>): Promise<any> {
    return this.request<any>('/api/system/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  }

  public async downloadDatabaseBackup(): Promise<Blob> {
    const endpoint = '/api/system/backup';
    const headers = new Headers();
    const token = this.getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      credentials: 'include'
    });

    if (!res.ok) {
      let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const errorData = await res.json();
        if (errorData?.error) errorMessage = errorData.error;
      } catch {
        // Not JSON
      }
      throw new Error(errorMessage);
    }

    const blob = await res.blob();

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const url = window.URL?.createObjectURL ? window.URL.createObjectURL(blob) : '';
      if (url) {
        const a = document.createElement('a');
        a.href = url;
        const contentDisposition = res.headers.get('Content-Disposition');
        let filename = 'barangay_backup.sqlite';
        if (contentDisposition) {
          const match = contentDisposition.match(/filename="?([^"]+)"?/);
          if (match && match[1]) {
            filename = match[1];
          }
        }
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        if (window.URL?.revokeObjectURL) {
          window.URL.revokeObjectURL(url);
        }
      }
    }

    return blob;
  }
}

export const api = new ApiClient();
export default api;
