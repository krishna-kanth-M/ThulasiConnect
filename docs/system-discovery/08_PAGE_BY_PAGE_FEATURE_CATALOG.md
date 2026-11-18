# 08 — Page-by-Page Feature Catalog

> Every route defined in `frontend/src/App.tsx` and every page component in `frontend/src/pages/` has been inspected against its actual JSX controls, API calls, backend handlers, and PostgreSQL tables.

---

## Route & Navigation Overview

| Route | Component | Visible in Sidebar? | Access Guard | Implementation Status |
|---|---|---|---|---|
| `/login` | `LoginPage` | No (Public-only route) | `PublicOnlyRoute` | **Fully implemented and working** |
| `/` | `DashboardPage` | Yes (`Overview`) | `dashboard:view` | **Fully implemented and working** |
| `/live-call` | `LiveCallDeskPage` | Yes (`Live Call Desk`) | `live_call:use` | **Fully implemented and working** |
| `/calls` | `CallsPage` | Yes (`Calls`) | `calls:read_*` | **Partially implemented** (missing date/employee UI filters) |
| `/calls/:id` | `CallDetailPage` | No (Reached via Calls table `View`) | `calls:read_*` | **Partially implemented** (linked request/followup IDs not rendered) |
| `/requests` | `RequestsPage` | Yes (`Customer Requests`) | `requests:read_*` | **Partially implemented** (item editing post-creation not in UI) |
| `/followups` | `FollowUpsPage` | Yes (`Follow-ups`) | `followups:read_*` | **Partially implemented** (no follow-up reassign modal; Complete button shown to read-only roles) |
| `/employees` | `EmployeesPage` | Yes (`Employees`) | `performance:read_*` | **Fully implemented and working** |
| `/branches` | `BranchesPage` | Yes (`Branches`) | `branches:read` \| `admin:branches` | **Partially implemented** (manager assignment dropdown not in UI) |
| `/zones` | `ZonesPage` | Yes (`Zones`) | `zones:read` \| `admin:zones` | **Partially implemented** (no Edit Zone modal) |
| `/reports` | `ReportsPage` | Yes (`Reports`) | `reports:*` | **Fully implemented and working** |
| `/notifications` | `NotificationsPage` | Yes (`Notifications`) | `notifications:read` | **Fully implemented and working** |
| `/administration` | `AdministrationPage` | Yes (`Administration`) | `admin:*` | **Partially implemented** (5 tabs; Users edit / Roles edit / Integration edit / Audit filters not wired) |
| `/settings` | `SettingsPage` | Yes (`Settings`) | Any authenticated user | **Fully implemented and working** |

---

## Detailed Page Catalog

### 1. Login & Password Reset (`/login` — `LoginPage.tsx`)
- **Purpose:** Authenticate staff users and support self-service single-use password reset.
- **Intended Roles:** Unauthenticated users (authenticated users auto-redirect to `/`).
- **Sections & Inputs:** Brand privacy panel; 3 form modes: (a) Sign In (`email`, `password`), (b) Request Reset (`email`), (c) Confirm Reset (`token`, `new_password` min 8 chars).
- **Buttons:** `Sign In`, `Forgot / Reset Password?`, `Generate Reset Token`, `Update Password`, `Back to Sign In`.
- **Validation:** HTML5 required + email + minLength(8); backend Pydantic email regex (`^[^@\s]+@[^@\s]+\.[^@\s]+$`), password >= 6 (login) / >= 8 (reset).
- **API Calls:** `POST /api/auth/login`, `POST /api/auth/password-reset/request`, `POST /api/auth/password-reset/confirm`.
- **DB Tables:** `users`, `user_roles`, `roles`, `role_permissions`, `permissions`, `employees`, `branches`, `zones`, `password_reset_tokens`, `audit_logs`.
- **Status:** **Fully implemented and working** (note: in `APP_ENV=development`, reset token displays on-screen because no SMTP server is configured).

