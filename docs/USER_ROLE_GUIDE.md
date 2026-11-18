# ThulasiConnect — User Role Guide

ThulasiConnect enforces a **5-role Role-Based Access Control (RBAC)** model backed authoritatively by PostgreSQL (`roles`, `permissions`, `role_permissions`, `user_roles`). Revoking a permission from a role in **Administration → Roles & Permissions** takes effect immediately on both UI and direct API calls.

---

## 1. Pharmacist / Employee (`pharmacist`, Scope: `self`)
- **Primary Pages:** Overview Dashboard, Live Call Desk (`/live-call`), Calls (`/calls`), Customers (`/customers`), Customer Requests (`/requests`), Follow-ups (`/followups`), Employees (self performance), Notifications, Settings.
- **Core Daily Actions:**
  1. Register manual telephone calls or run authorized browser microphone prototype sessions in Live Call Desk (with returning customer autocomplete).
  2. Review/correct text transcripts, run local Ollama extraction, look up ShopAid CSV reference prices, and **explicitly confirm** every medicine item before saving.
  3. Track multi-item medicine requests (including editing items/availability after creation) and complete scheduled customer callbacks with completion notes.
- **Restrictions:** Cannot view other branches or coworkers' calls, cannot trigger organization-wide escalation checks (`403`), cannot view Reports, Branches, Zones, or Administration.

## 2. Branch Manager (`branch_manager`, Scope: `branch`)
- **Primary Pages:** All operational pages + Branches (`/branches`), Reports (`/reports`), and Supervisory Escalations Queue on `/followups`.
- **Core Daily Actions:**
  1. Monitor branch calls, missed/unregistered call indicators, pending requests, and staff workload comparison on the Branch Dashboard.
  2. Reassign medicine requests and follow-ups among branch pharmacists, run manual escalation checks when needed, and acknowledge/resolve Level 1 escalations with documented resolution notes.
  3. Adjust branch operating hours, phone number, and branch-specific overdue escalation threshold on `/branches`, and export branch CSV reports from `/reports`.
- **Restrictions:** Strictly isolated to assigned branch(es) (`403` on other branches); cannot access Zones or System Administration.

## 3. Zonal Manager (`zonal_manager`, Scope: `zone`)
- **Primary Pages:** Zonal Dashboard (`/`), Calls (read-only), Customers (read-only), Customer Requests (read-only), Follow-ups (read-only) & Escalations (manage Level 2), Employees (zone), Branches (zone), Zones (own zone), Reports (zone CSV export), Notifications, Settings.
- **Core Daily Actions:** Compare branch performance inside authorized zone(s), identify underperforming or understaffed branches, acknowledge/resolve Level 2 escalations, and export zonal CSV reports.
- **Restrictions:** Strictly isolated to authorized zone(s) (`403` on unrelated zones); read-only on operational calls/requests/follow-ups; no Administration access.

## 4. Owner (`owner`, Scope: `org`)
- **Primary Pages:** Executive Organization Dashboard (`/`), Calls/Customers/Requests/Follow-ups (read-only), Escalations (manage Level 3), Employees, Branches, Zones, Reports (org-wide CSV export), Notifications, Settings.
- **Core Daily Actions:** Compare all zones and branches company-wide, track registration rates and request fulfillment, resolve critical Level 3 escalations (broadcast to all active Owner accounts), and export organization-wide reports.
- **Restrictions:** Separated from technical System Administration (`admin:*` blocked unless separately assigned `system_admin`).

## 5. System Administrator (`system_admin`, Scope: `org` — Technical Governance)
- **Primary Pages:** Dedicated **System Administration Overview Dashboard** (`/` showing active/inactive users, org staffing warnings, live background scheduler status, PostgreSQL health, and recent audit trail) + **Administration Hub (`/administration`)** + Branches & Zones management.
- **Core Administrative Actions:**
  1. Create and edit user accounts (including multi-role assignment, branch/zone mapping, password reset, and activate/deactivate; self-role changes and self-deactivation are blocked).
  2. Edit authoritative role permissions (`Roles & Permissions` tab — prevents revoking `admin:roles` from `system_admin`).
  3. Create/edit Zones and Branches, assign Zonal/Branch Managers, and monitor staffing integrity warnings.
  4. Configure Integration Adapters, upload validated ShopAid CSV reference snapshots (with failed-row and import-history reporting), adjust global L1/L2/L3 escalation thresholds (`60 / 240 / 1440` min default), and search filterable immutable Audit Logs.
