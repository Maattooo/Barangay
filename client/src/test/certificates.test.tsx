import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { AppRoutes } from '../App';
import NewCertificatePage from '../pages/NewCertificatePage';
import CertificatesPage from '../pages/CertificatesPage';
import CertificatePrintSheet from '../components/certificates/CertificatePrintSheet';
import PrintPreviewModal from '../components/certificates/PrintPreviewModal';
import api from '../services/api';
import { UserRole } from '../types/auth';
import { Resident } from '../types/resident';
import {
  CertificateTemplate,
  BarangayOfficial,
  BlotterCheckResponse,
  IssuanceListResponse,
  PreviewIssuanceResponse,
  PrintableIssuancePayload,
  SingleIssuanceResponse
} from '../types/certificates';

// Mock user helper
const mockUserWithRole = (role: UserRole) => ({
  id: 1,
  username: role.toLowerCase(),
  full_name: `${role} Officer`,
  role,
  official_id: 1
});

// Mock Resident
const mockResident: Resident = {
  id: 1,
  first_name: 'Juan',
  middle_name: 'Mendoza',
  last_name: 'Dela Cruz',
  suffix: 'Jr.',
  birthdate: '1975-06-12',
  sex: 'Male',
  civil_status: 'Married',
  purok: 'Purok 1',
  house_no_street: '123 Rizal St.',
  contact_no: '09171234567',
  occupation: 'Mechanic',
  nationality: 'Filipino',
  residency_status: 'Active',
  is_voter: 1,
  precinct_no: '0012A',
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
  created_at: '2026-01-01 10:00:00',
  updated_at: '2026-01-01 10:00:00',
  age: 50,
  is_senior: false,
  is_youth: false,
  is_minor: false
};

// Mock Templates
const mockTemplates: CertificateTemplate[] = [
  {
    id: 1,
    template_code: 'BRGY_CLEARANCE',
    template_name: 'Barangay Clearance',
    title_header: 'BARANGAY CLEARANCE',
    body_html: '<p>This certifies that <strong>JUAN DELA CRUZ</strong> has no derogatory record.</p>',
    show_officials_sidebar: 1,
    default_fee: 50,
    requires_blotter_check: 1,
    is_active: 1
  },
  {
    id: 2,
    template_code: 'INDIGENCY',
    template_name: 'Certificate of Indigency',
    title_header: 'CERTIFICATE OF INDIGENCY',
    body_html: '<p>This certifies indigency status.</p>',
    show_officials_sidebar: 0,
    default_fee: 0,
    requires_blotter_check: 0,
    is_active: 1
  }
];

// Mock Barangay Officials
const mockOfficials: BarangayOfficial[] = [
  {
    id: 1,
    full_name: 'Hon. Roberto Santos',
    position: 'Punong Barangay',
    committee: null,
    rank_order: 1,
    term_start: '2023-11-01',
    term_end: '2026-11-01',
    is_active: 1
  },
  {
    id: 2,
    full_name: 'Hon. Maria Clara',
    position: 'Sangguniang Barangay Member',
    committee: 'Committee on Peace and Order',
    rank_order: 2,
    term_start: '2023-11-01',
    term_end: '2026-11-01',
    is_active: 1
  },
  {
    id: 3,
    full_name: 'Hon. Jose Rizal',
    position: 'Sangguniang Barangay Member',
    committee: 'Committee on Education',
    rank_order: 3,
    term_start: '2023-11-01',
    term_end: '2026-11-01',
    is_active: 1
  }
];

