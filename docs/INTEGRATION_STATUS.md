# ThulasiConnect — External & Local Integration Status

> **Standardized Status Labels Used:**
> - `CONNECTED AND TESTED`
> - `CONNECTED BUT NOT VERIFIED`
> - `DEVELOPMENT ONLY`
> - `NOT CONFIGURED`
> - `BLOCKED BY EXTERNAL DEPENDENCY`

---

## Integration Status Matrix

| Integration | Honest Status | Details & Evidence |
|---|---|---|
| **PostgreSQL 16.16 Database (`thulasiconnect_dev`)** | **CONNECTED AND TESTED** | Local portable cluster (`127.0.0.1:5432`), 26 normalized tables managed by Alembic (`cc32ff675d54`), verified via SQLAlchemy + Psycopg3 + Pytest + Playwright. |
| **Local Ollama LLM (`qwen2.5:1.5b`)** | **CONNECTED AND TESTED** | Local HTTP API (`127.0.0.1:11434`), text-only JSON extraction verified with `keep_alive: "2m"` RAM conservation and automatic rule-based fallback. No paid cloud APIs. |
| **Faster-Whisper Speech-to-Text (`base`, CPU INT8 + Silero VAD)** | **DEVELOPMENT ONLY** | Connected to `/api/ws/transcription/live` (in-memory PCM only, zero disk audio), verified via automated WebSocket tests and local scripts; real-world Tamil/Tanglish pharmacy call accuracy requires controlled branch pilot evaluation. |
| **Browser Microphone Audio Capture** | **DEVELOPMENT ONLY** | Working prototype via Web Audio API (`getUserMedia` → 16 kHz Int16 PCM in RAM). Explicitly labeled as a prototype — cannot capture ordinary desk phone calls automatically. |
| **ShopAid Inventory — CSV Reference Fallback** | **CONNECTED AND TESTED** | Read-only UTF-8 CSV upload (`POST /api/integrations/shopaid/import-csv`) with row-level failure reporting, duplicate SKU tracking, import history, and Live Call Desk search (`GET /api/integrations/shopaid/catalog`). Never modifies ShopAid. |
| **ShopAid Inventory — Live Read-Only API** | **BLOCKED BY EXTERNAL DEPENDENCY** | Official ShopAid vendor API documentation, endpoint specification, and read-only credentials have not been provided. No endpoints or live stock values have been invented. |
| **Pharmacy Telephony (PBX / SIP / VoIP / Landline)** | **BLOCKED BY EXTERNAL DEPENDENCY** | Physical pharmacy PBX/SIP trunk or authorized cloud telephony provider is not connected. Adapter config (`telephony_pbx`) is ready to record verified integration settings once hardware/provider details are available. |
| **In-App Notifications & Automated Escalation Scheduler** | **CONNECTED AND TESTED** | Recipient-scoped PostgreSQL notifications with `dedup_key` deduplication, 30-second UI unread badge polling, and 60-second lightweight `asyncio` background escalation scheduler. |
| **External Notification Channels (Email SMTP / SMS / WhatsApp)** | **NOT CONFIGURED** | Integration configuration placeholder (`notification_channels`) tracks honest status; no credentials are configured and no external messages are dispatched. |
