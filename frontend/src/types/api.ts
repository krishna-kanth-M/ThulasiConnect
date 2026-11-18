export interface UserSummary {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  must_change_password: boolean;
  roles: string[];
  permissions: string[];
  primary_role: string;
  scope_level: 'self' | 'branch' | 'zone' | 'org';
  branch_id: number | null;
  branch_name: string | null;
  zone_id: number | null;
  zone_name: string | null;
  employee_id: number | null;
  employee_code: string | null;
  allowed_branch_ids: number[];
  allowed_zone_ids: number[];
  last_login_at: string | null;
  created_at: string | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_at: string;
  user: UserSummary;
}

export interface RoleOut {
  id: number;
  code: string;
  name: string;
  description: string | null;
  hierarchy_level: number;
  permissions: string[];
}

export interface PermissionOut {
  id: number;
  code: string;
  module: string;
  description: string | null;
}

export interface ZoneOut {
  id: number;
  code: string;
  name: string;
  region_description: string | null;
  zonal_manager_user_id: number | null;
  zonal_manager_name: string | null;
  branch_count: number;
  is_active: boolean;
  created_at: string;
}

export interface BranchOut {
  id: number;
  zone_id: number;
  zone_name: string | null;
  code: string;
  name: string;
  city: string;
  address: string | null;
  phone_number: string | null;
  branch_manager_user_id: number | null;
  branch_manager_name: string | null;
  escalation_overdue_minutes: number | null;
  operating_hours: string | null;
  employee_count: number;
  pharmacist_count: number;
  warnings: string[];
  is_active: boolean;
  created_at: string;
}

export interface EmployeeOut {
  id: number;
  user_id: number;
  employee_code: string;
  full_name: string;
  email: string;
  phone: string | null;
  designation: string;
  branch_id: number | null;
  branch_name: string | null;
  zone_id: number | null;
  zone_name: string | null;
  roles: string[];
  is_active: boolean;
}

export interface CustomerOut {
  id: number;
  branch_id: number | null;
  full_name: string;
  phone_number: string;
  preferred_language: string;
  notes: string | null;
  call_count: number;
  created_at: string;
}

export interface CallOutcomeOut {
  id: number;
  code: string;
  label: string;
  requires_followup: boolean;
  is_active: boolean;
}

export interface TranscriptSegment {
  id?: number;
  sequence_index: number;
  speaker_label: string;
  start_seconds: number;
  end_seconds: number;
  text: string;
  language: string | null;
  confidence: number | null;
  is_edited: boolean;
}

export interface TranscriptOut {
  id: number;
  call_id: number;
  full_text: string;
  language_detected: string | null;
  model_used: string | null;
  average_confidence: number | null;
  review_status: string;
  ai_extraction_json: string | null;
  segments: TranscriptSegment[];
  updated_at: string;
}

