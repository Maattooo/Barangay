# Offline Web-Based Barangay Management & Certificate Issuance System
**System Architecture & Technical Specification (`architecture.md`)**

> **Purpose of this Document:** This file serves as the single source of truth for AI coding agents and developers building the Offline Barangay Management System. Follow the technology stack, database schema, business logic rules, and directory structure strictly.

---

## 1. System Overview & Operational Environment

### 1.1 Core Objective
A **100% offline, local web-based system** designed for Philippine barangay halls to manage the **Registry of Barangay Inhabitants (RBI)**, track **Special Sector demographics**, enforce **Lupong Tagapamayapa (Blotter) checks**, manage **current Barangay Officials dynamically**, and print **official-editable text-based certificates** with a complete **User Accountability Audit Trail**.

### 1.2 Target Deployment & Network Topology
* **Primary Host:** The Barangay Secretary's desktop/laptop PC runs the Node.js/Express server and stores the embedded SQLite database file (`barangay_data.sqlite`).
* **Multi-Desk Local LAN Support:** The Express server binds to `0.0.0.0:3000`.
  * The Secretary accesses the system at `http://localhost:3000`.
  * Other officials (Treasurer, Clerks, Lupon, Punong Barangay) connected to the same local Wi-Fi router or LAN switch access the system via the host PC's local IP address (e.g., `http://192.168.1.25:3000`) with zero client-side installation.
* **Zero-Setup Daily Startup:** Launched via a single desktop shortcut (`start-barangay-system.bat` wrapped in a silent `.vbs` launcher or packaged binary) that starts the Node.js server and opens the default browser automatically.
* **Brownout / Power-Loss Resilience:** SQLite MUST be initialized with `PRAGMA journal_mode = WAL;` (Write-Ahead Logging) and `PRAGMA synchronous = NORMAL;` to prevent database corruption during sudden power outages.

---

## 2. Technology Stack Mandate

| Layer | Technology | Rationale & Agent Constraints |
| :--- | :--- | :--- |
| **Runtime & Backend** | **Node.js (LTS) + Express.js (TypeScript)** | Lightweight, serves both REST API endpoints (`/api/*`) and built frontend static assets (`dist/`). |
| **Database** | **SQLite 3** via `better-sqlite3` | Synchronous, blazing-fast C++ bindings, single-file storage (`barangay_data.sqlite`), zero external DB daemon required. |
| **Authentication** | **`bcryptjs` + `jsonwebtoken` (JWT)** | Offline local authentication using HTTP-only cookies or Bearer tokens. No internet/OAuth dependencies allowed. |
| **Excel I/O** | **`xlsx` (SheetJS) or `exceljs`** | Powers bulk resident import (with column mapping) and filtered sector masterlist exports. |
| **Frontend Framework** | **React 18 + Vite + TypeScript** | Fast SPA bundled into static files for offline delivery. |
| **Styling & UI** | **Tailwind CSS + Lucide Icons** | Offline-bundled utility CSS; clean, high-contrast UI suitable for non-technical barangay staff. |
| **Rich Text Editor** | **TipTap** (or `react-quill`) | Enables officials to edit certificate templates in-app and insert dynamic `{{placeholder}}` tags. |
| **Printing Engine** | **Native Browser `@media print` CSS** | Pure text/HTML A4 & Letter print views with dynamic header, council sidebar, and signatory injection. |

---

## 3. Recommended Monorepo Directory Structure

