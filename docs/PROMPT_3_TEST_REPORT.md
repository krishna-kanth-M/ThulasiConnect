# ThulasiConnect — Prompt 3 Test & Validation Report

**Date:** 2026-11-18  
**Hardware:** Windows 11 Home (Build 26200), Intel Core i3-1115G4 (2C/4T), 7.80 GB RAM  
**Services Active During Test Run:** PostgreSQL 16.16 (`:5432`), Ollama 0.40.16 (`:11434`, `qwen2.5:1.5b`), Faster-Whisper `base` CPU INT8 (`ai-services/models`), FastAPI Uvicorn (`:8000`), Vite React (`:5173`)

---

## 1. Automated Test Execution Results

| Test Suite | Command Executed | Actual Result | Notes |
|---|---|---|---|
| **Python Static Linting (Ruff)** | `.\.venv\Scripts\ruff.exe check backend\app tests\test_backend_api.py` | **PASSED (0 errors)** | Clean across all backend routers, services, core, and test files |
| **Backend Integration & Security Suite (Pytest)** | `.\.venv\Scripts\pytest.exe tests/test_backend_api.py -v` | **8 / 8 PASSED (`38.51s`)** | 100% pass against live PostgreSQL 16 + live Ollama + live WebSocket |
| **Frontend Strict TypeScript Check** | `npm run typecheck` (`tsc --noEmit`) | **PASSED (0 errors)** | All 15 pages, types, and API services type-safe |
| **Frontend ESLint** | `npm run lint` (`eslint .`) | **PASSED (0 errors)** | 0 errors (2 non-blocking `react-refresh` warnings on shared context/UI exports) |
| **Frontend Production Bundle** | `npm run build` (`vite build`) | **PASSED (`29.04s`)** | `2070` modules compiled (`dist/assets/index-*.js`: `897.21 kB` / `245.36 kB` gzip) |
| **5-Role Browser E2E Suite (Playwright Chromium)** | `npx playwright test --reporter=list` | **5 / 5 PASSED (`34.1s`)** | Full real-browser verification across all 5 roles |

---

## 2. Backend Pytest Coverage (8 / 8 Passed)
1. `test_health_endpoint` — Confirmed DB healthy, `audio_storage_enabled: false`, and background `scheduler.running: true`.
2. `test_authentication_login_invalid_logout_and_reset` — Verified `401` on unauthenticated/invalid login, immediate JWT revocation on `/logout`, and single-use password reset token enforcement.
3. `test_rbac_hierarchical_isolation_enforced_in_backend` — Verified cross-branch (`403`), cross-zone (`403`), Pharmacist admin/report blocks (`403`), Owner separation from `system_admin` (`403`), and System Admin access (`200`).
4. `test_call_registration_transcript_requests_and_followups_lifecycle` — Verified spoofed telephony rejection (`400`), manual call creation, text-only transcript save, multi-item request + immutable status history, cancel-without-reason rejection (`400`), **Pharmacist `403` on escalation evaluation (`DEF-08`)**, and deduplicated Branch Manager escalation evaluation.
5. `test_transcription_websocket_in_memory_and_ollama_extraction` — Verified authenticated `/api/ws/transcription/live` ephemeral RAM PCM processing (`audio_retained: false`) and real local Ollama `qwen2.5:1.5b` structured JSON extraction with disclaimer.
6. `test_shopaid_csv_fallback_and_reports_csv_export` — Verified ShopAid CSV upload with 1 intentionally invalid row reporting `failed_count == 1` (`Row 4`), catalog lookup, and authorized CSV report export.
7. `test_rbac_permission_revocation_and_self_role_guard` — Verified admin self-role change blocked (`400`), live permission revocation via `PUT /api/roles/{id}/permissions` immediately returning **`403 Forbidden`** on direct API call (`DEF-01`), and clean restoration returning `200`.
8. `test_metrics_reconciliation_admin_dashboard_and_customer_crud` — Verified System Admin dashboard summary (`scheduler.running`, `CBE-GP` staffing warning), `calls_today` excluding `browser_microphone_test` while `microphone_tests_today` increments (`DEF-02`), `GET/POST/PATCH /api/customers` CRUD, and `requests_created` + `requests_assigned` fields (`DEF-03`).

---

## 3. Playwright Chromium 5-Role E2E Coverage (5 / 5 Passed)
1. **Unauthenticated & Invalid Login (`2.3s`)** — Redirects `/calls` → `/login`; rejects invalid password with visible error banner.
2. **Pharmacist Journey (`7.1s`)** — Verifies `Phone Calls Today`, Live Call Desk 3 panels + `Start Next Call` + `0` `<audio>` elements, `/customers` directory, `/calls` date/employee/outcome filters, Call Detail `Linked Operational Records` + `No Audio Stored`, Request Manage `Edit Medicine Items`, and `Run Escalation Check Now` hidden.
3. **Branch Manager Journey (`5.7s`)** — Verifies Branch Dashboard, `Run Escalation Check Now` visible on `/followups`, Gandhipuram `No active pharmacists assigned` warning on `/branches`, and CSV export on `/reports`.
4. **Zonal Manager & Owner Journeys (`7.6s`)** — Verifies West Zone isolation (South Zone hidden), `Complete` button hidden on `/followups` for read-only roles (`DEF-06`), Owner executive dashboard with Zone Summary, and `Administration` hidden for Owner.
5. **System Administrator Journey (`7.1s`)** — Verifies dedicated System Admin Dashboard (`Background Escalation Scheduler: RUNNING`, `Organization Staffing & Integrity Warnings`), Administration `Edit` user control, interactive `Edit Permissions` modal (`Save Role Permissions`), Integrations (`ShopAid`, `Telephony`, `Notification Delivery Channels`, `Configure Adapter`), Audit Log `Entity Type Filter`, and Zones `Edit Zone` button.

---

## 4. Security, Privacy & Local Performance Validation
- **Privacy:** Verified `0` audio columns in PostgreSQL, `0` `<audio>` tags in UI, `audio_retained: false` on live WebSocket stop, and `0` audio files created by backend or frontend runs.
- **Security:** Direct API revocation, cross-branch/cross-zone isolation, escalation authorization (`403` for pharmacists), self-deactivation/self-role-change guards, and immutable audit logging all passed.
- **Hardware / Performance Notes:** Full 8-suite backend run (including live Ollama inference and Faster-Whisper WebSocket) completed in `38.51s` on the 2-core i3 / 8 GB RAM laptop; Ollama `keep_alive: "2m"` releases idle RAM automatically. Concurrent multi-branch production load remains untested and requires central-server benchmarking prior to deployment.
