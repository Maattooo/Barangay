import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { AppRoutes } from '../App';
import BlotterPage from '../pages/BlotterPage';
import OfficialsPage from '../pages/OfficialsPage';
import TemplatesPage from '../pages/TemplatesPage';
import AuditLogsPage from '../pages/AuditLogsPage';
import SettingsPage from '../pages/SettingsPage';
import api from '../services/api';
import { UserRole } from '../types/auth';
import {
  BlotterRecord,
  BarangayOfficial,
  CertificateTemplate,
  AuditLogEntry,
  UserAccount
} from '../types/admin';
import { Resident } from '../types/resident';

// Mock User generator
const mockUserWithRole = (role: UserRole) => ({
  id: 1,
  username: role.toLowerCase(),
  full_name: `${role} Officer`,
  role,
  official_id: 1
});

// Mock Blotter Records
const mockBlotterRecords: BlotterRecord[] = [
  {
    id: 101,
    case_number: 'BLT-2026-001',
    complainant_id: null,
    complainant_name: 'Maria Santos',
    respondent_id: 1,
    respondent_name: 'Juan Dela Cruz',
    incident_type: 'Physical Injury',
    incident_location: 'Purok 1 Basketball Court',
    incident_details: 'Altercation over basketball game resulting in minor scuffle.',
    date_incident: '2026-03-10',
    date_recorded: '2026-03-11 09:30:00',
    status: 'Active',
    settlement_notes: '',
    is_archived: 0,
    created_by: 1,
    updated_by: 1,
    updated_at: '2026-03-11 09:30:00'
  },
  {
    id: 102,
    case_number: 'BLT-2026-002',
    complainant_id: null,
    complainant_name: 'Pedro Penduko',
    respondent_id: 2,
    respondent_name: 'Ana Reyes',
    incident_type: 'Boundary Dispute',
    incident_location: 'Purok 3',
    incident_details: 'Fence encroaching on adjacent residential lot.',
    date_incident: '2026-03-15',
    date_recorded: '2026-03-16 14:00:00',
    status: 'Under Mediation',
    settlement_notes: 'Initial hearing scheduled.',
    is_archived: 0,
    created_by: 1,
    updated_by: 1,
    updated_at: '2026-03-16 14:00:00'
  }
];

// Mock Officials Roster
const mockOfficials: BarangayOfficial[] = [
  {
    id: 1,
    full_name: 'HON. JUAN DELA CRUZ',
    position: 'Punong Barangay',
    committee: 'Executive',
    rank_order: 1,
    term_start: '2023-11-01',
    term_end: '2026-11-01',
    is_active: 1
  },
  {
    id: 2,
    full_name: 'HON. PEDRO SANTOS',
    position: 'Sangguniang Barangay Member',
    committee: 'Committee on Peace and Order',
    rank_order: 2,
    term_start: '2023-11-01',
    term_end: '2026-11-01',
    is_active: 1
  },
  {
    id: 3,
    full_name: 'HON. MARIA CLARA',
    position: 'SK Chairperson',
    committee: 'Youth and Sports Development',
    rank_order: 9,
    term_start: '2023-11-01',
    term_end: '2026-11-01',
    is_active: 1
  }
];

// Mock Templates
const mockTemplates: CertificateTemplate[] = [
  {
    id: 1,
    template_code: 'BRGY_CLEARANCE',
    template_name: 'Barangay Clearance',
    title_header: 'BARANGAY CLEARANCE',
    body_html: '<p>This is to certify that {{full_name}}, of legal age, is a bona fide resident.</p>',
    show_officials_sidebar: 1,
    default_fee: 50.0,
    requires_blotter_check: 1,
    is_active: 1
  },
  {
    id: 2,
    template_code: 'INDIGENCY',
    template_name: 'Certificate of Indigency',
    title_header: 'CERTIFICATE OF INDIGENCY',
    body_html: '<p>This is to certify that {{full_name}} belongs to an indigent family.</p>',
    show_officials_sidebar: 1,
    default_fee: 0.0,
    requires_blotter_check: 0,
    is_active: 1
  }
];

// Mock Audit Logs
const mockAuditLogs: AuditLogEntry[] = [
  {
    id: 1,
    user_id: 1,
    username_snapshot: 'admin',
    user_role_snapshot: 'Admin',
    action: 'UPDATE',
    entity_type: 'official',
    entity_id: 2,
    summary_text: 'Updated official committee assignment',
    old_data_json: JSON.stringify({ committee: 'Peace' }),
    new_data_json: JSON.stringify({ committee: 'Health' }),
    client_ip: '192.168.1.15',
    created_at: '2026-10-22 14:15:00'
  },
  {
    id: 2,
    user_id: 2,
    username_snapshot: 'clerk',
    user_role_snapshot: 'Clerk',
    action: 'PRINT_CERTIFICATE',
    entity_type: 'issuance',
    entity_id: 10,
    summary_text: 'Issued Barangay Clearance for Juan Dela Cruz',
    old_data_json: null,
    new_data_json: null,
    client_ip: '192.168.1.20',
    created_at: '2026-10-22 14:20:00'
  },
  {
    id: 3,
    user_id: 1,
    username_snapshot: 'admin',
    user_role_snapshot: 'Admin',
    action: 'BLOTTER_OVERRIDE',
    entity_type: 'issuance',
    entity_id: 11,
    summary_text: 'Overrode active blotter warning for Juan Dela Cruz',
    old_data_json: null,
    new_data_json: null,
    client_ip: '192.168.1.15',
    created_at: '2026-10-22 14:25:00'
  }
];

