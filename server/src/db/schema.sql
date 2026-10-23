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
    template_category TEXT NOT NULL DEFAULT 'certificate' CHECK(template_category IN ('certificate', 'blotter')),
    paper_size TEXT NOT NULL DEFAULT 'a4' CHECK(paper_size IN ('short', 'a4', 'long')),
    header_html TEXT NOT NULL DEFAULT '',     -- Customizable rich HTML header structure
    header_config_json TEXT NOT NULL DEFAULT '{}', -- Header layout config (seals, borders, alignment, subtitle)
    title_header TEXT NOT NULL,               -- e.g., "BARANGAY CLEARANCE" or "CERTIFICATION"
    body_html TEXT NOT NULL,                  -- Rich HTML containing {{placeholders}}
    footer_html TEXT NOT NULL DEFAULT '',     -- Optional custom footer / signatory layout
    docx_filename TEXT NOT NULL DEFAULT '',   -- Associated MS Word .docx filename in data/templates/word/
    show_officials_sidebar INTEGER NOT NULL DEFAULT 1, -- 1 = Left column shows Barangay Council, 0 = Full width text
    default_fee REAL NOT NULL DEFAULT 50.00,
    requires_blotter_check INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    updated_by INTEGER,
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- 5b. BLOTTER / KP TEMPLATES TABLE (Official Printable Blotter & Katarungang Pambarangay Forms)
CREATE TABLE IF NOT EXISTS blotter_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_code TEXT NOT NULL UNIQUE,       -- e.g., "BLOTTER_EXTRACT", "KP_SUMMONS", "KP_SETTLEMENT", "KP_CFA"
    template_name TEXT NOT NULL,              -- e.g., "Blotter Incident Report"
    template_category TEXT NOT NULL DEFAULT 'blotter' CHECK(template_category IN ('certificate', 'blotter')),
    paper_size TEXT NOT NULL DEFAULT 'a4' CHECK(paper_size IN ('short', 'a4', 'long')),
    header_html TEXT NOT NULL DEFAULT '',
    header_config_json TEXT NOT NULL DEFAULT '{}',
    title_header TEXT NOT NULL,
    body_html TEXT NOT NULL,
    footer_html TEXT NOT NULL DEFAULT '',
    docx_filename TEXT NOT NULL DEFAULT '',
    show_officials_sidebar INTEGER NOT NULL DEFAULT 0,
    default_fee REAL NOT NULL DEFAULT 0.00,
    requires_blotter_check INTEGER NOT NULL DEFAULT 0,
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
