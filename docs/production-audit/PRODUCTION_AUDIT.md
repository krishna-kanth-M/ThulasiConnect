# ThulasiConnect — Complete Production Environment Audit & Security Assessment

**Audit Date:** November 25, 2026  
**Auditor:** Senior Full-Stack Architect, Application Security Engineer & DevOps Specialist  
**Target Deployment:** `https://thulasiconnect.vercel.app`  
**Workspace:** `c:\Users\KRISHNA KANTH M\Downloads\ThulasiConnect`  
**Classification:** Critical Security & Infrastructure Audit  

---

## 1. Executive Summary & Root Cause Analysis

ThulasiConnect was deployed to Vercel as a static Single Page Application (SPA). The deployed website exhibits serious functional, authentication, and security issues reported by stakeholders. 

A rigorous architectural and network audit reveals the **single overarching root cause**:

> **The production frontend at `https://thulasiconnect.vercel.app` is currently operating with NO connected cloud backend, NO cloud PostgreSQL database, and NO cloud AI/WebSocket service.**

Because Vercel currently hosts only the static compiled bundle of the frontend, all browser network requests to `/api/*` are captured by Vercel's static catch-all rewrite rule (`/(.*) -> /index.html`). 
- **`GET /api/health`** returns `index.html` (HTTP 200, Content-Type: `text/html`).
- **`POST /api/auth/login`** returns **HTTP 405 Method Not Allowed** (static HTML files do not accept HTTP POST requests).
- When the frontend receives this error, an offline showcase fallback in `frontend/src/services/api.ts` catches the failure and diverts execution to client-side mock data in `frontend/src/services/mockData.ts`.
- In `mockData.ts`, a development fallback automatically approves **any login request** with synthetic mock tokens, completely bypassing real password verification, Argon2id hashing, database user lookup, and server-side RBAC enforcement.

---

## 2. Issue Severity & Classification Matrix

| Finding ID | Component | Description & Root Cause | Severity | Impact |
| :--- | :--- | :--- | :---: | :--- |
| **SEC-01** | **Authentication** | **Client-side mock login bypass:** When `/api/auth/login` fails with HTTP 405, `mockData.ts` intercepts the request and issues a mock session for ANY email/password combination, even nonexistent accounts or invalid passwords. | **CRITICAL** | False sense of authentication; anyone can enter any random password and enter the system. |
| **SEC-02** | **Session Security** | **Mock JWT tokens in LocalStorage:** Synthetic tokens (`mock_jwt_token_<email>`) are stored in `localStorage` without cryptographic signature validation or server verification. | **CRITICAL** | Zero tamper protection; tokens cannot be validated or revoked by any backend. |
| **INF-01** | **Backend Connectivity** | **Missing Production Backend:** No FastAPI server is running on the cloud. The frontend has `VITE_API_BASE_URL=""`, sending all API calls back to Vercel's static file server. | **CRITICAL** | Zero backend processing; real business logic does not execute. |
| **INF-02** | **Database Connectivity** | **Missing Cloud PostgreSQL:** The production application is not connected to any persistent PostgreSQL database. Local PostgreSQL (`127.0.0.1:5432`) is not accessible from Vercel. | **CRITICAL** | Zero data persistence; customer calls, medicine requests, and follow-ups vanish on page reload. |
| **INF-03** | **WebSockets & Speech STT** | **WebSocket Failure on Vercel:** Live Call Desk attempts to open `wss://thulasiconnect.vercel.app/api/ws/transcription/live`. Vercel Serverless cannot host persistent WebSockets. | **HIGH** | Live speech-to-text transcription cannot function on pure Vercel serverless. |
| **INF-04** | **AI LLM Extraction** | **Missing Ollama Service:** Backend Ollama (`http://127.0.0.1:11434`) is local only. No cloud LLM endpoint is wired for production medicine entity extraction. | **HIGH** | Automated medicine name and quantity extraction is unavailable in cloud production. |
| **INF-05** | **Background Daemon** | **Missing Escalation Scheduler:** The 60-second `EscalationScheduler` loop runs inside FastAPI's local Python process. In cloud serverless, background workers do not run. | **HIGH** | Overdue follow-up callbacks are never automatically escalated to Branch Managers or Owners. |
| **INT-01** | **ShopAid Integration** | **Adapter Unconnected:** ShopAid pharmacy catalog integration is running against local CSV / stubs. No live production pharmacy ERP credentials or endpoints are configured. | **MEDIUM** | Live medicine stock lookup and pricing are restricted to mock/cached catalog items. |

