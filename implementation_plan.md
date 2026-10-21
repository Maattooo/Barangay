# Implementation Plan
**Offline Web-Based Barangay Management & Certificate Issuance System**

This document outlines the phased master implementation plan for building the complete, 100% offline, local web-based Barangay Management and Certificate Issuance System. Every phase is self-contained, independently testable, and strictly mapped to the requirements defined in `specification.md` and `ASSUMPTIONS.md`.

---

## Model Routing Legend
Per the project's multi-agent build pipeline (`multi_agent_prompt_flow.md`):
* **`Routing: FLASH`** — Routine, structured, or bulk development (CRUD endpoints, UI components, boilerplate, standard services, and test scaffolding) executed by Gemini 3.7 Flash.
* **`Routing: PRO`** — Security-critical, reasoning-heavy, or adversarial logic (cryptography, authentication, RBAC enforcement, immutable audit diffing, blotter gatekeeper validation, transactional consistency, and end-to-end integration verification) executed by Gemini 3.1 Pro.

---

## Phase Overview & Progress Tracking

| Phase | Title | Routing | Status | Key Deliverable |
| :---: | :--- | :---: | :---: | :--- |
| **01** | Project Scaffolding & Monorepo Infrastructure | `FLASH` | ⏳ Pending | Root repo, Express TS server, Vite React SPA, 1-click scripts |
| **02** | Database Schema, SQLite WAL Engine & Seed Layer | `FLASH` | ⏳ Pending | `better-sqlite3` connection, `schema.sql` (8 tables), `seed.ts` |
| **03** | Core Security, Authentication & Role-Based Access Control | `PRO` | ⏳ Pending | Password hashing, JWT auth, RBAC guards (4 roles), LAN IP tracker |
| **04** | Transparency Audit Interceptor & JSON Diff Service | `PRO` | ⏳ Pending | Immutable audit logging, fine-grained JSON before/after diff engine |
| **05** | Resident RBI Management, Demographics & Excel Engine | `FLASH` | ⏳ Pending | Dynamic age calculation, combinatorial sector filters, Excel import/export |
| **06** | Blotter Case Management & Automated Gatekeeper Engine | `PRO` | ⏳ Pending | Lupon case tracking, clearance check API, blotter override verification |
| **07** | Officials Roster, Certificate Template Engine & Backup API | `FLASH` | ⏳ Pending | Officials CRUD, `{{placeholder}}` substitution, SQLite hot backup |
| **08** | Transactional Certificate Issuance API & Audit Linkage | `PRO` | ⏳ Pending | Sequential control number generator, atomic issuance transaction |
| **09** | Frontend Core: App Shell, Auth State, Navigation & Dashboard | `FLASH` | ⏳ Pending | React Router, AuthContext, LAN IP badge, stats metric cards |
| **10** | Frontend Resident RBI Module & Excel I/O | `FLASH` | ⏳ Pending | Resident table, sector filter chips, add/edit modal, Excel import/export |
| **11** | Frontend Certificate Issuance Wizard & Native Print Engine | `PRO` | ⏳ Pending | Issuance wizard, blotter warning card, A4 preview, `@media print` CSS |
| **12** | Frontend Admin Suite: Templates, Officials & Audit Inspector | `FLASH` | ⏳ Pending | TipTap template editor, officials manager, visual JSON diff modal |
| **13** | End-to-End System Integration, LAN & Offline Verification | `PRO` | ⏳ Pending | Offline audit, multi-desk LAN validation, backup drill, thesis guide |

---

## Phase Details

### Phase 01: Project Scaffolding & Monorepo Infrastructure
`Routing: FLASH`

* **Goal:** Initialize the monorepo workspace containing the Express backend and React frontend, configured for local development and offline production bundling.
* **Scope:**
  * Root `package.json` with scripts for concurrent development, builds, and unified execution.
  * Backend directory (`server/`) with Node.js LTS, Express, TypeScript, `tsconfig.json`, ESLint, and a baseline health-check endpoint (`GET /api/health`).
  * Frontend directory (`client/`) with React 18, Vite, TypeScript, Tailwind CSS, and Lucide React icons.
  * Windows 1-click startup automation files: `start-server.bat` and silent launcher `start-hidden.vbs`.
  * Asset localization check: verify zero external CDN dependencies (all styles, icons, fonts bundled locally).