### 2. Overview Dashboard (`/` — `DashboardPage.tsx`)
- **Purpose:** Role-adaptive operational and executive summary.
- **Intended Roles:** All 5 roles (`dashboard:view`).
- **Sections:** Telephony transparency banner (when disconnected), 4 KPI StatCards, 7-day Recharts `BarChart`, Active Reminders & Alerts card, and role-specific drilldown table (Personal summary for `self`; Employee Activity table for `branch`; Branch Comparison for `zone`; Zone Executive Summary + Branch Comparison for `org`).
- **Filters:** Period selector (`7`, `30`, `90` days).
- **Buttons/Links:** `Open Live Call Desk` (if `live_call:use`), `View All` (`/notifications`), `Manage Zones`, `Branch Directory`, `Full Performance View`.
- **API Calls:** `GET /api/dashboard/overview?days={days}`.
- **DB Tables:** `calls`, `medicine_requests`, `follow_ups`, `escalations`, `notifications`, `employees`, `branches`, `zones`.
- **Status:** **Fully implemented and working**.

### 3. Live Call Desk (`/live-call` — `LiveCallDeskPage.tsx`)
- **Purpose:** 3-panel operational workspace for live speech-to-text, manual fallback, local AI extraction, employee confirmation, and request/callback saving.
- **Intended Roles:** `pharmacist`, `branch_manager` (`live_call:use`).
- **Sections:**
  - *Left Panel:* Employee/branch badge, Call Source Type (`browser_microphone_test`, `manual_telephone_call`, disabled `verified_telephony_integration`), Direction (`inbound`/`outbound`), Customer Name*, Customer Phone*, Call Outcome, Call Summary, `Register Call Session`.
  - *Center Panel:* `Start Mic` / `Stop Mic Immediately`, pulsing `MICROPHONE ACTIVE — IN-MEMORY ONLY` badge, Language selector (`auto`/`en`/`ta`), Speaker Tag (`Unknown speaker`/`Speaker 1`/`Speaker 2`), editable segment stream, manual line input (`+ Add`), `Extract Suggestions (Local AI)`, `Save Transcript`.
  - *Right Panel:* AI Safety Disclaimer banner, ShopAid CSV Reference Lookup (`Search` + `+ Use`), multi-item Medicine Request cards (`Employee Confirmed` / `AI Suggested — Unconfirmed` / `Missing Info` badges + `Confirm` + `Remove` + `Add Another Medicine`), Priority, Follow-up Due datetime, auto-reminder checkbox, employee notes, `Save Draft & Request`, `Save & Close Call`.
- **Validation:** Blocks saving if no medicine name, if any item is not `employee_confirmed`, or if customer name/phone are blank.
- **API & WS Calls:** `GET /api/call-outcomes`, `GET /api/transcription/status`, `POST /api/calls`, `PATCH /api/calls/{id}`, `WS /api/ws/transcription/live`, `POST /api/calls/{id}/transcript`, `POST /api/transcription/extract`, `GET /api/integrations/shopaid/catalog`, `POST /api/requests`.
- **DB Tables:** `calls`, `customers`, `call_outcomes`, `call_transcripts`, `speakers`, `transcript_segments`, `medicine_requests`, `medicine_request_items`, `request_status_history`, `follow_ups`, `shopaid_catalog_items`, `audit_logs`.
- **Status:** **Fully implemented and working** (Browser Mic prototype; zero `<audio>` playback elements).

### 4. Call Management (`/calls` — `CallsPage.tsx`)
- **Purpose:** Searchable registry of all authorized calls + manual call registration modal.
- **Intended Roles:** All 5 roles (read scoped; `Register Manual Call` requires `calls:create`).
- **Filters:** Free-text search (`call_reference`, customer name/phone, summary), Call Source Type, Registration Status, Authorized Branch. *(Note: Backend also supports `date_from`, `date_to`, `employee_id`, `attendance_status`, which are not yet exposed as UI controls.)*
- **Buttons:** `Register Manual Call` (modal: customer name*, phone*, direction, attendance `attended`/`missed`, outcome, summary), `View` link per row (`/calls/:id`).
- **API Calls:** `GET /api/calls`, `GET /api/branches`, `GET /api/call-outcomes`, `POST /api/calls`.
- **DB Tables:** `calls`, `customers`, `call_outcomes`, `call_transcripts`, `medicine_requests`, `follow_ups`, `branches`, `employees`, `audit_logs`.
- **Status:** **Partially implemented** (core CRUD and search work; date-range and employee filter UI missing).

