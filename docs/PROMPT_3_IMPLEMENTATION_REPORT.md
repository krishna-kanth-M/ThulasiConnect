# ThulasiConnect — Prompt 3 Implementation Report

**Date:** 2026-11-18  
**Project Root:** `C:\Users\KRISHNA KANTH M\Downloads\ThulasiConnect`  
**Git Baseline Checkpoint:** `checkpoint: pre-prompt-3 baseline`  
**Database Migration Version:** `cc32ff675d54` (preserved intact — zero destructive migrations, zero seed resets)

---

## 1. What Was Already Working (Preserved Intact)
- Core FastAPI + SQLAlchemy 2.1 + PostgreSQL 16 (`26` tables) + Alembic setup.
- Argon2id password hashing, HS256 JWT authentication, immediate logout revocation (`revoked_tokens`), single-use password reset flow, and immutable `audit_logs`.
- Faster-Whisper `base` (CPU INT8 + Silero VAD, cached in `ai-services/models`) wired to `/api/ws/transcription/live` with strictly in-memory PCM processing.
- Local Ollama (`qwen2.5:1.5b`) text-only medicine extraction with deterministic fallback and human confirmation gate.
- 8 operational reports with authorized CSV export and in-app notification inbox.

---

## 2. Confirmed Defects Corrected

| Defect ID | Issue | Fix Implemented | Verified By |
|---|---|---|---|
| **DEF-01** | `rbac.py` unconditionally re-merged hardcoded `ROLE_DEFINITIONS` permissions, preventing DB revocation | Removed baseline re-merge in `resolve_auth_context()`; seeded defaults only on new role creation in `ensure_roles_and_permissions_seeded()`; added lockout guard preventing removal of `admin:roles` from `system_admin` and self-role elevation guard in `users.py` | `test_rbac_permission_revocation_and_self_role_guard` |
| **DEF-02** | `calls_today` included `browser_microphone_test` while `registered_calls` excluded it | Restricted `calls_today` to operational sources (`manual_telephone_call`, `verified_telephony_integration`) and added separate `microphone_tests_today` KPI | `test_metrics_reconciliation_admin_dashboard_and_customer_crud` |
| **DEF-03** | Employee performance `requests_created` queried `assigned_employee_id` instead of creator | Corrected `requests_created` to query `created_by_user_id == emp.user_id` and added `requests_assigned` (`assigned_employee_id == emp.id`) | `test_metrics_reconciliation_admin_dashboard_and_customer_crud` + `EmployeesPage.tsx` |
| **DEF-04** | Pharmacist dashboard vs `/api/requests` scope mismatch | Aligned Pharmacist dashboard request query to match `/api/requests` (`assigned OR created_by`) | `dashboard.py` + Pytest |
| **DEF-05** | Level 3 Owner escalation notified only `owners[0]` and silently dropped missing recipients | Updated `escalation_service.py` to notify **all** active eligible `owner` accounts (deduplicated per user) and emit `system_alert` config warnings to active `system_admin` accounts if 0 eligible recipients exist | `escalation_service.py` + Pytest |
| **DEF-06** | `FollowUpsPage` displayed `Complete` button for read-only roles (backend returned 403) | Gated `Complete` button on `hasPermission('followups:update_own', 'followups:update_branch')` | Playwright Test #4 |
| **DEF-07** | `overdue_followups` report ignored `date_from`/`date_to` parameters | Added `FollowUp.due_at >= date_from` and `<= date_to` filtering in `reports.py` | `reports.py` |
| **DEF-08** | Any authenticated user (including Pharmacist) could trigger organization-wide escalation evaluation | Restricted `POST /api/followups/evaluate-escalations` to `escalations:manage_*` / `admin:settings` and hid button for Pharmacists in UI | Pytest (`403` for Pharmacist) + Playwright Test #2 |
| **DEF-09** | Missing automated background escalation scheduler | Implemented lightweight 60-second `asyncio` `EscalationScheduler` (`backend/app/services/scheduler.py`) wired into FastAPI `lifespan`, exposed via `/api/health` and System Admin Dashboard | `test_health_endpoint` + Playwright Test #5 |

---

## 3. Newly Implemented & Newly Connected Features