---

## 3. Deep Architectural Investigation

### 3.1 Network Communication Breakdown

```
[User Browser on https://thulasiconnect.vercel.app]
          │
          │ 1. POST /api/auth/login { email: "user@thulasi", password: "wrongpassword" }
          ▼
┌────────────────────────────────────────────────────────┐
│                   VERCEL STATIC CDN                    │
│                                                        │
│  vercel.json rewrites: "/(.*)" -> "/index.html"        │
│                                                        │
│  Result: HTTP 405 Method Not Allowed (on index.html)   │
└──────────────────────────┬─────────────────────────────┘
                           │
                           │ 2. Fetch fails (Status 405 / Content-Type: text/html)
                           ▼
┌────────────────────────────────────────────────────────┐
│            BROWSER CLIENT FALLBACK (api.ts)            │
│                                                        │
│  catch (err) -> getMockResponse('/api/auth/login')     │
│  mockData.ts: DEMO_USERS[email] || DEMO_USERS['...']   │
│  Return: { access_token: "mock_jwt_token_...", user }  │
│                                                        │
│  CRITICAL FLAW: User is logged in WITHOUT password check│
└────────────────────────────────────────────────────────┘
```

### 3.2 Frontend vs Backend Configuration Audit

| Configuration | Local Development | Deployed Vercel Environment | Status / Discrepancy |
| :--- | :--- | :--- | :--- |
| **`VITE_API_BASE_URL`** | `http://127.0.0.1:8000` | `""` (Not configured in Vercel env) | ❌ Broken: Defaults to relative path on static Vercel host |
| **`VITE_WS_BASE_URL`** | `ws://127.0.0.1:8000` | `""` (Not configured in Vercel env) | ❌ Broken: Defaults to `wss://thulasiconnect.vercel.app` which fails |
| **FastAPI Backend** | Local Python 3.13 process | Not deployed to cloud | ❌ Broken: Backend code exists only on local laptop |
| **PostgreSQL 16** | Local `thulasiconnect_dev` | Not provisioned on cloud | ❌ Broken: No cloud database exists |
| **Faster-Whisper** | Local CPU INT8 (`ai-services/`) | Not deployed to cloud | ❌ Broken: Cannot run inside Vercel static/serverless |
| **Ollama Qwen 2.5** | Local port 11434 | Not deployed to cloud | ❌ Broken: No cloud inference host |
| **Scheduler** | In-process asyncio task (60s) | Inactive | ❌ Broken: Serverless environments freeze between requests |

---

## 4. Authentication & Security Lifecycle Audit

The backend repository contains a high-quality, production-ready security implementation in `backend/app/core/security.py` and `backend/app/routers/auth.py`. However, because the backend is not deployed to production, none of these security guarantees are active on Vercel.

### 4.1 Backend Security Capabilities (Local / Ready to Deploy)
1. **Password Hashing:** Uses state-of-the-art **Argon2id** (`time_cost=2, memory_cost=65536, parallelism=2`). Plaintext passwords are never stored.
2. **Password Verification:** Cryptographically validates hashes via `argon2.PasswordHasher.verify()`.
3. **Brute-Force & Audit Logging:** Failed logins record an immutable audit event (`auth.login_failed`) with client IP address in PostgreSQL table `audit_logs`.
4. **JWT Creation & Validation:** Generates standard signed HS256 tokens with `sub`, `roles`, `jti`, `iat`, and `exp`.
5. **Token Revocation (Logout):** Records token `jti` in table `revoked_tokens` so logged-out tokens are immediately rejected.
6. **Password Reset Flow:** Cryptographically secure 32-byte tokens with expiration in table `password_reset_tokens`.

### 4.2 Production Security Defects Observed on Live Site
1. **Invalid Passwords Authenticate:** Entering `admin@thulasipharmacy.local` with any random password (e.g. `wrong123`) succeeds because `mockData.ts` blindly returns a mock user object.
2. **Nonexistent Accounts Authenticate:** Entering `hacker@evil.com` logs in as the default pharmacist account.
3. **No Cryptographic Signature:** Browser sessions use plain string `mock_jwt_token_<email>` in `localStorage`.
4. **Client-Side Authorization Only:** Routes in `App.tsx` check permissions against the unverified JSON stored in `localStorage`. A client can manually edit `user.permissions` in browser devtools and access any screen.

