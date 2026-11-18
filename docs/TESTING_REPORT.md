# ThulasiConnect — Testing & Verification Report

**Date:** 2026-11-18  
**Environment:** Windows 11 Home (Build 26200), Intel Core i3-1115G4, 7.80 GB RAM, Python 3.13.7 (`.venv`), Node.js v20.20.2, PostgreSQL 16.16, Ollama 0.40.16 (`qwen2.5:1.5b`), Faster-Whisper `base` (CPU INT8)

---

## 1. Automated Verification Summary

| Suite / Tool | Command | Result | Details |
|---|---|---|---|
| **Python Linter (Ruff)** | `.\.venv\Scripts\ruff.exe check backend\app tests\test_backend_api.py` | **PASSED (0 errors)** | All backend modules and integration tests clean |
| **Database Migration (Alembic)** | `alembic upgrade head` | **PASSED** | All 26 normalized tables + indexes created in `thulasiconnect_dev` |
| **Backend API, RBAC, AI & WS Tests (Pytest)** | `pytest tests/test_backend_api.py -v` | **6 / 6 PASSED** (`29.22s`) | Auth, RBAC isolation, Calls/Transcripts, Requests/History, Escalation deduplication, Live WS + Ollama `qwen2.5:1.5b`, ShopAid CSV fallback, Reports CSV export |
| **Frontend TypeScript Compiler** | `npm run typecheck` (`tsc --noEmit`) | **PASSED (0 errors)** | Strict TypeScript across all pages, services, and API types |
| **Frontend ESLint** | `npm run lint` (`eslint .`) | **PASSED (0 errors)** | 0 errors (2 non-blocking `react-refresh` warnings) |
| **Frontend Production Build** | `npm run build` (`vite build`) | **PASSED (`9.09s`)** | `dist/` built cleanly (`2069` modules) |
| **End-to-End Browser Tests (Playwright Chromium)** | `npx playwright test --reporter=list` | **4 / 4 PASSED** (`9.1s`) | Tested against live Uvicorn (`:8000`) + PostgreSQL 16 + Vite (`:5173`) |

---

## 2. Detailed Verification Coverage

### Authentication & Security (`test_authentication_login_invalid_logout_and_reset` + Playwright #1)
- Unauthenticated API call returns `401 Unauthorized`; unauthenticated browser navigation redirects to `/login`.
- Invalid password rejected with `401` and visible UI error banner; failed login recorded in `audit_logs`.
- Valid login returns signed JWT; `POST /api/auth/logout` adds `jti` to `revoked_tokens` and immediately invalidates subsequent API calls (`401`).
- Password reset token generated, confirmed once (`200`), and rejected on reuse (`400`).

### Backend RBAC & Hierarchical Scope Enforcement (`test_rbac_hierarchical_isolation_enforced_in_backend` + Playwright #2, #3, #4)
- **Pharmacist:** Sees own dashboard, Live Call Desk, own calls/requests/follow-ups; receives `403` on `/api/users`, `/api/audit-logs`, `/api/reports/*`; navigation hides Administration & Reports.
- **Branch Manager (RS Puram):** Authorized for `CBE-RSP` (`200`), blocked (`403`) from Madurai (`MDU-KKN`) calls and requests; accesses branch reports & branch settings.
- **Zonal Manager (West):** Sees West Tamil Nadu Zone (`CBE-RSP`, `CBE-GP`), does NOT see South Zone (`MDU-KKN`), blocked (`403`) on direct Madurai branch queries.
- **Owner:** Sees organization-wide executive dashboard with Zone & Branch drilldowns; receives `403` on `/api/users` (system admin remains strictly separated).
- **System Administrator:** Manages users, roles, integrations, escalation policies, and views `audit_logs`.

### Calls, Requests, Status History & Deduplicated Escalations (`test_call_registration_transcript_requests_and_followups_lifecycle`)
- Pharmacist attempting to spoof `call_source_type="verified_telephony_integration"` is rejected (`400`).
- Manual telephone call registered (`201`), text-only transcript segments saved (`200`).
- Multi-item medicine request created (`2` items), cancellation without reason rejected (`400`), status update appends to `request_status_history`.
- Overdue follow-up evaluation generates employee reminder & Branch Manager escalation once; re-running evaluation creates **0 duplicates**.

### In-Memory Transcription WebSocket & Local Ollama AI (`test_transcription_websocket_in_memory_and_ollama_extraction`)
- `/api/transcription/status` confirms `audio_recording_storage: false`.
- Authenticated WebSocket `/api/ws/transcription/live` accepted in-memory 16 kHz PCM Int16 bytes, flushed cleanly on `stop`, and confirmed `audio_retained: false`.
- Local Ollama `qwen2.5:1.5b` extracted structured JSON medicine suggestions tagged `ai_suggested`/`missing_info` with non-medical-advice disclaimer.
- Playwright verified `0` `<audio>` playback elements exist on Live Call Desk and Call Detail views.

### Integrations & Reports (`test_shopaid_csv_fallback_and_reports_csv_export`)
- ShopAid and Telephony integrations explicitly report `disconnected` / `csv_fallback_only`.
- ShopAid CSV fallback upload imported reference rows (`live_shopaid_connected: false`) and returned search matches.
- Reports CSV export returned valid `text/csv` payload scoped to the caller's authorized branch.

---

## 3. Items Requiring Controlled Real-World Evaluation (Not Claimed As Verified Yet)
- **Tamil, English & Tanglish Live Pharmacy Speech Accuracy:** Faster-Whisper `base` (CPU INT8) is verified functionally (and preserved scripts `tests/test_live_microphone.py` and `tests/test_transcription.py` remain intact), but accuracy on real pharmacy brand names and accented Tamil-English conversations must be measured during authorized pilot testing.
- **Live Telephony & Live ShopAid API:** Pending vendor API documentation, credentials, and PBX/SIP hardware connection.