* **Key Files:** `package.json`, `server/src/index.ts`, `server/tsconfig.json`, `client/vite.config.ts`, `client/tailwind.config.js`, `start-server.bat`, `start-hidden.vbs`.
* **Acceptance Criteria:**
  1. `npm install` runs cleanly without dependency conflicts.
  2. `npm run dev` starts both server (port 3000) and client (port 5173 with proxy).
  3. `GET /api/health` returns `{ status: "ok", timestamp: ... }`.
  4. Client displays a styled Tailwind landing screen with Lucide icons without internet access.

---

### Phase 02: Database Schema, SQLite WAL Engine & Seed Layer
`Routing: FLASH`

* **Goal:** Create the single-file SQLite database instance with WAL mode resilience and populate it with rich initial seed data for local testing.
* **Scope:**
  * `server/src/db/connection.ts` establishing the singleton `better-sqlite3` instance pointing to `data/barangay_data.sqlite`.
  * Enforcement of SQLite pragmas: `PRAGMA journal_mode = WAL;`, `PRAGMA synchronous = NORMAL;`, and `PRAGMA foreign_keys = ON;`.
  * `server/src/db/schema.sql` implementing the complete DDL for all 8 tables defined in `specification.md`:
    1. `barangay_officials`
    2. `users`
    3. `residents` (with indexes on name, purok, birthdate, sectors)
    4. `blotter_records` (with index on respondent and status)
    5. `certificate_templates`
    6. `certificate_issuances`
    7. `audit_logs`
    8. `system_settings`
  * `server/src/db/seed.ts` providing realistic mock data:
    * Default Admin account (`admin` / `admin123` with bcrypt hash).
    * Complete Sangguniang Barangay roster (1 Punong Barangay, 7 Kagawads with assigned committees, 1 SK Chairperson, 1 Secretary, 1 Treasurer).
    * 4 official certificate templates: *Barangay Clearance*, *Certificate of Indigency*, *Certificate of Residency*, *First-Time Jobseeker Certification*.
    * 10 diverse resident records across multiple Puroks and special sectors (Seniors, PWDs, Solo Parents, 4Ps, Voters, Minors).
    * 1 active blotter record linked to a sample resident to test the clearance gatekeeper.
    * Default barangay metadata in `system_settings`.
* **Key Files:** `server/src/db/connection.ts`, `server/src/db/schema.sql`, `server/src/db/seed.ts`.
* **Acceptance Criteria:**
  1. Running database initialization creates `data/barangay_data.sqlite` with WAL mode enabled.
  2. All 8 tables and indexes exist with correct column constraints and foreign keys.
  3. `seed.ts` populates all sample records without foreign key errors.
  4. Verification script confirms that the default Admin account and sample council members are queryable.

---

### Phase 03: Core Security, Authentication & Role-Based Access Control (RBAC)
`Routing: PRO`

* **Goal:** Implement secure, local-only authentication, password hashing, and strict Role-Based Access Control protecting all backend routes.
* **Scope:**
  * Password hashing and comparison using `bcryptjs` (work factor 10).
  * JWT issuance and verification (`jsonwebtoken`) stored via HTTP-only cookies or Bearer tokens.
  * `auth.middleware.ts`: Authenticates incoming requests, verifies token signature and expiration, and hydrates `req.user`.
  * `rbac.middleware.ts`: Role-guard middleware restricting access based on the 4 roles (`Admin`, `Clerk`, `Treasurer`, `Lupon`) matching the Section 5.5 matrix in `specification.md`.
  * `ip.middleware.ts`: Captures and sanitizes the client's LAN IPv4 address (`req.ip` / `x-forwarded-for`) for audit attribution.
  * Authentication routes (`server/src/routes/auth.routes.ts`):
    * `POST /api/auth/login` (authenticates credentials, updates `last_login_at`, logs `LOGIN` in audit logs, returns token + user profile).
    * `GET /api/auth/me` (returns current user profile and role).
  * User management routes (`server/src/routes/users.routes.ts`):
    * `GET /api/users` (`Admin` only).
    * `POST /api/users` (`Admin` only, creates staff accounts with hashed passwords).
    * `PUT /api/users/:id` (`Admin` only, updates role, toggles `is_active`, or resets password).
  * Automated security tests verifying unauthorized access rejection, role boundary enforcement, and password hash integrity.