---

## 5. Role-Based Access Control (RBAC) Audit

The system design defines four primary organizational roles with strict hierarchical permissions:

### 5.1 Role Definitions & Permission Matrix

| Role | Scope | Allowed Pages | Critical Permissions | Restrictions |
| :--- | :--- | :--- | :--- | :--- |
| **Pharmacist** | Branch Only (e.g. RS Puram) | Live Call Desk, Calls, Customers, Requests, Follow-ups | `live_call:use`, `calls:create`, `calls:read_branch`, `requests:create`, `requests:update_status`, `followups:create`, `followups:resolve` | Cannot view other branches, zones, system settings, or administration. |
| **Branch Manager** | Branch Only (e.g. RS Puram) | Dashboard, Calls, Customers, Requests, Follow-ups, Branch Staff, Notifications | `dashboard:read_branch`, `calls:read_branch`, `escalations:read_branch`, `escalations:resolve`, `employees:read_branch`, `reports:read_branch` | Cannot modify organization settings, zones, or roles. |
| **Zonal Manager** | Zone Wide (e.g. West Zone) | Regional Dashboard, Multi-Branch Comparisons, Escalation Audits, Reports | `dashboard:read_zone`, `branches:read_zone`, `escalations:read_zone`, `reports:read_zone`, `performance:read_zone` | Cannot access other zones or system-level configuration. |
| **Owner / Director** | Organization Wide | Executive Dashboard, High-Level Financials, Demand Analytics, Reports | `dashboard:read_org`, `reports:read_org`, `escalations:read_org`, `audit:read` | Read-only executive visibility; operational configuration delegated to Admin. |
| **System Admin** | Global System | Administration, Role Permissions, User Management, System Health, Escalation Policy | `admin:access`, `users:manage`, `roles:manage`, `system:health`, `settings:manage` | Has full configuration access; restricted from clinical dispensing. |

### 5.2 Server-Side Enforcement Status
- In `backend/app/core/rbac.py`, every single endpoint has a `@require_permissions(...)` dependency that extracts the JWT token, verifies signature, checks database user status, and validates user permissions.
- **Production Vulnerability:** In the current live deployment, because requests never reach the backend, the server-side RBAC checks never execute.

---

## 6. Complete Feature Functionality Audit

| Feature Area | Sub-Feature | Implementation Status | Cloud Production Status | Root Cause of Failure |
| :--- | :--- | :---: | :---: | :--- |
| **A. Live Call Desk** | Call Interface | Implemented | ⚠️ Mock Fallback | Loads UI with synthetic call session; no backend persistence. |
| | Speech STT | Implemented | ❌ Broken | WebSocket `/api/ws/transcription/live` fails on Vercel CDN. |
| | Medicine Extraction | Implemented | ❌ Broken | Local Ollama daemon unreachable from cloud Vercel. |
| | Customer Lookup | Implemented | ⚠️ Mock Fallback | Returns mock customer list from memory; database disconnected. |
| **B. Call Management** | Manual Call Entry | Implemented | ⚠️ Mock Fallback | Saves in client-side mock array; resets on page refresh. |
| | Call Source Filter | Implemented | ⚠️ Mock Fallback | Filters client-side mock data; no database query. |
| | Transcript Viewer | Implemented | ⚠️ Mock Fallback | Displays hardcoded transcript segments. |
| **C. Customer Requests** | Request Creation | Implemented | ⚠️ Mock Fallback | Creates local in-memory object; never written to PostgreSQL. |
| | Status Transitions | Implemented | ⚠️ Mock Fallback | Updates local state; status history table not updated. |
| | Inventory Lookup | Implemented | ⚠️ Mock Fallback | Returns stub catalog; live ERP integration not wired. |
| **D. Follow-ups & Esc.** | Callback Tracking | Implemented | ⚠️ Mock Fallback | Displays mock follow-ups; no database persistence. |
| | Overdue Evaluation | Implemented | ❌ Broken | Background scheduler is not running in production. |
| | Multi-Tier Esc. | Implemented | ❌ Broken | Automatic escalation logic cannot trigger without worker. |
| **E. Staff & Org** | Branch Directory | Implemented | ⚠️ Mock Fallback | Reads hardcoded branch records; no database connection. |
| | Staff Assignment | Implemented | ⚠️ Mock Fallback | Cannot update staff roles or branch mappings permanently. |
| | Performance Metrics | Implemented | ⚠️ Mock Fallback | Calculations run on mock arrays rather than database records. |
| **F. Notifications** | Notification Inbox | Implemented | ⚠️ Mock Fallback | Displays mock alerts; real escalations do not generate alerts. |
| | Mark as Read | Implemented | ⚠️ Mock Fallback | Updates local state; resets on reload. |
| **G. System Health** | DB Status | Implemented | ❌ Inaccurate | Reports "Connected" based on mock health stub, masking outage. |
| | AI Engine Status | Implemented | ❌ Inaccurate | Reports Faster-Whisper ready based on mock stub. |
| **H. ShopAid ERP** | CSV Import | Implemented | ❌ Broken | Uploads fail because backend POST endpoints return 405. |
| | Live API Catalog | Stubbed | ⚠️ Incomplete | Live API requires partner credentials and API endpoint URL. |

