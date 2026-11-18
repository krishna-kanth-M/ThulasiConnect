# Prompt 3 — Implementation Assessment & Execution Plan

**Project:** ThulasiConnect (`C:\Users\KRISHNA KANTH M\Downloads\ThulasiConnect`)  
**Date:** 2026-11-18  
**Baseline Git Checkpoint:** Created prior to code edits (`checkpoint: pre-prompt-3 baseline`)  
**Current Alembic Migration Version:** `cc32ff675d54` (`initial_schema`, 26 application tables)  
**Database:** PostgreSQL 16.16 (`thulasiconnect_dev` on `127.0.0.1:5432`) — preserved without reset or destructive migrations.

---

## 1. Existing Application Architecture

Modular monolith consisting of:
- **Frontend SPA (`frontend/src/`):** React 19, TypeScript 5.9, Vite 6.4, Tailwind CSS v4, React Router v7, TanStack Query v5, Recharts v2.
- **Backend API (`backend/app/`):** FastAPI 0.163, Uvicorn 0.54, SQLAlchemy 2.1, Alembic 1.20, Psycopg 3.3, Argon2id + PyJWT, 12 modular routers (`57` REST + `1` WebSocket endpoint), 5 services.
- **Local AI & Speech Services:** Faster-Whisper `base` (CPU INT8, Silero VAD, in-memory PCM only, cached at `ai-services/models`) and local Ollama `qwen2.5:1.5b` (`127.0.0.1:11434`).

---

## 2. Feature Classification Matrix (Before Prompt 3 Changes)