### Backend Enhancements
- **Automated Escalation Scheduler:** `backend/app/services/scheduler.py` (60s interval, clean `asyncio.Event` shutdown, zero Redis/Celery overhead).
- **System Administrator Dashboard Payload:** `_build_system_admin_summary()` in `dashboard.py` returning user counts, 24h failed logins, DB health, live scheduler state, org staffing integrity warnings (`CBE-GP` 0 pharmacists, shared Branch Manager), integration statuses, and recent audit logs.
- **Branch Organizational Integrity Warnings:** Added `pharmacist_count` and non-destructive `warnings[]` to `BranchOut` (`organization.py`) without modifying existing seed records.
- **Call Outcome Filter:** Added `outcome_code` filter to `GET /api/calls`.
- **PostgreSQL Fast-Fail Pool Guard:** Added `connect_timeout: 5` in `database.py`.
- **Ollama RAM Conservation & Richer Extraction:** Added `keep_alive: "2m"` plus `customer_name_mentioned`, `urgency_indicator`, and `uncertain_fields` in `ai_extraction_service.py`.
- **ShopAid CSV Validation & History:** Added row-level `failed_rows`, duplicate SKU tracking, and persisted `import_history` (last 10 uploads) in `shopaid_adapter.py`.
- **Honest Notification Channels Config:** Added `notification_channels` adapter entry in `integrations.py` (`in_app`: `CONNECTED AND TESTED`; `email_smtp`, `sms_gateway`, `whatsapp_business`: `NOT CONFIGURED`).

### Frontend Pages Completed & Connected
1. **New Customer Directory (`/customers` — `CustomersPage.tsx`):** Full branch-scoped search, Register Customer, and Edit Customer wired to `GET/POST/PATCH /api/customers`.
2. **Customer Autocomplete:** Added live phone autocomplete (`GET /api/customers?search=...`) in `LiveCallDeskPage.tsx` and `CallsPage.tsx`, plus a **Start Next Call (Reset Desk)** button on `LiveCallDeskPage.tsx`.
3. **Calls & Call Detail:** Added Date From, Date To, Employee, and Call Outcome filters in `CallsPage.tsx`; added clickable **Linked Operational Records** (`Requests` & `Follow-ups`) in `CallDetailPage.tsx`.
4. **Requests Management:** Added `?call_id=` query filtering and full post-creation **Edit Medicine Items** + `required_followup_at` editing inside `RequestsPage.tsx`.
5. **Follow-ups & Escalations:** Added role-gated `Complete` & `Run Escalation Check Now` buttons, **Reassign Follow-up Modal** (`PATCH /api/followups/{id}`), and **Supervisory Resolution Notes Modal** (`PATCH /api/escalations/{id}`) in `FollowUpsPage.tsx`.
6. **System Administrator Dashboard:** Added dedicated System Admin overview in `DashboardPage.tsx` (Users, Org Warnings, Live Scheduler `RUNNING`, PostgreSQL Health, Recent Audit Activity).
7. **Administration Hub (`AdministrationPage.tsx`):**
   - Full **Edit User Modal** + multi-role checkboxes in Create/Edit User (`PATCH /api/users/{id}`).
   - Interactive **Edit Role Permissions Modal** (`GET /api/permissions` + `PUT /api/roles/{id}/permissions`).
   - Interactive **Configure Adapter Modal** (`PATCH /api/integrations/{key}`) + ShopAid CSV failed-row & import-history reporting + Notification Delivery Channels card.
   - Interactive **Audit Log Filters** (`action`, `entity_type`, `actor_email`).
8. **Zones & Branches:** Added **Edit Zone & Assign Zonal Manager** modal in `ZonesPage.tsx`; added **Staffing Integrity Warning Badges**, Admin manager assignment, and active status toggle in `BranchesPage.tsx`.

---

## 4. What Remains Blocked / External
- **ShopAid Live Inventory API:** `BLOCKED BY EXTERNAL DEPENDENCY` (vendor API docs & read-only credentials unavailable).
- **Pharmacy PBX / SIP / Landline Telephony:** `BLOCKED BY EXTERNAL DEPENDENCY` (no physical PBX/SIP bridge connected).
- **Email SMTP / SMS / WhatsApp Notification Gateways:** `NOT CONFIGURED` (provider credentials required).
- **Real-World Tamil/Tanglish Pharmacy Audio Pilot:** Pending authorized counter test utterances.
