# 14 — System Gaps, Confirmed Defects & Recommendations

> **Strictly Read-Only Audit:** No recommendations below have been implemented. Findings are strictly separated into **Confirmed Defects**, **Implemented-But-Disconnected Features**, **Incomplete Workflows**, and **Architectural / Operational Recommendations**.

---

## 1. Confirmed Defects (Verified in Source Code)

| ID | Severity | Location | Confirmed Defect |
|---|---|---|---|
| **DEF-01** | **High** | `backend/app/core/rbac.py:183-186` | **Baseline permissions cannot be revoked via DB:** `resolve_auth_context()` loads `role_permissions` from PostgreSQL and then unconditionally unions `ROLE_DEFINITIONS[code]["permissions"]`. Any permission removed via `PUT /api/roles/{id}/permissions` is immediately re-granted at runtime. |
| **DEF-02** | **Medium** | `backend/app/routers/dashboard.py:265` | **`calls_today` includes browser mic test sessions:** Unlike `registered_calls` and `registration_rate_pct` (which exclude `browser_microphone_test`), `calls_today` counts every `Call` row from today regardless of `call_source_type`. |
| **DEF-03** | **Medium** | `backend/app/routers/dashboard.py:121` | **Misleading metric key `requests_created`:** In `_compute_employee_metrics()`, `requests_created` counts rows filtered by `assigned_employee_id == emp.id`, not `created_by_user_id`. Reassigning a request shifts its count between employees. |
| **DEF-04** | **Medium** | `backend/app/routers/dashboard.py:251` vs `requests.py:157` | **Pharmacist request scope mismatch:** Dashboard counts Pharmacist requests strictly by `assigned_employee_id == ctx.employee_id`, whereas `/api/requests` lists `assigned_employee_id == ctx.employee_id OR created_by_user_id == ctx.user.id`. |
| **DEF-05** | **Medium** | `backend/app/services/escalation_service.py:161` | **Single-Owner Level 3 escalation:** Level 3 escalation notifies only `owners[0].id`. If multiple Owner accounts exist, subsequent owners are not alerted. |
| **DEF-06** | **Low** | `frontend/src/pages/FollowUpsPage.tsx:229` | **`Complete` button visible to read-only roles:** Zonal Managers, Owners, and System Admins see the **Complete** button on pending follow-ups; clicking it triggers a backend `403` error toast instead of hiding the control. |
| **DEF-07** | **Low** | `backend/app/routers/reports.py:163` | **`overdue_followups` report ignores date range:** Selecting `date_from`/`date_to` on `/reports` for `overdue_followups` has no effect (always returns all currently overdue rows). |
| **DEF-08** | **Low** | `backend/app/routers/followups.py:293` | **Any authenticated user can trigger global escalation evaluation:** `POST /api/followups/evaluate-escalations` uses `get_current_user` (any role, including a single branch pharmacist) and evaluates overdue follow-ups across the **entire** organization. |

---

## 2. Backend Features Implemented But Disconnected / Partially Wired in UI

| Feature | Backend Status | Frontend Gap |
|---|---|---|
| **Customer Directory & Autocomplete** | `GET/POST/PATCH /api/customers` implemented | No `/customers` page and no returning-customer autocomplete on `LiveCallDeskPage` or `CallsPage` |
| **Full User Editing & Dual Roles** | `PATCH /api/users/{id}` supports editing name, phone, roles, branch, zone, designation, admin password reset | `AdministrationPage` Users tab only has Activate/Deactivate toggle; Create User modal allows only 1 role |
| **Role Permission Matrix Editing** | `GET /api/permissions` & `PUT /api/roles/{id}/permissions` implemented | `AdministrationPage` Roles tab is read-only |
| **Edit Zone & Assign Managers** | `PATCH /api/zones/{id}` and `PATCH /api/branches/{id}` support manager assignments | `ZonesPage` has Create only; `BranchesPage` Settings modal omits `branch_manager_user_id` and `is_active` |
| **Integration Endpoint Configuration** | `PATCH /api/integrations/{key}` implemented | `AdministrationPage` Integrations tab displays status read-only (only CSV upload is interactive) |
| **Edit Medicine Request Items Post-Creation** | `PATCH /api/requests/{id}` supports replacing `items` & `required_followup_at` | `RequestsPage` Manage modal edits status/assignee/notes only, not medicine items |
| **Reassign Follow-Ups in UI** | `PATCH /api/followups/{id}` supports changing `assigned_employee_id` & `due_at` | `FollowUpsPage` only exposes Complete modal |
| **Call Filters & Cross-Links** | `GET /api/calls` supports `date_from`, `date_to`, `employee_id`; `GET /api/calls/{id}` returns `request_ids` & `followup_ids` | `CallsPage` lacks date-range & employee filters; `CallDetailPage` does not render links to linked requests/follow-ups |
| **Audit Log Search Filters** | `GET /api/audit-logs` supports `action`, `entity_type`, `actor_email` | `AdministrationPage` Audit tab fetches latest 100 unfiltered |

---

## 3. Operational, Privacy & Performance Recommendations (Not Implemented)

1. **Automated Background Escalation Scheduler:** Replace/supplement on-demand `POST /api/followups/evaluate-escalations` with a periodic background worker (e.g., Windows Task Scheduler / APScheduler running every 5–10 minutes) plus pre-due upcoming reminders (e.g., 15 minutes before `due_at`).
2. **Resolve RBAC Defect (`DEF-01`):** Make `role_permissions` in PostgreSQL the single source of truth once seeded so admins can both grant and revoke permissions cleanly.
3. **Separate Developer Audio Test Artifacts:** Keep `tests/record_sample.py` and `tests/sample.wav` strictly outside any staging/production deployment package so no audio-recording utility ever exists on pharmacy machines.
4. **Migrate Browser Audio Capture to `AudioWorkletNode`:** Replace deprecated `ScriptProcessorNode` in `LiveCallDeskPage.tsx` with `AudioWorkletNode` for smoother browser audio capture and lower main-thread jank on i3 laptops.
5. **Post-Save Call Desk Reset:** Add a **"Start Next Call"** button / clean state reset in `LiveCallDeskPage.tsx` after clicking **Save & Close Call**.
6. **Hardware & Memory Guardrails (8 GB RAM):** Add an Ollama `keep_alive` setting (e.g., `"2m"`) so `qwen2.5:1.5b` unloads from RAM when idle, freeing ~1.5 GB RAM for Faster-Whisper and Chrome on 8 GB laptops.
7. **JWT Storage Hardening for Production:** Before production central-server deployment, migrate JWT transport from `localStorage` to `HttpOnly; Secure; SameSite=Lax` cookies with CSRF protection and rate limiting on `/api/auth/login`.
8. **Dashboard Chart Synchronization:** Align the trend chart window with the selected `days` filter (`7`/`30`/`90` days) and add historical escalation-trend charts for Zonal Managers and Owner.
9. **Staffing Gandhipuram (`CBE-GP`):** Assign at least one Pharmacist and clarify whether `manager.rspuram@thulasipharmacy.local` should permanently manage both `CBE-RSP` and `CBE-GP`.
