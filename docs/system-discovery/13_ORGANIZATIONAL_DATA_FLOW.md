# 13 — Organizational Hierarchy & Information Data Flow

---

## 1. Actual Organizational Hierarchy Implemented in Code & Live Database

The application implements **two parallel structures** rather than a single linear chain:
1. **Business Supervision Hierarchy:** `Owner → Zonal Manager → Branch Manager → Pharmacist`
2. **Independent Technical Governance Role:** `System Administrator` (governs users, roles, org topology, policies, integrations, and audit logs across the organization, but does **not** participate in operational call handling or escalation resolution).

```mermaid
flowchart TD
    Admin["System Administrator (admin@thulasipharmacy.local)\nTechnical Governance Only: Users, Roles, Org, Policy, Integrations, Audit"]
    Owner["Owner (owner@thulasipharmacy.local)\nOrganization-Wide Executive Visibility & Level 3 Escalations"]

    ZMW["Zonal Manager - West (ZM-W01)\nWest Tamil Nadu Zone (TN-WEST)"]
    ZMS["Zonal Manager - South (ZM-S01)\nSouth Tamil Nadu Zone (TN-SOUTH)"]

    BMR["Branch Manager - RS Puram (BM-RS01)\nManages BOTH RS Puram & Gandhipuram"]
    BMM["Branch Manager - Madurai (BM-MD01)\nManages KK Nagar Madurai"]

    BRSP["Branch: RS Puram (CBE-RSP)\nCoimbatore"]
    BGP["Branch: Gandhipuram (CBE-GP)\nCoimbatore (0 Pharmacists Assigned)"]
    BMDU["Branch: KK Nagar (MDU-KKN)\nMadurai"]

    PHR["Pharmacist - RS Puram (PH-RS01)\nSenior Pharmacist"]
    PHM["Pharmacist - Madurai (PH-MD01)\nPharmacist"]

    Admin -. "Configures Org, Users & Policy" .-> Owner
    Owner --> ZMW
    Owner --> ZMS
    ZMW --> BMR
    ZMS --> BMM
    BMR --> BRSP
    BMR --> BGP
    BMM --> BMDU
    BRSP --> PHR
    BMDU --> PHM
```

---

## 2. Complete Reporting & Information Flow (Pharmacist → Owner)

```mermaid
flowchart LR
    Event["Source Event\n(Customer Phone Inquiry / Callback)"]
    Rec["Source Records Created by Pharmacist\ncalls, call_transcripts,\nmedicine_requests, follow_ups"]
    DB[("PostgreSQL 16\nBranch-Tagged & Employee-Tagged Rows")]
    Calc["Aggregation & Escalation Engine\ndashboard.py / reports.py /\nescalation_service.py"]

    D_P["Pharmacist Dashboard\n(Own Calls, Requests, Overdue FU)"]
    D_BM["Branch Manager Dashboard & Reports\n(Branch KPIs + Employee Comparison + L1 Escalations)"]
    D_ZM["Zonal Manager Dashboard & Reports\n(Zone KPIs + Branch Comparison + L2 Escalations)"]
    D_O["Owner Executive Dashboard & Reports\n(Org KPIs + Zone & Branch Comparison + L3 Escalations)"]

    Dec["Management Decisions\n(Reassign Workload, Resolve Stock Delays,\nAdjust Branch Thresholds, Coach Staff)"]

    Event --> Rec --> DB --> Calc
    Calc --> D_P
    Calc --> D_BM
    Calc --> D_ZM
    Calc --> D_O
    D_BM --> Dec
    D_ZM --> Dec
    D_O --> Dec
```

---

## 3. Who Generates vs. Who Consumes Information

| Information Stream | Primary Generator(s) | Storage Table(s) | Consumed By | Management Decision Enabled |
|---|---|---|---|---|
| Call Intake & Transcripts | Pharmacist, Branch Manager | `calls`, `call_transcripts`, `transcript_segments` | Pharmacist (own), Branch Mgr (branch), Zonal Mgr (zone), Owner & Admin (org) | Audit registration quality, spot missed/unregistered calls, verify inquiry text |
| Multi-Item Medicine Requests | Pharmacist, Branch Manager | `medicine_requests`, `medicine_request_items`, `request_status_history` | All management tiers (scoped) | Track out-of-stock patterns, rebalance pending workload, measure avg resolution time |
| Scheduled Callbacks & Overdue Status | Pharmacist, Branch Manager | `follow_ups` | Pharmacist (own), Branch/Zonal/Owner (scoped) | Prevent forgotten callbacks; enforce SLA completion rates |
| Escalation Alerts (L1 / L2 / L3) | Escalation Engine (triggered on demand) | `escalations`, `notifications` | L1 → Branch Mgr; L2 → Zonal Mgr; L3 → Owner | Rapid supervisory intervention on stalled customer inquiries |
| Employee & Branch Performance Reports | Computed dynamically from DB | Read-only aggregation (`dashboard.py`, `reports.py`) | Branch Mgr (branch), Zonal Mgr (zone), Owner & Admin (org) | Compare branch/staff responsiveness and export CSV summaries |
| Security & Change Audit Trail | All write endpoints + Auth | `audit_logs` | System Administrator only (`admin:audit_logs`) | Forensic accountability for logins, user changes, request updates, and settings |

---

## 4. Direct API Enforcement Verification

Direct HTTP requests bypassing the frontend UI were verified in `tests/test_backend_api.py` and inspected across all 12 routers:
- **Pharmacist:** Direct `GET /api/users`, `GET /api/audit-logs`, `GET /api/reports/daily_calls`, or `GET /api/calls?employee_id=<other>` → **`403 Forbidden`**.
- **Branch Manager (RS Puram):** Direct `GET /api/calls?branch_id=3` or `GET /api/requests?branch_id=3` (Madurai) → **`403 Forbidden`**.
- **Zonal Manager (West):** Direct `GET /api/calls?branch_id=3` (Madurai) → **`403 Forbidden`**.
- **Owner:** Direct `GET /api/users` → **`403 Forbidden`** (unless separately granted `system_admin`).
- **All Roles:** Revoked JWT after `/api/auth/logout` or deactivated `User.is_active = False` → **`401 Unauthorized`**.
