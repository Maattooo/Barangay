import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import ResidentsPage from '../pages/ResidentsPage';
import api from '../services/api';
import { UserRole } from '../types/auth';
import { Resident } from '../types/resident';

const mockUserWithRole = (role: UserRole) => ({
  id: 1,
  username: role.toLowerCase(),
  full_name: `${role} Officer`,
  role,
  official_id: 1
});

const mockResident1: Resident = {
  id: 1,
  first_name: 'Juan',
  middle_name: 'Santos',
  last_name: 'Dela Cruz',
  suffix: 'Jr.',
  birthdate: '1960-05-15',
  sex: 'Male',
  civil_status: 'Married',
  purok: 'Purok 1',
  house_no_street: '123 Rizal Street',
  contact_no: '09171234567',
  occupation: 'Farmer',
  nationality: 'Filipino',
  residency_status: 'Active',
  is_voter: 1,
  precinct_no: '0012A',
  is_pwd: 1,
  pwd_id_no: 'PWD-101',
  pwd_disability_type: 'Visual Impairment',
  is_solo_parent: 0,
  solo_parent_id_no: '',
  is_4ps: 1,
  is_indigent: 0,
  is_ofw: 0,
  is_osy: 0,
  senior_id_no: 'OSCA-551',
  is_archived: 0,
  created_by: 1,
  updated_by: 1,
  created_at: '2026-01-01 10:00:00',
  updated_at: '2026-01-01 10:00:00',
  age: 65,
  is_senior: true,
  is_youth: false,
  is_minor: false
};

const mockResident2: Resident = {
  id: 2,
  first_name: 'Maria',
  middle_name: 'Clara',
  last_name: 'Santos',
  suffix: '',
  birthdate: '2005-08-20',
  sex: 'Female',
  civil_status: 'Single',
  purok: 'Purok 2',
  house_no_street: '456 Bonifacio St.',
  contact_no: '09187654321',
  occupation: 'Student',
  nationality: 'Filipino',
  residency_status: 'Active',
  is_voter: 1,
  precinct_no: '0015B',
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
  created_at: '2026-01-02 11:00:00',
  updated_at: '2026-01-02 11:00:00',
  age: 21,
  is_senior: false,
  is_youth: true,
  is_minor: false
};