* **Key Files:** `server/src/middleware/auth.middleware.ts`, `server/src/middleware/rbac.middleware.ts`, `server/src/middleware/ip.middleware.ts`, `server/src/routes/auth.routes.ts`, `server/src/routes/users.routes.ts`.
* **Acceptance Criteria:**
  1. Valid credentials return a signed JWT; invalid credentials return HTTP 401.
  2. Role guard correctly permits authorized roles and returns HTTP 403 for unauthorized roles across all matrix actions.
  3. Non-admin users cannot access `GET /api/users` or `POST /api/users`.
  4. Client LAN IP is accurately extracted on every authenticated request.
  5. Passwords in the database are salted bcrypt hashes, never plaintext.

---

### Phase 04: Transparency Audit Interceptor & JSON Diff Service
`Routing: PRO`

* **Goal:** Build an immutable, append-only audit trail service that computes fine-grained before-and-after JSON diffs on every database mutation.
* **Scope:**
  * `server/src/services/audit.service.ts`:
    * Implements `logAuditEvent({ userId, username, userRole, action, entityType, entityId, summaryText, oldData, newData, clientIp })`.
    * Implements automated JSON diff computation: compares original entity state with updated payload, isolating exclusively the modified attributes.
    * Stores serialized changed attributes into `old_data_json` and `new_data_json`.
  * Enforces immutability: verifies that no `UPDATE` or `DELETE` queries or endpoints exist for `audit_logs`.
  * Audit querying routes (`server/src/routes/audit.routes.ts`):
    * `GET /api/audit-logs` (`Admin` only): Paginated list of audit events with filtering by `user_id`, `action`, `entity_type`, and date range.
  * Comprehensive automated tests validating:
    * Exact diff generation on single-field and multi-field updates.
    * Empty diff handling when updates contain identical data.
    * Accurate logging of client IP, username snapshot, and role snapshot.
* **Key Files:** `server/src/services/audit.service.ts`, `server/src/routes/audit.routes.ts`, `server/src/types/audit.ts`.
* **Acceptance Criteria:**
  1. Mutating updates produce `old_data_json` and `new_data_json` containing only the modified properties.
  2. Unchanged fields are excluded from diff JSON to conserve database space.
  3. Audit records cannot be modified or deleted via any API endpoint.
  4. `GET /api/audit-logs` returns paginated, filtered logs accessible only to `Admin`.

---

### Phase 05: Resident RBI Management, Demographics & Excel Engine
`Routing: FLASH`

* **Goal:** Implement the Registry of Barangay Inhabitants (RBI) endpoints, dynamic demographic calculations, combinatorial sector filtering, and Excel import/export.
* **Scope:**
  * Dynamic Age Calculation SQL logic using SQLite's formula:
    `CAST((julianday('now', 'localtime') - julianday(birthdate)) / 365.2425 AS INTEGER) AS age`.
  * Dynamic Sector classification (Senior: `age >= 60`, Youth/SK: `age >= 15 AND age <= 30`, Minor: `age < 18`).
  * Resident REST endpoints (`server/src/routes/residents.routes.ts`):
    * `GET /api/residents`: Supports search (name query), `purok`, `sex`, `civil_status`, pagination, and combinatorial `sectors` filter (`senior,pwd,indigent,4ps,solo_parent,voter,youth,ofw,osy`).
    * `GET /api/residents/stats`: Returns dashboard statistics (Total, Purok counts, Seniors, PWDs, 4Ps, Indigents, Voters, Active Blotters).
    * `POST /api/residents`: Creates resident profile and logs `CREATE` audit event.
    * `PUT /api/residents/:id`: Updates resident profile and logs `UPDATE` audit event with JSON diff.
    * `PATCH /api/residents/:id/archive`: Soft-deletes (`is_archived = 1`) and logs `ARCHIVE` audit event (`Admin` only).
  * `server/src/services/excel.service.ts`:
    * Bulk import endpoint (`POST /api/residents/import-excel`): Parses uploaded spreadsheet, maps columns, detects duplicates against existing residents (`first_name + last_name + birthdate`), performs batch insertion, and logs `IMPORT_EXCEL`.
    * Filtered export endpoint (`GET /api/residents/export-excel`): Generates and downloads `.xlsx` spreadsheet matching the currently applied filter criteria and logs `EXPORT_EXCEL`.
  * Automated tests for combinatorial sector queries, duplicate detection during Excel import, and soft-delete filtering.
