# ThulasiConnect — System Architecture

## 1. Architectural Pattern
ThulasiConnect is implemented as a **modular monolith** optimized for low-overhead local execution (Windows 11, Intel Core i3, 8 GB RAM) while preserving clean module boundaries for future central-server deployment.

```text
Browser (React 19 + TypeScript + Vite + Tailwind CSS v4 + TanStack Query)
   │
   ├── HTTPS/HTTP REST (Bearer JWT) ──────────► FastAPI Backend (127.0.0.1:8000)
   │                                              ├── Core: Config, SQLAlchemy, Argon2id/JWT, RBAC Scope Engine, Audit Trail
   │                                              ├── Routers: auth, users, organization, customers, calls, transcription,
   │                                              │            requests, followups, dashboard, notifications, reports, integrations
   │                                              ├── Services:
   │                                              │     ├── TranscriptionService (Faster-Whisper CPU INT8, RAM-only)
   │                                              │     ├── AIExtractionService (Local Ollama Qwen 2.5 1.5B + fallback)
   │                                              │     ├── EscalationService (Deduplicated hierarchical reminders)
   │                                              │     ├── ShopAidAdapter (Read-only, Disconnected + CSV fallback)
   │                                              │     └── TelephonyAdapter (Browser Mic / Manual / Future SIP-PBX)
   │                                              │
   ├── WebSocket (16 kHz PCM Int16 in RAM) ────► /api/ws/transcription/live
   │                                              │
   │                                              ├──► PostgreSQL 16 (127.0.0.1:5432, thulasiconnect_dev, 26 tables)
   │                                              └──► Local Ollama API (127.0.0.1:11434, qwen2.5:1.5b)
```

## 2. Module Boundaries
| Layer | Directory | Responsibility |
|---|---|---|
| Frontend SPA | `frontend/src/` | Role-aware UI, Live Call Desk (Web Audio API 16 kHz PCM capture), TanStack Query state, Recharts dashboards |
| Backend API | `backend/app/` | FastAPI REST & WebSocket endpoints, backend-enforced RBAC, transactional persistence, CSV exports |
| Migrations | `backend/alembic/` | Versioned PostgreSQL DDL schema management |
| Local Models | `ai-services/models/` | Cached Faster-Whisper `base` model (`download_root="ai-services/models"`) |
| Test Suites | `tests/` & `frontend/e2e/` | Preserved microphone/sample scripts, Pytest API/RBAC/AI/WS suite, Playwright Chromium E2E suite |
| Operational Scripts | `scripts/` | Start/stop PostgreSQL 16 portable, start backend/frontend, health check |

## 3. Core Architectural Invariants
1. **Zero Audio Persistence:** Live audio bytes exist strictly in volatile RAM buffers and are cleared immediately upon chunk decode or session stop. No audio columns, disk files, or playback widgets exist.
2. **Backend-Enforced RBAC:** Permissions and organizational scope (`self`, `branch`, `zone`, `org`) are enforced inside SQLAlchemy queries on every API endpoint, not only via UI navigation hiding.
3. **Human-in-the-Loop AI:** Local Ollama extraction suggests medicine items strictly tagged `ai_suggested` or `missing_info`. Employees must explicitly confirm each item before persistence. AI never provides medical advice or prescriptions.
4. **Honest Call-Source Accounting:** `browser_microphone_test`, `manual_telephone_call`, and `verified_telephony_integration` are stored separately so prototype mic tests are never misrepresented as verified telephone call counts.
