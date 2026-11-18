# 02 — Role & Permission Matrix

> **Verified Sources:** `backend/app/core/rbac.py`, `backend/app/cli/bootstrap_admin.py`, live PostgreSQL tables `roles`, `permissions`, `role_permissions`, `users`, `user_roles`, `employees`, `zones`, `branches`.  
> **Security Note:** No passwords, hashes, or tokens are included.

---

## 1. Role Architecture vs. Bootstrapped Accounts

ThulasiConnect implements **5 canonical system roles** in the `roles` table. No additional roles exist in the codebase or database.

| Role ID | Role Code | Display Name | Hierarchy Level | Resolved Scope (`scope_level`) |
|---:|---|---|---:|---|
| 1 | `pharmacist` | Pharmacist / Employee | 1 | `self` |
| 2 | `branch_manager` | Branch Manager | 2 | `branch` |
| 3 | `zonal_manager` | Zonal Manager | 3 | `zone` |
| 4 | `owner` | Owner | 4 | `org` |
| 5 | `system_admin` | System Administrator | 5 | `org` |

> **Important Nuance on Hierarchy (`System Administrator` vs `Owner`):**  
> Although `system_admin` has `hierarchy_level = 5` and `owner` has `hierarchy_level = 4` in the `roles` table, in `resolve_auth_context()` (`backend/app/core/rbac.py` lines 189–203), `owner` takes precedence as `primary_role` if a user holds both `owner` and `system_admin`. Operationally, `system_admin` is a **separate technical governance role**, NOT a business supervisor above `owner` — e.g., `owner` receives Level 3 business escalations (`escalation_level = 3`), whereas `system_admin` manages user accounts, roles, branches, zones, integrations, escalation policies, and audit logs.

---

## 2. All 8 Bootstrapped Synthetic User Accounts (Live Database Audit)

| User ID | Account Email (Synthetic) | Role Code | Assigned Zone | Assigned Branch(es) (`allowed_branch_ids`) | Employee Code & Designation | Reporting Authority (Data & Escalation Flow) |
|---:|---|---|---|---|---|---|
| 1 | `admin@thulasipharmacy.local` | `system_admin` | All (`org`) | All 3 branches (`1, 2, 3`) | None (no `employees` row) | Independent System Governance |
| 2 | `owner@thulasipharmacy.local` | `owner` | All (`org`) | All 3 branches (`1, 2, 3`) | None (no `employees` row) | Top Business Authority (Receives Level 3 escalations) |
| 3 | `zonal.west@thulasipharmacy.local` | `zonal_manager` | West TN (`1`) | RS Puram (`1`), Gandhipuram (`2`) | `ZM-W01` — Zonal Manager | Reports to Owner; supervises West TN branches |
| 4 | `zonal.south@thulasipharmacy.local` | `zonal_manager` | South TN (`2`) | KK Nagar Madurai (`3`) | `ZM-S01` — Zonal Manager | Reports to Owner; supervises South TN branch |
| 5 | `manager.rspuram@thulasipharmacy.local` | `branch_manager` | West TN (`1`) | **Both** RS Puram (`1`) **and** Gandhipuram (`2`)* | `BM-RS01` — Branch Manager | Reports to Zonal Manager – West |
| 6 | `manager.madurai@thulasipharmacy.local` | `branch_manager` | South TN (`2`) | KK Nagar Madurai (`3`) | `BM-MD01` — Branch Manager | Reports to Zonal Manager – South |
| 7 | `pharmacist.rspuram@thulasipharmacy.local` | `pharmacist` | West TN (`1`) | RS Puram (`1`) | `PH-RS01` — Senior Pharmacist | Reports to Branch Manager – RS Puram |
| 8 | `pharmacist.madurai@thulasipharmacy.local` | `pharmacist` | South TN (`2`) | KK Nagar Madurai (`3`) | `PH-MD01` — Pharmacist | Reports to Branch Manager – Madurai |

> \* **Empirical Database Finding:** In `bootstrap_admin.py` lines 225–226, `manager.rspuram@thulasipharmacy.local` (`user_id=5`) is set as `branch_manager_user_id` on **both** `CBE-RSP` (RS Puram) and `CBE-GP` (Gandhipuram). Because `resolve_auth_context()` unions `user.branch_id` with all branches where `branch_manager_user_id == user.id`, this manager currently supervises two branches, while `CBE-GP` (Gandhipuram) has **0 assigned pharmacists**.

---

## 3. Complete Role-vs-Permission Matrix (`51` Seeded Permissions)

