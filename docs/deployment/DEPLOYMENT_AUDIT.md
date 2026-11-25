# ThulasiConnect — Complete Deployment Audit & Architecture Discovery

**Audit Date:** November 25, 2026  
**Auditor:** Senior DevOps & Cloud Infrastructure Specialist  
**Application:** ThulasiConnect — Multi-Branch Pharmacy Call Management & Supervision Platform  
**Repository Working Directory:** `c:\Users\KRISHNA KANTH M\Downloads\ThulasiConnect`

---

## 1. Executive Summary

This deployment audit performs a complete inspection of the ThulasiConnect code repository prior to production deployment. The purpose is to verify application entry points, frontend and backend roots, database schema, background daemons, AI models, and architectural hosting requirements.

### Key Discovery Findings
- **Frontend Root:** `frontend/` (Vite 6.0.5, React 19.0.0, TypeScript 5.7.2, React Router 7.1.0, TailwindCSS 4.0.0)
- **Backend Root:** `backend/` (FastAPI 0.115.0+, SQLAlchemy 2.0.36+, Alembic 1.14.0+, Psycopg 3.2.0, Uvicorn 0.32.0+)
- **Total Frontend Pages:** 16 full-page components
- **Total Backend Routers:** 13 modular APIRouters
- **Total API Endpoints:** 58 REST operations across 48 API routes + 1 WebSocket streaming endpoint (`/api/ws/transcription/live`)
- **Total Database Tables:** 26 relational tables (SQLAlchemy models + Alembic migration `cc32ff675d54_initial_schema.py`)
- **AI / Speech Stack:** Faster-Whisper (CPU INT8, local base model at `ai-services/models`), local Ollama (`qwen2.5:1.5b` over HTTP `http://127.0.0.1:11434`), strictly in-memory audio chunking (zero audio files written to disk).
- **Background Daemons:** In-process `EscalationScheduler` running inside FastAPI lifespan every 60 seconds to evaluate overdue callbacks and escalate to Branch Managers, Zonal Managers, and Owners.

---

## 2. Directory Structure & Workspace Verification

```
ThulasiConnect/
├── .github/
│   └── workflows/
│       └── deploy.yml            # Automated GitHub Pages CI/CD workflow
├── .venv/                        # Python 3.13 virtual environment with dependencies
├── ai-services/
│   ├── models/                   # Cached Faster-Whisper INT8 base model (~150 MB)
│   └── requirements.txt
├── backend/
│   ├── alembic/
│   │   ├── versions/
│   │   │   └── cc32ff675d54_initial_schema.py  # 26-table initial schema migration
│   │   └── env.py
│   ├── app/
│   │   ├── cli/
│   │   │   └── bootstrap_admin.py # CLI for initial system administrator account
│   │   ├── core/
│   │   │   ├── audit.py           # Immutable system audit logging
│   │   │   ├── config.py          # Pydantic Settings from .env
│   │   │   ├── database.py        # SQLAlchemy engine & session maker
│   │   │   ├── rbac.py            # RBAC tokens, permissions, and seeding
│   │   │   └── security.py        # Argon2id password hashing, JWT creation
│   │   ├── models/                # 5 model modules (identity, operations, organization, requests, workflow)
│   │   ├── routers/               # 13 APIRouters
│   │   ├── schemas/               # Pydantic v2 schemas
│   │   ├── services/              # Domain logic (escalation, transcription, AI extraction, shopaid, telephony)
│   │   └── main.py                # FastAPI application entrypoint with lifespan
│   ├── alembic.ini
│   └── requirements.txt
├── database/                     # Seed scripts and SQL reference definitions
├── deployment/                   # Deployment scripts and configuration files
├── docs/                         # Technical architecture, user roles, API specifications
├── frontend/
│   ├── public/
│   │   └── 404.html              # SPA routing fallback for static hosts
│   ├── src/
│   │   ├── components/           # UI badges, modals, tables, toasts
│   │   ├── features/             # AuthContext, session storage
│   │   ├── layouts/              # AppLayout with sidebar & role-aware navigation
│   │   ├── pages/                # 16 page components
│   │   ├── services/             # api.ts (fetch client) & mockData.ts (offline showcase)
│   │   ├── types/                # TypeScript API interfaces
│   │   ├── App.tsx               # React Router 7 route definitions & guards
│   │   └── main.tsx              # Application mount
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── tests/                        # Pytest integration & unit test suite
├── .env.example                  # Environment variable reference template
├── pyproject.toml
├── vercel.json                   # Root Vercel configuration
└── README.md
```