* **Key Files:** `server/src/routes/residents.routes.ts`, `server/src/controllers/residents.controller.ts`, `server/src/services/excel.service.ts`.
* **Acceptance Criteria:**
  1. Resident age and age-derived sectors are computed dynamically at query time.
  2. Combinatorial sector filters return residents satisfying all requested sector criteria.
  3. Excel import skips duplicate residents and successfully ingests new entries.
  4. Excel export outputs valid `.xlsx` file reflecting active query filters.
  5. All resident creations, updates, and archives generate corresponding audit log records with diffs.

---

### Phase 06: Blotter Case Management & Automated Gatekeeper Engine
`Routing: PRO`

* **Goal:** Build the Lupong Tagapamayapa blotter record management module and the automated clearance gatekeeper logic that protects certificate issuance.
* **Scope:**
  * Blotter records REST endpoints (`server/src/routes/blotter.routes.ts`):
    * `GET /api/blotter`: List blotter records with filtering by `status` (`Active`, `Under Mediation`, `Settled`, `Dismissed`, `CFA Issued`) and search.
    * `POST /api/blotter`: Records new incident, auto-generates sequential case number (`BLT-YYYY-NNN`), links `respondent_id` (if resident), and logs `CREATE` in audit logs (`Admin` and `Lupon` roles).
    * `PUT /api/blotter/:id`: Updates case details or status (e.g., mediation to settled) and logs `UPDATE` with JSON diff.
  * Automated Blotter Gatekeeper endpoint:
    * `GET /api/residents/:id/blotter-check`:
      * Queries `blotter_records` where `respondent_id = :id AND is_archived = 0 AND status IN ('Active', 'Under Mediation', 'CFA Issued')`.
      * Returns `{ cleared: true, cases: [] }` if no pending records exist.
      * Returns `{ cleared: false, cases: [...] }` if pending records exist.
  * Validation rules for certificate issuance override:
    * Enforces that an active blotter requires `blotter_override_reason` with a minimum of 10 characters.
  * Automated tests for blotter status transitions, gatekeeper query accuracy, and override validation logic.
* **Key Files:** `server/src/routes/blotter.routes.ts`, `server/src/controllers/blotter.controller.ts`, `server/src/services/blotter.service.ts`.
* **Acceptance Criteria:**
  1. Case numbers are automatically generated in the `BLT-YYYY-NNN` sequence.
  2. `GET /api/residents/:id/blotter-check` accurately identifies residents with `Active`, `Under Mediation`, or `CFA Issued` statuses.
  3. Settled or Dismissed cases do not trigger a clearance block.
  4. Blotter status modifications are captured in audit logs with before/after JSON diffs.

---

### Phase 07: Officials Roster, Certificate Template Engine & Backup API
`Routing: FLASH`