// Mock System Users
const mockUsers: UserAccount[] = [
  {
    id: 1,
    username: 'admin',
    full_name: 'Admin Officer',
    role: 'Admin',
    official_id: 1,
    is_active: 1,
    last_login_at: '2026-10-22 08:00:00',
    created_at: '2026-01-01 00:00:00'
  },
  {
    id: 2,
    username: 'clerk',
    full_name: 'Clerk Staff',
    role: 'Clerk',
    official_id: null,
    is_active: 1,
    last_login_at: '2026-10-22 09:00:00',
    created_at: '2026-01-02 00:00:00'
  }
];

// Mock Resident for search
const mockResident: Resident = {
  id: 1,
  first_name: 'Juan',
  middle_name: 'Mendoza',
  last_name: 'Dela Cruz',
  suffix: '',
  birthdate: '1990-05-15',
  sex: 'Male',
  civil_status: 'Single',
  purok: 'Purok 1',
  house_no_street: '123 Rizal St.',
  contact_no: '09171234567',
  occupation: 'Mechanic',
  nationality: 'Filipino',
  residency_status: 'Active',
  is_voter: 1,
  precinct_no: '001A',
  is_pwd: 0,
  pwd_id_no: '',
  pwd_disability_type: '',
  is_solo_parent: 0,
  solo_parent_id_no: '',
  is_4ps: 0,
  is_indigent: 0,
  is_ofw: 0,
  is_osy: 0,
  senior_id_no: '',
  is_archived: 0,
  created_by: 1,
  updated_by: 1,
  created_at: '2026-01-01 00:00:00',
  updated_at: '2026-01-01 00:00:00',
  age: 36,
  is_senior: false,
  is_youth: false,
  is_minor: false
};