Verified directly from `ROLE_DEFINITIONS` (`backend/app/core/rbac.py`) and `role_permissions` (`81` mappings in PostgreSQL):

| Module | Permission Code | Pharmacist | Branch Mgr | Zonal Mgr | Owner | System Admin |
|---|---|:---:|:---:|:---:|:---:|:---:|
| **Dashboard** | `dashboard:view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Live Call Desk** | `live_call:use` | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Calls** | `calls:read_own` | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Calls** | `calls:read_branch` | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Calls** | `calls:read_zone` | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Calls** | `calls:read_org` | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Calls** | `calls:create` | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Calls** | `calls:update_own` | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Calls** | `calls:update_branch` | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Customers** | `customers:read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Customers** | `customers:write` | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Requests** | `requests:read_own` | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Requests** | `requests:read_branch` | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Requests** | `requests:read_zone` | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Requests** | `requests:read_org` | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Requests** | `requests:create` | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Requests** | `requests:update_own` | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Requests** | `requests:update_branch` | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Requests** | `requests:assign_branch` | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Follow-ups** | `followups:read_own` | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Follow-ups** | `followups:read_branch` | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Follow-ups** | `followups:read_zone` | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Follow-ups** | `followups:read_org` | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Follow-ups** | `followups:create` | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Follow-ups** | `followups:update_own` | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Follow-ups** | `followups:update_branch` | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Escalations** | `escalations:read_branch` | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Escalations** | `escalations:manage_branch` | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Escalations** | `escalations:read_zone` | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Escalations** | `escalations:manage_zone` | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Escalations** | `escalations:read_org` | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Escalations** | `escalations:manage_org` | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Performance** | `performance:read_own` | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Performance** | `performance:read_branch` | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Performance** | `performance:read_zone` | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Performance** | `performance:read_org` | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Organization** | `branches:read` | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Organization** | `branches:manage_settings` | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Organization** | `zones:read` | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Reports** | `reports:branch` | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Reports** | `reports:zone` | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Reports** | `reports:org` | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Notifications** | `notifications:read` | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Integrations** | `integrations:lookup_catalog` | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Admin** | `admin:users` | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Admin** | `admin:roles` | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Admin** | `admin:branches` | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Admin** | `admin:zones` | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Admin** | `admin:settings` | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Admin** | `admin:integrations` | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Admin** | `admin:audit_logs` | ❌ | ❌ | ❌ | ❌ | ✅ |

> **Confirmed RBAC Code Defect Found During Inspection (`backend/app/core/rbac.py:183-186`):**  
> `resolve_auth_context()` loads database `RolePermission` records and then **unconditionally re-adds** all permissions from the hardcoded `ROLE_DEFINITIONS` dictionary. Consequently, if a System Administrator uses `PUT /api/roles/{role_id}/permissions` to *remove* a default permission from a role, it is still granted at runtime. Adding new permissions works, but revoking baseline permissions does not. (Documented in `14_SYSTEM_GAPS_AND_RECOMMENDATIONS.md`.)

---

## 4. Role-by-Role Feature & Navigation Access Matrix