* **Goal:** Implement the Barangay Officials roster management, the rich-text template placeholder replacement service, and the SQLite hot backup system endpoint.
* **Scope:**
  * Barangay Officials REST endpoints (`server/src/routes/officials.routes.ts`):
    * `GET /api/officials`: Returns active council officials sorted by `rank_order ASC`.
    * `POST /api/officials`: (`Admin` only) Adds new official.
    * `PUT /api/officials/:id`: (`Admin` only) Modifies name, position, committee, rank order, or active status, logging audit diff.
  * Certificate Templates REST endpoints (`server/src/routes/templates.routes.ts`):
    * `GET /api/templates`: Lists all certificate templates.
    * `PUT /api/templates/:id`: (`Admin` only) Updates `title_header`, `body_html`, `show_officials_sidebar`, and `default_fee`.
  * `server/src/services/template.service.ts`:
    * Interpolation engine replacing all 18 standard `{{placeholders}}` with resident, transaction, and officials data:
      `{{full_name}}`, `{{age}}`, `{{birthdate}}`, `{{sex}}`, `{{civil_status}}`, `{{pronoun_he_she}}`, `{{pronoun_his_her}}`, `{{purok}}`, `{{address}}`, `{{purpose}}`, `{{control_number}}`, `{{or_number}}`, `{{amount_paid}}`, `{{day_ordinal}}`, `{{month_year}}`, `{{punong_barangay}}`, `{{barangay_secretary}}`, `{{barangay_treasurer}}`, `{{signatory_name}}`, `{{signatory_title}}`.
  * System Administration endpoints (`server/src/routes/system.routes.ts`):
    * `GET /api/system/info`: Returns host LAN IPv4 addresses from `os.networkInterfaces()`, database file size, and metadata settings.
    * `POST /api/system/backup`: Initiates `better-sqlite3` `.backup()` to generate `data/backups/barangay_backup_YYYYMMDD_HHMMSS.sqlite` and streams the file for download (`Admin` only).
  * Automated unit tests for placeholder interpolation and database backup creation.
* **Key Files:** `server/src/routes/officials.routes.ts`, `server/src/routes/templates.routes.ts`, `server/src/services/template.service.ts`, `server/src/routes/system.routes.ts`, `server/src/services/backup.service.ts`.
* **Acceptance Criteria:**
  1. Officials roster returns council members in proper hierarchy order (`rank_order`).
  2. Template engine resolves all 18 placeholders correctly with appropriate casing and pronoun resolution.
  3. `GET /api/system/info` correctly reports LAN IPv4 address of the host machine.
  4. `POST /api/system/backup` creates a valid, non-corrupt SQLite hot backup file.

---

### Phase 08: Transactional Certificate Issuance API & Audit Linkage
`Routing: PRO`

* **Goal:** Build the secure, atomic certificate issuance endpoint that enforces the blotter gatekeeper, generates sequential control numbers, and records immutable audit records.
* **Scope:**
  * Control number generator creating sequential codes in format `CERT-YYYY-NNNNN`.
  * Certificate preview endpoint:
    * `POST /api/issuances/preview`: Accepts issuance parameters, runs template interpolation without saving, and returns preview HTML and signatory block.
  * Atomic Issuance transaction endpoint (`POST /api/issuances`):
    * Validates resident ID, template ID, and signatory official ID.
    * Queries blotter gatekeeper (`blotter_records`).
    * **If pending blotter exists:** Requires `is_override = true` and `blotter_override_reason` (minimum 10 characters). Rejects transaction if override reason is absent or insufficient.
    * Inserts record into `certificate_issuances` with signatory snapshots (`signatory_name_snapshot`, `signatory_position_snapshot`) to maintain historical accuracy regardless of future council changes.
    * Records `PRINT_CERTIFICATE` audit event.
    * If blotter was overridden, concurrently records a distinct `BLOTTER_OVERRIDE` audit event containing the override rationale.
  * Certificate Issuance log endpoint:
    * `GET /api/issuances`: Returns paginated history of issued certificates with date range, template, and clerk filtering.
  * Automated tests verifying:
    * Sequential control number generation.
    * Rejection of issuance when active blotter exists without override.
    * Successful issuance with valid override reason and concurrent audit logging.
    * Transaction rollback upon simulated database error.
