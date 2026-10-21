# Project Assumptions & Constraints
**Offline Web-Based Barangay Management & Certificate Issuance System**

This document records the foundational architectural assumptions, deployment constraints, and operational boundaries guiding the implementation plan and task tickets.

---

## 1. Operating Environment & Network Topology
1. **Host Environment:** The primary host is a standard desktop or laptop PC running Microsoft Windows (Windows 10/11) located at the Barangay Secretary's workstation.
2. **Node.js Runtime:** Node.js LTS (v18.x or v20.x) and `npm` are installed on the host machine.
3. **100% Offline Air-Gapped Operation:** The entire system must function indefinitely without active internet access.
   - All assets (fonts, icons, CSS, JavaScript libraries, UI dependencies) must be bundled locally into `client/dist` and `node_modules`.
   - No external CDN links (e.g., Google Fonts, cdnjs, unpkg) are permitted.
4. **Local Area Network (LAN) Connectivity:**
   - The backend server binds to `0.0.0.0:3000`.
   - Other barangay hall staff (Treasurer, Clerks, Lupon, Barangay Captain) connect from secondary desktop/laptop/tablet devices over local Wi-Fi or Ethernet via the host's LAN IPv4 (e.g., `http://192.168.1.X:3000`).
   - Zero installation or runtime dependencies are required on client machines; any modern Chromium or Firefox-based web browser suffices.
5. **Zero-Setup Startup Launcher:**
   - Double-clicking `start-server.bat` or `start-hidden.vbs` initiates the backend server and triggers the OS default browser to open `http://localhost:3000`.

---

## 2. Architecture & Monorepo Structure
1. **Monorepo Layout:**
   - Single repository containing root coordination files, a `/server` directory (Node.js, Express, TypeScript), and a `/client` directory (Vite, React 18, TypeScript, Tailwind CSS).
2. **Dual-Mode Delivery:**
   - **Development Mode:** Vite runs concurrently on port 5173 with a proxy forwarding `/api` requests to Express on port 3000.
   - **Production / Host Deployment Mode:** The Express server serves compiled static frontend assets from `client/dist` while simultaneously routing API endpoints at `/api/*`.
3. **Process Supervision:** A lightweight script or npm command manages building the client and starting the server without requiring complex process managers like PM2 or Docker.

---

## 3. Database & Data Persistence
1. **Embedded SQLite Engine:**
   - Database operations use `better-sqlite3` to achieve synchronous, high-throughput C++ bindings with zero external database server daemons.
   - Primary database file is stored at `data/barangay_data.sqlite`.
2. **Power-Failure & Brownout Resilience:**
   - Initialized with `PRAGMA journal_mode = WAL;` (Write-Ahead Logging) and `PRAGMA synchronous = NORMAL;` to protect against database corruption during unexpected electrical blackouts.
   - Foreign key constraints are enforced with `PRAGMA foreign_keys = ON;`.
3. **Hot Backup Mechanism:**
   - Database backups use `better-sqlite3`'s native `.backup()` API to create non-blocking, snapshot backups stored in `data/backups/barangay_backup_YYYYMMDD_HHMMSS.sqlite`.
   - The backup can be triggered via a 1-click web interface and streamed as a downloadable file to the user.

---

## 4. Security, Access Control & Auditing
1. **Authentication:**
   - Local authentication using `bcryptjs` for salted password hashing and `jsonwebtoken` (JWT) for session verification.
   - No internet-dependent OAuth or external identity providers.
2. **Role-Based Access Control (RBAC):**
   - Four distinct user roles: `Admin` (Barangay Secretary), `Clerk` (Front-desk Staff), `Treasurer`, and `Lupon` (Lupong Tagapamayapa).
   - Strictly enforced via backend middleware on every mutating route according to the RBAC matrix in `specification.md`.
3. **Immutable Transparency Audit Trail:**
   - The `audit_logs` table is strictly append-only. No API endpoints or user interfaces allow updating or deleting audit logs.
   - Mutating actions (`CREATE`, `UPDATE`, `ARCHIVE`, `RESTORE`, `PRINT_CERTIFICATE`, `BLOTTER_OVERRIDE`, `IMPORT_EXCEL`, `EXPORT_EXCEL`, `SYSTEM_BACKUP`) compute before-and-after JSON diffs capturing only modified fields.
   - Client LAN IP addresses (`req.ip` or forwarded headers) are logged for workstation accountability.

---

## 5. Domain Logic & Business Rules
1. **Registry of Barangay Inhabitants (RBI):**
   - Resident age is **never** stored statically. It is computed dynamically at query time using the birthdate against the current local date:
     `CAST((julianday('now', 'localtime') - julianday(birthdate)) / 365.2425 AS INTEGER) AS age`.
   - Age categories (Senior Citizen: 60+, Youth/SK: 15–30, Minor: <18) are derived dynamically.
   - Special sectors (PWD, Solo Parent, 4Ps, Indigent, Voter, OFW, OSY) are stored as boolean flags with relevant identification numbers.
   - Soft-delete semantics: Resident deletion marks `is_archived = 1` rather than purging rows.
2. **Automated Blotter Gatekeeper:**
   - Prior to issuing any certificate, the system queries active blotter cases where `respondent_id = :resident_id` and `status IN ('Active', 'Under Mediation', 'CFA Issued')`.
   - Pending cases trigger a prominent red clearance warning.
   - The certificate issuance can only proceed if explicitly overridden with a mandatory justification (`blotter_override_reason` >= 10 characters), creating a high-priority audit log entry.
3. **Dynamic Barangay Officials & Signatories:**
   - Official signatories are not hardcoded. Active officials are loaded from `barangay_officials`.
   - Certificates support either the Punong Barangay or an designated Kagawad (OIC) signing "By Authority of the Punong Barangay".
   - Issued certificates snapshot the signatory's name and position as immutable text to preserve historical validity across election terms.

---

## 6. Document Generation & Printing
1. **Zero External Binary Dependencies:**
   - No external PDF compilation binaries (e.g., Puppeteer, wkhtmltopdf, LibreOffice) are required.
   - Rendering relies on native browser `@media print` CSS targeting standard A4 (`210mm x 297mm`) and Letter (`8.5in x 11in`) paper.
2. **WYSIWYG & Dynamic Templates:**
   - Certificate templates are stored as HTML containing double curly brace placeholders (e.g., `{{full_name}}`, `{{purpose}}`, `{{control_number}}`).
   - Rich-text editing is handled in-browser via TipTap (or React-Quill).
   - Dynamic layouts support an optional left council sidebar (28% width) showing active officials, or a standard full-width layout.

---

## 7. Multi-Agent Pipeline & Routing Strategy
1. **Model Assignment:**
   - **Flash (Gemini 3.7 Flash):** High-speed execution for routine, structured, boilerplate, UI components, standard CRUD controllers, and scaffolding.
   - **Pro (Gemini 3.1 Pro):** Deep reasoning, edge-case analysis, and verification for security-critical modules (JWT Auth, RBAC guards, immutable audit diffs, blotter gatekeeper, transactional issuance, and end-to-end integration audits).
2. **Ticket Structure:** Every phase will have a formal scoped ticket in `tasks/phase-N-<name>.md` following Section 2 of `multi_agent_prompt_flow.md` before execution begins.