describe('Phase 11 — Frontend Certificate Issuance Wizard & Native Print Engine Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    api.setToken(null);
    window.print = vi.fn();
  });

  describe('1. Wizard Step 1 — Resident Selection', () => {
    it('Search for resident by name, select from results, assert summary card details, and verify blotter check trigger', async () => {
      vi.spyOn(api, 'getTemplates').mockResolvedValue(mockTemplates);
      vi.spyOn(api, 'getOfficials').mockResolvedValue(mockOfficials);
      vi.spyOn(api, 'getResidents').mockResolvedValue({
        data: [mockResident],
        pagination: { total: 1, page: 1, limit: 10, totalPages: 1 }
      });
      const checkSpy = vi.spyOn(api, 'checkResidentBlotter').mockResolvedValue({
        cleared: true,
        cases: []
      });

      render(
        <MemoryRouter>
          <NewCertificatePage />
        </MemoryRouter>
      );

      // Search resident
      const searchInput = screen.getByTestId('resident-search-input');
      fireEvent.change(searchInput, { target: { value: 'Juan' } });

      // Wait for search results
      await waitFor(() => {
        expect(screen.getByTestId('resident-result-1')).toBeInTheDocument();
      });

      // Select resident
      const selectBtn = screen.getByTestId('select-resident-btn-1');
      fireEvent.click(selectBtn);

      // Assert resident summary card displays full name, birthdate, dynamic age, and purok
      await waitFor(() => {
        const summaryCard = screen.getByTestId('resident-summary-card');
        expect(summaryCard).toBeInTheDocument();
        expect(summaryCard).toHaveTextContent(/JUAN MENDOZA DELA CRUZ JR/i);
        expect(summaryCard).toHaveTextContent(/1975-06-12/);
        expect(summaryCard).toHaveTextContent(/50 years old/);
        expect(summaryCard).toHaveTextContent(/Purok 1/);
      });

      // Assert automated blotter check API is immediately triggered
      expect(checkSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('2. Wizard Step 2 — Clean Resident Gatekeeper Check', () => {
    it('Renders green badge "Cleared: No Pending Blotter Record" and unlocks proceeding to Step 3 without override', async () => {
      vi.spyOn(api, 'getTemplates').mockResolvedValue(mockTemplates);
      vi.spyOn(api, 'getOfficials').mockResolvedValue(mockOfficials);
      vi.spyOn(api, 'getResidents').mockResolvedValue({
        data: [mockResident],
        pagination: { total: 1, page: 1, limit: 10, totalPages: 1 }
      });
      vi.spyOn(api, 'checkResidentBlotter').mockResolvedValue({
        cleared: true,
        cases: []
      });

      render(
        <MemoryRouter>
          <NewCertificatePage />
        </MemoryRouter>
      );

      // Select resident to advance to Step 2
      fireEvent.change(screen.getByTestId('resident-search-input'), { target: { value: 'Juan' } });
      await waitFor(() => screen.getByTestId('select-resident-btn-1'));
      fireEvent.click(screen.getByTestId('select-resident-btn-1'));

      // Assert green badge renders
      await waitFor(() => {
        expect(screen.getByTestId('blotter-cleared-badge')).toBeInTheDocument();
        expect(screen.getByText(/Cleared: No Pending Blotter Record/i)).toBeInTheDocument();
      });

      // Assert proceed button is enabled and advances to Step 3 without override
      const proceedBtn = screen.getByTestId('proceed-to-step-3-button');
      expect(proceedBtn).toBeEnabled();

      fireEvent.click(proceedBtn);

      await waitFor(() => {
        expect(screen.getByText(/Step 3: Certificate Details & Accounting/i)).toBeInTheDocument();
      });
    });
  });

  describe('3. Wizard Step 2 — Active Blotter Gatekeeper Block', () => {
    it('Displays Red Gatekeeper Warning Card with case details and locks proceed button', async () => {
      vi.spyOn(api, 'getTemplates').mockResolvedValue(mockTemplates);
      vi.spyOn(api, 'getOfficials').mockResolvedValue(mockOfficials);
      vi.spyOn(api, 'getResidents').mockResolvedValue({
        data: [mockResident],
        pagination: { total: 1, page: 1, limit: 10, totalPages: 1 }
      });
      vi.spyOn(api, 'checkResidentBlotter').mockResolvedValue({
        cleared: false,
        cases: [
          {
            case_number: 'BLT-2026-001',
            complainant_name: 'Maria Clara',
            incident_type: 'Physical Injury',
            status: 'Active',
            date_recorded: '2026-10-20'
          }
        ]
      });

      render(
        <MemoryRouter>
          <NewCertificatePage />
        </MemoryRouter>
      );

      // Select resident to advance to Step 2
      fireEvent.change(screen.getByTestId('resident-search-input'), { target: { value: 'Juan' } });
      await waitFor(() => screen.getByTestId('select-resident-btn-1'));
      fireEvent.click(screen.getByTestId('select-resident-btn-1'));

      // Assert Red Gatekeeper Warning Card displays case details
      await waitFor(() => {
        expect(screen.getByTestId('blotter-gatekeeper-warning-card')).toBeInTheDocument();
        expect(screen.getByText(/BLT-2026-001/)).toBeInTheDocument();
        expect(screen.getByText(/Maria Clara/)).toBeInTheDocument();
        expect(screen.getByText(/Physical Injury/)).toBeInTheDocument();
        expect(within(screen.getByTestId('blotter-cases-table')).getByText('Active')).toBeInTheDocument();
      });

      // Assert Proceed button is locked and disabled
      const proceedBtn = screen.getByTestId('proceed-to-step-3-button');
      expect(proceedBtn).toBeDisabled();
    });
  });

  describe('4. Wizard Step 2 — Override Reason Validation', () => {
    it('Enforces override checkbox and minimum 10 non-whitespace characters justification', async () => {
      vi.spyOn(api, 'getTemplates').mockResolvedValue(mockTemplates);
      vi.spyOn(api, 'getOfficials').mockResolvedValue(mockOfficials);
      vi.spyOn(api, 'getResidents').mockResolvedValue({
        data: [mockResident],
        pagination: { total: 1, page: 1, limit: 10, totalPages: 1 }
      });
      vi.spyOn(api, 'checkResidentBlotter').mockResolvedValue({
        cleared: false,
        cases: [
          {
            case_number: 'BLT-2026-001',
            complainant_name: 'Maria Clara',
            incident_type: 'Physical Injury',
            status: 'Active',
            date_recorded: '2026-10-20'
          }
        ]
      });

      render(
        <MemoryRouter>
          <NewCertificatePage />
        </MemoryRouter>
      );

      fireEvent.change(screen.getByTestId('resident-search-input'), { target: { value: 'Juan' } });
      await waitFor(() => screen.getByTestId('select-resident-btn-1'));
      fireEvent.click(screen.getByTestId('select-resident-btn-1'));

      await waitFor(() => {
        expect(screen.getByTestId('authorize-override-checkbox')).toBeInTheDocument();
      });

      const proceedBtn = screen.getByTestId('proceed-to-step-3-button');
      expect(proceedBtn).toBeDisabled();

      // Check Authorize Issuance Override checkbox: textarea renders
      const overrideCheckbox = screen.getByTestId('authorize-override-checkbox');
      fireEvent.click(overrideCheckbox);

      await waitFor(() => {
        expect(screen.getByTestId('blotter_override_reason')).toBeInTheDocument();
      });

      const reasonTextarea = screen.getByTestId('blotter_override_reason');

      // Type reason < 10 characters: validation error appears and proceed remains disabled
      fireEvent.change(reasonTextarea, { target: { value: 'Medical' } });
      expect(screen.getByTestId('override-validation-error')).toBeInTheDocument();
      expect(proceedBtn).toBeDisabled();

      // Type whitespace-only reason: proceed remains disabled
      fireEvent.change(reasonTextarea, { target: { value: '          ' } });
      expect(proceedBtn).toBeDisabled();

      // Type valid justification (>= 10 characters)
      fireEvent.change(reasonTextarea, {
        target: { value: 'Emergency hospital assistance authorized by Captain' }
      });

      // Validation error disappears and proceed button is unlocked
      await waitFor(() => {
        expect(screen.queryByTestId('override-validation-error')).not.toBeInTheDocument();
        expect(proceedBtn).toBeEnabled();
      });

      // Advances to Step 3
      fireEvent.click(proceedBtn);
      await waitFor(() => {
        expect(screen.getByText(/Step 3: Certificate Details & Accounting/i)).toBeInTheDocument();
      });
    });
  });

  describe('5. Wizard Step 3 & 4 — Template & Signatory Configuration', () => {
    it('Selects template, verifies default fee, configures signatory and OIC, and calls preview API', async () => {
      vi.spyOn(api, 'getTemplates').mockResolvedValue(mockTemplates);
      vi.spyOn(api, 'getOfficials').mockResolvedValue(mockOfficials);
      vi.spyOn(api, 'getResidents').mockResolvedValue({
        data: [mockResident],
        pagination: { total: 1, page: 1, limit: 10, totalPages: 1 }
      });
      vi.spyOn(api, 'checkResidentBlotter').mockResolvedValue({
        cleared: true,
        cases: []
      });

      const previewSpy = vi.spyOn(api, 'previewIssuance').mockResolvedValue({
        html: '<p>Preview certificate body</p>',
        title_header: 'BARANGAY CLEARANCE',
        show_officials_sidebar: 1,
        control_number_preview: 'CERT-2026-PREVIEW',
        sidebar_officials: mockOfficials,
        blotter_status: { cleared: true, cases: [] },
        default_fee: 50
      });

      render(
        <MemoryRouter>
          <NewCertificatePage />
        </MemoryRouter>
      );

      // Step 1: Select resident
      fireEvent.change(screen.getByTestId('resident-search-input'), { target: { value: 'Juan' } });
      await waitFor(() => screen.getByTestId('select-resident-btn-1'));
      fireEvent.click(screen.getByTestId('select-resident-btn-1'));

      // Step 2: Proceed
      await waitFor(() => screen.getByTestId('proceed-to-step-3-button'));
      fireEvent.click(screen.getByTestId('proceed-to-step-3-button'));

      // Step 3: Template selector and default fee
      await waitFor(() => screen.getByTestId('certificate-template-select'));
      const templateSelect = screen.getByTestId('certificate-template-select');
      fireEvent.change(templateSelect, { target: { value: '1' } });

      const feeInput = screen.getByTestId('certificate-fee-input') as HTMLInputElement;
      expect(feeInput.value).toBe('50');

      // Enter purpose
      const purposeInput = screen.getByTestId('certificate-purpose-input');
      fireEvent.change(purposeInput, { target: { value: 'Local Employment' } });

      // Proceed to Step 4
      const proceedTo4Btn = screen.getByTestId('proceed-to-step-4-button');
      expect(proceedTo4Btn).toBeEnabled();
      fireEvent.click(proceedTo4Btn);

      // Step 4: Signatory and OIC toggle
      await waitFor(() => screen.getByTestId('signatory-official-select'));
      const signatorySelect = screen.getByTestId('signatory-official-select');
      fireEvent.change(signatorySelect, { target: { value: '2' } });

      const oicToggle = screen.getByTestId('oic-signing-toggle');
      fireEvent.click(oicToggle);

      // Click Preview Certificate
      const previewBtn = screen.getByTestId('preview-certificate-button');
      fireEvent.click(previewBtn);

      await waitFor(() => {
        expect(previewSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            resident_id: 1,
            template_id: 1,
            purpose: 'Local Employment',
            signatory_official_id: 2,
            is_oic_signing: 1
          })
        );
      });
    });
  });

  describe('6. Certificate Print Sheet Layout Verification', () => {
    it('Renders with show_officials_sidebar = 1: 28% left sidebar sorted by rank_order ASC and 72% right column', () => {
      // Provide officials in reverse order to test sorting
      const unorganizedOfficials = [mockOfficials[2], mockOfficials[0], mockOfficials[1]];

      render(
        <CertificatePrintSheet
          show_officials_sidebar={1}
          sidebar_officials={unorganizedOfficials}
          html="<p>This certifies that <strong>JUAN DELA CRUZ</strong> has been cleared.</p>"
          resident_name="JUAN DELA CRUZ"
          signatory_name="Hon. Maria Clara"
          signatory_position="Sangguniang Barangay Member"
          is_oic_signing={1}
        />
      );

      // Asserts 28% left sidebar exists
      const sidebar = screen.getByTestId('print-officials-sidebar');
      expect(sidebar).toBeInTheDocument();
      expect(sidebar).toHaveStyle({ width: '28%' });

      // Asserts council officials are ordered strictly by rank_order ASC
      const officialItems = screen.getAllByTestId(/official-sidebar-item-/);
      expect(officialItems).toHaveLength(3);
      expect(officialItems[0]).toHaveTextContent(/Hon\. Roberto Santos/i); // rank 1
      expect(officialItems[1]).toHaveTextContent(/Hon\. Maria Clara/i);   // rank 2
      expect(officialItems[2]).toHaveTextContent(/Hon\. Jose Rizal/i);    // rank 3

      // Asserts 72% right column
      const bodyColumn = screen.getByTestId('print-certificate-body');
      expect(bodyColumn).toBeInTheDocument();
      expect(bodyColumn).toHaveStyle({ width: '72%' });

      // Asserts resident name is rendered in bold uppercase
      expect(screen.getByText('JUAN DELA CRUZ')).toBeInTheDocument();

      // Asserts signatory subtitle contains "By Authority of the Punong Barangay"
      const signatoryBlock = screen.getByTestId('signatory-block');
      expect(signatoryBlock).toHaveTextContent(/By Authority of the Punong Barangay/i);
    });

    it('Renders with show_officials_sidebar = 0: sidebar is absent and body is full-width (100%)', () => {
      render(
        <CertificatePrintSheet
          show_officials_sidebar={0}
          sidebar_officials={mockOfficials}
          html="<p>Full width certificate for <strong>JUAN DELA CRUZ</strong>.</p>"
          resident_name="JUAN DELA CRUZ"
          signatory_name="Hon. Roberto Santos"
          is_oic_signing={0}
        />
      );

      // Asserts sidebar is absent
      expect(screen.queryByTestId('print-officials-sidebar')).not.toBeInTheDocument();

      // Asserts body is full-width (100%)
      const bodyColumn = screen.getByTestId('print-certificate-body');
      expect(bodyColumn).toBeInTheDocument();
      expect(bodyColumn).toHaveStyle({ width: '100%' });
    });
  });

  describe('7. Issuance Transaction & Native Print Execution', () => {
    it('Submits createIssuance, captures returned control number, and executes window.print()', async () => {
      const mockPrintablePayload: PrintableIssuancePayload = {
        issuance: {
          id: 101,
          control_number: 'CERT-2026-00042',
          resident_id: 1,
          template_id: 1,
          purpose: 'Local Employment',
          or_number: 'OR-12345',
          amount_paid: 50,
          ctc_number: '',
          ctc_date_issued: '',
          ctc_place_issued: '',
          signatory_official_id: 1,
          signatory_name_snapshot: 'Hon. Roberto Santos',
          signatory_position_snapshot: 'Punong Barangay',
          is_oic_signing: 0,
          had_active_blotter: 0,
          blotter_override_reason: '',
          issued_by_user_id: 1,
          issued_at: '2026-10-22 14:00:00'
        },
        html: '<p>Official Certificate HTML</p>',
        sidebar_officials: mockOfficials,
        template_name: 'Barangay Clearance',
        title_header: 'BARANGAY CLEARANCE',
        show_officials_sidebar: 1
      };

      const createSpy = vi.spyOn(api, 'createIssuance').mockResolvedValue(mockPrintablePayload);
      const printSpy = vi.spyOn(window, 'print');

      const createInput = {
        resident_id: 1,
        template_id: 1,
        purpose: 'Local Employment',
        signatory_official_id: 1,
        amount_paid: 50,
        or_number: 'OR-12345'
      };

      render(
        <PrintPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          mode="create"
          createPayload={createInput}
          previewData={{
            html: '<p>Preview text</p>',
            title_header: 'BARANGAY CLEARANCE',
            control_number_preview: 'CERT-2026-PREVIEW'
          }}
        />
      );

      const issuePrintBtn = screen.getByTestId('issue-and-print-button');
      fireEvent.click(issuePrintBtn);

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalledWith(createInput);
        expect(printSpy).toHaveBeenCalled();
        expect(screen.getAllByText('CERT-2026-00042').length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('8. Issuance History Log & Reprint Capability', () => {
    it('Mounts CertificatesPage, fetches history, renders blotter override badge, and opens reprint modal with snapshotted signatory', async () => {
      const mockHistoryList: IssuanceListResponse = {
        data: [
          {
            id: 1,
            control_number: 'CERT-2026-00001',
            resident_id: 1,
            resident_name: 'Juan Dela Cruz',
            template_id: 1,
            template_name: 'Barangay Clearance',
            purpose: 'Employment Clearance',
            or_number: 'OR-5501',
            amount_paid: 50,
            ctc_number: '',
            ctc_date_issued: '',
            ctc_place_issued: '',
            signatory_official_id: 1,
            signatory_name_snapshot: 'HON. ROBERTO SANTOS',
            signatory_position_snapshot: 'Punong Barangay',
            is_oic_signing: 0,
            had_active_blotter: 1,
            blotter_override_reason: 'Approved by Punong Barangay for urgent hospital work',
            issued_by_user_id: 2,
            issued_by_name: 'Maria Clerk',
            issued_at: '2026-10-21 09:30:00'
          }
        ],
        pagination: { total: 1, page: 1, limit: 10, totalPages: 1 }
      };

      const getIssuancesSpy = vi.spyOn(api, 'getIssuances').mockResolvedValue(mockHistoryList);
      vi.spyOn(api, 'getTemplates').mockResolvedValue(mockTemplates);

      const singleIssuanceDetail: SingleIssuanceResponse = {
        ...mockHistoryList.data[0],
        html: '<p>Historical printed clearance body</p>',
        sidebar_officials: mockOfficials,
        title_header: 'BARANGAY CLEARANCE',
        show_officials_sidebar: 1
      };

      const getByIdSpy = vi.spyOn(api, 'getIssuanceById').mockResolvedValue(singleIssuanceDetail);

      render(
        <MemoryRouter>
          <CertificatesPage />
        </MemoryRouter>
      );

      // Asserts GET /api/issuances is invoked
      await waitFor(() => {
        expect(getIssuancesSpy).toHaveBeenCalled();
      });

      // Asserts table displays issued record details
      await waitFor(() => {
        expect(screen.getByText('CERT-2026-00001')).toBeInTheDocument();
        expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
        expect(screen.getByText('Maria Clerk')).toBeInTheDocument();
      });

      // Asserts row with had_active_blotter = 1 renders Blotter Override warning badge
      const overrideBadge = screen.getByTestId('blotter-override-badge-1');
      expect(overrideBadge).toBeInTheDocument();
      expect(overrideBadge).toHaveTextContent(/Blotter Override/i);

      // Clicks Reprint button
      const reprintBtn = screen.getByTestId('reprint-btn-1');
      fireEvent.click(reprintBtn);

      // Asserts preview modal opens with snapshotted signatory name
      await waitFor(() => {
        expect(getByIdSpy).toHaveBeenCalledWith(1);
        const modal = screen.getByTestId('print-preview-modal');
        expect(modal).toBeInTheDocument();
        expect(within(modal).getByText('HON. ROBERTO SANTOS')).toBeInTheDocument();
      });
    });
  });

  describe('9. Role-Based Access Control (RBAC)', () => {
    const mockAuthFetch = (role: UserRole) => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes('/api/auth/me')) {
          return new Response(JSON.stringify({ user: mockUserWithRole(role) }), { status: 200 });
        }
        if (url.includes('/api/system/info')) {
          return new Response(
            JSON.stringify({ lan_ips: ['192.168.1.10'], settings: { barangay_name: 'Test Barangay' } }),
            { status: 200 }
          );
        }
        if (url.includes('/api/issuances')) {
          return new Response(
            JSON.stringify({ data: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 0 } }),
            { status: 200 }
          );
        }
        if (url.includes('/api/templates')) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        if (url.includes('/api/officials')) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });
    };

    it('Permits Admin, Clerk, and Treasurer to access /certificates and /certificates/new', async () => {
      const allowedRoles: UserRole[] = ['Admin', 'Clerk', 'Treasurer'];

      for (const role of allowedRoles) {
        mockAuthFetch(role);

        // Access /certificates
        const { unmount: unmount1 } = render(
          <MemoryRouter initialEntries={['/certificates']}>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByText(/Certificate Issuance History/i)).toBeInTheDocument();
        });
        unmount1();

        // Access /certificates/new
        const { unmount: unmount2 } = render(
          <MemoryRouter initialEntries={['/certificates/new']}>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(screen.getByText(/Issue Official Certificate/i)).toBeInTheDocument();
        });
        unmount2();
      }
    });

    it('Strictly forbids Lupon from accessing /certificates and /certificates/new, redirecting to /unauthorized', async () => {
      mockAuthFetch('Lupon');

      // Attempt to access /certificates
      const { unmount: unmount1 } = render(
        <MemoryRouter initialEntries={['/certificates']}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('unauthorized-page')).toBeInTheDocument();
        expect(screen.getByText(/Access Denied/i)).toBeInTheDocument();
      });
      unmount1();

      // Attempt to access /certificates/new
      const { unmount: unmount2 } = render(
        <MemoryRouter initialEntries={['/certificates/new']}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('unauthorized-page')).toBeInTheDocument();
        expect(screen.getByText(/Access Denied/i)).toBeInTheDocument();
      });
      unmount2();
    });
  });

  describe('10. Targeted Remediation Fixes (DOM Synchronization, Regex Escaping, Alert Hardening, Success State)', () => {
    it('Synchronously flushes permanent control number to the DOM before window.print() is called', async () => {
      let domControlNumberDuringPrint = '';
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {
        const printableArea = document.getElementById('printable-certificate-area');
        domControlNumberDuringPrint = printableArea?.textContent || '';
      });

      const mockPrintablePayload: PrintableIssuancePayload = {
        issuance: {
          id: 202,
          control_number: 'CERT-2026-00099',
          resident_id: 1,
          template_id: 1,
          purpose: 'Employment',
          or_number: 'OR-999',
          amount_paid: 50,
          signatory_official_id: 1,
          signatory_name_snapshot: 'Hon. Roberto Santos',
          signatory_position_snapshot: 'Punong Barangay',
          is_oic_signing: 0,
          had_active_blotter: 0,
          blotter_override_reason: '',
          issued_by_user_id: 1,
          issued_at: '2026-10-22 14:00:00'
        },
        html: '<p>Synchronous DOM certificate body</p>',
        sidebar_officials: mockOfficials,
        template_name: 'Barangay Clearance',
        title_header: 'BARANGAY CLEARANCE',
        show_officials_sidebar: 1
      };

      vi.spyOn(api, 'createIssuance').mockResolvedValue(mockPrintablePayload);

      render(
        <PrintPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          mode="create"
          createPayload={{
            resident_id: 1,
            template_id: 1,
            purpose: 'Employment',
            signatory_official_id: 1,
            amount_paid: 50,
            or_number: 'OR-999'
          }}
          previewData={{
            html: '<p>Preview certificate body</p>',
            title_header: 'BARANGAY CLEARANCE',
            control_number_preview: 'CERT-2026-PREVIEW'
          }}
        />
      );

      expect(screen.getAllByText('CERT-2026-PREVIEW').length).toBeGreaterThanOrEqual(1);

      const issuePrintBtn = screen.getByTestId('issue-and-print-button');
      fireEvent.click(issuePrintBtn);

      await waitFor(() => {
        expect(printSpy).toHaveBeenCalled();
      });

      // Assert that during print execution, flushSync ensured CERT-2026-00099 was synchronously flushed to the DOM
      expect(domControlNumberDuringPrint).toContain('CERT-2026-00099');
      expect(domControlNumberDuringPrint).not.toContain('CERT-2026-PREVIEW');
    });

    it('Correctly escapes regex metacharacters in resident name (e.g., dots, parentheses) without syntax errors', () => {
      const testCases = [
        {
          name: 'Juan Dela Cruz Jr.',
          html: '<p>This certifies that Juan Dela Cruz Jr. is a resident.</p>',
          expectedText: 'JUAN DELA CRUZ JR.'
        },
        {
          name: 'Maria (Elena) Santos',
          html: '<p>This certifies that Maria (Elena) Santos is a resident.</p>',
          expectedText: 'MARIA (ELENA) SANTOS'
        }
      ];

      for (const tc of testCases) {
        const { container, unmount } = render(
          <CertificatePrintSheet
            html={tc.html}
            residentName={tc.name}
            controlNumber="CERT-2026-TEST"
          />
        );

        const strongEl = container.querySelector('strong.uppercase.font-bold');
        expect(strongEl).not.toBeNull();
        expect(strongEl?.textContent).toBe(tc.expectedText);
        unmount();
      }
    });

    it('Renders an in-app error banner on reprint failure and does not call window.alert', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      vi.spyOn(api, 'getIssuances').mockResolvedValue({
        data: [
          {
            id: 42,
            control_number: 'CERT-2026-00042',
            resident_id: 1,
            resident_name: 'Pedro Penduko',
            template_id: 1,
            template_name: 'Barangay Clearance',
            purpose: 'Employment',
            or_number: 'OR-42',
            amount_paid: 50,
            signatory_official_id: 1,
            signatory_name_snapshot: 'Hon. Roberto Santos',
            signatory_position_snapshot: 'Punong Barangay',
            is_oic_signing: 0,
            had_active_blotter: 0,
            blotter_override_reason: '',
            issued_by_user_id: 1,
            issued_by_name: 'Clerk User',
            issued_at: '2026-10-22 10:00:00'
          }
        ],
        pagination: { total: 1, page: 1, limit: 10, totalPages: 1 }
      });
      vi.spyOn(api, 'getTemplates').mockResolvedValue([]);
      vi.spyOn(api, 'getIssuanceById').mockRejectedValue(new Error('Network connectivity lost'));

      render(
        <MemoryRouter>
          <CertificatesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('CERT-2026-00042')).toBeInTheDocument();
      });

      const reprintBtn = screen.getByTestId('reprint-btn-42');
      fireEvent.click(reprintBtn);

      await waitFor(() => {
        expect(screen.getByTestId('reprint-error-banner')).toBeInTheDocument();
        expect(screen.getByText('Network connectivity lost')).toBeInTheDocument();
      });

      expect(alertSpy).not.toHaveBeenCalled();

      // Dismiss error banner
      const dismissBtn = screen.getByTestId('dismiss-reprint-error-banner');
      fireEvent.click(dismissBtn);
      expect(screen.queryByTestId('reprint-error-banner')).not.toBeInTheDocument();
    });

    it('Renders success alert banner when location.state.successMessage is present and allows dismissal', async () => {
      vi.spyOn(api, 'getIssuances').mockResolvedValue({
        data: [],
        pagination: { total: 0, page: 1, limit: 10, totalPages: 0 }
      });
      vi.spyOn(api, 'getTemplates').mockResolvedValue([]);

      render(
        <MemoryRouter
          initialEntries={[
            {
              pathname: '/certificates',
              state: { successMessage: 'Certificate CERT-2026-00001 successfully issued for Juan Dela Cruz.' }
            }
          ]}
        >
          <CertificatesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('issuance-success-banner')).toBeInTheDocument();
        expect(screen.getByText('Certificate CERT-2026-00001 successfully issued for Juan Dela Cruz.')).toBeInTheDocument();
      });

      // Dismiss success banner
      const dismissBtn = screen.getByTestId('dismiss-success-banner');
      fireEvent.click(dismissBtn);
      expect(screen.queryByTestId('issuance-success-banner')).not.toBeInTheDocument();
    });
  });
});
