# ThulasiConnect — Official Metric Definitions

> **Verified Against:** `backend/app/routers/dashboard.py` & `backend/app/routers/reports.py` (Post-Prompt 3 Defect Corrections).  
> All metrics are calculated dynamically from PostgreSQL 16 records with zero fabricated or placeholder figures.

---

## 1. Dashboard Overview Metrics (`GET /api/dashboard/overview?days=N`)

| Metric Name | Definition | Exact Formula / Filter | Data Source | Date Range | Exclusions | Role Visibility |
|---|---|---|---|---|---|---|
| **Phone Calls Today** (`calls_today`) | Operational telephone calls logged today (UTC) | `count(calls where call_source_type in ('manual_telephone_call', 'verified_telephony_integration') and started_at >= today_00_00_UTC)` | `calls` | Current UTC day | Excludes `browser_microphone_test` | All 5 roles (scoped) |
| **Mic Tests Today** (`microphone_tests_today`) | Browser microphone prototype sessions today (UTC) | `count(calls where call_source_type == 'browser_microphone_test' and started_at >= today_00_00_UTC)` | `calls` | Current UTC day | Excludes telephone calls | All 5 roles (scoped) |
| **Registered Calls** (`registered_calls`) | Operational telephone calls properly registered or completed | `count(operational_calls where registration_status in ('registered', 'completed'))` | `calls` | Last `N` days (`7`/`30`/`90`) | Excludes `draft`, `unregistered`, and all `browser_microphone_test` | All 5 roles (scoped) |
| **Registration Rate (%)** (`registration_rate_pct`) | Share of operational telephone calls that were registered | `round((registered_calls / telephone_calls_period) * 100, 1)` else `null` | `calls` | Last `N` days | Excludes `browser_microphone_test` | All 5 roles (scoped) |
| **Missed Calls** (`missed_calls`) | Operational calls marked as missed | `count(operational_calls where attendance_status == 'missed')` | `calls` | Last `N` days | Reflects logged entries only while PBX is disconnected | All 5 roles (scoped) |
| **Unregistered Calls** (`unregistered_calls`) | Operational calls marked unregistered | `count(operational_calls where registration_status == 'unregistered' or attendance_status == 'unregistered')` | `calls` | Last `N` days | Excludes `browser_microphone_test` | All 5 roles (scoped) |
| **Pending Requests** (`pending_requests`) | Customer medicine requests awaiting action or completion | `count(medicine_requests where status in ('new', 'in_progress', 'waiting_for_info', 'waiting_for_stock', 'follow_up_required'))` | `medicine_requests` | Last `N` days (`created_at`) | Excludes `resolved`, `closed`, `cancelled` | All 5 roles (scoped) |
| **Overdue Requests** (`overdue_requests`) | Pending requests whose target follow-up time has passed | `count(pending_requests where required_followup_at IS NOT NULL and required_followup_at < now_UTC)` | `medicine_requests` | Last `N` days (`created_at`) | Excludes requests with no target time | All 5 roles (scoped) |
| **Resolved Requests** (`resolved_requests`) | Medicine requests completed in period | `count(medicine_requests where status in ('resolved', 'closed'))` | `medicine_requests` | Last `N` days (`created_at`) | Excludes `cancelled` | All 5 roles (scoped) |
| **Upcoming Follow-ups** (`upcoming_followups`) | Scheduled future customer callbacks | `count(follow_ups where status == 'pending' and due_at >= now_UTC)` | `follow_ups` | All-time active | Excludes completed/cancelled | All 5 roles (scoped) |
| **Overdue Follow-ups** (`overdue_followups`) | Active customer callbacks past due time | `count(follow_ups where status in ('pending', 'overdue') and due_at < now_UTC)` | `follow_ups` | All-time active | Excludes completed/cancelled | All 5 roles (scoped) |
| **Open Escalations** (`open_escalations`) | Unresolved supervisory escalations | `count(escalations where status != 'resolved')` | `escalations` | All-time active | Excludes `resolved` | Branch Mgr, Zonal Mgr, Owner, Admin |

---

## 2. Employee Performance Metrics (`GET /api/performance/employees?days=N`)

| Metric Name | Definition | Exact Formula | Source Table(s) | Exclusions |
|---|---|---|---|---|
| `calls_registered` | Registered operational telephone calls handled by the employee | `count(calls where employee_id == emp.id and call_source_type in ('manual_telephone_call', 'verified_telephony_integration') and registration_status in ('registered', 'completed'))` | `calls` | Excludes `browser_microphone_test`, `draft`, `unregistered` |
| `microphone_test_sessions` | Browser microphone test sessions run by the employee | `count(calls where employee_id == emp.id and call_source_type == 'browser_microphone_test')` | `calls` | Excludes operational telephone calls |
| `requests_created` | Medicine requests actually **created by** the employee *(corrected in Prompt 3)* | `count(medicine_requests where created_by_user_id == emp.user_id and created_at >= date_from)` | `medicine_requests` | Separate from reassignment |
| `requests_assigned` | Medicine requests currently **assigned to** the employee | `count(medicine_requests where assigned_employee_id == emp.id and created_at >= date_from)` | `medicine_requests` | Tracks current ownership |
| `requests_resolved` | Assigned requests resolved or closed | `count(requests_assigned where status in ('resolved', 'closed'))` | `medicine_requests` | Excludes `cancelled` |
| `pending_workload` | Assigned requests still open | `count(requests_assigned where status in OPEN_REQUEST_STATUSES)` | `medicine_requests` | Excludes resolved/closed/cancelled |
| `overdue_followups` | All currently active overdue callbacks assigned to the employee | `count(follow_ups where assigned_employee_id == emp.id and status in ('pending', 'overdue') and due_at < now_UTC)` | `follow_ups` | All-time active backlog (consistent with Dashboard) |
| `avg_resolution_hours` | Mean turnaround time on resolved assigned requests | `mean((resolved_at - created_at) / 3600)` for `resolved_at >= created_at` | `medicine_requests` | `null` when 0 resolved requests |
| `registration_completeness_pct` | Data quality score on registered operational calls | `%` of `calls_registered` having `customer_phone_snapshot` AND `outcome_id` AND (`summary` OR `transcript`) | `calls`, `call_transcripts` | `null` when 0 registered calls |
| `followup_completion_rate_pct` | Share of non-cancelled follow-ups completed in period | `completed_followups / non_cancelled_followups * 100` | `follow_ups` | Excludes `cancelled` follow-ups |

---

## 3. Reconciliation Guarantees

- **Pharmacist Dashboard vs `/api/requests`:** Both query `assigned_employee_id == ctx.employee_id OR created_by_user_id == ctx.user.id`.
- **Branch → Zone → Owner Roll-Up:** Every operational record belongs to exactly one `branch_id`, and every branch belongs to exactly one `zone_id`. Zone totals strictly sum their member branches with zero double counting.
- **Test vs Operational Separation:** Browser microphone tests are never folded into `calls_today`, `registered_calls`, or `registration_rate_pct`.