| Sidebar / Route | Pharmacist | Branch Mgr | Zonal Mgr | Owner | System Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| `/` Overview Dashboard | ✅ (Personal) | ✅ (Branch + Staff) | ✅ (Zone + Branches) | ✅ (Org + Zones + Branches) | ✅ (Org + Zones + Branches) |
| `/live-call` Live Call Desk | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/calls` & `/calls/:id` | ✅ (Own, Read/Write) | ✅ (Branch, Read/Write) | ✅ (Zone, Read-Only) | ✅ (Org, Read-Only) | ✅ (Org, Read-Only) |
| `/requests` Customer Requests | ✅ (Own, Read/Write) | ✅ (Branch, Read/Write/Assign) | ✅ (Zone, Read-Only) | ✅ (Org, Read-Only) | ✅ (Org, Read-Only) |
| `/followups` Follow-ups & Escalations | ✅ (Own Follow-ups Only) | ✅ (Branch + Escalations) | ✅ (Zone Read + Escalations Manage) | ✅ (Org Read + Escalations Manage) | ✅ (Org Read + Escalations View) |
| `/employees` Employee Performance | ✅ (Self Only) | ✅ (Branch Staff) | ✅ (Zone Staff) | ✅ (All Staff) | ✅ (All Staff) |
| `/branches` Branches | ❌ (Hidden; API returns own branch) | ✅ (Own Branch + Settings) | ✅ (Zone Branches, Read-Only) | ✅ (All Branches, Read-Only) | ✅ (All Branches + Create/Edit) |
| `/zones` Zones | ❌ | ❌ | ✅ (Own Zone, Read-Only) | ✅ (All Zones, Read-Only) | ✅ (All Zones + Create) |
| `/reports` Reports & CSV Export | ❌ | ✅ (Branch Scope) | ✅ (Zone Scope) | ✅ (Org Scope) | ✅ (Org Scope) |
| `/notifications` Notifications | ✅ (Own Inbox) | ✅ (Own Inbox) | ✅ (Own Inbox) | ✅ (Own Inbox) | ✅ (Own Inbox) |
| `/administration` System Admin | ❌ | ❌ | ❌ | ❌ | ✅ (Full 5 Tabs) |
| `/settings` Settings | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 5. Deep Profile per Role Group

### 5.1 System Administrator (`admin@thulasipharmacy.local`)
- **Job Responsibility:** Technical governance, user provisioning/deactivation, branch/zone topology, escalation timing policy, external integration adapters (ShopAid CSV fallback & Telephony), and audit log compliance review.
- **Decisions Made:** Who can log in, what roles/branches/zones users belong to, global overdue escalation thresholds (minutes), and when to import ShopAid reference CSV exports.
- **Actions on Other Users:** Create accounts, activate/deactivate accounts (self-deactivation blocked), reset user passwords/roles/branches via API (UI currently exposes Create + Activate/Deactivate only).
- **Escalations Handled:** Can view organization-wide escalations (`escalations:read_org`), but intentionally lacks `escalations:manage_org` (cannot resolve business escalations).

### 5.2 Owner (`owner@thulasipharmacy.local`)
- **Job Responsibility:** Executive oversight of call registration discipline, pending customer requests, branch/zone accountability, and unresolved critical escalations across all Thulasi Pharmacy branches.
- **Decisions Made:** Strategic branch/zone interventions, resolving Level 3 critical escalations, reviewing organization-wide CSV reports.
- **Restrictions:** Cannot create/edit calls, requests, follow-ups, users, roles, branches, zones, or read `audit_logs` unless separately assigned `system_admin`.

### 5.3 Zonal Manager — West (`zonal.west@thulasipharmacy.local`) & South (`zonal.south@thulasipharmacy.local`)
- **Job Responsibility:** Regional supervision of assigned branches (`West`: RS Puram + Gandhipuram; `South`: KK Nagar Madurai), comparing branch metrics, monitoring pending requests, and resolving Level 2 escalations.
- **Decisions Made:** Acknowledge/resolve Level 2 (and Level 1) escalations within authorized branches, export zonal performance reports, escalate systemic branch issues to the Owner.
- **Restrictions:** Strict `403 Forbidden` isolation from unrelated zones/branches; cannot register calls, edit medicine requests, or administer user accounts.

### 5.4 Branch Manager — RS Puram (`manager.rspuram@thulasipharmacy.local`) & Madurai (`manager.madurai@thulasipharmacy.local`)
- **Job Responsibility:** Frontline branch supervision — monitoring daily calls, assigning/reassigning medicine requests and follow-ups among branch staff, resolving Level 1 escalations, tuning branch-specific escalation thresholds and operating hours, and backing up the Live Call Desk when needed.
- **Decisions Made:** Workload balancing across branch pharmacists, resolving Level 1 overdue escalations, configuring branch `escalation_overdue_minutes` and operating hours, exporting branch CSV reports.
- **Restrictions:** Cannot access other branches (`403`), cannot change branch zone/manager/active status (`403`), cannot create/deactivate user accounts (`403`).

### 5.5 Pharmacist / Employee — RS Puram (`pharmacist.rspuram@thulasipharmacy.local`) & Madurai (`pharmacist.madurai@thulasipharmacy.local`)
- **Job Responsibility:** Primary customer call handler — answering/registering customer calls, operating the Live Call Desk, verifying AI-suggested medicine inquiries, logging multi-item medicine requests, checking ShopAid CSV reference prices, scheduling and completing customer callbacks.
- **Decisions Made:** Confirming/editing transcribed text, confirming AI medicine suggestions, setting request status/availability/quoted price, scheduling follow-ups, closing calls with standardized outcomes.
- **Restrictions:** Scoped strictly to `self` (`employee_id`) — cannot view coworkers' calls/requests, cannot view management escalations, cannot access Reports, Branches, Zones, or Administration (`403`).