### 5. Call Detail (`/calls/:id` — `CallDetailPage.tsx`)
- **Purpose:** Inspect call metadata and review/correct text-only transcript segments.
- **Intended Roles:** All 5 roles (editing requires `calls:update_own` or `calls:update_branch`).
- **Sections:** Call Metadata card (Source Type, Customer, Employee, editable Registration Status, Outcome, Summary, explicit `"No Audio Stored"` privacy card); Editable Text Transcript Segments card.
- **API Calls:** `GET /api/calls/{id}`, `GET /api/call-outcomes`, `PATCH /api/calls/{id}`, `POST /api/calls/{id}/transcript`.
- **DB Tables:** `calls`, `call_transcripts`, `speakers`, `transcript_segments`, `audit_logs`.
- **Status:** **Partially implemented** (`request_ids` and `followup_ids` are returned by API but not rendered as clickable links on this page).

### 6. Customer & Medicine Requests (`/requests` — `RequestsPage.tsx`)
- **Purpose:** Multi-item medicine inquiry tracking, status workflow management, staff assignment, and status history audit.
- **Intended Roles:** All 5 roles (`New Medicine Request` requires `requests:create`; status updates require `requests:update_*`; reassignment requires `requests:assign_branch`).
- **Filters:** Search, Status (all 8 statuses), Priority.
- **Modals:**
  - *Create Request:* Customer name*, phone*, priority, optional follow-up due (auto-creates `FollowUp`), dynamic multi-item medicine rows, notes.
  - *Manage Request:* Read-only item summary, Workflow Status dropdown, Assigned Employee dropdown (for managers), mandatory Cancellation Reason input (when `cancelled`), Resolution Details, Status Change Note, immutable Status Change History timeline.
- **Notifications Triggered:** Reassigning employee emits `request_update` notification to the assignee.
- **API Calls:** `GET /api/requests`, `GET /api/employees`, `POST /api/requests`, `PATCH /api/requests/{id}`.
- **DB Tables:** `medicine_requests`, `medicine_request_items`, `request_status_history`, `customers`, `follow_ups`, `notifications`, `audit_logs`.
- **Status:** **Partially implemented** (cannot edit individual medicine items/availability after creation via UI; no dedicated `/requests/:id` page).

### 7. Follow-ups, Reminders & Escalations (`/followups` — `FollowUpsPage.tsx`)
- **Purpose:** Manage customer callbacks, trigger overdue evaluation, and resolve supervisory escalations.
- **Intended Roles:** All 5 roles (Escalations queue visible if `escalations:read_*`; Acknowledge/Resolve if `escalations:manage_*`; Schedule Follow-up if `followups:create`).
- **Buttons:** `Check Overdue & Trigger Escalations`, `Schedule Follow-up` (modal), `Complete` (modal with required completion notes), `Acknowledge` / `Resolve` on escalations.
- **API Calls:** `GET /api/followups`, `GET /api/escalations`, `GET /api/employees`, `POST /api/followups/evaluate-escalations`, `POST /api/followups`, `PATCH /api/followups/{id}`, `PATCH /api/escalations/{id}`.
- **DB Tables:** `follow_ups`, `escalations`, `notifications`, `app_settings`, `branches`, `zones`, `audit_logs`.
- **Status:** **Partially implemented** (no background scheduler; no UI modal to reassign follow-ups; `Complete` button shown to read-only roles though backend rejects with `403`).

### 8. Employee Performance (`/employees` — `EmployeesPage.tsx`)
- **Purpose:** Transparent employee operational accountability metrics.
- **Intended Roles:** All 5 roles (Pharmacist sees self only; managers see scoped staff).
- **Filters:** Authorized Branch dropdown (when > 1 branch), Period (`7`, `30`, `90` days).
- **Sections:** 10-column metrics table + **Metric Calculation Methodology** panel explaining every formula directly from backend `METRIC_DEFINITIONS`.
- **API Calls:** `GET /api/branches`, `GET /api/performance/employees`.
- **DB Tables:** `employees`, `users`, `branches`, `calls`, `call_transcripts`, `medicine_requests`, `follow_ups`.
- **Status:** **Fully implemented and working**.

