# Design System Master File: Swiss Architectural Grid (Barangay Operations Portal)

> **LOGIC:** This is the Global Source of Truth for the entire Barangay management system redesign.
> Strictly follow the rules below to ensure an edgy, professional, user-friendly, and non-AI aesthetic.

---

**Project:** Barangay Management & Civil Registry System  
**Aesthetic Identity:** Swiss Architectural Grid / High-Contrast Utilitarian  
**Design Dials:** Variance 3/10 (Minimal & Structural) | Motion 2/10 (Snappy 100-150ms) | Density 7/10 (Modular Data Grid)  
**Corner Radius:** Strict 0px (`rounded-none`) across all cards, buttons, inputs, tables, modals, and tags  
**Shadows:** None (`shadow-none`); structural definition relies purely on 1px hairline borders (`border-zinc-200` / `border-zinc-800`)  

---

## 1. Global Color Tokens (Anti-AI & Standard Recognizable)

Strictly zero neon glowing purples, fuchsias, or cyan AI gradients. All colors are honest, high-contrast, recognizable civic and status colors:

| Token | Hex / Class | Purpose |
|-------|-------------|---------|
| Canvas Background | `#F8F9FA` (`bg-[#F8F9FA]` / `bg-zinc-50`) | Clean off-white paper canvas for daytime document reading |
| Surface / Cards | `#FFFFFF` (`bg-white`) | Pure white elevated data modules with 1px border |
| Dark Anchor (Sidebar) | `#121214` (`bg-[#121214]`) | Deep structural graphite sidebar & dark headers |
| Primary Text | `#09090B` (`text-zinc-950`) | High-contrast deep black/graphite typography |
| Secondary Text | `#52525B` (`text-zinc-600`) | Clean slate-zinc subtext and metadata |
| Muted / Captions | `#71717A` (`text-zinc-500`) | Micro-labels, table column headers (uppercase) |
| Hairline Border | `#E4E4E7` (`border-zinc-200` / `border-zinc-300`) | Crisp 1px geometric grid dividers |
| Dark Divider | `#27272A` (`border-zinc-800`) | Hairline border inside dark graphite containers |
| Primary Action (CTA) | `#18181B` (`bg-zinc-900 hover:bg-black text-white`) | Authoritative obsidian action button |
| Secondary Action | `border border-zinc-300 bg-white hover:bg-zinc-100 text-zinc-900` | Crisp outlined action button |
| Standard Success | `#16A34A` / `#15803D` (`bg-emerald-50 text-emerald-800 border-emerald-300`) | Active residents, paid certificates, settled cases |
| Standard Danger | `#DC2626` / `#B91C1C` (`bg-red-50 text-red-800 border-red-300`) | Blotters, deceased, unpaid, delete actions, errors |
| Standard Warning | `#D97706` / `#B45309` (`bg-amber-50 text-amber-800 border-amber-300`) | Pending hearings, review notices, unverified status |
| Standard Info / Tech | `#2563EB` / `#1D4ED8` (`bg-blue-50 text-blue-800 border-blue-300`) | System info, LAN network badges, official notice |

---

## 2. Typography & Numerical Hierarchy

### Font Family Stack:
- **Headings & Body UI:**  
  `font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;`  
  - Tracking: `tracking-tight` on headings (H1: `text-2xl font-black`, H2: `text-lg font-bold`).
  - Column Headers: `text-[11px] font-semibold uppercase tracking-wider text-zinc-500`.
- **Data Figures, Reference Codes & Station Telemetry:**  
  `font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;`  
  - Applied to: Case Numbers (`BLTR-2026-0001`), Resident IDs (`RES-00042`), CTC Numbers, Dates, Currency amounts (`₱50.00`), LAN IP addresses (`192.168.1.100`), and Status Pills.

### Offline Resilience:
- Default fonts must cleanly degrade to system font sans and monospace without layout jumping if internet is offline.

---

## 3. Component Geometry & Layout System

1. **Zero Corner Radius (`rounded-none`):**
   - Every card, button, modal dialog, text input, select menu, tab item, and badge has `border-radius: 0px`.
2. **Hairline 1px Grid Architecture:**
   - Visual structure is established through visible 1px borders rather than blurry shadows (`border border-zinc-200`).
3. **No Heavy Shadows:**
   - Eliminate `shadow-lg`, `shadow-2xl`. Modals and dropdowns use clean flat elevation: `border border-zinc-300 shadow-sm` or crisp solid borders.
4. **Collapsible Rail Navigation:**
   - Desktop sidebar can be toggled between expanded (240px) and a sleek icon-only rail (64px) using a crisp toggle at the sidebar base or top.
   - Saves horizontal screen space for wide tabular ledgers.
5. **Login Page Architecture (Pure Credential Monolith):**
   - High-contrast graphite monolithic box (`rounded-none border border-zinc-800 bg-[#0C0C0E]`).
   - Official municipal typography + live monospace LAN telemetry indicator.
   - Demo 1-click credential selector helper is removed; login requires valid credential submission.

---

## 4. Interaction & Motion Rules

- **Speed:** Transitions are ultra-snappy (100ms - 150ms `ease-out`). No sluggish bounce or decorative float.
- **Hover States:** Crisp solid background color shift (e.g. `hover:bg-zinc-100`, `hover:border-zinc-400`).
- **Focus Rings:** High-contrast 2px black/dark ring: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1`.
- **Keyboard & A11y:** Full tab navigation support, explicit `aria-label`s on icon-only buttons, descriptive error text adjacent to invalid fields.

---

## 5. Module-by-Module Implementation Blueprint

1. **App Shell (`MainLayout`, `Sidebar`, `Topbar`):**
   - Off-white canvas, graphite sidebar with 64px rail collapse mode.
   - Topbar: Breadcrumb, Monospace LAN IP badge with 1-click copy, standard recognizable role tag, user dropdown.
2. **Dashboard (`DashboardPage`):**
   - Crisp 4-column metric blocks with monospace values and uppercase labels.
   - Quick Action bar with 0px sharp buttons.
   - Purok distribution modular grid and Recent Issuances / Blotter side-by-side split ledger.
3. **Residents (`ResidentsPage`, Modals):**
   - Search bar + modular filter strip (Purok, Voter, Senior/PWD, Civil Status) with instant reset.
   - Full-bleed 0px table with monospace ID, age, and contact numbers.
4. **Certificates (`CertificatesPage`, `NewCertificatePage`, `PrintPreviewModal`, `TemplatesPage`):**
   - Structured stepper for certificate issuance.
   - Clear standard fee calculations.
   - Clean printable A4 layout with official civic header alignment.
5. **Blotter & Incidents (`BlotterPage`, Modals):**
   - Case dossier cards and tabular ledger with standard status tags (Open = Red, Pending = Amber, Settled = Green).
6. **Officials & Staff (`OfficialsPage`, Modals):**
   - Crisp hierarchy cards of Barangay Captain, Kagawads, Secretary, and Treasurer.
7. **Audit Logs & Settings (`AuditLogsPage`, `SettingsPage`):**
   - High-density security event ledger with monospace timestamps, action tags, and IP addresses.
   - Settings with clear tabbed layout (Barangay Profile, Signatories, Data Backup, System Diagnostics).
