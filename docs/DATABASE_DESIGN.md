# ThulasiConnect — Database Design

**Engine:** PostgreSQL 16.16 (UTF-8 encoding, `thulasiconnect_dev`)  
**ORM / Migrations:** SQLAlchemy 2.1 + Psycopg 3.3 + Alembic 1.20 (`backend/alembic/versions/cc32ff675d54_initial_schema.py`)

## 1. Entity Inventory (26 Application Tables)

### Organization & Identity (10 tables)
- `zones`: Regional zones (`code`, `name`, `zonal_manager_user_id`, `is_active`)
- `branches`: Pharmacy branches mapped to `zone_id` (`code`, `name`, `city`, `branch_manager_user_id`, `escalation_overdue_minutes`, `operating_hours`)
- `users`: Staff accounts (`email`, `full_name`, `password_hash` [Argon2id], `branch_id`, `zone_id`, `is_active`, `last_login_at`)
- `roles`: Standard roles (`pharmacist`, `branch_manager`, `zonal_manager`, `owner`, `system_admin`) with `hierarchy_level`
- `permissions` & `role_permissions`: Granular permission catalog mapped to roles
- `user_roles`: Many-to-many user-to-role assignments (allows separating `owner` and `system_admin`)
- `employees`: Operational staff profile linked 1:1 to `users` (`employee_code`, `branch_id`, `designation`)
- `password_reset_tokens`: Single-use SHA-256 hashed 30-minute password reset tokens
- `revoked_tokens`: JWT `jti` denylist for immediate logout invalidation

### Operations & Text-Only Transcription (6 tables)
- `customers`: Branch-scoped customer contact records (`full_name`, `phone_number`, `preferred_language`) — deduplicated per `(branch_id, phone_number)`
- `call_outcomes`: Configurable standardized call outcomes (`requires_followup`)
- `calls`: Call register (`call_reference`, `branch_id`, `employee_id`, `customer_id`, `call_direction`, `call_source_type`, `attendance_status`, `registration_status`, `outcome_id`, `summary`, `detected_language`, `started_at`, `ended_at`)
- `call_transcripts`: 1:1 text transcript linked to `calls` (`full_text`, `language_detected`, `model_used`, `review_status`, `ai_extraction_json`)
- `speakers`: Speaker labels per transcript (`Speaker 1`, `Speaker 2`, `Unknown speaker`, `identity_status`)
- `transcript_segments`: Ordered timestamped segments (`sequence_index`, `start_seconds`, `end_seconds`, `text`, `confidence`, `is_edited`)

> **Privacy Verification:** No `BYTEA`, audio file path, or audio URL column exists on any table.

### Customer & Medicine Requests (3 tables)
- `medicine_requests`: Multi-item request header (`request_reference`, `branch_id`, `call_id`, `customer_id`, `assigned_employee_id`, `status`, `priority`, `resolution_details`, `cancellation_reason`, `required_followup_at`, `resolved_at`, `closed_at`)
- `medicine_request_items`: Individual medicines per request (`medicine_name`, `strength`, `dosage_form`, `quantity`, `availability_status`, `price_inquiry`, `quoted_price`, `verification_status`)
- `request_status_history`: Immutable audit history of every status transition (`from_status`, `to_status`, `changed_by_user_id`, `note`, `changed_at`)

### Workflow Automation, Integrations & Governance (7 tables)
- `follow_ups`: Scheduled customer callbacks (`due_at`, `priority`, `status`, `completion_notes`, `reminder_sent_at`)
- `escalations`: Hierarchical overdue escalations (`escalation_level` 1/2/3, `target_role`, `target_user_id`, `status`, `reason`)
- `notifications`: Recipient-scoped alerts with unique `dedup_key` preventing duplicate notifications
- `audit_logs`: Immutable security & operational trail (`actor_user_id`, `actor_email`, `action`, `entity_type`, `entity_id`, `details_json`, `ip_address`, `created_at`)
- `integration_configs`: Adapter configuration & status (`shopaid_inventory`, `telephony_pbx`)
- `shopaid_catalog_items`: Optional read-only CSV reference catalog snapshot
- `app_settings`: Configurable system parameters (e.g., escalation timing thresholds)