---

## 3. Technology Stack & Component Specifications

### 3.1 Frontend (`frontend/`)
- **Framework:** React 19.0.0 with Vite 6.0.5 build tooling.
- **Language:** TypeScript 5.7.2.
- **Routing:** React Router DOM 7.1.0 (`BrowserRouter` with dynamic `basename` support).
- **Styling:** TailwindCSS 4.0.0, Lucide React icons (`0.468.0`).
- **Data Fetching & State:** `@tanstack/react-query` 5.62.0, React Context for Authentication.
- **Forms & Validation:** `react-hook-form` 7.54.0 with `zod` 3.24.0 resolvers.
- **Charts:** `recharts` 2.15.0.
- **Build Output:** `frontend/dist` (single-page static bundle containing `index.html`, `404.html`, and hashed JS/CSS assets).

### 3.2 Backend (`backend/`)
- **Framework:** FastAPI 0.115.0+ running on Python 3.13.
- **ASGI Server:** Uvicorn 0.32.0+ with standard extras.
- **Database ORM:** SQLAlchemy 2.0.36+ with Psycopg 3.2.0 binary driver.
- **Migrations:** Alembic 1.14.0+.
- **Authentication & Security:** Argon2id (`argon2-cffi 23.1.0+`), JWT (`PyJWT 2.9.0+`, HS256), Bearer Token authentication.
- **Network & Validation:** Pydantic 2.10.0+, `pydantic-settings 2.6.0+`, `httpx 0.28.0+`.
- **WebSockets:** Starlette/FastAPI WebSockets (`websockets 14.0+`).

### 3.3 Database (`PostgreSQL 16+`)
- **Tables (26 total):**
  1. `app_settings`
  2. `audit_logs`
  3. `branches`
  4. `call_outcomes`
  5. `call_transcripts`
  6. `calls`
  7. `customers`
  8. `employees`
  9. `escalations`
  10. `follow_ups`
  11. `integration_configs`
  12. `medicine_request_items`
  13. `medicine_requests`
  14. `notifications`
  15. `password_reset_tokens`
  16. `permissions`
  17. `request_status_history`
  18. `revoked_tokens`
  19. `role_permissions`
  20. `roles`
  21. `shopaid_catalog_items`
  22. `speakers`
  23. `transcript_segments`
  24. `user_roles`
  25. `users`
  26. `zones`

### 3.4 Speech-to-Text & AI Services
- **Speech-to-Text Engine:** Faster-Whisper (CPU INT8 quantized base model).
- **Processing Mode:** Strictly in-memory RAM buffers (~4s PCM chunks, 16 kHz mono 16-bit). Audio is discarded immediately post-transcription. Audio recording storage is permanently disabled.
- **LLM Engine:** Local Ollama daemon running `qwen2.5:1.5b` over HTTP for medicine entity extraction and intent tagging.

### 3.5 Background Processing
- **Escalation Daemon:** `app.services.scheduler.EscalationScheduler` initialized during FastAPI `lifespan`. Runs every 60 seconds to identify overdue customer follow-ups and automatically create hierarchical escalation events (`branch_manager` at +60m, `zonal_manager` at +240m, `owner` at +1440m).

---

## 4. Complete Inventory of Components & Endpoints

### 4.1 Frontend Pages (16)
1. `LoginPage.tsx`: Staff authentication with 1-click role switcher preview.
2. `DashboardPage.tsx`: Role-specific overview with metrics, SLA compliance, and system status.
3. `LiveCallDeskPage.tsx`: Interactive microphone capture, live speech transcription, and AI extraction.
4. `CallsPage.tsx`: Call registry, source filtering (telephony vs mic), date range, and staff assignment.
5. `CallDetailPage.tsx`: Detailed call timeline, transcript segments, linked medicine requests, and follow-ups.
6. `CustomersPage.tsx`: Customer search, interaction history, and active inquiries.
7. `RequestsPage.tsx`: Medicine inquiry lifecycle management (Pending, Sourced, Ready, Dispensed, Cancelled).
8. `FollowUpsPage.tsx`: Scheduled callbacks, overdue flags, and escalation status.
9. `EmployeesPage.tsx`: Pharmacy staff directory, role assignments, and branch mapping.
10. `BranchesPage.tsx`: Branch locations, contact details, operational hours, and assigned personnel.
11. `ZonesPage.tsx`: Regional grouping of branches (West Zone, South Zone).
12. `ReportsPage.tsx`: Operational reports and CSV exports.
13. `NotificationsPage.tsx`: In-app alert inbox for overdue reminders and escalations.
14. `AdministrationPage.tsx`: User management, role permission matrix, and escalation threshold configuration.
15. `SystemHealthPage.tsx`: Real-time health status of PostgreSQL, STT, LLM, and adapters.
16. `SettingsPage.tsx`: User profile and password management.