---

## 7. Required Technical Remediation Plan

To convert the application from a disconnected static prototype into a genuine, secure full-stack production application, the following five repairs are mandatory:

```
┌────────────────────────────────────────────────────────────────────────┐
│                     REQUIRED PRODUCTION ARCHITECTURE                   │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  [Clients / Browsers]                                                  │
│         │                                                              │
│         ▼ HTTPS                                                        │
│  ┌──────────────────────────────┐                                      │
│  │   VERCEL CLOUD CDN           │ ◄─── Frontend SPA                    │
│  │   thulasiconnect.vercel.app  │      Configured with:                │
│  │                              │      - VITE_API_BASE_URL=https://api │
│  │                              │      - VITE_WS_BASE_URL=wss://api    │
│  └──────────────┬───────────────┘                                      │
│                 │                                                      │
│                 │ HTTPS REST / WSS WebSocket                           │
│                 ▼                                                      │
│  ┌──────────────────────────────┐                                      │
│  │   MANAGED CLOUD BACKEND      │ ◄─── Persistent FastAPI + Uvicorn    │
│  │   (Render / Railway / Cloud) │      - 58 REST Endpoints             │
│  │                              │      - WebSocket Live Call Desk      │
│  │                              │      - 60s Escalation Scheduler      │
│  │                              │      - Argon2id + JWT + Audit Log    │
│  └───────┬──────────────┬───────┘                                      │
│          │              │                                              │
│          │ SSL          │ In-Memory                                    │
│          ▼              ▼                                              │
│  ┌──────────────┐  ┌──────────────────────────────┐                    │
│  │ MANAGED      │  │ CLOUD SPEECH & LLM SERVICE   │                    │
│  │ POSTGRESQL   │  │ - Faster-Whisper CPU INT8    │                    │
│  │ (Neon/Cloud) │  │ - Cloud LLM Inference        │                    │
│  │ 26 Tables    │  │ - ZERO Audio Storage         │                    │
│  └──────────────┘  └──────────────────────────────┘                    │
└────────────────────────────────────────────────────────────────────────┘
```

### Actionable Steps:
1. **Disable Insecure Mock Auth Fallback:** In `frontend/src/services/api.ts` and `mockData.ts`, eliminate the silent auto-login for invalid credentials. If credentials fail or the server is unavailable, the UI must explicitly display authentication failure errors.
2. **Provision Cloud Managed PostgreSQL:** Set up a cloud PostgreSQL instance (e.g. Neon Serverless Postgres or Supabase), execute Alembic migrations (`alembic upgrade head`), and seed default reference metadata.
3. **Deploy FastAPI Backend to Cloud Container:** Deploy the existing backend container ([`deployment/Dockerfile.backend`](file:///c:/Users/KRISHNA%20KANTH%20M/Downloads/ThulasiConnect/deployment/Dockerfile.backend)) to a persistent hosting service (Render, Railway, or AWS App Runner) with WebSocket support and background worker enabled.
4. **Configure Vercel Production Environment Variables:** Add `VITE_API_BASE_URL` and `VITE_WS_BASE_URL` pointing to the live backend URL, then redeploy the Vercel frontend.
5. **Verify Full-Stack Security & Workflows:** Execute end-to-end integration tests (login rejection on bad password, valid JWT issuance, database persistence of customer requests, and live WebSocket streaming).