* **Key Files:** `server/src/routes/issuances.routes.ts`, `server/src/controllers/issuances.controller.ts`, `server/src/services/issuance.service.ts`.
* **Acceptance Criteria:**
  1. Control numbers increment sequentially without collisions.
  2. Issuance to a resident with an active blotter without override reason fails with HTTP 400.
  3. Overridden issuance succeeds and logs both `PRINT_CERTIFICATE` and `BLOTTER_OVERRIDE` in `audit_logs`.
  4. Signatory details are permanently snapshotted in `certificate_issuances`.

---

### Phase 09: Frontend Core: App Shell, Auth State, Navigation & Dashboard
`Routing: FLASH`

* **Goal:** Implement the client SPA layout, offline authentication handling, role-based navigation sidebar, and executive dashboard.
* **Scope:**
  * Client entry point, routing (`react-router-dom`), and protected route wrappers enforcing role permissions.
  * `AuthContext`: Manages user login state, token storage, role detection, and logout.
  * High-contrast, clean Login screen with form validation, error banners, and demo credentials guide.
  * Main Layout component:
    * Responsive sidebar with role-aware navigation links (hiding Lupon / Admin tabs when unauthorized).
    * Topbar displaying Barangay branding, logged-in user profile, role badge, and a **LAN IP Badge** (`Host: http://192.168.X.X:3000`).
  * Executive Dashboard (`/dashboard`):
    * Statistical Metric Cards: Total Residents, Senior Citizens, PWDs, 4Ps Beneficiaries, Registered Voters, Active Blotter Cases.
    * Quick Action Buttons: "New Resident", "Issue Certificate", "Record Blotter Case".
    * Recent issuance and blotter summary feeds.
* **Key Files:** `client/src/App.tsx`, `client/src/context/AuthContext.tsx`, `client/src/components/layout/Sidebar.tsx`, `client/src/components/layout/Topbar.tsx`, `client/src/pages/LoginPage.tsx`, `client/src/pages/DashboardPage.tsx`.
* **Acceptance Criteria:**
  1. User can log in with seeded credentials and persist session on reload.
  2. Unauthorized routes redirect to `/login` or display access-denied warnings based on role.
  3. Topbar dynamically displays the server's LAN IP address retrieved from `/api/system/info`.
  4. Dashboard metric cards accurately reflect data loaded from `/api/residents/stats`.

---

### Phase 10: Frontend Resident RBI Module & Excel I/O
`Routing: FLASH`

* **Goal:** Build the complete Resident Registry interface, interactive sector filter chips, resident add/edit modal, and Excel bulk import/export modals.
* **Scope:**
  * Resident List Page (`/residents`):
    * Search bar with debounced name query input.
    * Purok dropdown filter.
    * **Combinatorial Sector Filter Chips Bar**: Interactive multi-select toggle chips (Senior, PWD, 4Ps, Solo Parent, Indigent, Voter, Youth, OFW, OSY).
    * Resident data table showing full name, age, purok, sector badges, status, and action buttons.
  * Resident Add / Edit Modal:
    * Inputs: First name, middle name, last name, suffix, birthdate, sex, civil status, purok, street address, contact no, occupation, nationality.
    * Boolean sector checkboxes with conditional ID number inputs (PWD ID, Solo Parent ID, Precinct No, Senior ID).
    * Client-side form validation.
  * Archive / Soft-delete confirmation dialog (`Admin` only).
  * Excel Bulk Import Modal:
    * File upload area for `.xlsx` or `.csv`.
    * Column mapping confirmation view and parsed data preview table.
    * Duplicate detection warning list (`first_name + last_name + birthdate`).
    * Batch submit with progress bar.
  * Export to Excel button: Downloads filtered `.xlsx` file reflecting current table filters.
* **Key Files:** `client/src/pages/ResidentsPage.tsx`, `client/src/components/residents/ResidentTable.tsx`, `client/src/components/residents/SectorFilterChips.tsx`, `client/src/components/residents/ResidentFormModal.tsx`, `client/src/components/residents/ExcelImportModal.tsx`.
* **Acceptance Criteria:**
  1. User can filter residents by toggling any combination of sector chips simultaneously.
  2. Adding or editing a resident immediately updates the table and creates an audit diff.
  3. Archiving a resident soft-deletes the record with confirmation.
  4. Excel bulk import successfully processes files and identifies duplicate resident records.
  5. Excel export downloads a spreadsheet matching the exact active search/filter criteria.