### 4.2 Backend REST & WebSocket Endpoints (59 Total)
- **Authentication (6):**
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
  - `POST /api/auth/change-password`
  - `POST /api/auth/password-reset/request`
  - `POST /api/auth/password-reset/confirm`
- **Users & RBAC (6):**
  - `GET, POST /api/users`
  - `PATCH /api/users/{user_id}`
  - `GET /api/roles`
  - `PUT /api/roles/{role_id}/permissions`
  - `GET /api/permissions`
- **Organization (6):**
  - `GET, POST /api/zones`
  - `PATCH /api/zones/{zone_id}`
  - `GET, POST /api/branches`
  - `PATCH /api/branches/{branch_id}`
  - `GET /api/employees`
- **Customers (3):**
  - `GET, POST /api/customers`
  - `PATCH /api/customers/{customer_id}`
- **Calls & Outcomes (6):**
  - `GET, POST /api/calls`
  - `GET, PATCH /api/calls/{call_id}`
  - `POST /api/calls/{call_id}/transcript`
  - `GET /api/call-outcomes`
- **Transcription & AI (3):**
  - `GET /api/transcription/status`
  - `POST /api/transcription/extract`
  - `WS /api/ws/transcription/live` (Authorized binary PCM streaming)
- **Medicine Requests (4):**
  - `GET, POST /api/requests`
  - `GET, PATCH /api/requests/{request_id}`
- **Follow-ups & Escalations (5):**
  - `GET, POST /api/followups`
  - `PATCH /api/followups/{followup_id}`
  - `POST /api/followups/evaluate-escalations`
  - `GET /api/escalations`
  - `PATCH /api/escalations/{escalation_id}`
- **Dashboard & Performance (3):**
  - `GET /api/dashboard/overview`
  - `GET /api/performance/branches`
  - `GET /api/performance/employees`
- **Notifications (4):**
  - `GET /api/notifications`
  - `GET /api/notifications/unread-count`
  - `PATCH /api/notifications/{notification_id}/read`
  - `POST /api/notifications/mark-all-read`
- **Reports & Exports (2):**
  - `GET /api/reports/{report_type}`
  - `GET /api/reports/{report_type}/export.csv`
- **Integrations & Settings (4):**
  - `GET /api/integrations`
  - `PATCH /api/integrations/{integration_key}`
  - `GET /api/integrations/shopaid/catalog`
  - `POST /api/integrations/shopaid/import-csv`
- **System Health & Audit (7):**
  - `GET /api/health`
  - `GET /api/admin/system-health`
  - `GET /api/audit-logs`
  - `GET, PUT /api/settings/escalation-policy`

---

## 5. Deployment Blockers & Serverless Constraints on Vercel

Vercel is an exceptional platform for frontend hosting and serverless micro-APIs. However, direct evaluation against ThulasiConnect's architecture reveals key runtime constraints:

