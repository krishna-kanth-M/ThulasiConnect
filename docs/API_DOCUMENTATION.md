# ThulasiConnect — REST & WebSocket API Documentation

Interactive OpenAPI / Swagger documentation is automatically served at `http://127.0.0.1:8000/docs` when the backend is running.

All `/api/*` endpoints (except `/api/health`, `/api/auth/login`, `/api/auth/password-reset/*`) require `Authorization: Bearer <JWT>`.

## Authentication (`/api/auth`)
- `POST /api/auth/login` — Authenticate with email/password, returns JWT and resolved RBAC user profile.
- `POST /api/auth/logout` — Revokes active JWT `jti` immediately and writes audit log.
- `GET /api/auth/me` — Returns current authenticated user, roles, permissions, and allowed branch/zone IDs.
- `POST /api/auth/change-password` — Changes current user's password after verifying current password.
- `POST /api/auth/password-reset/request` — Generates single-use 30-minute reset token.
- `POST /api/auth/password-reset/confirm` — Resets password using valid unused token.

## System Administration & Organization
- `GET /api/users`, `POST /api/users`, `PATCH /api/users/{id}` — User lifecycle, role/branch/zone mapping (`admin:users`).
- `GET /api/roles`, `GET /api/permissions`, `PUT /api/roles/{id}/permissions` — RBAC inspection and management (`admin:roles`).
- `GET /api/zones`, `POST /api/zones`, `PATCH /api/zones/{id}` — Zone directory and configuration.
- `GET /api/branches`, `POST /api/branches`, `PATCH /api/branches/{id}` — Branch directory & branch operational settings.
- `GET /api/employees` — Scoped employee directory.
- `GET /api/audit-logs` — Filterable security and operational audit trail (`admin:audit_logs`).

## Calls, Customers & Live Transcription
- `GET /api/customers`, `POST /api/customers`, `PATCH /api/customers/{id}` — Branch-scoped customer directory.
- `GET /api/call-outcomes` — Active standardized call outcomes.
- `GET /api/calls`, `POST /api/calls`, `GET /api/calls/{id}`, `PATCH /api/calls/{id}` — Scoped call management.
- `POST /api/calls/{id}/transcript` — Persist or update text-only transcript segments (zero audio).
- `GET /api/transcription/status` — Faster-Whisper & Ollama live health plus privacy mode status.
- `POST /api/transcription/extract` — Text-only local Ollama (`qwen2.5:1.5b`) structured requirement extraction.
- `WS /api/ws/transcription/live?token=<JWT>&language=auto|en|ta&sample_rate=16000` — Live in-memory 16 kHz PCM Int16 streaming transcription; buffers are discarded immediately after processing and on disconnect.

## Medicine Requests, Follow-ups & Escalations
- `GET /api/requests`, `POST /api/requests`, `GET /api/requests/{id}`, `PATCH /api/requests/{id}` — Multi-item requests, status transitions (requires `cancellation_reason` on cancel), assignment, and status history.
- `GET /api/followups`, `POST /api/followups`, `PATCH /api/followups/{id}` — Follow-up scheduling and completion.
- `POST /api/followups/evaluate-escalations` — Evaluates overdue follow-ups and creates deduplicated reminders & hierarchical escalations.
- `GET /api/escalations`, `PATCH /api/escalations/{id}` — Supervisory escalation queue.
- `GET /api/settings/escalation-policy`, `PUT /api/settings/escalation-policy` — Configurable escalation thresholds.

## Dashboards, Performance, Notifications, Reports & Integrations
- `GET /api/dashboard/overview?days=30` — Role-adaptive KPIs, 7-day trend, and hierarchical comparisons.
- `GET /api/performance/employees`, `GET /api/performance/branches` — Real operational metrics + transparent calculation formulas.
- `GET /api/notifications`, `GET /api/notifications/unread-count`, `PATCH /api/notifications/{id}/read`, `POST /api/notifications/mark-all-read`.
- `GET /api/reports/{report_type}` & `GET /api/reports/{report_type}/export.csv` — Daily/weekly/monthly calls, branch/employee performance, pending requests, overdue follow-ups, escalations.
- `GET /api/integrations`, `PATCH /api/integrations/{key}`, `POST /api/integrations/shopaid/import-csv`, `GET /api/integrations/shopaid/catalog`.
