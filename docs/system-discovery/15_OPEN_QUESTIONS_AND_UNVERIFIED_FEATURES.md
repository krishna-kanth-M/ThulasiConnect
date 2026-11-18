# 15 — Open Questions & Unverified Features

> Items below could not be confirmed solely from static source code or require explicit business-owner, IT-vendor, or controlled pilot decisions before production rollout.

---

## 1. Business & Operational Questions Requiring Owner Clarification

1. **Multi-Branch Manager Assignment (`CBE-RSP` & `CBE-GP`):** In the current bootstrapped data, `manager.rspuram@thulasipharmacy.local` manages **both** RS Puram and Gandhipuram, and Gandhipuram has no assigned pharmacists. In real Thulasi Pharmacy operations, can one Branch Manager oversee multiple branches, or is it strictly 1 Branch Manager per branch?
2. **Escalation Timing Policy (SLAs):** Are the current default escalation thresholds (**60 min** → Branch Manager, **240 min** → Zonal Manager, **1440 min** → Owner) appropriate for pharmacy medicine inquiries, or should urgent medicine requests escalate faster (e.g., 15–30 min)?
3. **Owner + System Administrator Separation:** Should the Owner hold `owner` only (current default) while a separate IT lead holds `system_admin`, or should the Owner also be granted `system_admin`?
4. **Notification Delivery Channels:** Currently all reminders and escalations are **in-app only**. Do pharmacists and managers require WhatsApp, SMS, email, or desktop push alerts when a callback becomes overdue?
5. **Customer Consent & Data Minimization Policy:** What exact verbal disclosure must pharmacists read before activating live transcription, and how long should text transcripts and customer phone numbers be retained in PostgreSQL before archival/anonymization?
6. **Request Closure Authority:** Should a Pharmacist be allowed to move a request directly to `closed`, or should `resolved → closed` require Branch Manager verification or confirmed customer pickup?
7. **Missed Call Accountability Before PBX Integration:** Until a telephony adapter is connected, should staff manually log missed calls seen on the branch handset caller-ID log, or should `missed_calls` metrics remain hidden until PBX integration is live?
8. **Multi-Branch Stock Transfer Requests:** If Branch A is out of stock on a requested medicine but Branch B in the same zone has it, should ThulasiConnect support inter-branch transfer requests? (Currently all requests stay within a single `branch_id`.)

---

## 2. External Vendor & Technical Questions

9. **ShopAid Inventory Software Integration:**
   - Does Thulasi Pharmacy's installed version of **ShopAid** expose a read-only HTTP/REST API, SQL view, or scheduled CSV export folder?
   - What authentication method, rate limits, and branch-level stock fields are provided?
   - Is real-time stock lookup required per branch, or is a periodic CSV snapshot sufficient for Phase 1 pilot?
10. **Pharmacy Telephone System (PBX / SIP / VoIP):**
    - What phone hardware/provider does each Thulasi Pharmacy branch currently use (analog PSTN landline, mobile SIM, Asterisk/FreePBX IP-PBX, or cloud telephony)?
    - Can the telephony provider deliver authorized call-metadata webhooks (answered/missed/caller ID) and ephemeral audio streams without storing recordings?
11. **Central Server Hosting & Network Topology:**
    - When moving from this local laptop to a central server, will branches connect over HTTPS on the public internet, VPN, or local LAN?
    - Will central-server hardware include a dedicated CPU/GPU node for concurrent branch transcription?

---

## 3. Unverified Features Requiring Controlled Pilot Testing

| Feature / Claim | Current Verification State | What Still Must Be Tested |
|---|---|---|
| **Real-World Tamil, English & Tanglish Accuracy** | Faster-Whisper `base` CPU INT8 verified on synthetic/dev audio only | Authorized pilot calls containing South Indian pharmaceutical brand names (e.g., *Telma, Dolo, Glycomet, Augmentin*), Tamil-English code-switching, and background pharmacy counter noise |
| **Live Browser Microphone Capture Under Sustained Load** | WebSocket protocol & RAM buffer disposal verified via automated tests | 5–10 minute continuous browser microphone sessions in Chrome/Edge on the i3 / 8 GB RAM laptop to measure CPU latency and RAM stability |
| **Local Ollama Extraction Quality on Tanglish** | Verified on short synthetic English/Tanglish sentences | Complex multi-medicine transcripts with ambiguous strengths, dosages, and Tamil colloquial phrasing |
| **Concurrent Multi-User Performance** | Verified sequentially in Pytest & Playwright | 5–10 simultaneous branch users hitting FastAPI + PostgreSQL + Faster-Whisper on target hardware |
| **SMTP / Production Password Reset Delivery** | Verified in `development` mode with `dev_reset_token` | Production `APP_ENV=production` SMTP integration (currently not implemented) |