```text
barangay-system/
├── package.json
├── start-server.bat               # 1-click startup script for Windows
├── start-hidden.vbs               # Runs start-server.bat without terminal window
├── data/
│   ├── barangay_data.sqlite       # Primary SQLite database file (WAL mode)
│   └── backups/                   # Timestamped .sqlite backups
├── server/                        # Backend (Node.js + Express + TypeScript)
│   ├── src/
│   │   ├── index.ts               # Express entry point (binds to 0.0.0.0:3000)
│   │   ├── db/
│   │   │   ├── connection.ts      # better-sqlite3 singleton + WAL pragma setup
│   │   │   ├── schema.sql         # Full DDL initialization script
│   │   │   └── seed.ts            # Seeds default Admin, Officials, & Templates
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts # JWT verification & RBAC role guards
│   │   │   └── ip.middleware.ts   # Captures client LAN IP for audit logs
│   │   ├── services/
│   │   │   ├── audit.service.ts   # Computes before/after JSON diff & writes audit_logs
│   │   │   ├── template.service.ts# Replaces {{placeholders}} with resident & official data
│   │   │   ├── excel.service.ts   # Parses incoming .xlsx & generates filtered exports
│   │   │   └── backup.service.ts  # Uses SQLite .backup() API to copy DB safely
│   │   └── routes/
│   │       ├── auth.routes.ts
│   │       ├── residents.routes.ts
│   │       ├── officials.routes.ts
│   │       ├── blotter.routes.ts
│   │       ├── templates.routes.ts
│   │       ├── issuances.routes.ts
│   │       ├── audit.routes.ts
│   │       └── system.routes.ts   # LAN IP detection & 1-click DB backup
├── client/                        # Frontend (React + Vite + Tailwind CSS)
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/            # Sidebar, Topbar with LAN IP Badge & User Role
│   │   │   ├── residents/         # ResidentForm, SectorFilterChips, ExcelImportModal
│   │   │   ├── certificates/      # IssuanceWizard, BlotterAlertModal, PrintPreviewA4
│   │   │   ├── templates/         # RichTextTemplateEditor, PlaceholderChipBar
│   │   │   ├── officials/         # OfficialsRosterManager, OICSelector
│   │   │   ├── blotter/           # BlotterCaseTable, BlotterFormModal
│   │   │   └── audit/             # AuditLogViewer, JsonDiffModal
│   │   ├── pages/
│   │   ├── context/               # AuthContext
│   │   └── utils/                 # Age calculator, date formatters
```

---

## 4. Complete SQLite Database Schema (`schema.sql`)

The AI agent MUST initialize SQLite using the exact schema below.

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

-- 1. BARANGAY OFFICIALS TABLE (Powers dynamic certificates & council roster)
CREATE TABLE IF NOT EXISTS barangay_officials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,                  -- e.g., "HON. JUAN DELA CRUZ"
    position TEXT NOT NULL CHECK(position IN (
        'Punong Barangay',
        'Sangguniang Barangay Member',
        'SK Chairperson',
        'Barangay Secretary',
        'Barangay Treasurer'
    )),
    committee TEXT,                           -- e.g., "Committee on Peace and Order"
    rank_order INTEGER NOT NULL DEFAULT 1,    -- 1 = Punong Barangay, 2-8 = Kagawads, 9 = SK, 10 = Sec, 11 = Treas
    term_start TEXT,                          -- YYYY-MM-DD
    term_end TEXT,                            -- YYYY-MM-DD
    is_active INTEGER NOT NULL DEFAULT 1,     -- 1 = Current Term, 0 = Former Official
    updated_by INTEGER,
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 2. USERS TABLE (Role-Based Access Control & Accountability)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('Admin', 'Clerk', 'Treasurer', 'Lupon')),
    official_id INTEGER,                      -- Optional link to barangay_officials
    is_active INTEGER NOT NULL DEFAULT 1,
    last_login_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (official_id) REFERENCES barangay_officials(id) ON DELETE SET NULL
);