| Feature / Area | Frontend Page(s) | Backend Endpoint(s) | Classification | Notes |
|---|---|---|---|---|
| Login, Logout, Token Revocation, Password Reset | `LoginPage`, `SettingsPage`, `AppLayout` | `/api/auth/*` | **WORKING** | Verified via Pytest & Playwright; SMTP email delivery is `NOT IMPLEMENTED` (dev token fallback) |
| 5-Role RBAC & Scope Isolation | `AppLayout`, `App.tsx` | `core/rbac.py` | **PARTIALLY WORKING** | Confirmed defect `DEF-01`: `resolve_auth_context()` re-merges hardcoded `ROLE_DEFINITIONS`, preventing runtime revocation of baseline permissions |
| Role-Adaptive Dashboards (Pharmacist, Branch, Zonal, Owner) | `DashboardPage` | `GET /api/dashboard/overview` | **PARTIALLY WORKING** | Confirmed defects: `calls_today` includes browser mic tests; `requests_created` queries `assigned_employee_id`; Pharmacist dashboard vs `/api/requests` scope mismatch |
| System Administrator Dashboard | `DashboardPage` | `GET /api/dashboard/overview` | **NOT IMPLEMENTED** | System Admin currently sees business-owner zone/branch tables instead of user/integration/scheduler/audit/health summary |
| Live Call Desk (Browser Mic Prototype + Manual Fallback) | `LiveCallDeskPage` | `WS /api/ws/transcription/live`, `POST /api/calls`, `/transcript` | **WORKING** | In-memory PCM only (zero audio saved); needs customer autocomplete, "Start Next Call" reset, and WS reconnect handling |
| Local Ollama Medicine Extraction | `LiveCallDeskPage` | `POST /api/transcription/extract` | **WORKING** | Connected to `qwen2.5:1.5b` with human confirmation gate; needs `keep_alive` RAM tuning & richer uncertainty/customer/urgency schema |
| Call Management & Call Details | `CallsPage`, `CallDetailPage` | `/api/calls/*`, `/api/call-outcomes` | **PARTIALLY WORKING** | Backend supports date/employee/outcome filters and returns `request_ids`/`followup_ids`; UI missing date/employee/outcome filters and linked request/followup navigation |
| Customer Directory & Autocomplete | None | `GET/POST/PATCH /api/customers` | **NOT CONNECTED** | Backend CRUD complete; no `/customers` UI page and no autocomplete on Call/Live Call forms |
| Medicine Request Tracking | `RequestsPage` | `/api/requests/*` | **PARTIALLY WORKING** | Multi-item creation and status history work; UI cannot edit individual medicine items or `required_followup_at` after creation |
| Follow-Up Management | `FollowUpsPage` | `/api/followups/*` | **PARTIALLY WORKING** | UI shows `Complete` button to read-only roles (backend returns 403); no Edit/Reassign follow-up modal; no escalation resolution notes modal |
| Automated Overdue Escalation Scheduler | `FollowUpsPage` (manual button only) | `POST /api/followups/evaluate-escalations` | **NOT IMPLEMENTED** | No background scheduler; manual trigger open to any authenticated user (`DEF-08`); Level 3 notifies only `owners[0]` (`DEF-05`) |
| Employee & Branch Performance | `EmployeesPage`, `BranchesPage` | `/api/performance/*` | **PARTIALLY WORKING** | Working, but `requests_created` counts assigned requests rather than creator (`DEF-03`) |
| Branches & Zones Configuration | `BranchesPage`, `ZonesPage` | `/api/branches/*`, `/api/zones/*` | **PARTIALLY WORKING** | Missing Edit Zone modal, manager assignment dropdowns, and org-integrity warnings (`CBE-GP` 0 pharmacists / shared manager) |
| Reports & CSV Export (8 Reports) | `ReportsPage` | `/api/reports/*` | **WORKING** | All 8 reports + CSV download verified; `overdue_followups` date filter behavior to be clarified |
| Notifications (In-App vs External) | `NotificationsPage`, `AppLayout` | `/api/notifications/*` | **WORKING** (In-App) / **NOT CONFIGURED** (Email/SMS/WhatsApp) | External messaging adapters require provider credentials |
| System Admin: Users, Roles, Integrations, Audit | `AdministrationPage` | `/api/users/*`, `/api/roles/*`, `/api/permissions`, `/api/integrations/*`, `/api/audit-logs` | **PARTIALLY WORKING** | Missing full Edit User modal, multi-role checkboxes, Role Permission editor UI, Integration config modal, and Audit Log filter inputs |
| ShopAid CSV Reference Fallback | `AdministrationPage`, `LiveCallDeskPage` | `/api/integrations/shopaid/*` | **WORKING** | Needs failed-row reporting, duplicate stats, and import history visibility |
| ShopAid Live Inventory API | `AdministrationPage` | `shopaid_adapter.py` | **BLOCKED BY EXTERNAL DEPENDENCY** | Vendor API docs & credentials unavailable; read-only CSV fallback retained honestly |
| Pharmacy Telephony / PBX / SIP | `AdministrationPage`, `LiveCallDeskPage` | `telephony_adapter.py` | **BLOCKED BY EXTERNAL DEPENDENCY** | Physical PBX/SIP hardware/provider not connected; Browser Mic & Manual Registration remain primary |
| Org Staffing Structure (`CBE-GP` shared manager / 0 staff) | `BranchesPage` | `branches`, `employees` | **REQUIRES BUSINESS CONFIRMATION** | Preserved as-is; surface non-destructive integrity warnings in UI |

---

## 3. Database Connectivity & AI Service Status

- **PostgreSQL 16.16:** Verified running on `127.0.0.1:5432` (`thulasiconnect_dev`, 26 tables, zero audio columns). Existing seed data preserved.
- **Faster-Whisper `base` (CPU INT8):** Verified cached in `ai-services/models`, loads in ~1.3s warm.
- **Ollama `0.40.16` (`qwen2.5:1.5b`):** Verified running on `127.0.0.1:11434`.

---

## 4. Confirmed Defects to Correct