---

### Phase 11: Frontend Certificate Issuance Wizard & Native Print Engine
`Routing: PRO`

* **Goal:** Build the guided Certificate Issuance Wizard, real-time Blotter Gatekeeper alert modal, live A4 print preview, and `@media print` CSS engine.
* **Scope:**
  * Certificate Issuance Wizard (`/issue-certificate`):
    * **Step 1: Resident Selection** — Search resident by name, view demographic details.
    * **Step 2: Automated Blotter Check** — Calls `/api/residents/:id/blotter-check`.
      * If Cleared: Displays prominent green "Cleared: No Pending Blotter Record" badge.
      * If Flagged: Displays red "Blotter Gatekeeper Warning Card" listing pending case numbers, complainants, incident types, and statuses.
      * Unlocks issuance only when user checks "Authorize Issuance Override" and types a mandatory `blotter_override_reason` (minimum 10 characters).
    * **Step 3: Certificate Details** — Template selector, Purpose input, OR Number, Amount Paid, CTC (Cedula) Number/Date/Place.
    * **Step 4: Signatory Selection** — Dropdown of active officials, toggle for "Sign as Officer-in-Charge (OIC)".
  * Live Interactive Print Preview component (`<CertificatePrintSheet />`):
    * Renders official barangay header (Republic of the Philippines, Province, Municipality, Barangay).
    * Dynamic layout: 28% left council sidebar (if `show_officials_sidebar = 1`) listing PB, Kagawads with committees, SK, Sec, Treas; 72% right certificate body and formal signatory block.
    * Full-width layout when sidebar is disabled.
  * `@media print` CSS engine:
    * Configured in `client/src/index.css` for clean A4 (`210mm x 297mm`) and Letter (`8.5in x 11in`) paper.
    * Hides all sidebar, navigation, and button UI elements during printing.
    * Uses formal serif typography (`Georgia` or `Times New Roman`) for body text and bold uppercase for names.
  * Issuance execution: Saves transaction to backend, records audit logs, and automatically triggers `window.print()`.
  * Certificate Issuance History Page (`/issuances`): Filterable log of issued certificates with reprint capability.
* **Key Files:** `client/src/pages/IssuanceWizardPage.tsx`, `client/src/components/certificates/BlotterAlertModal.tsx`, `client/src/components/certificates/CertificatePrintSheet.tsx`, `client/src/components/certificates/PrintPreviewModal.tsx`, `client/src/pages/IssuanceHistoryPage.tsx`.
* **Acceptance Criteria:**
  1. Blotter check triggers automatically upon resident selection.
  2. Resident with an active blotter cannot be issued a certificate without entering a valid override reason.
  3. Live preview accurately reflects all replaced `{{placeholders}}` and council members.
  4. Triggering print renders a clean, single-page A4 document without UI clutter or margins distortion.
  5. Successfully issued certificates appear in the Issuance History table.

---

### Phase 12: Frontend Admin Suite: Templates, Officials & Audit Inspector
`Routing: FLASH`

* **Goal:** Build administrative modules for managing certificate templates, the barangay officials roster, Lupong Tagapamayapa blotter records, and the visual audit log inspector.
* **Scope:**
  * Blotter Records Page (`/blotter`):
    * Table of cases with status badges (`Active`, `Under Mediation`, `Settled`, `Dismissed`, `CFA Issued`).
    * "Record New Case" modal linking complainant and respondent to residents.
    * "Update Case / Settle" modal with settlement notes and status transitions (`Admin` and `Lupon`).
  * Barangay Officials Roster Page (`/officials`):
    * List of current officials with drag/numeric reordering (`rank_order`).
    * Add/Edit official modal (Name, Position, Committee, Active Term toggle) (`Admin` only).
  * Rich-Text Certificate Template Editor (`/templates`):
    * WYSIWYG editor using TipTap (or React-Quill).
    * Clickable `{{placeholder}}` chips bar allowing staff to click a tag (e.g. `{{full_name}}`, `{{purpose}}`) to insert it at cursor position.
    * Toggle for `show_officials_sidebar` and default fee input (`Admin` only).
  * Transparency Audit Log Inspector (`/audit-logs`):
    * Filterable table by user, action type, entity type, and date range (`Admin` only).
    * **Visual JSON Diff Modal**: Displays side-by-side or colorized before-and-after comparison of modified fields for `UPDATE` events.
  * System Settings & Database Maintenance Page (`/settings`):
    * Edit barangay metadata (Barangay Name, Municipality, Province).
    * Display host LAN IP address instructions.
    * "Download Database Backup" button triggering `/api/system/backup`.
    * User account manager for staff creation and password resets.