-- 3. RESIDENTS TABLE (Registry of Barangay Inhabitants + Special Sector Flags)
CREATE TABLE IF NOT EXISTS residents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    middle_name TEXT DEFAULT '',
    last_name TEXT NOT NULL,
    suffix TEXT DEFAULT '',                   -- e.g., "Jr.", "III"
    birthdate TEXT NOT NULL,                  -- Strictly YYYY-MM-DD (Used to auto-compute Age, Senior, Youth, Minor)
    sex TEXT NOT NULL CHECK(sex IN ('Male', 'Female')),
    civil_status TEXT NOT NULL CHECK(civil_status IN ('Single', 'Married', 'Widowed', 'Separated', 'Live-in')),
    purok TEXT NOT NULL,                      -- e.g., "Purok 1", "Sitio Centro"
    house_no_street TEXT DEFAULT '',
    contact_no TEXT DEFAULT '',
    occupation TEXT DEFAULT '',
    nationality TEXT NOT NULL DEFAULT 'Filipino',
    residency_status TEXT NOT NULL DEFAULT 'Active' CHECK(residency_status IN ('Active', 'Moved Out', 'Deceased')),

    -- Special Sector Manual Boolean Flags (0 or 1) & Optional ID Numbers
    is_voter INTEGER NOT NULL DEFAULT 0,
    precinct_no TEXT DEFAULT '',
    is_pwd INTEGER NOT NULL DEFAULT 0,
    pwd_id_no TEXT DEFAULT '',
    pwd_disability_type TEXT DEFAULT '',
    is_solo_parent INTEGER NOT NULL DEFAULT 0,
    solo_parent_id_no TEXT DEFAULT '',
    is_4ps INTEGER NOT NULL DEFAULT 0,
    is_indigent INTEGER NOT NULL DEFAULT 0,
    is_ofw INTEGER NOT NULL DEFAULT 0,
    is_osy INTEGER NOT NULL DEFAULT 0,        -- Out-of-School Youth
    senior_id_no TEXT DEFAULT '',             -- Senior status is auto-computed via birthdate >= 60 yrs, ID stored here

    -- Soft Delete & Audit Metadata
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER,
    updated_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- Indexes for fast searching and sector filtering
