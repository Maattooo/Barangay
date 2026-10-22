# Barangay Management & Official Certificate Issuance System

A **100% offline, air-gapped, local web-based management system** engineered specifically for Philippine barangay local government units (LGUs). The system manages the **Registry of Barangay Inhabitants (RBI)**, executes **dynamic age and special sector demographics**, enforces automated **Lupong Tagapamayapa blotter gatekeeping**, dynamically maintains the **Sangguniang Barangay Council roster**, prints official **A4/Letter text-based certificates** with native CSS print styling, and records a fine-grained **immutable visual JSON diff audit trail**.

---

## 1. System Overview & Core Capabilities

- **100% Offline Air-Gapped Operation:** Zero external network calls, zero third-party CDNs, zero cloud databases, and zero external font or script dependencies. Functions completely without internet access in rural, coastal, or emergency power-outage environments.
- **Dynamic Age & Combinatorial Sector Demographics:** Computes resident ages on-the-fly using the high-precision astronomical Julian Day formula `CAST((julianday('now', 'localtime') - julianday(birthdate)) / 365.2425 AS INTEGER)`. Automatically tags Senior Citizens ($\ge 60$), SK / Youth ($15 - 30$), and Minors ($< 18$) alongside manual sector flags (PWD, 4Ps, Indigent, Solo Parent, Registered Voter, OFW, Out-of-School Youth). Supports instant Excel masterlist export with active filter preservation.
- **Automated Lupong Tagapamayapa Blotter Gatekeeper:** Real-time inter-module gatekeeper stops certificate issuance for respondents with pending active blotter cases (`Active`, `Under Mediation`, `CFA Issued`). Issuance can only proceed if authorized with a mandatory justification ($\ge 10$ characters), atomically recording both `PRINT_CERTIFICATE` and `BLOTTER_OVERRIDE` audit events.
- **Dynamic Council Roster & WYSIWYG Template Engine:** Manage Punong Barangay, Kagawads, SK Chairperson, Secretary, and Treasurer terms and committee assignments. Certificate templates feature real-time variable interpolation (`{{full_name}}`, `{{purok}}`, `{{punong_barangay}}`, `{{day_ordinal}}`, etc.) and instant preview.
- **Native A4/Letter Clean Print Engine:** Implements dedicated `@media print` CSS rules, two-column official LGU seal headers, left-column council rosters, watermarks, and historical signatory snapshotting (ensuring certificates retain original official names even after elections).
- **Immutable Visual JSON Diff Audit Trail:** Every mutating operation (`POST`, `PUT`, `DELETE`) automatically calculates granular before/after diffs (`old_data_json`, `new_data_json`) with zero no-op pollution, exact LAN client IP attribution, and immutable read-only preservation.

---

## 2. Technology Stack & Monorepo Structure

### Technology Stack
- **Backend:** Node.js, Express, TypeScript, Better-SQLite3, JSON Web Tokens (`jsonwebtoken`), `bcryptjs`, `xlsx`.
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide React, React Router v7.
- **Database:** Embedded SQLite with Write-Ahead Logging (`WAL`) mode and `PRAGMA synchronous = NORMAL`.
- **Testing & Tooling:** Vitest, Supertest, React Testing Library, Concurrently.

### Monorepo Architecture
```text
barangay-system/
├── package.json                   # Root workspace orchestrator (server + client)
├── start-server.bat               # Windows 1-click startup launcher
├── start-hidden.vbs               # Silent background Windows launcher
├── README.md                      # Comprehensive system & defense documentation
├── data/
│   ├── barangay_data.sqlite       # Production SQLite database (WAL mode)
│   └── backups/                   # Hot timestamped database backup archives
├── server/                        # Express + TypeScript backend API
│   ├── src/
│   │   ├── index.ts               # Server entry point (binds to 0.0.0.0:3000)
│   │   ├── db/
│   │   │   ├── connection.ts      # SQLite connection & WAL pragmas
│   │   │   ├── init.ts            # DDL schema initialization
│   │   │   ├── schema.sql         # 8 relational tables & triggers
│   │   │   └── seed.ts            # Default admin, council, and templates
│   │   ├── controllers/           # HTTP request handlers & validation
│   │   ├── services/              # Business logic, diff engine & gatekeeper
│   │   ├── middleware/            # JWT authentication, RBAC & IP extraction
│   │   └── routes/                # Express API route declarations
│   └── tests/                     # Backend unit & integration test suites
│       └── e2e/workflow.test.ts   # Server runner for Phase 13 integration suite
├── client/                        # React 18 + Vite frontend SPA
│   ├── index.html                 # Offline entry HTML (local font fallbacks)
│   ├── src/
│   │   ├── components/            # Layout, Navigation, Topbar, Modals, Print preview
│   │   ├── context/               # AuthContext (JWT & role management)
│   │   ├── pages/                 # Dashboard, Residents, Certificates, Blotter, Officials, Templates, Audit, Settings
│   │   ├── services/              # Client-side API connectors & Excel triggers
│   │   └── test/                  # Component and UI workflow test suites
│   └── dist/                      # Compiled production assets (air-gapped bundle)
└── tests/
    └── e2e/workflow.test.ts       # Root E2E lifecycle & LAN verification test suite
```