### 9. Branches (`/branches` — `BranchesPage.tsx`)
- **Purpose:** Branch directory, 30-day branch metrics, branch creation (Admin), and branch operational settings (Branch Manager & Admin).
- **Intended Roles:** `branch_manager`, `zonal_manager`, `owner`, `system_admin`.
- **Buttons & Modals:** `Add Branch` (Admin only), `Branch Settings` (phone, operating hours, branch-level overdue escalation threshold).
- **API Calls:** `GET /api/branches`, `GET /api/performance/branches?days=30`, `GET /api/zones`, `POST /api/branches`, `PATCH /api/branches/{id}`.
- **DB Tables:** `branches`, `zones`, `employees`, `calls`, `medicine_requests`, `follow_ups`, `escalations`, `audit_logs`.
- **Status:** **Partially implemented** (no UI dropdown to change `branch_manager_user_id` or `is_active`).

### 10. Zones (`/zones` — `ZonesPage.tsx`)
- **Purpose:** Regional zone overview with per-zone branch comparison tables and zone creation (Admin).
- **Intended Roles:** `zonal_manager`, `owner`, `system_admin`.
- **Buttons & Modals:** `Add Zone` (Admin only).
- **API Calls:** `GET /api/zones`, `GET /api/performance/branches?days=30`, `POST /api/zones`.
- **DB Tables:** `zones`, `branches`, `users`, `calls`, `medicine_requests`, `follow_ups`, `escalations`, `audit_logs`.
- **Status:** **Partially implemented** (`PATCH /api/zones/{id}` exists in backend but no Edit Zone / Assign Zonal Manager modal exists in UI).

### 11. Reports & Analytics (`/reports` — `ReportsPage.tsx`)
- **Purpose:** Generate 8 date-filtered operational reports and export authorized CSV downloads.
- **Intended Roles:** `branch_manager`, `zonal_manager`, `owner`, `system_admin`.
- **Filters:** Report Type (8 types), Authorized Branch, From Date, To Date.
- **Buttons:** `Export CSV` (authenticated Blob download via `downloadCsvReport`).
- **API Calls:** `GET /api/branches`, `GET /api/reports/{report_type}`, `GET /api/reports/{report_type}/export.csv`.
- **DB Tables:** `calls`, `branches`, `zones`, `employees`, `medicine_requests`, `medicine_request_items`, `follow_ups`, `escalations`.
- **Status:** **Fully implemented and working**.

### 12. Notifications (`/notifications` — `NotificationsPage.tsx`)
- **Purpose:** Personal inbox for follow-up reminders, request assignments, and escalation alerts.
- **Intended Roles:** All 5 roles (`notifications:read`).
- **Controls:** `Unread only` toggle, `Mark Read` per card, `Mark All Read`.
- **API Calls:** `GET /api/notifications`, `PATCH /api/notifications/{id}/read`, `POST /api/notifications/mark-all-read` (plus `GET /api/notifications/unread-count` polled every 30s in `AppLayout.tsx`).
- **DB Tables:** `notifications`.
- **Status:** **Fully implemented and working**.

### 13. System Administration (`/administration` — `AdministrationPage.tsx`)
- **Purpose:** Centralized 5-tab IT governance workspace.
- **Intended Roles:** `system_admin` (`admin:*`).
- **Tabs:**
  1. **Users & Access:** Lists users, `Create User Account` modal, `Activate` / `Deactivate` toggle (`POST /api/users`, `PATCH /api/users/{id}`). *(No full Edit User modal.)*
  2. **Roles & Permissions:** Read-only role & permission cards (`GET /api/roles`). *(No edit controls.)*
  3. **Integrations:** Read-only ShopAid & Telephony status cards (`GET /api/integrations`) + working `Import Reference CSV` upload (`POST /api/integrations/shopaid/import-csv`) + searchable CSV catalog table (`GET /api/integrations/shopaid/catalog`). *(No endpoint config edit form.)*
  4. **Escalation Policy:** Editable L1/L2/L3 overdue thresholds (`GET/PUT /api/settings/escalation-policy`).
  5. **Audit Logs:** Latest 100 audit records (`GET /api/audit-logs?limit=100`). *(Backend filter params not wired to UI inputs.)*
- **Status:** **Partially implemented**.

### 14. Settings (`/settings` — `SettingsPage.tsx`)
- **Purpose:** View own authorization scope, change password, and inspect local Faster-Whisper/Ollama runtime health.
- **Intended Roles:** All authenticated users.
- **API Calls:** `GET /api/transcription/status`, `POST /api/auth/change-password`.
- **DB Tables:** `users`, `audit_logs`.
- **Status:** **Fully implemented and working**.