| Component | Vercel Serverless Capability | Technical Constraint / Blocker | Resolution / Alternative |
| :--- | :--- | :--- | :--- |
| **Frontend SPA (Vite/React)** |  **Native Support** | None. Static assets build and serve instantly with global CDN caching. | Deploy to Vercel with SPA rewrites (`/(.*) -> /index.html`). |
| **FastAPI REST Endpoints** | ⚠️ **Partial Support** | Can run via `@vercel/python` serverless functions, but cold starts and connection limits apply. | Deploy to a long-running container service (Render, Railway, Fly.io, or AWS) or serverless with connection pooler. |
| **WebSocket Streaming (`/api/ws/transcription/live`)** | ❌ **Incompatible** | Vercel Serverless Functions do not support persistent stateful WebSockets or long-lived streaming socket connections. | Requires an ASGI server running on a persistent host/container (Render, Railway, AWS ECS, or Fly.io). |
| **Faster-Whisper STT** | ❌ **Incompatible** | Serverless function bundle limits (50–250 MB) and CPU/RAM execution limits make bundled Whisper models (~150 MB binary + CTranslate2) impossible. | Dedicated persistent worker container or cloud inference endpoint (e.g. Groq Whisper / Faster-Whisper microservice). |
| **Local Ollama LLM** | ❌ **Incompatible** | Ollama runs as a standalone daemon requiring persistent background execution and model storage (~1.5 GB). | Managed cloud LLM endpoint (Groq / Together / DeepSeek / OpenAI API compatible) or dedicated GPU/CPU host. |
| **Background Escalation Scheduler** | ❌ **Incompatible** | `EscalationScheduler` uses an ongoing `asyncio` loop running every 60s. Serverless functions terminate when requests end. | Dedicated container service, or Vercel Cron calling `/api/followups/evaluate-escalations` every minute. |
| **PostgreSQL Database** | ❌ **No Native Database** | Vercel does not host persistent PostgreSQL databases directly. | Managed Cloud PostgreSQL (Neon Postgres, Supabase, Render Postgres, or AWS RDS). |

---

## 6. Security & Infrastructure Risks

1. **Database Credentials:** Local development used unauthenticated `postgres@127.0.0.1:5432`. Production requires encrypted SSL connections (`sslmode=require`) and secure secret management.
2. **Audio Privacy Guard:** The system architecture guarantees zero audio recording persistence. This invariant must be preserved across all cloud environments (`AUDIO_STORAGE_ENABLED=false`).
3. **CORS Configuration:** Backend CORS origins currently default to `localhost:5173`. In production, CORS must explicitly whitelist the deployed Vercel domain.
4. **JWT & Secret Keys:** Development defaults (`dev-only-set-in-env`) must be replaced with cryptographically random 256-bit secrets via cloud environment variables.

---

## 7. Recommended Production Hosting Architecture

To ensure a genuinely accessible, multi-device, production-grade deployment without running any processes on the local laptop:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        THULASICONNECT CLOUD PLATFORM                   │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  [User / Reviewer Browsers]                                            │
│            │                                                           │
│            ▼ (HTTPS)                                                   │
│  ┌──────────────────────────────┐                                      │
│  │     VERCEL CLOUD CDN         │ ◄─── Frontend Production Deployment   │
│  │  (React 19 / Vite SPA Build) │      (Custom Domain / vercel.app)     │
│  └──────────────┬───────────────┘                                      │
│                 │                                                      │
│                 │ (REST API & Auth over HTTPS)                         │
│                 ▼                                                      │
│  ┌──────────────────────────────┐                                      │
│  │   MANAGED CLOUD BACKEND      │ ◄─── FastAPI + Uvicorn               │
│  │   (Render / Railway / Cloud) │      (Persistent ASGI Container)     │
│  │                              │      - 58 REST Endpoints             │
│  │                              │      - WebSocket Live Desk           │
│  │                              │      - 60s Escalation Scheduler      │
│  └───────┬──────────────┬───────┘                                      │
│          │              │                                              │
│          │ (SSL)        │ (In-Memory Streaming)                        │
│          ▼              ▼                                              │
│  ┌──────────────┐  ┌──────────────────────────────┐                    │
│  │ MANAGED POSTGRES│ │ CLOUD AI INFERENCE ENGINE    │                  │
│  │ (Neon / Supabase│ │ (Faster-Whisper / Cloud LLM) │                  │
│  │  26 Relational  │ │ - Zero Audio Persistence     │                  │
│  │  Tables + Pool) │ │ - RAM-only Chunk Processing  │                  │
│  └──────────────┘  └──────────────────────────────┘                    │
└────────────────────────────────────────────────────────────────────────┘
```

### Action Plan:
1. **Frontend:** Deploy to Vercel using the official Vercel CLI / Vercel GitHub integration with production environment variables (`VITE_API_BASE_URL`, `VITE_WS_BASE_URL`).
2. **Database:** Provision a managed PostgreSQL instance (e.g., Neon Postgres / Supabase / Render Postgres) and apply Alembic migrations.
3. **Backend:** Deploy the FastAPI container with persistent WebSocket and background scheduler support.
4. **Showcase Fallback Guarantee:** Maintain the high-fidelity mock data fallback inside `api.ts` so that even if network partitions occur or external AI services are unreachable, the entire frontend role journey remains 100% interactive and functional.