---

## 3. Prerequisites, Installation & 1-Click Windows Startup

### Prerequisites
- **Operating System:** Windows 10 / 11, Windows Server, or Linux / macOS.
- **Runtime:** Node.js LTS (v18.0.0+ or v20.0.0+ recommended).

### Initial Setup & Production Build
Open a command prompt in the project root directory and run:

```bash
# 1. Install root and workspace dependencies
npm install

# 2. Compile both server and client production bundles
npm run build

# 3. Initialize the SQLite database schema
npm run db:init

# 4. Seed default admin, council officials, and certificate templates
npm run db:seed
```

### 1-Click Windows Daily Startup
For everyday non-technical barangay staff operation:
- **Option A (Visible Console Launcher):** Double-click `start-server.bat`.
  - Verifies Node.js installation.
  - Automatically launches the default web browser to `http://localhost:3000`.
  - Starts the production server in the background.
- **Option B (Silent Background Launcher):** Double-click `start-hidden.vbs`.
  - Launches `start-server.bat` silently without keeping a Command Prompt window open on the desktop.

---

## 4. Multi-Desk Local Area Network (LAN) Workstation Setup

The system is architected for **multi-desk barangay hall operations** with zero client installation on secondary PCs.

```text
               +-------------------------------------------+
               |        Barangay Secretary Host PC         |
               |  (Node.js Server + SQLite DB on 0.0.0.0)  |
               |         Local IP: 192.168.1.25:3000       |
               +-------------------------------------------+
                                     |
               +---------------------+---------------------+
               |       Local Barangay Wi-Fi Router / Switch |
               |               (No Internet Needed)        |
               +---------------------+---------------------+
                                     |
       +-----------------------------+-----------------------------+
       |                             |                             |
+---------------------+    +---------------------+    +---------------------+
|   Clerk Terminal    |    |  Treasurer Terminal |    |    Lupon Terminal   |
|   (Browser Only)    |    |   (Browser Only)    |    |    (Browser Only)   |
| 192.168.1.25:3000   |    | 192.168.1.25:3000   |    | 192.168.1.25:3000   |
+---------------------+    +---------------------+    +---------------------+
```

### Setting Up Multi-Desk Access:
1. **Host Binding:** The host server automatically binds to `0.0.0.0:3000`, listening on all active local network adapters.
2. **Find Host LAN IPv4 Address:**
   - Look at the **LAN IP Badge** in the top navigation bar of the application (e.g., `LAN: 192.168.1.25:3000`), or
   - Go to **System Settings** (`/settings`) to view all detected network adapter addresses, or
   - Run `ipconfig` in Windows Command Prompt and note the `IPv4 Address`.
3. **Connecting Secondary Workstations:**
   - Ensure the secondary PC, laptop, or tablet is connected to the same local Wi-Fi or Ethernet router.
   - Open Google Chrome, Microsoft Edge, or Mozilla Firefox and navigate to:
     ```text
     http://192.168.1.25:3000
     ```
   - No software, database, or plugin installation is required on secondary terminals.
4. **Windows Firewall Note:** If secondary devices cannot connect, allow inbound TCP traffic on port `3000`:
   ```powershell
   netsh advfirewall firewall add rule name="Barangay System (Port 3000)" dir=in action=allow protocol=TCP localport=3000
   ```

---

## 5. Role-Based Access Control (RBAC) & Demo Credentials

The system provides 4 discrete roles aligned with standard Philippine Barangay organizational structures:

### Default / Demo Credentials Table
| Username | Password | Role | Primary Responsibility |
| :--- | :--- | :--- | :--- |
| `admin` | `admin123` | **Admin** (Secretary) | Full administrative access, user management, templates, council roster, audit logs, hot backups. |
| `clerk` | `clerk123` | **Clerk** (Staff) | Resident registration and editing, demographic sector filtering, certificate issuance and printing. |
| `treasurer` | `treasurer123` | **Treasurer** | Resident and demographics viewing, Excel reports export, certificate printing. |
| `lupon` | `lupon123` | **Lupon** | Lupong Tagapamayapa case management (incident recording, conciliation hearing status updates, settlements). |