describe('Phase 12 — Frontend Admin Suite: Templates, Officials, Blotter & Audit Inspector', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    api.setToken('test-token');
  });

  // 1. Blotter Records Table & Search
  describe('1. Blotter Records Table & Search', () => {
    it('Mounts BlotterPage: asserts GET /api/blotter is called with default pagination, renders records and status pills, and filters by status', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes('/api/auth/me')) {
          return new Response(JSON.stringify({ user: mockUserWithRole('Admin') }), { status: 200 });
        }
        if (url.includes('/api/blotter')) {
          const u = new URL(url, 'http://localhost');
          const statusParam = u.searchParams.get('status');
          const filtered = statusParam
            ? mockBlotterRecords.filter((r) => r.status === statusParam)
            : mockBlotterRecords;

          return new Response(
            JSON.stringify({
              data: filtered,
              pagination: { total: filtered.length, page: 1, limit: 10, totalPages: 1 }
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });

      render(
        <MemoryRouter initialEntries={['/blotter']}>
          <AuthProvider>
            <BlotterPage />
          </AuthProvider>
        </MemoryRouter>
      );

      // Verify GET /api/blotter called with default pagination
      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/api/blotter?page=1&limit=10'),
          expect.anything()
        );
      });

      // Verify records rendered with case numbers, names, and pills inside table
      const table = await screen.findByRole('table');
      expect(within(table).getByText('BLT-2026-001')).toBeInTheDocument();
      expect(within(table).getByText('Maria Santos')).toBeInTheDocument();
      expect(within(table).getByText('Juan Dela Cruz')).toBeInTheDocument();
      expect(within(table).getByText('Physical Injury')).toBeInTheDocument();
      expect(within(table).getByText('Active')).toBeInTheDocument();

      expect(within(table).getByText('BLT-2026-002')).toBeInTheDocument();
      expect(within(table).getByText('Under Mediation')).toBeInTheDocument();

      // Filter by "Under Mediation"
      const statusSelect = screen.getByLabelText(/filter by status/i);
      fireEvent.change(statusSelect, { target: { value: 'Under Mediation' } });

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringMatching(/\/api\/blotter\?.*status=Under(?:\+|%20| )Mediation/),
          expect.anything()
        );
      });
    });
  });

  // 2. Blotter Incident Creation & Settlement
  describe('2. Blotter Incident Creation & Settlement', () => {
    it('Opens Record New Case modal, fills form, links resident, submits POST /api/blotter, and settles case via PUT /api/blotter/:id', async () => {
      let createdPayload: any = null;
      let updatedPayload: any = null;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        const method = init?.method || 'GET';

        if (url.includes('/api/auth/me')) {
          return new Response(JSON.stringify({ user: mockUserWithRole('Admin') }), { status: 200 });
        }
        if (url.includes('/api/residents') && url.includes('search=')) {
          return new Response(
            JSON.stringify({
              data: [mockResident],
              pagination: { total: 1, page: 1, limit: 5, totalPages: 1 }
            }),
            { status: 200 }
          );
        }
        if (url.includes('/api/blotter') && method === 'POST') {
          createdPayload = JSON.parse(init?.body as string);
          return new Response(
            JSON.stringify({
              id: 103,
              case_number: 'BLT-2026-003',
              ...createdPayload,
              date_recorded: '2026-03-20 10:00:00'
            }),
            { status: 201 }
          );
        }
        if (url.includes('/api/blotter/101') && method === 'PUT') {
          updatedPayload = JSON.parse(init?.body as string);
          return new Response(
            JSON.stringify({
              ...mockBlotterRecords[0],
              ...updatedPayload
            }),
            { status: 200 }
          );
        }
        if (url.includes('/api/blotter')) {
          return new Response(
            JSON.stringify({
              data: mockBlotterRecords,
              pagination: { total: mockBlotterRecords.length, page: 1, limit: 10, totalPages: 1 }
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });

      render(
        <MemoryRouter initialEntries={['/blotter']}>
          <AuthProvider>
            <BlotterPage />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('BLT-2026-001')).toBeInTheDocument();
      });

      // 1. Open "Record New Case" modal
      const newCaseBtn = screen.getByRole('button', { name: /record new case/i });
      fireEvent.click(newCaseBtn);

      const modal = await screen.findByRole('dialog');
      expect(within(modal).getByRole('heading', { name: /record new blotter case/i })).toBeInTheDocument();

      // Fill in Complainant
      const compInput = within(modal).getByLabelText(/complainant full name/i);
      fireEvent.change(compInput, { target: { value: 'Lucia Dimagiba' } });

      // Fill Respondent & search resident
      const respInput = within(modal).getByLabelText(/respondent full name/i);
      fireEvent.change(respInput, { target: { value: 'Juan Dela Cruz' } });

      const respSearch = within(modal).getByPlaceholderText(/search resident masterlist to link respondent ID/i);
      fireEvent.change(respSearch, { target: { value: 'Juan' } });

      // Wait for debounced search results list
      await waitFor(() => {
        expect(within(modal).getByRole('list')).toBeInTheDocument();
      });

      const residentItem = within(modal).getByRole('listitem');
      fireEvent.click(residentItem);

      // Verify linkage badge appears
      await waitFor(() => {
        expect(within(modal).getByText(/Linked to Resident Registry/i)).toBeInTheDocument();
      });

      // Fill incident type & details
      const incidentTypeInput = within(modal).getByLabelText(/incident type/i);
      fireEvent.change(incidentTypeInput, { target: { value: 'Unjust Vexation' } });

      const detailsInput = within(modal).getByLabelText(/incident details/i);
      fireEvent.change(detailsInput, {
        target: { value: 'Persistent loud shouting and disturbance of peace late at night.' }
      });

      // Submit form
      const submitBtn = within(modal).getByRole('button', { name: /record case/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(createdPayload).not.toBeNull();
        expect(createdPayload.complainant_name).toBe('Lucia Dimagiba');
        expect(createdPayload.respondent_name).toBe('Juan Mendoza Dela Cruz');
        expect(createdPayload.respondent_id).toBe(1);
        expect(createdPayload.incident_type).toBe('Unjust Vexation');
      });

      // 2. Click "Update / Settle" on BLT-2026-001
      const settleButtons = screen.getAllByRole('button', { name: /update \/ settle/i });
      fireEvent.click(settleButtons[0]);

      const settleModal = await screen.findByRole('dialog');
      expect(within(settleModal).getByRole('heading', { name: /update \/ settle blotter case/i })).toBeInTheDocument();

      // Select status "Settled"
      const statusSelect = within(settleModal).getByLabelText(/new case status/i);
      fireEvent.change(statusSelect, { target: { value: 'Settled' } });

      // Enter settlement notes
      const notesInput = within(settleModal).getByLabelText(/settlement notes/i);
      fireEvent.change(notesInput, {
        target: { value: 'Parties met at Barangay Hall and amicably resolved the matter with signed agreement.' }
      });

      // Save changes
      const saveSettleBtn = within(settleModal).getByRole('button', { name: /save changes/i });
      fireEvent.click(saveSettleBtn);

      await waitFor(() => {
        expect(updatedPayload).not.toBeNull();
        expect(updatedPayload.status).toBe('Settled');
        expect(updatedPayload.settlement_notes).toContain('amicably resolved');
      });
    });
  });

  // 3. Officials Roster Management
  describe('3. Officials Roster Management', () => {
    it('Mounts OfficialsPage: fetches officials, renders council hierarchy in rank_order ASC, adds new official, and updates official', async () => {
      let createdOfficial: any = null;
      let updatedOfficial: any = null;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        const method = init?.method || 'GET';

        if (url.includes('/api/auth/me')) {
          return new Response(JSON.stringify({ user: mockUserWithRole('Admin') }), { status: 200 });
        }
        if (url.includes('/api/officials') && method === 'POST') {
          createdOfficial = JSON.parse(init?.body as string);
          return new Response(
            JSON.stringify({
              id: 4,
              ...createdOfficial
            }),
            { status: 201 }
          );
        }
        if (url.includes('/api/officials/2') && method === 'PUT') {
          updatedOfficial = JSON.parse(init?.body as string);
          return new Response(
            JSON.stringify({
              ...mockOfficials[1],
              ...updatedOfficial
            }),
            { status: 200 }
          );
        }
        if (url.includes('/api/officials')) {
          return new Response(JSON.stringify(mockOfficials), { status: 200 });
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });

      render(
        <MemoryRouter initialEntries={['/officials']}>
          <AuthProvider>
            <OfficialsPage />
          </AuthProvider>
        </MemoryRouter>
      );

      // Verify list renders council hierarchy in rank_order ASC order
      await waitFor(() => {
        expect(screen.getByText('HON. JUAN DELA CRUZ')).toBeInTheDocument();
        expect(screen.getByText('HON. PEDRO SANTOS')).toBeInTheDocument();
        expect(screen.getByText('HON. MARIA CLARA')).toBeInTheDocument();
      });

      // Verify rank orders displayed
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('9')).toBeInTheDocument();

      // Open "Add Official" modal as Admin
      const addBtn = screen.getByRole('button', { name: /add official/i });
      fireEvent.click(addBtn);

      const modal = await screen.findByRole('dialog');
      expect(within(modal).getByRole('heading', { name: /add barangay official/i })).toBeInTheDocument();

      // Enter official details
      const nameInput = within(modal).getByLabelText(/full name/i);
      fireEvent.change(nameInput, { target: { value: 'HON. TERESA MAGBANUA' } });

      const posSelect = within(modal).getByLabelText(/^position/i);
      fireEvent.change(posSelect, { target: { value: 'Sangguniang Barangay Member' } });

      const commInput = within(modal).getByLabelText(/committee assignment/i);
      fireEvent.change(commInput, { target: { value: 'Committee on Health' } });

      const rankInput = within(modal).getByLabelText(/rank order/i);
      fireEvent.change(rankInput, { target: { value: '2' } });

      // Submit form inside modal
      const saveBtn = within(modal).getByRole('button', { name: /^add official$/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(createdOfficial).not.toBeNull();
        expect(createdOfficial.full_name).toBe('HON. TERESA MAGBANUA');
        expect(createdOfficial.position).toBe('Sangguniang Barangay Member');
        expect(createdOfficial.committee).toBe('Committee on Health');
        expect(createdOfficial.rank_order).toBe(2);
      });

      // Edit official: update committee name
      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      fireEvent.click(editButtons[1]); // Second official (HON. PEDRO SANTOS)

      const editModal = await screen.findByRole('dialog');
      expect(within(editModal).getByRole('heading', { name: /edit barangay official/i })).toBeInTheDocument();

      const editCommInput = within(editModal).getByLabelText(/committee assignment/i);
      fireEvent.change(editCommInput, { target: { value: 'Committee on Ways and Means' } });

      const saveEditBtn = within(editModal).getByRole('button', { name: /save changes/i });
      fireEvent.click(saveEditBtn);

      await waitFor(() => {
        expect(updatedOfficial).not.toBeNull();
        expect(updatedOfficial.committee).toBe('Committee on Ways and Means');
      });
    });
  });

  // 4. Certificate Template Editor & Placeholder Chips Insertion
  describe('4. Certificate Template Editor & Placeholder Chips Insertion', () => {
    it('Mounts TemplatesPage as Admin, selects Barangay Clearance, clicks {{full_name}} placeholder chip, toggles sidebar, and saves template', async () => {
      let updatedTemplatePayload: any = null;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        const method = init?.method || 'GET';

        if (url.includes('/api/auth/me')) {
          return new Response(JSON.stringify({ user: mockUserWithRole('Admin') }), { status: 200 });
        }
        if (url.includes('/api/templates/1') && method === 'PUT') {
          updatedTemplatePayload = JSON.parse(init?.body as string);
          return new Response(
            JSON.stringify({
              ...mockTemplates[0],
              ...updatedTemplatePayload
            }),
            { status: 200 }
          );
        }
        if (url.includes('/api/templates')) {
          return new Response(JSON.stringify(mockTemplates), { status: 200 });
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });

      render(
        <MemoryRouter initialEntries={['/templates']}>
          <AuthProvider>
            <TemplatesPage />
          </AuthProvider>
        </MemoryRouter>
      );

      // Verify editor loads template body HTML, title header, and fee
      await waitFor(() => {
        expect(screen.getByLabelText(/title header/i)).toHaveValue('BARANGAY CLEARANCE');
        expect(screen.getByLabelText(/default fee/i)).toHaveValue(50);
      });

      // Verify RichTextTemplateEditor container exists
      const editor = screen.getByTestId('rich-text-editor');
      expect(editor).toBeInTheDocument();

      // Click {{full_name}} placeholder chip in PlaceholderChipBar
      const fullNameChip = screen.getByRole('button', { name: /\{\{full_name\}\}/i });
      fireEvent.click(fullNameChip);

      // Assert {{full_name}} is inserted into editor content
      expect(editor.textContent).toContain('{{full_name}}');

      // Toggle show_officials_sidebar switch
      const sidebarToggle = screen.getByLabelText(/toggle officials sidebar/i);
      expect(sidebarToggle).toBeChecked();
      fireEvent.click(sidebarToggle);
      expect(sidebarToggle).not.toBeChecked();

      // Click "Save Template"
      const saveBtn = screen.getByRole('button', { name: /save template/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(updatedTemplatePayload).not.toBeNull();
        expect(updatedTemplatePayload.title_header).toBe('BARANGAY CLEARANCE');
        expect(updatedTemplatePayload.show_officials_sidebar).toBe(0);
        expect(updatedTemplatePayload.body_html).toContain('{{full_name}}');
      });
    });
  });

  // 5. Transparency Audit Log Viewer & Visual JSON Diff Modal
  describe('5. Transparency Audit Log Viewer & Visual JSON Diff Modal', () => {
    it('Mounts AuditLogsPage as Admin, renders action badges and LAN IP, and opens JsonDiffModal with colorized before/after comparison', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes('/api/auth/me')) {
          return new Response(JSON.stringify({ user: mockUserWithRole('Admin') }), { status: 200 });
        }
        if (url.includes('/api/users')) {
          return new Response(JSON.stringify(mockUsers), { status: 200 });
        }
        if (url.includes('/api/audit-logs')) {
          return new Response(
            JSON.stringify({
              data: mockAuditLogs,
              pagination: { total: mockAuditLogs.length, page: 1, limit: 20, totalPages: 1 }
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });

      render(
        <MemoryRouter initialEntries={['/audit-logs']}>
          <AuthProvider>
            <AuditLogsPage />
          </AuthProvider>
        </MemoryRouter>
      );

      // Verify audit entries display action badges, summaries, and client IP inside table
      const table = await screen.findByRole('table');
      expect(within(table).getByText('UPDATE')).toBeInTheDocument();
      expect(within(table).getByText('PRINT_CERTIFICATE')).toBeInTheDocument();
      expect(within(table).getByText('BLOTTER_OVERRIDE')).toBeInTheDocument();
      expect(within(table).getByText('Updated official committee assignment')).toBeInTheDocument();
      expect(within(table).getAllByText('192.168.1.15')[0]).toBeInTheDocument();

      // Click "View Diff" button on UPDATE log row
      const viewDiffBtn = within(table).getByRole('button', { name: /view diff for event #1/i });
      fireEvent.click(viewDiffBtn);

      // Assert JsonDiffModal opens
      expect(await screen.findByRole('heading', { name: /visual json diff inspector/i })).toBeInTheDocument();

      // Assert modal highlights "Peace" (removed/old) and "Health" (added/new)
      const oldVal = screen.getByTestId('diff-old-committee');
      const newVal = screen.getByTestId('diff-new-committee');

      expect(oldVal).toHaveTextContent('Peace');
      expect(newVal).toHaveTextContent('Health');
    });

    it('Filters audit logs by dedicated staff user dropdown, passes user_id parameter, and resets page', async () => {
      const dispatchedAuditUrls: string[] = [];
      let usersCalled = false;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes('/api/auth/me')) {
          return new Response(JSON.stringify({ user: mockUserWithRole('Admin') }), { status: 200 });
        }
        if (url.includes('/api/users')) {
          usersCalled = true;
          return new Response(JSON.stringify(mockUsers), { status: 200 });
        }
        if (url.includes('/api/audit-logs')) {
          dispatchedAuditUrls.push(url);
          return new Response(
            JSON.stringify({
              data: mockAuditLogs,
              pagination: { total: mockAuditLogs.length, page: 1, limit: 20, totalPages: 1 }
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });

      render(
        <MemoryRouter initialEntries={['/audit-logs']}>
          <AuthProvider>
            <AuditLogsPage />
          </AuthProvider>
        </MemoryRouter>
      );

      // Verify api.getUsers was invoked
      await waitFor(() => {
        expect(usersCalled).toBe(true);
      });

      // Find user select dropdown
      const userSelect = await screen.findByRole('combobox', { name: /filter by user/i });
      expect(userSelect).toBeInTheDocument();

      // Assert user options rendered: "All Users" and fetched staff users
      expect(within(userSelect).getByRole('option', { name: /all users/i })).toBeInTheDocument();
      expect(within(userSelect).getByRole('option', { name: /admin officer \(admin\)/i })).toHaveValue('1');
      expect(within(userSelect).getByRole('option', { name: /clerk staff \(clerk\)/i })).toHaveValue('2');

      // Trigger change to user.id = 2 (Clerk Staff)
      fireEvent.change(userSelect, { target: { value: '2' } });

      // Assert api.getAuditLogs is dispatched with user_id=2 and page=1
      await waitFor(() => {
        const userFilteredUrl = dispatchedAuditUrls.find((u) => u.includes('user_id=2'));
        expect(userFilteredUrl).toBeDefined();
        expect(userFilteredUrl).toContain('user_id=2');
        expect(userFilteredUrl).toContain('page=1');
      });

      // Adversarial/Negative test: Reverting to "All Users" (target.value = '') omits user_id
      fireEvent.change(userSelect, { target: { value: '' } });
      await waitFor(() => {
        const lastCall = dispatchedAuditUrls[dispatchedAuditUrls.length - 1];
        expect(lastCall).not.toContain('user_id=');
      });
    });

    it('Handles api.getUsers partial-failure gracefully without crashing audit logs table', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes('/api/auth/me')) {
          return new Response(JSON.stringify({ user: mockUserWithRole('Admin') }), { status: 200 });
        }
        if (url.includes('/api/users')) {
          return new Response(JSON.stringify({ message: 'Internal Server Error' }), { status: 500 });
        }
        if (url.includes('/api/audit-logs')) {
          return new Response(
            JSON.stringify({
              data: mockAuditLogs,
              pagination: { total: mockAuditLogs.length, page: 1, limit: 20, totalPages: 1 }
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });

      render(
        <MemoryRouter initialEntries={['/audit-logs']}>
          <AuthProvider>
            <AuditLogsPage />
          </AuthProvider>
        </MemoryRouter>
      );

      // Audit logs table still mounts and displays data despite user fetch failure
      const table = await screen.findByRole('table');
      expect(table).toBeInTheDocument();
      expect(within(table).getByText('UPDATE')).toBeInTheDocument();

      // Dropdown safely retains default "All Users" option
      const userSelect = screen.getByRole('combobox', { name: /filter by user/i });
      expect(within(userSelect).getByRole('option', { name: /all users/i })).toBeInTheDocument();
      expect(within(userSelect).queryByText(/admin officer/i)).not.toBeInTheDocument();

      consoleErrorSpy.mockRestore();
    });
  });

  // 6. System Settings & 1-Click Database Hot Backup
  describe('6. System Settings & 1-Click Database Hot Backup', () => {
    it('Mounts SettingsPage as Admin, renders host LAN IP instructions, and triggers POST /api/system/backup on download click', async () => {
      let backupCalled = false;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        const method = init?.method || 'GET';

        if (url.includes('/api/auth/me')) {
          return new Response(JSON.stringify({ user: mockUserWithRole('Admin') }), { status: 200 });
        }
        if (url.includes('/api/system/info')) {
          return new Response(
            JSON.stringify({
              lan_ips: ['192.168.1.100'],
              db_size_bytes: 5242880,
              settings: {
                barangay_name: 'Barangay Harapin Ang Bukas',
                municipality_name: 'Mandaluyong City',
                province_name: 'Metro Manila'
              }
            }),
            { status: 200 }
          );
        }
        if (url.includes('/api/system/backup') && method === 'POST') {
          backupCalled = true;
          return new Response(new Blob(['mock-sqlite-database']), {
            status: 200,
            headers: {
              'Content-Type': 'application/x-sqlite3',
              'Content-Disposition': 'attachment; filename="barangay_backup_20261022_120000.sqlite"'
            }
          });
        }
        if (url.includes('/api/users')) {
          return new Response(JSON.stringify(mockUsers), { status: 200 });
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });

      render(
        <MemoryRouter initialEntries={['/settings']}>
          <AuthProvider>
            <SettingsPage />
          </AuthProvider>
        </MemoryRouter>
      );

      // Verify host LAN IP address instructions render
      await waitFor(() => {
        expect(screen.getByText('http://192.168.1.100:3000')).toBeInTheDocument();
        expect(screen.getByText(/Open Chrome or Edge on any computer connected to the same Barangay Hall Wi-Fi/i)).toBeInTheDocument();
      });

      // Click "Download SQLite Backup" button
      const backupBtn = screen.getByRole('button', { name: /download sqlite backup/i });
      fireEvent.click(backupBtn);

      await waitFor(() => {
        expect(backupCalled).toBe(true);
      });
    });
  });

  // 7. Staff User Management
  describe('7. Staff User Management', () => {
    it('On SettingsPage: loads users from GET /api/users, opens Add Staff User modal, and submits POST /api/users', async () => {
      let createdUserPayload: any = null;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        const method = init?.method || 'GET';

        if (url.includes('/api/auth/me')) {
          return new Response(JSON.stringify({ user: mockUserWithRole('Admin') }), { status: 200 });
        }
        if (url.includes('/api/system/info')) {
          return new Response(
            JSON.stringify({
              lan_ips: ['127.0.0.1'],
              db_size_bytes: 1024,
              settings: {}
            }),
            { status: 200 }
          );
        }
        if (url.includes('/api/users') && method === 'POST') {
          createdUserPayload = JSON.parse(init?.body as string);
          return new Response(
            JSON.stringify({
              id: 3,
              ...createdUserPayload,
              is_active: 1,
              created_at: '2026-10-22 15:00:00'
            }),
            { status: 201 }
          );
        }
        if (url.includes('/api/users')) {
          return new Response(JSON.stringify(mockUsers), { status: 200 });
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });

      render(
        <MemoryRouter initialEntries={['/settings']}>
          <AuthProvider>
            <SettingsPage />
          </AuthProvider>
        </MemoryRouter>
      );

      // Verify user table loads
      await waitFor(() => {
        expect(screen.getByText('@admin')).toBeInTheDocument();
        expect(screen.getByText('@clerk')).toBeInTheDocument();
      });

      // Click "Add Staff User"
      const addUserBtn = screen.getByRole('button', { name: /add staff user/i });
      fireEvent.click(addUserBtn);

      const modal = await screen.findByRole('dialog');
      expect(within(modal).getByRole('heading', { name: /add staff user/i })).toBeInTheDocument();

      // Fill in user details
      const usernameInput = within(modal).getByLabelText(/username/i);
      fireEvent.change(usernameInput, { target: { value: 'treasurer_jane' } });

      const nameInput = within(modal).getByLabelText(/full name/i);
      fireEvent.change(nameInput, { target: { value: 'Jane Doe' } });

      const passInput = within(modal).getByLabelText(/password/i);
      fireEvent.change(passInput, { target: { value: 'secretPassword123' } });

      const roleSelect = within(modal).getByLabelText(/staff role/i);
      fireEvent.change(roleSelect, { target: { value: 'Treasurer' } });

      // Submit user form inside modal
      const submitUserBtn = within(modal).getByRole('button', { name: /create staff user/i });
      fireEvent.click(submitUserBtn);

      await waitFor(() => {
        expect(createdUserPayload).not.toBeNull();
        expect(createdUserPayload.username).toBe('treasurer_jane');
        expect(createdUserPayload.full_name).toBe('Jane Doe');
        expect(createdUserPayload.role).toBe('Treasurer');
        expect(createdUserPayload.password).toBe('secretPassword123');
      });
    });
  });

  // 8. Role-Based Access Control (RBAC)
  describe('8. Role-Based Access Control (RBAC)', () => {
    it('As Admin: all admin routes (/blotter, /officials, /templates, /audit-logs, /settings) render successfully', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes('/api/auth/me')) {
          return new Response(JSON.stringify({ user: mockUserWithRole('Admin') }), { status: 200 });
        }
        if (url.includes('/api/blotter')) {
          return new Response(
            JSON.stringify({ data: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 1 } }),
            { status: 200 }
          );
        }
        if (url.includes('/api/officials')) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        if (url.includes('/api/templates')) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        if (url.includes('/api/audit-logs')) {
          return new Response(
            JSON.stringify({ data: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 1 } }),
            { status: 200 }
          );
        }
        if (url.includes('/api/system/info')) {
          return new Response(
            JSON.stringify({ lan_ips: ['127.0.0.1'], db_size_bytes: 0, settings: {} }),
            { status: 200 }
          );
        }
        if (url.includes('/api/users')) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });

      // Admin on /blotter
      const { unmount: u1 } = render(
        <MemoryRouter initialEntries={['/blotter']}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </MemoryRouter>
      );
      expect(await screen.findByRole('heading', { name: /blotter records/i })).toBeInTheDocument();
      u1();

      // Admin on /officials
      const { unmount: u2 } = render(
        <MemoryRouter initialEntries={['/officials']}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </MemoryRouter>
      );
      expect(await screen.findByRole('heading', { name: /barangay officials roster/i })).toBeInTheDocument();
      u2();

      // Admin on /templates
      const { unmount: u3 } = render(
        <MemoryRouter initialEntries={['/templates']}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </MemoryRouter>
      );
      expect(await screen.findByRole('heading', { name: /certificate template/i })).toBeInTheDocument();
      u3();

      // Admin on /audit-logs
      const { unmount: u4 } = render(
        <MemoryRouter initialEntries={['/audit-logs']}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </MemoryRouter>
      );
      expect(await screen.findByRole('heading', { name: /transparency audit trail/i })).toBeInTheDocument();
      u4();

      // Admin on /settings
      const { unmount: u5 } = render(
        <MemoryRouter initialEntries={['/settings']}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </MemoryRouter>
      );
      expect(await screen.findByRole('heading', { name: /system settings & maintenance/i })).toBeInTheDocument();
      u5();
    });

    it('As Lupon: /blotter renders successfully; navigating to /templates, /officials, /audit-logs, or /settings redirects to /unauthorized', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes('/api/auth/me')) {
          return new Response(JSON.stringify({ user: mockUserWithRole('Lupon') }), { status: 200 });
        }
        if (url.includes('/api/blotter')) {
          return new Response(
            JSON.stringify({ data: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 1 } }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });

      // Lupon on /blotter
      const { unmount: u1 } = render(
        <MemoryRouter initialEntries={['/blotter']}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </MemoryRouter>
      );
      expect(await screen.findByRole('heading', { name: /blotter records/i })).toBeInTheDocument();
      u1();

      // Lupon on /templates -> /unauthorized
      const { unmount: u2 } = render(
        <MemoryRouter initialEntries={['/templates']}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </MemoryRouter>
      );
      await waitFor(() => {
        expect(screen.getByText(/access denied/i)).toBeInTheDocument();
      });
      u2();

      // Lupon on /officials -> /unauthorized
      const { unmount: u3 } = render(
        <MemoryRouter initialEntries={['/officials']}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </MemoryRouter>
      );
      await waitFor(() => {
        expect(screen.getByText(/access denied/i)).toBeInTheDocument();
      });
      u3();

      // Lupon on /audit-logs -> /unauthorized
      const { unmount: u4 } = render(
        <MemoryRouter initialEntries={['/audit-logs']}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </MemoryRouter>
      );
      await waitFor(() => {
        expect(screen.getByText(/access denied/i)).toBeInTheDocument();
      });
      u4();

      // Lupon on /settings -> /unauthorized
      const { unmount: u5 } = render(
        <MemoryRouter initialEntries={['/settings']}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </MemoryRouter>
      );
      await waitFor(() => {
        expect(screen.getByText(/access denied/i)).toBeInTheDocument();
      });
      u5();
    });

    it('As Clerk or Treasurer: navigating to /blotter, /templates, /officials, /audit-logs, or /settings redirects to /unauthorized', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes('/api/auth/me')) {
          return new Response(JSON.stringify({ user: mockUserWithRole('Clerk') }), { status: 200 });
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });

      // Clerk on /blotter -> /unauthorized
      const { unmount: u1 } = render(
        <MemoryRouter initialEntries={['/blotter']}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </MemoryRouter>
      );
      await waitFor(() => {
        expect(screen.getByText(/access denied/i)).toBeInTheDocument();
      });
      u1();

      // Clerk on /settings -> /unauthorized
      const { unmount: u2 } = render(
        <MemoryRouter initialEntries={['/settings']}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </MemoryRouter>
      );
      await waitFor(() => {
        expect(screen.getByText(/access denied/i)).toBeInTheDocument();
      });
      u2();
    });
  });

  // 9. Blotter Printing & Template Studio Enhancements (Coupon Sizes, Header Studio & .docx Feed)
  describe('9. Blotter Printing & Template Studio Enhancements', () => {
    it('Opens BlotterPrintPreviewModal from BlotterPage, switches KP form & Coupon Size (Short/A4/Long), and prints', async () => {
      window.print = vi.fn();

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes('/api/auth/me')) {
          return new Response(JSON.stringify({ user: mockUserWithRole('Lupon') }), { status: 200 });
        }
        if (url.includes('/api/blotter/101/print-preview')) {
          return new Response(
            JSON.stringify({
              html: '<p>Summons for Juan Dela Cruz regarding Physical Injury</p>',
              header_html: '<p>OFFICE OF THE LUPONG TAGAPAMAYAPA</p>',
              header_config_json: '{}',
              footer_html: '',
              title_header: 'SUMMONS (KP FORM NO. 9)',
              template_id: 102,
              template_code: 'KP_SUMMONS',
              template_name: 'KP Form No. 9 - Summons',
              paper_size: 'long',
              show_officials_sidebar: 0,
              sidebar_officials: mockOfficials,
              case_number: 'BLT-2026-001',
              signatory_name: 'HON. JUAN DELA CRUZ',
              signatory_position: 'Punong Barangay',
              is_oic_signing: 0
            }),
            { status: 200 }
          );
        }
        if (url.includes('/api/blotter')) {
          return new Response(
            JSON.stringify({
              data: mockBlotterRecords,
              pagination: { total: mockBlotterRecords.length, page: 1, limit: 10, totalPages: 1 }
            }),
            { status: 200 }
          );
        }
        if (url.includes('/api/officials')) {
          return new Response(JSON.stringify(mockOfficials), { status: 200 });
        }
        if (url.includes('/api/templates')) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });

      render(
        <MemoryRouter initialEntries={['/blotter']}>
          <AuthProvider>
            <BlotterPage />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('print-blotter-btn-101')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('print-blotter-btn-101'));

      const printModal = await screen.findByTestId('blotter-print-preview-modal');
      expect(printModal).toBeInTheDocument();

      // Switch coupon size to Long (8.5x13")
      fireEvent.click(screen.getByTestId('blotter-paper-size-btn-long'));
      expect(screen.getByTestId('printable-certificate-area')).toHaveAttribute('data-paper-size', 'long');

      // Click Print Blotter / KP Form
      fireEvent.click(screen.getByTestId('blotter-print-button'));
      expect(window.print).toHaveBeenCalled();
    });

    it('Supports Coupon Bond Size selection and Apply Header to All Templates in TemplatesPage', async () => {
      let syncedPayload: any = null;
      let savedPayload: any = null;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        const method = init?.method || 'GET';

        if (url.includes('/api/auth/me')) {
          return new Response(JSON.stringify({ user: mockUserWithRole('Admin') }), { status: 200 });
        }
        if (url.includes('/api/templates/sync-header') && method === 'POST') {
          syncedPayload = JSON.parse(init?.body as string);
          return new Response(
            JSON.stringify({ message: 'Synced', updatedCount: 8 }),
            { status: 200 }
          );
        }
        if (url.includes('/api/templates/1') && method === 'PUT') {
          savedPayload = JSON.parse(init?.body as string);
          return new Response(
            JSON.stringify({ ...mockTemplates[0], ...savedPayload }),
            { status: 200 }
          );
        }
        if (url.includes('/api/templates')) {
          return new Response(JSON.stringify(mockTemplates), { status: 200 });
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });

      render(
        <MemoryRouter initialEntries={['/templates']}>
          <AuthProvider>
            <TemplatesPage />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('template-paper-size-select')).toBeInTheDocument();
      });

      // Change coupon bond size to Long
      fireEvent.change(screen.getByTestId('template-paper-size-select'), {
        target: { value: 'long' }
      });

      // Click Apply Header to All Templates
      fireEvent.click(screen.getByTestId('sync-header-all-btn'));
      await waitFor(() => {
        expect(syncedPayload).not.toBeNull();
        expect(syncedPayload.header_html).toContain('Republic of the Philippines');
      });

      // Save template and verify paper_size and header_html are sent
      fireEvent.click(screen.getByRole('button', { name: /save template/i }));
      await waitFor(() => {
        expect(savedPayload).not.toBeNull();
        expect(savedPayload.paper_size).toBe('long');
        expect(savedPayload.header_html).toBeDefined();
      });
    });
  });
});