CREATE INDEX IF NOT EXISTS idx_residents_name ON residents(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_residents_purok ON residents(purok);
CREATE INDEX IF NOT EXISTS idx_residents_birthdate ON residents(birthdate);
CREATE INDEX IF NOT EXISTS idx_residents_sectors ON residents(is_voter, is_pwd, is_solo_parent, is_4ps, is_indigent, is_archived);

-- 4. BLOTTER RECORDS TABLE (Lupong Tagapamayapa Gatekeeper)
CREATE TABLE IF NOT EXISTS blotter_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_number TEXT NOT NULL UNIQUE,         -- e.g., "BLT-2026-001"
    complainant_id INTEGER,                   -- Nullable if complainant is non-resident
    complainant_name TEXT NOT NULL,
    respondent_id INTEGER,                    -- Linked to residents.id to trigger clearance warning!
    respondent_name TEXT NOT NULL,
    incident_type TEXT NOT NULL,              -- e.g., "Physical Injury", "Unjust Vexation", "Collection of Sum of Money"
    incident_location TEXT DEFAULT '',
    incident_details TEXT NOT NULL,
    date_incident TEXT,
    date_recorded TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN (
        'Active',                             -- Blocks/Warns Certificate Issuance
        'Under Mediation',                    -- Blocks/Warns Certificate Issuance
        'Settled',                            -- Cleared
        'Dismissed',                          -- Cleared
        'CFA Issued'                          -- Certificate to File Action (Escalated to Court - Blocks Issuance)
    )),
    settlement_notes TEXT DEFAULT '',
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER,
    updated_by INTEGER,
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (complainant_id) REFERENCES residents(id) ON DELETE SET NULL,
    FOREIGN KEY (respondent_id) REFERENCES residents(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (updated_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_blotter_respondent ON blotter_records(respondent_id, status);

-- 5. CERTIFICATE TEMPLATES TABLE (Official-Editable Layouts)
CREATE TABLE IF NOT EXISTS certificate_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_code TEXT NOT NULL UNIQUE,       -- e.g., "BRGY_CLEARANCE", "INDIGENCY", "RESIDENCY"
    template_name TEXT NOT NULL,              -- e.g., "Barangay Clearance"
    title_header TEXT NOT NULL,               -- e.g., "BARANGAY CLEARANCE" or "CERTIFICATION"
    body_html TEXT NOT NULL,                  -- Rich HTML containing {{placeholders}}
    show_officials_sidebar INTEGER NOT NULL DEFAULT 1, -- 1 = Left column shows Barangay Council, 0 = Full width text
    default_fee REAL NOT NULL DEFAULT 50.00,
    requires_blotter_check INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    updated_by INTEGER,
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- 6. CERTIFICATE ISSUANCES TABLE (Transaction & Printing Log)
CREATE TABLE IF NOT EXISTS certificate_issuances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    control_number TEXT NOT NULL UNIQUE,      -- e.g., "CERT-2026-00001"
    resident_id INTEGER NOT NULL,
    template_id INTEGER NOT NULL,
    purpose TEXT NOT NULL,                    -- e.g., "Local Employment", "Medical Assistance"
    or_number TEXT DEFAULT '',                -- Official Receipt No. (or "FREE / EXEMPT")
    amount_paid REAL NOT NULL DEFAULT 0.00,
    ctc_number TEXT DEFAULT '',               -- Cedula / Community Tax Certificate No.
    ctc_date_issued TEXT DEFAULT '',
    ctc_place_issued TEXT DEFAULT '',

    -- Signatory & OIC Snapshot
    signatory_official_id INTEGER NOT NULL,
    signatory_name_snapshot TEXT NOT NULL,    -- Stored as text so historical logs remain accurate after elections
    signatory_position_snapshot TEXT NOT NULL,
    is_oic_signing INTEGER NOT NULL DEFAULT 0,-- 1 = Signed "By Authority of the Punong Barangay"

    -- Blotter Gatekeeper Audit
    had_active_blotter INTEGER NOT NULL DEFAULT 0,
    blotter_override_reason TEXT DEFAULT '',

    issued_by_user_id INTEGER NOT NULL,
    issued_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (resident_id) REFERENCES residents(id),
    FOREIGN KEY (template_id) REFERENCES certificate_templates(id),
    FOREIGN KEY (signatory_official_id) REFERENCES barangay_officials(id),
    FOREIGN KEY (issued_by_user_id) REFERENCES users(id)
);

-- 7. IMMUTABLE AUDIT LOGS TABLE (Transparency: Who Edited What)
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    username_snapshot TEXT NOT NULL,
    user_role_snapshot TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN (
        'LOGIN', 'CREATE', 'UPDATE', 'ARCHIVE', 'RESTORE',
        'PRINT_CERTIFICATE', 'BLOTTER_OVERRIDE', 'IMPORT_EXCEL', 'EXPORT_EXCEL', 'SYSTEM_BACKUP'
    )),
    entity_type TEXT NOT NULL,                -- 'resident', 'blotter', 'official', 'template', 'issuance', 'user'
    entity_id INTEGER,
    summary_text TEXT NOT NULL,               -- Human-readable summary, e.g., "Updated resident Juan Dela Cruz (is_pwd: 0 -> 1)"
    old_data_json TEXT,                       -- JSON string of changed fields BEFORE update
    new_data_json TEXT,                       -- JSON string of changed fields AFTER update
    client_ip TEXT DEFAULT '127.0.0.1',
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 8. BARANGAY METADATA SETTINGS TABLE
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
-- Default keys: 'barangay_name', 'municipality_name', 'province_name', 'region_name', 'contact_email'
```

---

## 5. Detailed Functional Specifications & Business Rules

### 5.1 Special Sector Tagging & Age-Derived SQL Filtering
The system tracks both **Age-Computed Sectors** and **Manually Checked Sectors**.
* **Never hardcode `age` or `is_senior` as static integers in SQLite** because they become stale the next year. Instead, compute age dynamically in SQLite queries and TypeScript:
  ```sql
  -- SQLite Dynamic Age Calculation Formula:
  CAST((julianday('now', 'localtime') - julianday(birthdate)) / 365.2425 AS INTEGER) AS age
  ```
* **Auto-Computed Sector Filter Rules:**
  * **Senior Citizen:** `age >= 60`
  * **SK / Youth:** `age >= 15 AND age <= 30`
  * **Minor:** `age < 18`
* **Combinatorial Filter API (`GET /api/residents`):**
  * Must accept query parameters: `?search=dela+cruz&purok=Purok+1&sectors=senior,pwd,indigent,4ps,solo_parent,voter,youth,ofw,osy`
  * Must support exporting the exact currently filtered dataset directly to an `.xlsx` file (`GET /api/residents/export-excel?...`).

### 5.2 Automated Blotter Gatekeeper Workflow
When a user selects a resident in the **Issue Certificate** screen:
1. Frontend immediately calls `GET /api/residents/:id/blotter-check`.
2. Backend queries `blotter_records` where `respondent_id = :id AND is_archived = 0 AND status IN ('Active', 'Under Mediation', 'CFA Issued')`.
3. **If count == 0:** Returns `{ cleared: true, cases: [] }`. UI shows a green **"Cleared: No Pending Blotter Record"** badge.
4. **If count > 0:** Returns `{ cleared: false, cases: [...] }`.
   * UI displays a **Red Gatekeeper Warning Card** listing Case Number, Complainant Name, Incident Type, Status, and Date Recorded.
   * The **"Print Certificate"** button is locked until the user checks **"Authorize Issuance Override"** and enters a mandatory `blotter_override_reason` (minimum 10 characters, e.g., *"Approved by Punong Barangay for urgent hospital assistance"*).
   * Printing with an override logs both `PRINT_CERTIFICATE` and a high-priority `BLOTTER_OVERRIDE` entry in `audit_logs`.

### 5.3 Dynamic Officials & Editable Certificate Template Engine
Officials must be able to edit certificate text and manage council members without touching code.
* **Supported Template Variables (`{{placeholder}}`):**
  | Placeholder Tag | Resolved Value |
  | :--- | :--- |
  | `{{full_name}}` | Resident's `FIRST_NAME MIDDLE_NAME LAST_NAME SUFFIX` (Uppercase) |
  | `{{age}}` | Dynamically calculated age from `birthdate` |
  | `{{birthdate}}` | Formatted birthdate (e.g., *October 21, 1990*) |
  | `{{sex}}` | `Male` or `Female` |
  | `{{civil_status}}` | Resident's civil status |
  | `{{pronoun_he_she}}` | `he` (if Male) or `she` (if Female) |
  | `{{pronoun_his_her}}` | `his` (if Male) or `her` (if Female) |
  | `{{purok}}` | Resident's `purok` |
  | `{{address}}` | Full address (`house_no_street, purok, Barangay Name, Municipality, Province`) |
  | `{{purpose}}` | Transaction purpose entered during issuance |
  | `{{control_number}}` | Auto-generated sequential ID (e.g., `CERT-2026-00042`) |
  | `{{or_number}}` | Official Receipt number |
  | `{{amount_paid}}` | Formatted PHP currency (e.g., `₱50.00` or `FREE`) |
  | `{{day_ordinal}}` | Day with ordinal suffix (e.g., `21st`) |
  | `{{month_year}}` | Current Month and Year (e.g., `October 2026`) |
  | `{{punong_barangay}}` | Active `Punong Barangay` from `barangay_officials` |
  | `{{barangay_secretary}}` | Active `Barangay Secretary` from `barangay_officials` |
  | `{{barangay_treasurer}}` | Active `Barangay Treasurer` from `barangay_officials` |
  | `{{signatory_name}}` | Selected Signatory (Punong Barangay OR OIC Kagawad) |
  | `{{signatory_title}}` | `Punong Barangay` OR `Sangguniang Barangay Member / OIC` |

* **Left Sidebar Council Roster (`show_officials_sidebar = 1`):**
  * When enabled on a template, the print layout splits the page into a **Left Column (28% width)** listing the active `Punong Barangay`, all 7 `Sangguniang Barangay Members` with their `committee` subtitle, `SK Chairperson`, `Barangay Secretary`, and `Barangay Treasurer` (ordered by `rank_order ASC`), and a **Right Column (72% width)** containing the certificate body and signatory block.

### 5.4 Transparency Audit Interceptor (`audit.service.ts`)
Every mutating API endpoint (`POST`, `PUT`, `PATCH`, `DELETE`) MUST invoke `logAuditEvent()`:
* **Diff Calculation Rules:**
  * On `UPDATE` operations, fetch the existing row before executing the `UPDATE` statement.
  * Compare keys between `existingRow` and `updatedPayload`.
  * Construct `oldDiff` and `newDiff` objects containing **only the fields that actually changed**.
  * Store `JSON.stringify(oldDiff)` in `old_data_json` and `JSON.stringify(newDiff)` in `new_data_json`.
* **Immutability:** There must be **NO** `UPDATE` or `DELETE` endpoints for `audit_logs`.

### 5.5 Role-Based Access Control (RBAC) Matrix

| Module / Action | `Admin` (Secretary) | `Clerk` (Staff) | `Treasurer` | `Lupon` |
| :--- | :---: | :---: | :---: | :---: |
| View & Search Residents / Filter Sectors | ✅ | ✅ | ✅ | ✅ |
| Add / Edit Resident Profiles | ✅ | ✅ | ❌ | ❌ |
| Archive / Restore Residents | ✅ | ❌ | ❌ | ❌ |
| Import Excel Masterlist | ✅ | ❌ | ❌ | ❌ |
| Export Filtered Excel Reports | ✅ | ✅ | ✅ | ❌ |
| Print Certificates | ✅ | ✅ | ✅ | ❌ |
| Manage Blotter Cases (Add / Settle) | ✅ | ❌ | ❌ | ✅ |
| Edit Certificate Templates | ✅ | ❌ | ❌ | ❌ |
| Update Current Barangay Officials Roster | ✅ | ❌ | ❌ | ❌ |
| View Transparency Audit Logs & Manage Users | ✅ | ❌ | ❌ | ❌ |

---

## 6. REST API Endpoint Reference

### Authentication & Users
* `POST /api/auth/login` — Authenticate username/password, update `last_login_at`, log `LOGIN` audit event, return JWT + user profile.
* `GET /api/auth/me` — Verify current token and return logged-in user details.
* `GET /api/users` — *(Admin)* List all user accounts.
* `POST /api/users` — *(Admin)* Create staff account and log audit event.
* `PUT /api/users/:id` — *(Admin)* Update role, reset password, or toggle `is_active`.

### Residents & Sector Filtering
* `GET /api/residents` — Query params: `search`, `purok`, `sex`, `civil_status`, `sectors` (comma-separated), `page`, `limit`.
* `GET /api/residents/stats` — Dashboard counts (Total Residents, Households/Puroks, Seniors, PWDs, 4Ps, Voters, Indigents, Active Blotters).
* `POST /api/residents` — Create resident + log `CREATE` in `audit_logs`.
* `PUT /api/residents/:id` — Update resident + compute JSON diff in `audit_logs`.
* `PATCH /api/residents/:id/archive` — Soft-delete (`is_archived = 1`) + log `ARCHIVE` in `audit_logs`.
* `POST /api/residents/import-excel` — Bulk import mapped JSON array from Excel preview, skip duplicates (`first_name + last_name + birthdate`), log `IMPORT_EXCEL`.
* `GET /api/residents/export-excel` — Generate and download `.xlsx` buffer matching current filter query params.

### Blotter Gatekeeper & Lupon Records
* `GET /api/blotter` — List blotter records with filter by `status` and `search`.
* `GET /api/residents/:id/blotter-check` — Fast check returning active/pending blotter cases where `respondent_id = :id`.
* `POST /api/blotter` — Create new blotter case (auto-generates `BLT-YYYY-NNN` case number).
* `PUT /api/blotter/:id` — Update blotter status (e.g., `Active` → `Settled`) + log before/after JSON diff.

### Barangay Officials Roster
* `GET /api/officials` — List all active officials ordered by `rank_order ASC`.
* `POST /api/officials` — *(Admin)* Add official.
* `PUT /api/officials/:id` — *(Admin)* Edit official name, position, committee, or active status + log audit diff.

### Certificate Templates & Issuance
* `GET /api/templates` — List all certificate templates.
* `PUT /api/templates/:id` — *(Admin)* Update `title_header`, `body_html`, `show_officials_sidebar`, or `default_fee` + log audit diff.
* `POST /api/issuances/preview` — Accepts `{ resident_id, template_id, purpose, or_number, amount_paid, signatory_official_id, is_oic_signing }` and returns the fully interpolated HTML string + sidebar official roster.
* `POST /api/issuances` — Saves the issuance record, generates sequential `control_number`, records blotter override if applicable, writes to `audit_logs`, and returns printable data payload.
* `GET /api/issuances` — History of issued certificates with filter by date range, template type, and issuing clerk.

### Audit Logs & System Maintenance
* `GET /api/audit-logs` — *(Admin)* Paginated list of audit logs with filter by `user_id`, `action`, `entity_type`, and date range.
* `GET /api/system/info` — Returns host LAN IPv4 addresses (from `os.networkInterfaces()`), barangay metadata settings, and DB file size.
* `POST /api/system/backup` — Uses `better-sqlite3` `.backup()` API to create a safe hot backup in `data/backups/barangay_backup_YYYYMMDD_HHMMSS.sqlite` and streams it as a browser file download.

---

## 7. Print Layout & CSS Specification (`@media print`)

To ensure crisp, official-grade printing on standard ink-tank printers (Epson/Canon/Brother) without requiring MS Word or external PDF binaries:
1. Create a dedicated `<CertificatePrintSheet />` component styled to `210mm x 297mm` (A4) or `8.5in x 11in` (Letter).
2. Include the following print stylesheet rules in `index.css`:
   ```css
   @media print {
     @page {
       size: A4 portrait;
       margin: 12mm;
     }
     body * {
       visibility: hidden;
     }
     #printable-certificate-area,
     #printable-certificate-area * {
       visibility: visible;
     }
     #printable-certificate-area {
       position: absolute;
       left: 0;
       top: 0;
       width: 100%;
       box-shadow: none !important;
       border: none !important;
     }
     .no-print {
       display: none !important;
     }
   }
   ```
3. Use `Times New Roman` or `Georgia` serif typography for the formal certificate header and body, with bold uppercase formatting for resident names and official signatories.

---

## 8. Implementation Milestones for the AI Agent

When building this repository, execute in the following strict order:
1. **Step 1 — Database & Seed Layer:** Initialize `server/src/db/connection.ts`, run `schema.sql`, and create `seed.ts` containing:
   * Default Admin user (`admin` / `admin123`),
   * Complete sample Sangguniang Barangay roster (1 Punong Barangay, 7 Kagawads with committees, 1 SK Chairperson, 1 Secretary, 1 Treasurer),
   * 4 default editable templates (*Barangay Clearance*, *Certificate of Indigency*, *Certificate of Residency*, *First-Time Jobseeker Certification*),
   * 10 sample residents across multiple Puroks and Special Sectors, plus 1 active Blotter case linked to a sample resident.
2. **Step 2 — Backend Services & Middleware:** Implement JWT Auth, `audit.service.ts` (with JSON diff computation), `template.service.ts` (placeholder replacement), and all Express route controllers.
3. **Step 3 — Frontend Core & Resident RBI Module:** Build Login, Dashboard with LAN IP indicator, Resident Table with Combinatorial Sector Filter Chips, Resident Add/Edit Modal, and Excel Import/Export.
4. **Step 4 — Certificate Issuance, Blotter Gatekeeper & Print Engine:** Build the Issuance Wizard with real-time Blotter Check, OIC Signatory selector, live A4 preview, and `@media print` integration.
5. **Step 5 — Admin Configuration & Transparency Views:** Build the Rich-Text Certificate Template Editor (with clickable `{{placeholder}}` insertion buttons), Barangay Officials Manager, and the Audit Log Diff Inspector.