### RBAC Permissions Matrix
| Module / Action | `Admin` | `Clerk` | `Treasurer` | `Lupon` |
| :--- | :---: | :---: | :---: | :---: |
| View & Search Residents / Filter Sectors | ✅ | ✅ | ✅ | ✅ |
| Add / Edit Resident Profiles | ✅ | ✅ | ❌ | ❌ |
| Archive / Restore Residents | ✅ | ❌ | ❌ | ❌ |
| Import Excel Masterlist | ✅ | ❌ | ❌ | ❌ |
| Export Filtered Excel Reports | ✅ | ✅ | ✅ | ❌ |
| Issue & Print Certificates | ✅ | ✅ | ✅ | ❌ |
| Manage Blotter Cases (Add / Settle / CFA) | ✅ | ❌ | ❌ | ✅ |
| Edit Certificate Templates | ✅ | ❌ | ❌ | ❌ |
| Update Barangay Officials Roster | ✅ | ❌ | ❌ | ❌ |
| View Immutable Audit Logs | ✅ | ❌ | ❌ | ❌ |
| Manage User Accounts | ✅ | ❌ | ❌ | ❌ |
| Create System Hot Backups | ✅ | ❌ | ❌ | ❌ |

---

## 6. Database Resilience & Hot Backup / Restoration Drill

### Brownout & Sudden Power-Loss Protection
Sudden power interruptions and electrical brownouts are common in Philippine municipalities. SQLite is configured with:
- `PRAGMA journal_mode = WAL;` (Write-Ahead Logging): Readers do not block writers, and writers do not block readers. Changes are written to a sequential `.sqlite-wal` append log before commit.
- `PRAGMA synchronous = NORMAL;`: Ensures full data recovery and zero database corruption across operating system crashes and sudden power disconnection.
- `PRAGMA foreign_keys = ON;`: Enforces relational constraints across all 8 tables.

### 1-Click Hot Database Backup
Administrators can trigger a safe live snapshot without locking or stopping the server:
1. Log in as `Admin` and navigate to **System Settings** (`/settings`).
2. Click **"Generate Hot Backup Now"**.
3. The server invokes Better-SQLite3's native `.backup()` method, generating a clean snapshot in `data/backups/barangay_backup_YYYYMMDD_HHMMSS.sqlite` and prompting an immediate browser file download.
4. An immutable `SYSTEM_BACKUP` audit log is recorded.

### Standalone Database Restoration Procedure
In the event of physical hardware failure or host PC migration:
1. Stop the server (`Ctrl+C` in the console window).
2. Copy your desired backup file from `data/backups/barangay_backup_YYYYMMDD_HHMMSS.sqlite`.
3. Overwrite the active database file at `data/barangay_data.sqlite`.
4. Delete any existing `data/barangay_data.sqlite-wal` and `data/barangay_data.sqlite-shm` files.
5. Launch the system via `start-server.bat`.

---

## 7. Step-by-Step Thesis Panel Defense Demonstration Guide

Follow this 5-stage live demonstration script to present the system's compliance with DILG guidelines and technical specifications to thesis evaluators:

### Stage 1: Resident RBI Registration & Combinatorial Sector Demographics
1. **Login:** Log in as **Clerk** (`clerk` / `clerk123`).
2. **Registration:** Navigate to **Residents** (`/residents`) &rarr; click **"Register Resident"**.
3. **Input Data:**
   - First Name: `Elena`, Middle Name: `Santos`, Last Name: `Marasigan`.
   - Birthdate: `1958-04-15` *(notice age dynamically evaluates to 60+ without entering an age number)*.
   - Purok: `Purok 2`, Civil Status: `Married`.
   - Check Special Sectors: **Senior Citizen** (auto-computed), **PWD** (enter PWD ID: `PWD-2026-001`), **4Ps Beneficiary**, and **Registered Voter**.
4. **Demonstrate Filtering:**
   - On the Residents table, select the **Sector Multi-Select**: check **Senior**, **PWD**, and **4Ps**.
   - Notice the table filters in real-time.
   - Click **"Export to Excel"** to demonstrate immediate spreadsheet export matching the exact active filter criteria.