export interface CallOut {
  id: number;
  call_reference: string;
  branch_id: number;
  branch_name: string | null;
  employee_id: number | null;
  employee_name: string | null;
  customer_id: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  call_direction: 'inbound' | 'outbound';
  call_source_type: 'browser_microphone_test' | 'manual_telephone_call' | 'verified_telephony_integration';
  attendance_status: string;
  registration_status: string;
  outcome_id: number | null;
  outcome_code: string | null;
  outcome_label: string | null;
  outcome_notes: string | null;
  summary: string | null;
  detected_language: string | null;
  has_transcript: boolean;
  request_count: number;
  followup_count: number;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface CallDetailOut extends CallOut {
  transcript: TranscriptOut | null;
  request_ids: number[];
  followup_ids: number[];
}

export interface ExtractedMedicineSuggestion {
  medicine_name: string;
  strength: string | null;
  dosage_form: string | null;
  quantity: string | null;
  availability_question: boolean;
  pricing_question: boolean;
  verification_status: 'ai_suggested' | 'missing_info';
  notes: string | null;
}

export interface AIExtractResponse {
  source: string;
  model_used: string;
  disclaimer: string;
  summary_suggestion: string;
  customer_name_mentioned?: string | null;
  urgency_indicator?: string;
  uncertain_fields?: string[];
  medicines: ExtractedMedicineSuggestion[];
  availability_questions: string[];
  pricing_questions: string[];
  missing_information: string[];
  suggested_followup_needed: boolean;
  customer_details_to_confirm: string[];
}

export interface MedicineRequestItem {
  id?: number;
  medicine_name: string;
  strength: string | null;
  dosage_form: string | null;
  quantity: string | null;
  availability_status: 'unknown' | 'available' | 'out_of_stock' | 'order_required' | 'partial';
  price_inquiry: boolean;
  quoted_price: string | null;
  verification_status: 'employee_confirmed' | 'ai_suggested' | 'missing_info';
  notes: string | null;
}

export interface RequestStatusHistoryOut {
  id: number;
  from_status: string | null;
  to_status: string;
  changed_by_user_id: number | null;
  changed_by_name: string | null;
  note: string | null;
  changed_at: string;
}

export interface MedicineRequestOut {
  id: number;
  request_reference: string;
  branch_id: number;
  branch_name: string | null;
  call_id: number | null;
  call_reference: string | null;
  customer_id: number | null;
  customer_name: string;
  customer_phone: string;
  assigned_employee_id: number | null;
  assigned_employee_name: string | null;
  status: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  inquiry_type: string;
  employee_notes: string | null;
  resolution_details: string | null;
  cancellation_reason: string | null;
  required_followup_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  items: MedicineRequestItem[];
  status_history: RequestStatusHistoryOut[];
}

export interface FollowUpOut {
  id: number;
  branch_id: number;
  branch_name: string | null;
  call_id: number | null;
  call_reference: string | null;
  request_id: number | null;
  request_reference: string | null;
  customer_id: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  assigned_employee_id: number;
  assigned_employee_name: string | null;
  title: string;
  notes: string | null;
  due_at: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'overdue' | 'completed' | 'cancelled';
  is_overdue: boolean;
  completion_notes: string | null;
  completed_at: string | null;
  reminder_sent_at: string | null;
  created_at: string;
}

export interface EscalationOut {
  id: number;
  branch_id: number;
  branch_name: string | null;
  follow_up_id: number | null;
  follow_up_title: string | null;
  request_id: number | null;
  call_id: number | null;
  escalation_level: number;
  target_role: string;
  target_user_id: number | null;
  target_user_name: string | null;
  reason: string;
  status: 'open' | 'acknowledged' | 'resolved';
  resolution_notes: string | null;
  triggered_at: string;
  resolved_at: string | null;
}

export interface NotificationOut {
  id: number;
  recipient_user_id: number;
  category: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: number | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface AuditLogOut {
  id: number;
  actor_user_id: number | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
}

export interface IntegrationConfigOut {
  id: number;
  integration_key: string;
  display_name: string;
  status: string;
  mode: string;
  endpoint_url: string | null;
  status_message: string | null;
  config: Record<string, any>;
  last_synced_at: string | null;
  updated_at: string;
}

export interface ShopAidCatalogItemOut {
  id: number;
  sku: string;
  medicine_name: string;
  strength: string | null;
  dosage_form: string | null;
  manufacturer: string | null;
  mrp_price: string | null;
  stock_status_snapshot: string;
  source_label: string;
  imported_at: string;
}

export interface EmployeeMetric {
  employee_id: number;
  employee_code: string;
  full_name: string;
  designation: string;
  branch_id: number | null;
  branch_name: string | null;
  calls_registered: number;
  microphone_test_sessions: number;
  requests_created: number;
  requests_assigned?: number;
  requests_resolved: number;
  pending_workload: number;
  overdue_followups: number;
  avg_resolution_hours: number | null;
  registration_completeness_pct: number | null;
  followup_completion_rate_pct: number | null;
}

export interface BranchMetric {
  branch_id: number;
  branch_code: string;
  branch_name: string;
  city: string;
  zone_id: number;
  zone_name: string | null;
  verified_telephony_calls: number;
  manual_telephone_calls: number;
  microphone_test_sessions: number;
  registered_calls: number;
  missed_calls: number;
  unregistered_calls: number;
  registration_rate_pct: number | null;
  total_requests: number;
  pending_requests: number;
  resolved_requests: number;
  overdue_followups: number;
  open_escalations: number;
}

export interface ZoneMetric {
  zone_id: number;
  zone_code: string;
  zone_name: string;
  branch_count: number;
  telephone_calls: number;
  registered_calls: number;
  registration_rate_pct: number | null;
  pending_requests: number;
  overdue_followups: number;
  open_escalations: number;
}

export interface DashboardOverview {
  view_role: string;
  scope_level: string;
  period_days: number;
  telephony_connected: boolean;
  telephony_note: string;
  kpis: {
    calls_today: number;
    microphone_tests_today?: number;
    telephone_calls_period: number;
    verified_telephony_calls: number;
    microphone_test_sessions: number;
    registered_calls: number;
    missed_calls: number;
    unregistered_calls: number;
    registration_rate_pct: number | null;
    pending_requests: number;
    overdue_requests: number;
    resolved_requests: number;
    upcoming_followups: number;
    overdue_followups: number;
    open_escalations: number;
  };
  trend_7d: Array<{
    date: string;
    telephone_calls: number;
    microphone_tests: number;
    missed_calls: number;
  }>;
  personal_performance: EmployeeMetric | null;
  employee_comparison: EmployeeMetric[];
  branch_comparison: BranchMetric[];
  zone_comparison: ZoneMetric[];
  system_admin_summary?: {
    users_total: number;
    users_active: number;
    users_inactive: number;
    zones_total: number;
    branches_total: number;
    database_healthy: boolean;
    failed_logins_24h: number;
    scheduler: {
      running: boolean;
      interval_seconds: number;
      started_at: string | null;
      last_run_at: string | null;
      last_status: string;
      run_count: number;
      error_count: number;
      last_error: string | null;
    };
    org_warnings: Array<{
      severity: string;
      branch_code: string;
      branch_name: string;
      message: string;
    }>;
    integrations: Array<{
      integration_key: string;
      display_name: string;
      status: string;
      mode: string;
      last_synced_at: string | null;
    }>;
    recent_audit_logs: Array<{
      id: number;
      actor_email: string | null;
      action: string;
      entity_type: string;
      entity_id: string | null;
      created_at: string;
    }>;
  } | null;
  recent_notifications: Array<{
    id: number;
    category: string;
    severity: string;
    title: string;
    message: string;
    created_at: string;
  }>;
}
