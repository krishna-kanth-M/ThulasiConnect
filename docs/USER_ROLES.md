# ThulasiConnect — User Roles & Access Control (RBAC)

Permissions and organizational scopes are enforced **server-side** in `backend/app/core/rbac.py` and in every API router query.

## Role Hierarchy & Scope Matrix

| Role (`code`) | Scope Level | Allowed Data Scope | Primary Capabilities | Explicitly Restricted |
|---|---|---|---|---|
| **Pharmacist / Employee** (`pharmacist`) | `self` | Own calls, assigned requests, own follow-ups, own branch customers | Live Call Desk, manual call registration, multi-item requests, follow-ups, personal performance, CSV catalog lookup | Other branches' data, management reports, user/system admin, audit logs |
| **Branch Manager** (`branch_manager`) | `branch` | Assigned branch (`branch_id` / managed branches) | Branch dashboard with employee drilldown, branch calls/requests/follow-ups, assign requests to branch staff, acknowledge/resolve branch escalations, branch reports, branch operational settings | Other branches, zonal/org reports, user/role administration |
| **Zonal Manager** (`zonal_manager`) | `zone` | Assigned zone (`zone_id`) & all branches inside it | Zonal dashboard with branch-level comparison & drilldown, zonal calls/requests/escalations, zonal reports | Unrelated zones/branches, system administration |
| **Owner** (`owner`) | `org` | Organization-wide across all zones & branches | Executive dashboard with zone & branch drilldown, company-wide call/request/escalation analytics, organization reports | System administration (`admin:users`, `admin:roles`, `admin:audit_logs`) unless separately assigned `system_admin` |
| **System Administrator** (`system_admin`) | `org` | Organization-wide system configuration | User account creation/activation/deactivation, role & permission management, branch & zone configuration, escalation policy, integration adapters, audit log review | Separated from operational ownership by distinct role code |

## Initial Development Bootstrap Accounts (Synthetic Test Data Only)
No credentials are hardcoded in production code. Use the documented CLI to bootstrap the initial System Administrator and optional synthetic multi-branch organization:

```powershell
cd "C:\Users\KRISHNA KANTH M\Downloads\ThulasiConnect\backend"
$env:BOOTSTRAP_ADMIN_EMAIL = "admin@thulasipharmacy.local"
$env:BOOTSTRAP_ADMIN_PASSWORD = "<choose-a-strong-password>"
..\.venv\Scripts\python.exe -m app.cli.bootstrap_admin --seed-demo
```

This creates synthetic role accounts (`owner@thulasipharmacy.local`, `zonal.west@thulasipharmacy.local`, `zonal.south@thulasipharmacy.local`, `manager.rspuram@thulasipharmacy.local`, `manager.madurai@thulasipharmacy.local`, `pharmacist.rspuram@thulasipharmacy.local`, `pharmacist.madurai@thulasipharmacy.local`) mapped across 2 synthetic zones and 3 synthetic branches.