### Stage 2: Lupong Tagapamayapa Incident Filing & Blotter Numbering
1. **Switch Role:** Log out and log in as **Lupon** (`lupon` / `lupon123`).
2. **File Case:** Navigate to **Blotter Records** (`/blotter`) &rarr; click **"Record New Incident"**.
3. **Input Case:**
   - Complainant: `Rodrigo Duterte`.
   - Respondent: Select or type `Elena Marasigan` *(resident autocompletion links the respondent ID)*.
   - Incident Type: `Property Boundary Dispute`.
   - Location: `Purok 2 Orchid Street`.
   - Details: `Dispute regarding fence encroachment along Purok 2 lot line`.
4. **Submit:** Click **"Save Case"**. Show the panel the auto-generated sequential case number (e.g., `BLT-2026-001`) and the initial status badge **"Active"**.

### Stage 3: Automated Blotter Gatekeeper Block & Mandatory Justified Override
1. **Switch Role:** Log out and log back in as **Clerk** (`clerk` / `clerk123`).
2. **Start Issuance:** Navigate to **Issue Certificate** (`/issue-certificate`).
3. **Select Resident:** Search for `Elena Marasigan` and click **"Select Resident"**.
4. **Observe Gatekeeper Warning:**
   - Point out the **Red Gatekeeper Warning Card** that appears instantly.
   - The card shows `BLT-2026-001`, complainant `Rodrigo Duterte`, and status `Active`.
   - Point out that the **"Proceed to Template"** button is completely disabled.
5. **Demonstrate Override Enforcement:**
   - Check the **"Authorize Issuance Override"** box.
   - Type a short reason: `Urgent` *(notice the input turns red and informs the user that at least 10 characters are required)*.
   - Enter a valid justification: `Approved by Punong Barangay for urgent medical hospitalization assistance`.
   - The button unlocks. Click **"Proceed to Template"**.

### Stage 4: Live Official A4 Certificate Print Preview & Signatory Snapshotting
1. **Configure Document:**
   - Select Template: **Barangay Clearance**.
   - Select Signatory: **HON. ROBERTO C. SANTOS** (*Punong Barangay*).
   - Enter Purpose: `Emergency Medical Financial Assistance`.
2. **Preview Document:** Click **"Preview Certificate"**.
   - Show the panel the clean 2-column LGU layout.
   - Show that all placeholders (`{{full_name}}`, `{{purok}}`, `{{civil_status}}`, `{{punong_barangay}}`) have been cleanly replaced with uppercase text and zero unparsed brackets.
3. **Print Execution:** Click **"Print Certificate"**.
   - The system triggers native browser print (`window.print()`).
   - Notice the document receives a strictly sequential control number (e.g., `CERT-2026-00001`).
   - The signatory name and title are permanently snapshotted in the database record.

### Stage 5: System Administrator Transparency Audit Trail & Visual JSON Diff Inspection
1. **Switch Role:** Log out and log in as **Admin** (`admin` / `admin123`).
2. **Open Audit Inspector:** Navigate to **Audit Logs** (`/audit-logs`).
3. **Inspect Chronological Events:** Show the evaluation panel the complete chronological event stream:
   - `LOGIN`: Clerk and Lupon sessions with exact originating LAN client IP addresses.
   - `CREATE` (resident): Details of Elena Marasigan's registration.
   - `CREATE` (blotter): Case `BLT-2026-001` filed by the Lupon officer.
   - `BLOTTER_OVERRIDE` (high-priority badge): The exact justification reason entered by the Clerk.
   - `PRINT_CERTIFICATE`: The control number, document type, and recipient.
4. **Demonstrate Visual JSON Diff:**
   - Click on the resident `UPDATE` log entry.
   - Show the **Side-by-Side Visual Diff Card**: red strikethrough for old values and green highlighting for new values.
   - Point out that unchanged fields are never duplicated in the audit log.
5. **Verify Immutability:** Show that there are no "Edit" or "Delete" buttons anywhere in the Audit Trail interface.

---

## 8. Automated Verification & Testing Commands

The monorepo contains 100% automated coverage across all backend services, frontend components, and integration suites:

```bash
# Run complete server test suite (including Phase 13 E2E Integration)
npm test --workspace=server

# Run complete frontend test suite
npm test --workspace=client

# Execute production build verification
npm run build
```

---

## 9. License & Attribution
Designed and built for Philippine Barangay Local Government Units in accordance with the **Local Government Code of 1991 (Republic Act No. 7160)** and **DILG Memorandum Circulars on Barangay Governance and Inhabitants Recording**.