describe('Phase 10 — Frontend Resident RBI Module & Excel I/O Tests', () => {
  let fetchCalls: Array<{ url: string; method: string; body?: any; headers?: any }> = [];

  const setupFetchMock = (role: UserRole = 'Admin', residentsData: Resident[] = [mockResident1, mockResident2]) => {
    fetchCalls = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const method = init?.method || 'GET';
      const body = init?.body;
      const headers = init?.headers;

      fetchCalls.push({ url, method, body, headers });

      if (url.includes('/api/auth/me')) {
        return new Response(JSON.stringify({ user: mockUserWithRole(role) }), { status: 200 });
      }

      if (url.includes('/api/residents/export-excel')) {
        return new Response(new Blob(['fake-excel-data'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), {
          status: 200,
          headers: {
            'Content-Disposition': 'attachment; filename="barangay_residents.xlsx"'
          }
        });
      }

      if (url.includes('/api/residents/import-excel')) {
        return new Response(
          JSON.stringify({
            total_processed: 10,
            imported_count: 8,
            skipped_duplicates: 2,
            errors: []
          }),
          { status: 200 }
        );
      }

      if (url.includes('/api/residents/') && url.endsWith('/archive') && method === 'PATCH') {
        return new Response(JSON.stringify({ message: 'Resident archived successfully' }), { status: 200 });
      }

      if (url.includes('/api/residents/') && method === 'PUT') {
        const payload = body ? JSON.parse(body.toString()) : {};
        return new Response(JSON.stringify({ ...mockResident1, ...payload }), { status: 200 });
      }

      if (url.endsWith('/api/residents') && method === 'POST') {
        const payload = body ? JSON.parse(body.toString()) : {};
        return new Response(JSON.stringify({ id: 3, ...payload, age: 30, is_senior: false, is_youth: true, is_minor: false }), { status: 201 });
      }

      if (url.includes('/api/residents')) {
        return new Response(
          JSON.stringify({
            data: residentsData,
            pagination: {
              total: residentsData.length,
              page: 1,
              limit: 20,
              totalPages: 1
            }
          }),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify({}), { status: 200 });
    });
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    api.setToken('test-token');
  });

  // 1. Resident Table & Data Fetching
  describe('1. Resident Table & Data Fetching', () => {
    it('Mounts ResidentsPage, asserts GET /api/residents is called with default pagination, displays full names, dynamic age values, purok, and residency status', async () => {
      setupFetchMock('Admin');

      render(
        <MemoryRouter>
          <AuthProvider>
            <ResidentsPage />
          </AuthProvider>
        </MemoryRouter>
      );

      // Verify initial call includes default pagination
      await waitFor(() => {
        const residentCalls = fetchCalls.filter((c) => c.url.includes('/api/residents') && c.method === 'GET');
        expect(residentCalls.length).toBeGreaterThanOrEqual(1);
        expect(residentCalls[0].url).toContain('page=1');
        expect(residentCalls[0].url).toContain('limit=20');
      });

      // Verify resident demographic records render
      await waitFor(() => {
        expect(screen.getByText('Dela Cruz, Juan Santos Jr.')).toBeInTheDocument();
        expect(screen.getByText('Santos, Maria Clara')).toBeInTheDocument();
      });

      expect(screen.getByText(/65 yrs/)).toBeInTheDocument();
      expect(screen.getByText(/21 yrs/)).toBeInTheDocument();
      expect(screen.getByTestId('resident-row-1')).toHaveTextContent('Purok 1');
      expect(screen.getByTestId('resident-row-2')).toHaveTextContent('Purok 2');

      // Verify active status pill badges
      const activeBadges = screen.getAllByText('Active');
      expect(activeBadges.length).toBeGreaterThan(0);

      // Verify sector badge chips for Juan (Senior, PWD, 4Ps, Voter)
      const juanRow = screen.getByTestId('resident-row-1');
      expect(juanRow).toHaveTextContent('Senior');
      expect(juanRow).toHaveTextContent('PWD');
      expect(juanRow).toHaveTextContent('4Ps');
      expect(juanRow).toHaveTextContent('Voter');
    });
  });

  // 2. Debounced Search & Purok Filter
  describe('2. Debounced Search & Purok Filter', () => {
    it('Dispatches debounced search query and purok filter API calls', async () => {
      setupFetchMock('Admin');

      render(
        <MemoryRouter>
          <AuthProvider>
            <ResidentsPage />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Dela Cruz, Juan Santos Jr.')).toBeInTheDocument();
      });

      // 1. Types search query in name input: asserts debounced API call with search=dela cruz
      const searchInput = screen.getByTestId('resident-search-input');
      fireEvent.change(searchInput, { target: { value: 'dela cruz' } });

      await waitFor(
        () => {
          const debouncedCalls = fetchCalls.filter((c) => c.url.includes('search=dela+cruz') || c.url.includes('search=dela%20cruz'));
          expect(debouncedCalls.length).toBeGreaterThan(0);
        },
        { timeout: 1500 }
      );

      // 2. Selects a purok from dropdown: asserts API call with purok=Purok 2
      const purokSelect = screen.getByTestId('purok-filter-select');
      fireEvent.change(purokSelect, { target: { value: 'Purok 2' } });

      await waitFor(() => {
        const purokCalls = fetchCalls.filter((c) => c.url.includes('purok=Purok+2') || c.url.includes('purok=Purok%202'));
        expect(purokCalls.length).toBeGreaterThan(0);
      });
    });
  });

  // 3. Combinatorial Sector Filter Chips
  describe('3. Combinatorial Sector Filter Chips', () => {
    it('Toggles sector chips independently and enforces combinatorial multi-select querying and clear all', async () => {
      setupFetchMock('Admin');

      render(
        <MemoryRouter>
          <AuthProvider>
            <ResidentsPage />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Dela Cruz, Juan Santos Jr.')).toBeInTheDocument();
      });

      // 1. Toggle "Senior Citizen" chip -> sectors=senior
      const seniorChip = screen.getByTestId('chip-senior');
      fireEvent.click(seniorChip);

      await waitFor(() => {
        const seniorCalls = fetchCalls.filter((c) => c.url.includes('sectors=senior') && !c.url.includes('pwd'));
        expect(seniorCalls.length).toBeGreaterThan(0);
      });

      // 2. Simultaneously toggle "PWD" chip -> sectors=senior,pwd
      const pwdChip = screen.getByTestId('chip-pwd');
      fireEvent.click(pwdChip);

      await waitFor(() => {
        const combinatorialCalls = fetchCalls.filter((c) =>
          c.url.includes('sectors=senior%2Cpwd') || c.url.includes('sectors=senior,pwd')
        );
        expect(combinatorialCalls.length).toBeGreaterThan(0);
      });

      // 3. Simultaneously toggle "4Ps" chip -> sectors=senior,pwd,4ps
      const fourPsChip = screen.getByTestId('chip-4ps');
      fireEvent.click(fourPsChip);

      await waitFor(() => {
        const threeSectorCalls = fetchCalls.filter((c) =>
          c.url.includes('sectors=senior%2Cpwd%2C4ps') || c.url.includes('sectors=senior,pwd,4ps')
        );
        expect(threeSectorCalls.length).toBeGreaterThan(0);
      });

      // 4. Click "Clear All Sectors": asserts chips deactivate and sectors parameter is cleared
      const clearBtn = screen.getByTestId('clear-sectors-btn');
      expect(clearBtn).toBeInTheDocument();
      fireEvent.click(clearBtn);

      await waitFor(() => {
        const lastCall = fetchCalls[fetchCalls.length - 1];
        expect(lastCall.url).not.toContain('sectors=');
      });
    });
  });

  // 4. Resident Creation & Validation
  describe('4. Resident Creation & Validation (ResidentFormModal)', () => {
    it('Renders demographic inputs, validates required fields, reveals conditional ID inputs, and posts new resident', async () => {
      setupFetchMock('Admin');

      render(
        <MemoryRouter>
          <AuthProvider>
            <ResidentsPage />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('new-resident-btn')).toBeInTheDocument();
      });

      // 1. Opens "New Resident" modal
      fireEvent.click(screen.getByTestId('new-resident-btn'));
      expect(screen.getByTestId('resident-form-modal')).toBeInTheDocument();

      // 2. Submits empty form: asserts validation errors
      fireEvent.click(screen.getByTestId('submit-resident-btn'));
      await waitFor(() => {
        expect(screen.getByText('First name is required')).toBeInTheDocument();
        expect(screen.getByText('Last name is required')).toBeInTheDocument();
        expect(screen.getByText('Birthdate is required')).toBeInTheDocument();
        expect(screen.getByText('Sex is required')).toBeInTheDocument();
        expect(screen.getByText('Civil status is required')).toBeInTheDocument();
        expect(screen.getByText('Purok is required')).toBeInTheDocument();
      });

      // 3. Checks PWD checkbox: reveals pwd_id_no and pwd_disability_type
      const pwdCheckbox = screen.getByLabelText(/PWD/);
      expect(screen.queryByTestId('pwd-id-field')).not.toBeInTheDocument();
      fireEvent.click(pwdCheckbox);
      expect(screen.getByTestId('pwd-id-field')).toBeInTheDocument();
      expect(screen.getByTestId('pwd-disability-field')).toBeInTheDocument();

      // 4. Checks Registered Voter checkbox: reveals precinct_no
      const voterCheckbox = screen.getByLabelText(/Registered Voter/);
      expect(screen.queryByTestId('precinct-field')).not.toBeInTheDocument();
      fireEvent.click(voterCheckbox);
      expect(screen.getByTestId('precinct-field')).toBeInTheDocument();

      // 5. Fills valid demographic data and submits
      fireEvent.change(screen.getByPlaceholderText('e.g. Juan'), { target: { value: 'Pedro' } });
      fireEvent.change(screen.getByPlaceholderText('e.g. Dela Cruz'), { target: { value: 'Penduko' } });
      fireEvent.change(document.querySelector('input[name="birthdate"]')!, { target: { value: '1995-12-10' } });
      fireEvent.change(document.querySelector('select[name="sex"]')!, { target: { value: 'Male' } });
      fireEvent.change(document.querySelector('select[name="civil_status"]')!, { target: { value: 'Single' } });
      fireEvent.change(screen.getByPlaceholderText('e.g. Purok 1'), { target: { value: 'Purok 3' } });
      fireEvent.change(screen.getByPlaceholderText('e.g. 0012A'), { target: { value: '0099A' } });
      fireEvent.change(screen.getByPlaceholderText('e.g. PWD-2026-001'), { target: { value: 'PWD-888' } });
      fireEvent.change(screen.getByPlaceholderText('e.g. Visual Impairment, Mobility'), { target: { value: 'Hearing' } });

      fireEvent.click(screen.getByTestId('submit-resident-btn'));

      await waitFor(() => {
        const postCalls = fetchCalls.filter((c) => c.url.endsWith('/api/residents') && c.method === 'POST');
        expect(postCalls.length).toBe(1);
        const body = JSON.parse(postCalls[0].body);
        expect(body.first_name).toBe('Pedro');
        expect(body.last_name).toBe('Penduko');
        expect(body.birthdate).toBe('1995-12-10');
        expect(body.sex).toBe('Male');
        expect(body.civil_status).toBe('Single');
        expect(body.purok).toBe('Purok 3');
        expect(body.is_pwd).toBe(1);
        expect(body.pwd_id_no).toBe('PWD-888');
        expect(body.is_voter).toBe(1);
        expect(body.precinct_no).toBe('0099A');
      });

      // Asserts modal closes
      await waitFor(() => {
        expect(screen.queryByTestId('resident-form-modal')).not.toBeInTheDocument();
      });
    });
  });

  // 5. Resident Edit Workflow
  describe('5. Resident Edit Workflow', () => {
    it('Opens modal pre-filled with resident attributes and sector IDs, modifies address and updates profile', async () => {
      setupFetchMock('Admin');

      render(
        <MemoryRouter>
          <AuthProvider>
            <ResidentsPage />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('edit-resident-1')).toBeInTheDocument();
      });

      // 1. Click "Edit" on resident 1
      fireEvent.click(screen.getByTestId('edit-resident-1'));
      expect(screen.getByTestId('resident-form-modal')).toBeInTheDocument();

      // Asserts pre-filled fields
      expect(screen.getByDisplayValue('Juan')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Dela Cruz')).toBeInTheDocument();
      expect(screen.getByDisplayValue('123 Rizal Street')).toBeInTheDocument();
      expect(screen.getByDisplayValue('PWD-101')).toBeInTheDocument();
      expect(screen.getByDisplayValue('0012A')).toBeInTheDocument();
      expect(screen.getByDisplayValue('OSCA-551')).toBeInTheDocument();

      // 2. Modifies address and submits
      const addressInput = screen.getByDisplayValue('123 Rizal Street');
      fireEvent.change(addressInput, { target: { value: '789 Mabini St.' } });

      fireEvent.click(screen.getByTestId('submit-resident-btn'));

      await waitFor(() => {
        const putCalls = fetchCalls.filter((c) => c.url.includes('/api/residents/1') && c.method === 'PUT');
        expect(putCalls.length).toBe(1);
        const body = JSON.parse(putCalls[0].body);
        expect(body.house_no_street).toBe('789 Mabini St.');
      });

      await waitFor(() => {
        expect(screen.queryByTestId('resident-form-modal')).not.toBeInTheDocument();
      });
    });
  });

  // 6. Archival Confirmation Dialog
  describe('6. Archival Confirmation Dialog (ArchiveResidentDialog)', () => {
    it('Opens confirmation dialog with resident details, and confirms soft-delete archival', async () => {
      setupFetchMock('Admin');

      render(
        <MemoryRouter>
          <AuthProvider>
            <ResidentsPage />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('archive-resident-1')).toBeInTheDocument();
      });

      // 1. Click "Archive" on resident 1
      fireEvent.click(screen.getByTestId('archive-resident-1'));

      // Asserts dialog opens with resident name
      expect(screen.getByTestId('archive-resident-dialog')).toBeInTheDocument();
      expect(screen.getByText('Juan Dela Cruz Jr.')).toBeInTheDocument();

      // 2. Confirms archival
      fireEvent.click(screen.getByTestId('confirm-archive-btn'));

      await waitFor(() => {
        const patchCalls = fetchCalls.filter((c) => c.url.includes('/api/residents/1/archive') && c.method === 'PATCH');
        expect(patchCalls.length).toBe(1);
      });

      // Asserts dialog closes
      await waitFor(() => {
        expect(screen.queryByTestId('archive-resident-dialog')).not.toBeInTheDocument();
      });
    });
  });

  // 7. Excel Bulk Import Modal
  describe('7. Excel Bulk Import Modal', () => {
    it('Renders upload zone, executes multipart upload, and displays duplicate count summary', async () => {
      setupFetchMock('Admin');

      render(
        <MemoryRouter>
          <AuthProvider>
            <ResidentsPage />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('import-excel-btn')).toBeInTheDocument();
      });

      // 1. Open Import Modal
      fireEvent.click(screen.getByTestId('import-excel-btn'));
      expect(screen.getByTestId('excel-import-modal')).toBeInTheDocument();
      expect(screen.getByTestId('excel-file-input')).toBeInTheDocument();

      // 2. Simulate file selection
      const fileInput = screen.getByTestId('excel-file-input');
      const sampleFile = new File(['mock content'], 'residents_masterlist.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      fireEvent.change(fileInput, { target: { files: [sampleFile] } });

      expect(screen.getByText('residents_masterlist.xlsx')).toBeInTheDocument();

      // 3. Upload file
      fireEvent.click(screen.getByTestId('upload-excel-btn'));

      await waitFor(() => {
        const importCalls = fetchCalls.filter((c) => c.url.includes('/api/residents/import-excel') && c.method === 'POST');
        expect(importCalls.length).toBe(1);
        expect(importCalls[0].body).toBeInstanceOf(FormData);
      });

      // 4. Assert summary view displays processed, imported, and skipped duplicates
      await waitFor(() => {
        expect(screen.getByTestId('import-summary-view')).toBeInTheDocument();
      });

      expect(screen.getByTestId('total-processed')).toHaveTextContent('10');
      expect(screen.getByTestId('imported-count')).toHaveTextContent('8');
      expect(screen.getByTestId('skipped-duplicates')).toHaveTextContent('2');

      // 5. Click Done
      fireEvent.click(screen.getByTestId('import-done-btn'));
      await waitFor(() => {
        expect(screen.queryByTestId('excel-import-modal')).not.toBeInTheDocument();
      });
    });
  });

  // 8. Excel Export Trigger
  describe('8. Excel Export Trigger', () => {
    it('Dispatches exportExcelResidents with active search and sector parameters', async () => {
      setupFetchMock('Admin');

      const exportSpy = vi.spyOn(api, 'exportExcelResidents');

      render(
        <MemoryRouter>
          <AuthProvider>
            <ResidentsPage />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('export-excel-btn')).toBeInTheDocument();
      });

      // 1. Set active search filter
      const searchInput = screen.getByTestId('resident-search-input');
      fireEvent.change(searchInput, { target: { value: 'dela cruz' } });

      // 2. Set active sector filter (Senior)
      const seniorChip = screen.getByTestId('chip-senior');
      fireEvent.click(seniorChip);

      // Wait for debounce
      await waitFor(() => {
        const searchCalls = fetchCalls.filter((c) => c.url.includes('search=dela+cruz') || c.url.includes('search=dela%20cruz'));
        expect(searchCalls.length).toBeGreaterThan(0);
      });

      // 3. Click "Export Excel"
      fireEvent.click(screen.getByTestId('export-excel-btn'));

      await waitFor(() => {
        expect(exportSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            search: 'dela cruz',
            sectors: ['senior']
          })
        );
      });
    });
  });

  // 9. Role-Based UI Guards (RBAC)
  describe('9. Role-Based UI Guards (RBAC)', () => {
    it('As Admin: renders New Resident, Edit, Archive, Import Excel, and Export Excel buttons', async () => {
      setupFetchMock('Admin');

      render(
        <MemoryRouter>
          <AuthProvider>
            <ResidentsPage />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('new-resident-btn')).toBeInTheDocument();
      });

      expect(screen.getByTestId('import-excel-btn')).toBeInTheDocument();
      expect(screen.getByTestId('export-excel-btn')).toBeInTheDocument();
      expect(screen.getByTestId('edit-resident-1')).toBeInTheDocument();
      expect(screen.getByTestId('archive-resident-1')).toBeInTheDocument();
    });

    it('As Clerk: renders New Resident, Edit, and Export Excel; DOES NOT render Archive or Import Excel', async () => {
      setupFetchMock('Clerk');

      render(
        <MemoryRouter>
          <AuthProvider>
            <ResidentsPage />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('new-resident-btn')).toBeInTheDocument();
      });

      expect(screen.getByTestId('export-excel-btn')).toBeInTheDocument();
      expect(screen.getByTestId('edit-resident-1')).toBeInTheDocument();

      // Clerk forbidden buttons
      expect(screen.queryByTestId('import-excel-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('archive-resident-1')).not.toBeInTheDocument();
    });

    it('As Treasurer: renders Export Excel; DOES NOT render New Resident, Edit, Archive, or Import Excel', async () => {
      setupFetchMock('Treasurer');

      render(
        <MemoryRouter>
          <AuthProvider>
            <ResidentsPage />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('export-excel-btn')).toBeInTheDocument();
      });

      // Treasurer forbidden buttons
      expect(screen.queryByTestId('new-resident-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('import-excel-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('edit-resident-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('archive-resident-1')).not.toBeInTheDocument();
    });

    it('As Lupon: table and search/chips are accessible; DOES NOT render New Resident, Edit, Archive, Import Excel, or Export Excel', async () => {
      setupFetchMock('Lupon');

      render(
        <MemoryRouter>
          <AuthProvider>
            <ResidentsPage />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('resident-search-input')).toBeInTheDocument();
      });

      expect(screen.getByTestId('sector-filter-chips-bar')).toBeInTheDocument();
      expect(screen.getByTestId('resident-table')).toBeInTheDocument();

      // Lupon forbidden buttons
      expect(screen.queryByTestId('new-resident-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('import-excel-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('export-excel-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('edit-resident-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('archive-resident-1')).not.toBeInTheDocument();
    });
  });
});