* **Key Files:** `client/src/pages/BlotterPage.tsx`, `client/src/pages/OfficialsPage.tsx`, `client/src/pages/TemplatesPage.tsx`, `client/src/components/templates/RichTextTemplateEditor.tsx`, `client/src/pages/AuditLogsPage.tsx`, `client/src/components/audit/JsonDiffModal.tsx`, `client/src/pages/SettingsPage.tsx`.
* **Acceptance Criteria:**
  1. Lupon/Admin can create blotter cases and transition statuses to Settled.
  2. Templates can be edited in rich-text mode with inserted placeholders persisting properly.
  3. Officials roster changes immediately reflect in the certificate preview sidebar.
  4. Audit Log Inspector displays colorized before/after JSON diffs of modified fields.
  5. 1-click database backup button downloads a timestamped `.sqlite` file.

---

### Phase 13: End-to-End System Integration, LAN & Offline Verification
`Routing: PRO`

* **Goal:** Perform holistic end-to-end integration testing, verify 100% offline air-gapped readiness, test multi-desk LAN accessibility, and prepare thesis demonstration artifacts.
* **Scope:**
  * Complete lifecycle integration test:
    1. Log in as Clerk -> Register new resident with multiple sector flags.
    2. Log in as Lupon -> File blotter case against resident.
    3. Log in as Clerk -> Attempt certificate issuance -> verify Blotter Gatekeeper blocks printing.
    4. Provide valid override reason -> complete issuance -> print certificate.
    5. Log in as Admin -> Inspect audit log -> verify `CREATE`, `BLOTTER_OVERRIDE`, and `PRINT_CERTIFICATE` events with accurate JSON diffs.
  * Multi-Desk LAN verification:
    * Verify backend binds to `0.0.0.0:3000`.
    * Verify secondary device on local network accesses system via host IP without errors.
    * Verify simultaneous access from multiple workstations.
  * 100% Offline Air-Gapped Audit:
    * Disconnect network/internet access completely.
    * Verify all static assets (fonts, icons, styles, scripts) load locally with zero broken links or CDN errors.
  * Database resilience & backup test:
    * Trigger hot backup while executing concurrent read operations.
    * Verify downloaded backup can be opened and queried independently.
  * Windows 1-click startup automation:
    * Verify `start-server.bat` launches server and opens default browser to `http://localhost:3000`.
    * Verify `start-hidden.vbs` executes silently in background.
  * Documentation & User Guide: Create `README.md` and user operation guide for barangay staff and thesis panel defense.
* **Key Files:** `README.md`, `tests/e2e/workflow.test.ts`, `server/src/index.ts`, `start-server.bat`, `start-hidden.vbs`.
* **Acceptance Criteria:**
  1. Full resident -> blotter -> gatekeeper -> override -> certificate -> audit trail workflow passes seamlessly.
  2. Zero external network requests made during any user interaction.
  3. Host machine LAN IP is accessible from secondary devices on the same Wi-Fi/LAN.
  4. Database hot backup generates a completely valid, restorable SQLite file.
  5. 1-click launcher starts the system effortlessly on Windows.

---

## Ticket Creation Workflow Reminder
Before starting any phase, the Manager agent will produce a dedicated task ticket in `tasks/phase-[N]-[name].md` adhering strictly to Section 2 of `multi_agent_prompt_flow.md`. No worker agent should begin implementation without an approved task ticket.