1. **DEF-01 (High — Security/RBAC):** `backend/app/core/rbac.py` unconditionally re-adds `ROLE_DEFINITIONS` permissions in `resolve_auth_context()`, making DB permission revocations ineffective.
2. **DEF-02 (Medium — Metrics):** `calls_today` includes `browser_microphone_test` while `registered_calls` excludes it.
3. **DEF-03 (Medium — Metrics):** `requests_created` in employee performance queries `assigned_employee_id` instead of `created_by_user_id`.
4. **DEF-04 (Medium — Consistency):** Pharmacist dashboard vs `GET /api/requests` scope mismatch (`assigned_employee_id` vs `assigned OR created_by`).
5. **DEF-05 (Medium — Escalations):** Level 3 escalation notifies only `owners[0]` instead of all eligible active owners, and has no admin warning when 0 eligible recipients exist.
6. **DEF-06 (Low — UI Auth):** `FollowUpsPage.tsx` renders `Complete` button for read-only roles (Zonal Manager, Owner, Admin).
7. **DEF-07 (Low — Reports):** `overdue_followups` report ignores `date_from`/`date_to` parameters.
8. **DEF-08 (Medium — Security):** `POST /api/followups/evaluate-escalations` allows any authenticated user (including a Pharmacist) to trigger organization-wide escalation evaluation.
9. **DEF-09 (Medium — Operations):** No automated background scheduler runs overdue follow-up evaluation continuously.

---

## 5. Phased Implementation Sequence

1. **Stage A (Backend Security, RBAC & Scheduler):** Fix `DEF-01` in `rbac.py`; implement lightweight asyncio background escalation scheduler (`services/scheduler.py`) wired into FastAPI `lifespan`; fix `DEF-08` & `DEF-05` in `followups.py` & `escalation_service.py`; preserve SLA thresholds (`60 / 240 / 1440` min).
2. **Stage B (Backend Metrics, Dashboards, AI & Integrations):** Fix `DEF-02`, `DEF-03`, `DEF-04`, `DEF-07`; add dedicated System Administrator dashboard payload + org integrity warnings (`CBE-GP` 0 pharmacists, branches without managers); enhance ShopAid CSV validation with failed-row reporting & import history; add honest Notification Channels adapter status; add Ollama `keep_alive` & richer extraction fields.
3. **Stage C (Frontend Full Connectivity & UX Completion):**
   - Add `/customers` Customer Directory page + Customer Autocomplete in `LiveCallDeskPage` & `CallsPage`.
   - Upgrade `AdministrationPage`: full Edit User modal + multi-role checkboxes, interactive Role Permissions editor (`PUT /api/roles/{id}/permissions`), Integration Config modal (`PATCH /api/integrations/{key}`), ShopAid failed-row/history feedback, Notification Channels card, Audit Log search/filter controls.
   - Upgrade `ZonesPage` (Edit Zone + assign Zonal Manager) and `BranchesPage` (Admin manager assignment + active toggle + org-integrity warning badges).
   - Upgrade `CallsPage` (date/employee/outcome filters) and `CallDetailPage` (clickable linked Requests & Follow-ups).
   - Upgrade `RequestsPage` (post-creation Medicine Items + due-date editing).
   - Upgrade `FollowUpsPage` (role-gated Complete & Evaluate buttons, Reassign Follow-up modal, Escalation Resolution Notes modal).
   - Upgrade `LiveCallDeskPage` (Customer autocomplete, Start Next Call reset, WS reconnection/cancellation handling).
   - Upgrade `DashboardPage` (dedicated System Administrator dashboard view + reconciled KPI labels).
4. **Stage D (Testing & Validation):** Expand Pytest backend/security/RBAC/scheduler/privacy suite + expand Playwright Chromium E2E across all 5 roles + run Ruff, TypeScript, ESLint, Vite build, and privacy/performance checks.
5. **Stage E (Final Documentation):** Write all 7 required Phase 16 documentation files with honest integration statuses and metric definitions.

---

## 6. Completion Test Criteria

- `ruff check` = 0 errors
- `pytest tests/test_backend_api.py -v` = 100% pass (including RBAC permission revocation, escalation authz, multi-owner L3 notification, scheduler run, metric reconciliation, Customer CRUD, ShopAid CSV failed-row validation, zero audio persistence)
- `npm run typecheck`, `npm run lint`, `npm run build` = 0 errors
- `npx playwright test` = 100% pass across all 5 role journeys (`Pharmacist`, `Branch Manager`, `Zonal Manager`, `Owner`, `System Administrator`)
