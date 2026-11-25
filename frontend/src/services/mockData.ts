/**
 * High-fidelity Showcase Data for ThulasiConnect Public Demonstrations (e.g. Vercel deployments).
 * 
 * Activated automatically when the local/cloud FastAPI backend is unreachable, ensuring
 * that any viewer opening the public link can explore all dashboards, call desks,
 * customer records, follow-ups, and reports with rich, realistic pharmacy operations data.
 */

import type {
  AIExtractResponse,
  AuditLogOut,
  BranchOut,
  CallDetailOut,
  CallOut,
  CallOutcomeOut,
  CustomerOut,
  DashboardOverview,
  EscalationOut,
  FollowUpOut,
  IntegrationConfigOut,
  MedicineRequestOut,
  NotificationOut,
  PermissionOut,
  RoleOut,
  ShopAidCatalogItemOut,
  UserSummary,
  ZoneOut,
} from '../types/api';

export const DEMO_USERS: Record<string, UserSummary> = {
  'admin@thulasipharmacy.local': {
    id: 1,
    email: 'admin@thulasipharmacy.local',
    full_name: 'Dr. S. K. Thulasiraman (Administrator)',
    phone: '+91 94430 11001',
    is_active: true,
    must_change_password: false,
    roles: ['system_admin'],
    permissions: [
      'admin:users',
      'admin:roles',
      'admin:integrations',
      'admin:audit_logs',
      'admin:settings',
      'admin:branches',
      'admin:zones',
      'dashboard:view',
      'customers:read',
      'customers:create',
      'customers:edit',
      'calls:read_org',
      'requests:read_org',
      'followups:read_org',
      'performance:read_org',
      'branches:read',
      'zones:read',
      'reports:org',
      'notifications:read',
    ],
    primary_role: 'system_admin',
    scope_level: 'org',
    branch_id: null,
    branch_name: null,
    zone_id: null,
    zone_name: null,
    employee_id: null,
    employee_code: null,
    allowed_branch_ids: [1, 2, 3],
    allowed_zone_ids: [1, 2],
    last_login_at: new Date().toISOString(),
    created_at: '2026-01-10T08:00:00Z',
  },
  'owner@thulasipharmacy.local': {
    id: 2,
    email: 'owner@thulasipharmacy.local',
    full_name: 'Thulasi Managing Director',
    phone: '+91 94430 11002',
    is_active: true,
    must_change_password: false,
    roles: ['owner'],
    permissions: [
      'dashboard:view',
      'customers:read',
      'calls:read_org',
      'requests:read_org',
      'followups:read_org',
      'performance:read_org',
      'branches:read',
      'zones:read',
      'reports:org',
      'notifications:read',
    ],
    primary_role: 'owner',
    scope_level: 'org',
    branch_id: null,
    branch_name: null,
    zone_id: null,
    zone_name: null,
    employee_id: null,
    employee_code: null,
    allowed_branch_ids: [1, 2, 3],
    allowed_zone_ids: [1, 2],
    last_login_at: new Date().toISOString(),
    created_at: '2026-01-10T08:00:00Z',
  },
  'zonal.west@thulasipharmacy.local': {
    id: 3,
    email: 'zonal.west@thulasipharmacy.local',
    full_name: 'P. Anandhan (West Zone Manager)',
    phone: '+91 94430 11003',
    is_active: true,
    must_change_password: false,
    roles: ['zonal_manager'],
    permissions: [
      'dashboard:view',
      'customers:read',
      'calls:read_zone',
      'requests:read_zone',
      'followups:read_zone',
      'performance:read_zone',
      'branches:read',
      'zones:read',
      'reports:zone',
      'notifications:read',
    ],
    primary_role: 'zonal_manager',
    scope_level: 'zone',
    branch_id: null,
    branch_name: null,
    zone_id: 1,
    zone_name: 'West Tamil Nadu Zone',
    employee_id: 3,
    employee_code: 'EMP-ZM01',
    allowed_branch_ids: [1, 2],
    allowed_zone_ids: [1],
    last_login_at: new Date().toISOString(),
    created_at: '2026-01-10T08:00:00Z',
  },
  'manager.rspuram@thulasipharmacy.local': {
    id: 4,
    email: 'manager.rspuram@thulasipharmacy.local',
    full_name: 'R. Soundararajan (RS Puram Branch Manager)',
    phone: '+91 94430 11004',
    is_active: true,
    must_change_password: false,
    roles: ['branch_manager'],
    permissions: [
      'dashboard:view',
      'customers:read',
      'customers:create',
      'customers:edit',
      'calls:read_branch',
      'calls:create',
      'calls:edit',
      'requests:read_branch',
      'requests:create',
      'requests:edit',
      'followups:read_branch',
      'followups:create',
      'followups:edit',
      'followups:evaluate',
      'performance:read_branch',
      'branches:read',
      'reports:branch',
      'notifications:read',
      'live_call:use',
    ],
    primary_role: 'branch_manager',
    scope_level: 'branch',
    branch_id: 1,
    branch_name: 'Coimbatore - RS Puram (CBE-RSP)',
    zone_id: 1,
    zone_name: 'West Tamil Nadu Zone',
    employee_id: 4,
    employee_code: 'EMP-BM01',
    allowed_branch_ids: [1],
    allowed_zone_ids: [1],
    last_login_at: new Date().toISOString(),
    created_at: '2026-01-10T08:00:00Z',
  },
  'pharmacist.rspuram@thulasipharmacy.local': {
    id: 5,
    email: 'pharmacist.rspuram@thulasipharmacy.local',
    full_name: 'K. Meenakshi (Senior Dispensing Pharmacist)',
    phone: '+91 94430 11005',
    is_active: true,
    must_change_password: false,
    roles: ['pharmacist'],
    permissions: [
      'dashboard:view',
      'live_call:use',
      'customers:read',
      'customers:create',
      'customers:edit',
      'calls:read_own',
      'calls:create',
      'calls:edit',
      'requests:read_own',
      'requests:create',
      'requests:edit',
      'followups:read_own',
      'followups:create',
      'followups:edit',
      'performance:read_own',
      'notifications:read',
      'integrations:lookup_catalog',
    ],
    primary_role: 'pharmacist',
    scope_level: 'self',
    branch_id: 1,
    branch_name: 'Coimbatore - RS Puram (CBE-RSP)',
    zone_id: 1,
    zone_name: 'West Tamil Nadu Zone',
    employee_id: 5,
    employee_code: 'EMP-PH01',
    allowed_branch_ids: [1],
    allowed_zone_ids: [1],
    last_login_at: new Date().toISOString(),
    created_at: '2026-01-10T08:00:00Z',
  },
};

export const MOCK_ZONES: ZoneOut[] = [
  {
    id: 1,
    code: 'TN-WEST',
    name: 'West Tamil Nadu Zone',
    region_description: 'Coimbatore, Tiruppur, Erode, Nilgiris',
    zonal_manager_user_id: 3,
    zonal_manager_name: 'P. Anandhan',
    branch_count: 2,
    is_active: true,
    created_at: '2026-01-10T08:00:00Z',
  },
  {
    id: 2,
    code: 'TN-SOUTH',
    name: 'South Tamil Nadu Zone',
    region_description: 'Madurai, Dindigul, Virudhunagar, Tirunelveli',
    zonal_manager_user_id: 6,
    zonal_manager_name: 'M. Senthil Kumar',
    branch_count: 1,
    is_active: true,
    created_at: '2026-01-10T08:00:00Z',
  },
];

export const MOCK_BRANCHES: BranchOut[] = [
  {
    id: 1,
    zone_id: 1,
    zone_name: 'West Tamil Nadu Zone',
    code: 'CBE-RSP',
    name: 'Coimbatore - RS Puram Main',
    city: 'Coimbatore',
    address: 'No. 142, D.B. Road, R.S. Puram, Coimbatore - 641002',
    phone_number: '0422-2541001',
    branch_manager_user_id: 4,
    branch_manager_name: 'R. Soundararajan',
    escalation_overdue_minutes: 60,
    operating_hours: '07:00 AM - 11:00 PM (All days)',
    employee_count: 4,
    pharmacist_count: 2,
    warnings: [],
    is_active: true,
    created_at: '2026-01-10T08:00:00Z',
  },
  {
    id: 2,
    zone_id: 1,
    zone_name: 'West Tamil Nadu Zone',
    code: 'CBE-GP',
    name: 'Coimbatore - Gandhipuram Central',
    city: 'Coimbatore',
    address: 'No. 88, Cross Cut Road, Gandhipuram, Coimbatore - 641012',
    phone_number: '0422-2541002',
    branch_manager_user_id: 4,
    branch_manager_name: 'R. Soundararajan',
    escalation_overdue_minutes: 60,
    operating_hours: '24 Hours Emergency Service',
    employee_count: 1,
    pharmacist_count: 0,
    warnings: ['Staffing Warning: No active pharmacists assigned to Gandhipuram branch'],
    is_active: true,
    created_at: '2026-01-10T08:00:00Z',
  },
  {
    id: 3,
    zone_id: 2,
    zone_name: 'South Tamil Nadu Zone',
    code: 'MDU-KKN',
    name: 'Madurai - KK Nagar Hub',
    city: 'Madurai',
    address: 'No. 22, 80 Feet Road, K.K. Nagar, Madurai - 625020',
    phone_number: '0452-2541003',
    branch_manager_user_id: 7,
    branch_manager_name: 'V. Ramanathan',
    escalation_overdue_minutes: 60,
    operating_hours: '08:00 AM - 10:30 PM',
    employee_count: 3,
    pharmacist_count: 2,
    warnings: [],
    is_active: true,
    created_at: '2026-01-10T08:00:00Z',
  },
];

export const MOCK_CUSTOMERS: CustomerOut[] = [
  {
    id: 1,
    branch_id: 1,
    full_name: 'Karthik Subramanian',
    phone_number: '9840012345',
    preferred_language: 'ta-en',
    notes: 'Regular diabetic customer. Enquires for senior citizen parents in RS Puram.',
    call_count: 5,
    created_at: '2026-02-01T10:00:00Z',
  },
  {
    id: 2,
    branch_id: 1,
    full_name: 'Lakshmi Narayanan',
    phone_number: '9842245678',
    preferred_language: 'ta-en',
    notes: 'Monthly cardiac prescription customer (Telma 40mg, Atorva 10mg).',
    call_count: 3,
    created_at: '2026-02-05T11:30:00Z',
  },
  {
    id: 3,
    branch_id: 1,
    full_name: 'Murugan Thangavel',
    phone_number: '9443367890',
    preferred_language: 'ta-en',
    notes: 'Inquires about pediatric cough syrups and fever medicine.',
    call_count: 2,
    created_at: '2026-02-10T14:15:00Z',
  },
  {
    id: 4,
    branch_id: 3,
    full_name: 'Anitha Rajendran',
    phone_number: '9894456789',
    preferred_language: 'ta-en',
    notes: 'Frequent WhatsApp inquiry; prefers callback after 5 PM.',
    call_count: 4,
    created_at: '2026-02-12T09:40:00Z',
  },
];

export const MOCK_CALLS: CallOut[] = [
  {
    id: 101,
    call_reference: 'CAL-202602-0101',
    branch_id: 1,
    branch_name: 'Coimbatore - RS Puram Main',
    employee_id: 5,
    employee_name: 'K. Meenakshi',
    customer_id: 1,
    customer_name: 'Karthik Subramanian',
    customer_phone: '9840012345',
    call_direction: 'inbound',
    call_source_type: 'manual_telephone_call',
    attendance_status: 'attended',
    registration_status: 'registered',
    outcome_id: 1,
    outcome_code: 'medicine_inquiry_logged',
    outcome_label: 'Medicine Inquiry Logged',
    outcome_notes: 'Customer asked for Dolo 650mg (2 strips) and Telma 40mg (1 strip).',
    summary: 'Inquired about stock and pricing for paracetamol and telmisartan tablets.',
    detected_language: 'ta-en',
    has_transcript: true,
    request_count: 1,
    followup_count: 1,
    started_at: '2026-02-18T09:30:00Z',
    ended_at: '2026-02-18T09:32:15Z',
    created_at: '2026-02-18T09:32:30Z',
  },
  {
    id: 102,
    call_reference: 'CAL-202602-0102',
    branch_id: 1,
    branch_name: 'Coimbatore - RS Puram Main',
    employee_id: 5,
    employee_name: 'K. Meenakshi',
    customer_id: 2,
    customer_name: 'Lakshmi Narayanan',
    customer_phone: '9842245678',
    call_direction: 'inbound',
    call_source_type: 'manual_telephone_call',
    attendance_status: 'attended',
    registration_status: 'registered',
    outcome_id: 1,
    outcome_code: 'medicine_inquiry_logged',
    outcome_label: 'Medicine Inquiry Logged',
    outcome_notes: 'Checked availability of Augmentin 625 Duo.',
    summary: 'Antibiotic prescription availability and dosage confirmation.',
    detected_language: 'ta-en',
    has_transcript: true,
    request_count: 1,
    followup_count: 1,
    started_at: '2026-02-18T10:15:00Z',
    ended_at: '2026-02-18T10:17:40Z',
    created_at: '2026-02-18T10:18:00Z',
  },
  {
    id: 103,
    call_reference: 'CAL-202602-0103',
    branch_id: 1,
    branch_name: 'Coimbatore - RS Puram Main',
    employee_id: 5,
    employee_name: 'K. Meenakshi',
    customer_id: 3,
    customer_name: 'Murugan Thangavel',
    customer_phone: '9443367890',
    call_direction: 'inbound',
    call_source_type: 'manual_telephone_call',
    attendance_status: 'attended',
    registration_status: 'registered',
    outcome_id: 2,
    outcome_code: 'price_stock_inquiry_completed',
    outcome_label: 'Price & Stock Inquiry Completed',
    outcome_notes: 'Price quoted over call; customer purchasing at store counter.',
    summary: 'Ascoril LS syrup price inquiry. Counter stock verified.',
    detected_language: 'ta-en',
    has_transcript: true,
    request_count: 1,
    followup_count: 0,
    started_at: '2026-02-18T11:00:00Z',
    ended_at: '2026-02-18T11:01:20Z',
    created_at: '2026-02-18T11:01:30Z',
  },
  {
    id: 104,
    call_reference: 'CAL-202602-0104',
    branch_id: 1,
    branch_name: 'Coimbatore - RS Puram Main',
    employee_id: 5,
    employee_name: 'K. Meenakshi',
    customer_id: 1,
    customer_name: 'Karthik Subramanian',
    customer_phone: '9840012345',
    call_direction: 'inbound',
    call_source_type: 'browser_microphone_test',
    attendance_status: 'attended',
    registration_status: 'registered',
    outcome_id: 1,
    outcome_code: 'medicine_inquiry_logged',
    outcome_label: 'Medicine Inquiry Logged',
    outcome_notes: 'Prototype browser microphone speech recognition test.',
    summary: 'Live speech transcription prototype verification session.',
    detected_language: 'en',
    has_transcript: true,
    request_count: 0,
    followup_count: 0,
    started_at: '2026-02-18T11:45:00Z',
    ended_at: '2026-02-18T11:46:10Z',
    created_at: '2026-02-18T11:46:15Z',
  },
];

export const MOCK_CALL_DETAIL: CallDetailOut = {
  ...MOCK_CALLS[0],
  transcript: {
    id: 201,
    call_id: 101,
    full_text:
      'Vanakkam Thulasi Pharmacy, my name is Karthik. Do you have Dolo 650 mg 2 strips, and Telma 40 mg 1 strip in stock? Please call me back in 30 minutes with the price.',
    language_detected: 'ta-en',
    model_used: 'faster-whisper-base-cpu-int8',
    average_confidence: 0.94,
    review_status: 'employee_confirmed',
    ai_extraction_json: null,
    segments: [
      {
        id: 1,
        sequence_index: 0,
        speaker_label: 'Speaker 1',
        start_seconds: 0.0,
        end_seconds: 4.2,
        text: 'Vanakkam Thulasi Pharmacy, my name is Karthik.',
        language: 'ta-en',
        confidence: 0.96,
        is_edited: false,
      },
      {
        id: 2,
        sequence_index: 1,
        speaker_label: 'Speaker 1',
        start_seconds: 4.5,
        end_seconds: 9.8,
        text: 'Do you have Dolo 650 mg 2 strips, and Telma 40 mg 1 strip in stock?',
        language: 'ta-en',
        confidence: 0.93,
        is_edited: false,
      },
      {
        id: 3,
        sequence_index: 2,
        speaker_label: 'Speaker 1',
        start_seconds: 10.1,
        end_seconds: 14.5,
        text: 'Please call me back in 30 minutes with the price.',
        language: 'ta-en',
        confidence: 0.95,
        is_edited: false,
      },
    ],
    updated_at: '2026-02-18T09:33:00Z',
  },
  request_ids: [301],
  followup_ids: [401],
};

export const MOCK_REQUESTS: MedicineRequestOut[] = [
  {
    id: 301,
    request_reference: 'REQ-202602-0301',
    branch_id: 1,
    branch_name: 'Coimbatore - RS Puram Main',
    call_id: 101,
    call_reference: 'CAL-202602-0101',
    customer_id: 1,
    customer_name: 'Karthik Subramanian',
    customer_phone: '9840012345',
    assigned_employee_id: 5,
    assigned_employee_name: 'K. Meenakshi',
    status: 'in_progress',
    priority: 'high',
    inquiry_type: 'medicine_availability',
    employee_notes: 'Checking ShopAid inventory snapshot and counter stock for Dolo and Telma.',
    resolution_details: null,
    cancellation_reason: null,
    required_followup_at: new Date(Date.now() + 3600000).toISOString(),
    resolved_at: null,
    closed_at: null,
    created_at: '2026-02-18T09:33:30Z',
    updated_at: '2026-02-18T09:35:00Z',
    items: [
      {
        id: 501,
        medicine_name: 'Dolo 650',
        strength: '650mg',
        dosage_form: 'tablet',
        quantity: '2 strips (30 tabs)',
        availability_status: 'available',
        price_inquiry: true,
        quoted_price: '₹62.00',
        verification_status: 'employee_confirmed',
        notes: 'In stock at counter B',
      },
      {
        id: 502,
        medicine_name: 'Telma 40',
        strength: '40mg',
        dosage_form: 'tablet',
        quantity: '1 strip (15 tabs)',
        availability_status: 'available',
        price_inquiry: true,
        quoted_price: '₹225.00',
        verification_status: 'employee_confirmed',
        notes: 'Glenmark batch in stock',
      },
    ],
    status_history: [
      {
        id: 1,
        from_status: null,
        to_status: 'pending',
        changed_by_user_id: 5,
        changed_by_name: 'K. Meenakshi',
        note: 'Request registered from inbound telephone call.',
        changed_at: '2026-02-18T09:33:30Z',
      },
      {
        id: 2,
        from_status: 'pending',
        to_status: 'in_progress',
        changed_by_user_id: 5,
        changed_by_name: 'K. Meenakshi',
        note: 'Verified inventory in ShopAid catalog.',
        changed_at: '2026-02-18T09:35:00Z',
      },
    ],
  },
  {
    id: 302,
    request_reference: 'REQ-202602-0302',
    branch_id: 1,
    branch_name: 'Coimbatore - RS Puram Main',
    call_id: 102,
    call_reference: 'CAL-202602-0102',
    customer_id: 2,
    customer_name: 'Lakshmi Narayanan',
    customer_phone: '9842245678',
    assigned_employee_id: 5,
    assigned_employee_name: 'K. Meenakshi',
    status: 'pending',
    priority: 'urgent',
    inquiry_type: 'medicine_availability',
    employee_notes: 'Urgent antibiotic prescription check for Augmentin 625 Duo.',
    resolution_details: null,
    cancellation_reason: null,
    required_followup_at: new Date(Date.now() - 7200000).toISOString(),
    resolved_at: null,
    closed_at: null,
    created_at: '2026-02-18T10:19:00Z',
    updated_at: '2026-02-18T10:19:00Z',
    items: [
      {
        id: 503,
        medicine_name: 'Augmentin 625 Duo',
        strength: '625mg',
        dosage_form: 'tablet',
        quantity: '1 strip (10 tabs)',
        availability_status: 'available',
        price_inquiry: true,
        quoted_price: '₹204.50',
        verification_status: 'employee_confirmed',
        notes: 'Cold storage / dry rack verified',
      },
    ],
    status_history: [
      {
        id: 3,
        from_status: null,
        to_status: 'pending',
        changed_by_user_id: 5,
        changed_by_name: 'K. Meenakshi',
        note: 'Urgent customer callback scheduled.',
        changed_at: '2026-02-18T10:19:00Z',
      },
    ],
  },
];

export const MOCK_FOLLOWUPS: FollowUpOut[] = [
  {
    id: 401,
    branch_id: 1,
    branch_name: 'Coimbatore - RS Puram Main',
    call_id: 101,
    call_reference: 'CAL-202602-0101',
    request_id: 301,
    request_reference: 'REQ-202602-0301',
    customer_id: 1,
    customer_name: 'Karthik Subramanian',
    customer_phone: '9840012345',
    assigned_employee_id: 5,
    assigned_employee_name: 'K. Meenakshi',
    title: 'Customer Price & Ready-for-Pickup Confirmation',
    notes: 'Confirm total price ₹287 and pack medicines for evening pickup.',
    due_at: new Date(Date.now() + 1800000).toISOString(),
    priority: 'high',
    status: 'pending',
    is_overdue: false,
    completion_notes: null,
    completed_at: null,
    reminder_sent_at: null,
    created_at: '2026-02-18T09:33:30Z',
  },
  {
    id: 402,
    branch_id: 1,
    branch_name: 'Coimbatore - RS Puram Main',
    call_id: 102,
    call_reference: 'CAL-202602-0102',
    request_id: 302,
    request_reference: 'REQ-202602-0302',
    customer_id: 2,
    customer_name: 'Lakshmi Narayanan',
    customer_phone: '9842245678',
    assigned_employee_id: 5,
    assigned_employee_name: 'K. Meenakshi',
    title: 'Urgent Callback: Augmentin 625 Duo Dosage',
    notes: 'Customer waiting for confirmation before doctor consultation closes.',
    due_at: new Date(Date.now() - 3600000).toISOString(),
    priority: 'urgent',
    status: 'overdue',
    is_overdue: true,
    completion_notes: null,
    completed_at: null,
    reminder_sent_at: new Date(Date.now() - 3600000).toISOString(),
    created_at: '2026-02-18T10:19:00Z',
  },
];

export const MOCK_ESCALATIONS: EscalationOut[] = [
  {
    id: 601,
    branch_id: 1,
    branch_name: 'Coimbatore - RS Puram Main',
    follow_up_id: 402,
    follow_up_title: 'Urgent Callback: Augmentin 625 Duo Dosage',
    request_id: 302,
    call_id: 102,
    escalation_level: 1,
    target_role: 'branch_manager',
    target_user_id: 4,
    target_user_name: 'R. Soundararajan',
    reason: 'Follow-up task is 60+ minutes overdue past promised customer callback time.',
    status: 'open',
    resolution_notes: null,
    triggered_at: new Date(Date.now() - 1800000).toISOString(),
    resolved_at: null,
  },
];

export const MOCK_DASHBOARD: DashboardOverview = {
  view_role: 'system_admin',
  scope_level: 'org',
  period_days: 7,
  telephony_connected: false,
  telephony_note:
    'Telephony adapter disconnected (physical PBX / cloud SIP trunk pending vendor provisioning). Manual call intake and browser mic prototype active.',
  kpis: {
    calls_today: 14,
    microphone_tests_today: 2,
    telephone_calls_period: 86,
    verified_telephony_calls: 0,
    microphone_test_sessions: 5,
    registered_calls: 86,
    missed_calls: 2,
    unregistered_calls: 0,
    registration_rate_pct: 97.7,
    pending_requests: 6,
    overdue_requests: 2,
    resolved_requests: 78,
    upcoming_followups: 4,
    overdue_followups: 2,
    open_escalations: 1,
  },
  trend_7d: [
    { date: 'Feb 12', telephone_calls: 11, microphone_tests: 0, missed_calls: 0 },
    { date: 'Feb 13', telephone_calls: 14, microphone_tests: 1, missed_calls: 0 },
    { date: 'Feb 14', telephone_calls: 16, microphone_tests: 0, missed_calls: 1 },
    { date: 'Feb 15', telephone_calls: 10, microphone_tests: 0, missed_calls: 0 },
    { date: 'Feb 16', telephone_calls: 12, microphone_tests: 1, missed_calls: 0 },
    { date: 'Feb 17', telephone_calls: 15, microphone_tests: 1, missed_calls: 1 },
    { date: 'Feb 18', telephone_calls: 14, microphone_tests: 2, missed_calls: 0 },
  ],
  personal_performance: {
    employee_id: 5,
    employee_code: 'EMP-PH01',
    full_name: 'K. Meenakshi',
    designation: 'Senior Dispensing Pharmacist',
    branch_id: 1,
    branch_name: 'Coimbatore - RS Puram Main',
    calls_registered: 14,
    microphone_test_sessions: 2,
    requests_created: 12,
    requests_assigned: 12,
    requests_resolved: 10,
    pending_workload: 2,
    overdue_followups: 1,
    avg_resolution_hours: 0.6,
    registration_completeness_pct: 100.0,
    followup_completion_rate_pct: 91.7,
  },
  employee_comparison: [
    {
      employee_id: 5,
      employee_code: 'EMP-PH01',
      full_name: 'K. Meenakshi',
      designation: 'Senior Dispensing Pharmacist',
      branch_id: 1,
      branch_name: 'Coimbatore - RS Puram Main',
      calls_registered: 14,
      microphone_test_sessions: 2,
      requests_created: 12,
      requests_assigned: 12,
      requests_resolved: 10,
      pending_workload: 2,
      overdue_followups: 1,
      avg_resolution_hours: 0.6,
      registration_completeness_pct: 100.0,
      followup_completion_rate_pct: 91.7,
    },
    {
      employee_id: 6,
      employee_code: 'EMP-PH02',
      full_name: 'T. Vignesh',
      designation: 'Junior Pharmacist',
      branch_id: 3,
      branch_name: 'Madurai - KK Nagar Hub',
      calls_registered: 9,
      microphone_test_sessions: 1,
      requests_created: 8,
      requests_assigned: 8,
      requests_resolved: 7,
      pending_workload: 1,
      overdue_followups: 0,
      avg_resolution_hours: 0.8,
      registration_completeness_pct: 100.0,
      followup_completion_rate_pct: 100.0,
    },
  ],
  branch_comparison: [
    {
      branch_id: 1,
      branch_code: 'CBE-RSP',
      branch_name: 'Coimbatore - RS Puram Main',
      city: 'Coimbatore',
      zone_id: 1,
      zone_name: 'West Tamil Nadu Zone',
      verified_telephony_calls: 0,
      manual_telephone_calls: 58,
      microphone_test_sessions: 4,
      registered_calls: 58,
      missed_calls: 1,
      unregistered_calls: 0,
      registration_rate_pct: 98.3,
      total_requests: 52,
      pending_requests: 4,
      resolved_requests: 48,
      overdue_followups: 1,
      open_escalations: 1,
    },
    {
      branch_id: 2,
      branch_code: 'CBE-GP',
      branch_name: 'Coimbatore - Gandhipuram Central',
      city: 'Coimbatore',
      zone_id: 1,
      zone_name: 'West Tamil Nadu Zone',
      verified_telephony_calls: 0,
      manual_telephone_calls: 6,
      microphone_test_sessions: 0,
      registered_calls: 6,
      missed_calls: 1,
      unregistered_calls: 0,
      registration_rate_pct: 85.7,
      total_requests: 4,
      pending_requests: 1,
      resolved_requests: 3,
      overdue_followups: 1,
      open_escalations: 0,
    },
    {
      branch_id: 3,
      branch_code: 'MDU-KKN',
      branch_name: 'Madurai - KK Nagar Hub',
      city: 'Madurai',
      zone_id: 2,
      zone_name: 'South Tamil Nadu Zone',
      verified_telephony_calls: 0,
      manual_telephone_calls: 22,
      microphone_test_sessions: 1,
      registered_calls: 22,
      missed_calls: 0,
      unregistered_calls: 0,
      registration_rate_pct: 100.0,
      total_requests: 20,
      pending_requests: 1,
      resolved_requests: 19,
      overdue_followups: 0,
      open_escalations: 0,
    },
  ],
  zone_comparison: [
    {
      zone_id: 1,
      zone_code: 'TN-WEST',
      zone_name: 'West Tamil Nadu Zone',
      branch_count: 2,
      telephone_calls: 64,
      registered_calls: 64,
      registration_rate_pct: 97.0,
      pending_requests: 5,
      overdue_followups: 2,
      open_escalations: 1,
    },
    {
      zone_id: 2,
      zone_code: 'TN-SOUTH',
      zone_name: 'South Tamil Nadu Zone',
      branch_count: 1,
      telephone_calls: 22,
      registered_calls: 22,
      registration_rate_pct: 100.0,
      pending_requests: 1,
      overdue_followups: 0,
      open_escalations: 0,
    },
  ],
  system_admin_summary: {
    users_total: 8,
    users_active: 8,
    users_inactive: 0,
    zones_total: 2,
    branches_total: 3,
    database_healthy: true,
    failed_logins_24h: 0,
    scheduler: {
      running: true,
      interval_seconds: 60,
      started_at: '2026-02-18T00:00:00Z',
      last_run_at: new Date().toISOString(),
      last_status: 'ok',
      run_count: 742,
      error_count: 0,
      last_error: null,
    },
    org_warnings: [
      {
        severity: 'warning',
        branch_code: 'CBE-GP',
        branch_name: 'Coimbatore - Gandhipuram Central',
        message: 'No active pharmacists assigned to Gandhipuram branch.',
      },
    ],
    integrations: [
      {
        integration_key: 'shopaid_inventory',
        display_name: 'ShopAid Inventory Adapter (Read-Only CSV Fallback)',
        status: 'csv_fallback_only',
        mode: 'csv_fallback',
        last_synced_at: '2026-02-18T08:30:00Z',
      },
      {
        integration_key: 'telephony_pbx',
        display_name: 'Pharmacy Telephony / PBX / SIP Integration',
        status: 'disconnected',
        mode: 'webhook_listener',
        last_synced_at: null,
      },
    ],
    recent_audit_logs: [
      {
        id: 991,
        actor_email: 'admin@thulasipharmacy.local',
        action: 'auth.login_success',
        entity_type: 'user',
        entity_id: '1',
        created_at: new Date(Date.now() - 300000).toISOString(),
      },
    ],
  },
  recent_notifications: [
    {
      id: 801,
      category: 'escalation',
      severity: 'warning',
      title: 'Level 1 Escalation: Urgent Callback Overdue',
      message: 'Follow-up for customer Lakshmi Narayanan is overdue by 60 minutes.',
      created_at: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      id: 802,
      category: 'reminder',
      severity: 'info',
      title: 'Callback Reminder: Karthik Subramanian',
      message: 'Promised customer price confirmation due in 30 minutes.',
      created_at: new Date(Date.now() - 600000).toISOString(),
    },
  ],
};

export const MOCK_NOTIFICATIONS: NotificationOut[] = [
  {
    id: 801,
    recipient_user_id: 1,
    category: 'escalation',
    severity: 'warning',
    title: 'Level 1 Escalation: Urgent Callback Overdue',
    message: 'Follow-up for customer Lakshmi Narayanan (Augmentin 625 Duo) is overdue by 60 minutes.',
    entity_type: 'escalation',
    entity_id: 601,
    is_read: false,
    read_at: null,
    created_at: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: 802,
    recipient_user_id: 1,
    category: 'reminder',
    severity: 'info',
    title: 'Callback Reminder: Karthik Subramanian',
    message: 'Promised customer price confirmation due in 30 minutes.',
    entity_type: 'follow_up',
    entity_id: 401,
    is_read: false,
    read_at: null,
    created_at: new Date(Date.now() - 600000).toISOString(),
  },
  {
    id: 803,
    recipient_user_id: 1,
    category: 'system_alert',
    severity: 'info',
    title: 'System Startup Health Check Verified',
    message: 'All 27 PostgreSQL database tables, Alembic migrations, and background scheduler verified operational.',
    entity_type: 'system',
    entity_id: null,
    is_read: true,
    read_at: new Date(Date.now() - 7200000).toISOString(),
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
];

export const MOCK_SHOPAID_CATALOG: ShopAidCatalogItemOut[] = [
  {
    id: 1,
    sku: 'SHP-DOL-650',
    medicine_name: 'Dolo 650',
    strength: '650mg',
    dosage_form: 'Tablet',
    manufacturer: 'Micro Labs Ltd',
    mrp_price: '31.25',
    stock_status_snapshot: 'in_stock',
    source_label: 'CSV Reference Snapshot',
    imported_at: '2026-02-18T08:30:00Z',
  },
  {
    id: 2,
    sku: 'SHP-TEL-040',
    medicine_name: 'Telma 40',
    strength: '40mg',
    dosage_form: 'Tablet',
    manufacturer: 'Glenmark Pharmaceuticals',
    mrp_price: '225.00',
    stock_status_snapshot: 'in_stock',
    source_label: 'CSV Reference Snapshot',
    imported_at: '2026-02-18T08:30:00Z',
  },
  {
    id: 3,
    sku: 'SHP-AUG-625',
    medicine_name: 'Augmentin 625 Duo',
    strength: '625mg',
    dosage_form: 'Tablet',
    manufacturer: 'GlaxoSmithKline',
    mrp_price: '204.50',
    stock_status_snapshot: 'low_stock',
    source_label: 'CSV Reference Snapshot',
    imported_at: '2026-02-18T08:30:00Z',
  },
  {
    id: 4,
    sku: 'SHP-PAN-040',
    medicine_name: 'Pan 40',
    strength: '40mg',
    dosage_form: 'Tablet',
    manufacturer: 'Alkem Laboratories',
    mrp_price: '155.00',
    stock_status_snapshot: 'in_stock',
    source_label: 'CSV Reference Snapshot',
    imported_at: '2026-02-18T08:30:00Z',
  },
];

export const MOCK_CALL_OUTCOMES: CallOutcomeOut[] = [
  { id: 1, code: 'medicine_inquiry_logged', label: 'Medicine Inquiry Logged', requires_followup: true, is_active: true },
  { id: 2, code: 'price_stock_inquiry_completed', label: 'Price & Stock Inquiry Completed', requires_followup: false, is_active: true },
  { id: 3, code: 'home_delivery_order_placed', label: 'Home Delivery Order Placed', requires_followup: true, is_active: true },
  { id: 4, code: 'prescription_upload_requested', label: 'Prescription Upload Requested', requires_followup: true, is_active: true },
  { id: 5, code: 'missed_call_callback_pending', label: 'Missed Call Callback Pending', requires_followup: true, is_active: true },
  { id: 6, code: 'general_pharmacy_inquiry', label: 'General Pharmacy Inquiry', requires_followup: false, is_active: true },
];

export const MOCK_ROLES: RoleOut[] = [
  { id: 1, code: 'system_admin', name: 'System Administrator', description: 'Complete system maintenance, user provisioning, and RBAC governance', hierarchy_level: 100, permissions: ['admin:users', 'admin:roles', 'admin:integrations', 'admin:audit_logs', 'admin:settings', 'dashboard:view'] },
  { id: 2, code: 'owner', name: 'Pharmacy Owner / Director', description: 'Executive oversight across all zones and branches with aggregated metrics', hierarchy_level: 80, permissions: ['dashboard:view', 'reports:org', 'calls:read_org', 'requests:read_org', 'followups:read_org', 'performance:read_org', 'branches:read', 'zones:read'] },
  { id: 3, code: 'zonal_manager', name: 'Zonal Manager', description: 'Supervises branch performance, compliance, and escalations within assigned zone', hierarchy_level: 60, permissions: ['dashboard:view', 'reports:zone', 'calls:read_zone', 'requests:read_zone', 'followups:read_zone', 'performance:read_zone', 'branches:read', 'zones:read'] },
  { id: 4, code: 'branch_manager', name: 'Branch Manager', description: 'Operational branch management, staff performance, and L1 escalation resolution', hierarchy_level: 40, permissions: ['dashboard:view', 'reports:branch', 'calls:read_branch', 'calls:create', 'calls:edit', 'requests:read_branch', 'requests:create', 'requests:edit', 'followups:read_branch', 'followups:create', 'followups:edit', 'followups:evaluate', 'performance:read_branch', 'live_call:use'] },
  { id: 5, code: 'pharmacist', name: 'Pharmacist / Telephony Operator', description: 'Direct call attendance, speech transcription, medicine request registration, and callbacks', hierarchy_level: 20, permissions: ['dashboard:view', 'live_call:use', 'customers:read', 'customers:create', 'customers:edit', 'calls:read_own', 'calls:create', 'calls:edit', 'requests:read_own', 'requests:create', 'requests:edit', 'followups:read_own', 'followups:create', 'followups:edit', 'performance:read_own', 'integrations:lookup_catalog'] },
];

export const MOCK_PERMISSIONS: PermissionOut[] = [
  { id: 1, code: 'dashboard:view', module: 'dashboard', description: 'View role-specific overview dashboard' },
  { id: 2, code: 'live_call:use', module: 'live_call', description: 'Use live call intake and speech transcription desk' },
  { id: 3, code: 'customers:read', module: 'customers', description: 'Search and view customer profiles' },
  { id: 4, code: 'customers:create', module: 'customers', description: 'Register new customers' },
  { id: 5, code: 'calls:read_own', module: 'calls', description: 'View own registered calls' },
  { id: 6, code: 'calls:read_branch', module: 'calls', description: 'View calls within managed branch' },
  { id: 7, code: 'calls:read_zone', module: 'calls', description: 'View calls within assigned zone' },
  { id: 8, code: 'calls:read_org', module: 'calls', description: 'View calls organization-wide' },
  { id: 9, code: 'requests:read_branch', module: 'requests', description: 'View requests within branch' },
  { id: 10, code: 'requests:create', module: 'requests', description: 'Create medicine requests' },
  { id: 11, code: 'followups:evaluate', module: 'followups', description: 'Trigger manual escalation evaluations' },
  { id: 12, code: 'admin:users', module: 'admin', description: 'Manage employee and user accounts' },
  { id: 13, code: 'admin:roles', module: 'admin', description: 'Edit roles and permissions' },
  { id: 14, code: 'admin:integrations', module: 'admin', description: 'Configure external adapters and CSV fallbacks' },
  { id: 15, code: 'admin:audit_logs', module: 'admin', description: 'View system audit trails' },
];

export const MOCK_INTEGRATIONS: IntegrationConfigOut[] = [
  {
    id: 1,
    integration_key: 'shopaid_inventory',
    display_name: 'ShopAid Inventory Adapter (Read-Only CSV Fallback)',
    status: 'csv_fallback_only',
    mode: 'csv_fallback',
    endpoint_url: null,
    status_message: 'CSV Fallback Active: 4 reference medicines loaded. Live vendor API blocked pending credentials.',
    config: { read_only_enforced: true, write_operations_allowed: false },
    last_synced_at: '2026-02-18T08:30:00Z',
    updated_at: '2026-02-18T08:30:00Z',
  },
  {
    id: 2,
    integration_key: 'telephony_pbx',
    display_name: 'Pharmacy Telephony / PBX / SIP Integration',
    status: 'disconnected',
    mode: 'webhook_listener',
    endpoint_url: null,
    status_message: 'Telephony adapter disconnected. Inbound calls are logged manually or via browser mic prototype.',
    config: { auto_record: false, storage_disabled: true },
    last_synced_at: null,
    updated_at: '2026-02-18T08:30:00Z',
  },
  {
    id: 3,
    integration_key: 'notification_channels',
    display_name: 'Notification Delivery Channels (In-App / Email / SMS / WhatsApp)',
    status: 'disconnected',
    mode: 'read_only',
    endpoint_url: null,
    status_message: 'In-app notifications active. External SMTP, SMS, and WhatsApp require credentials.',
    config: { in_app: 'CONNECTED', email_smtp: 'NOT CONFIGURED', sms_gateway: 'NOT CONFIGURED', whatsapp_business: 'NOT CONFIGURED' },
    last_synced_at: null,
    updated_at: '2026-02-18T08:30:00Z',
  },
];

export const MOCK_AUDIT_LOGS: AuditLogOut[] = [
  {
    id: 101,
    actor_user_id: 1,
    actor_email: 'admin@thulasipharmacy.local',
    action: 'auth.login_success',
    entity_type: 'user',
    entity_id: '1',
    details: { method: 'password', ip: '127.0.0.1' },
    ip_address: '127.0.0.1',
    created_at: new Date(Date.now() - 900000).toISOString(),
  },
  {
    id: 102,
    actor_user_id: 5,
    actor_email: 'pharmacist.rspuram@thulasipharmacy.local',
    action: 'call.registered',
    entity_type: 'call',
    entity_id: '101',
    details: { call_reference: 'CAL-202602-0101', customer_phone: '9840012345' },
    ip_address: '127.0.0.1',
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 103,
    actor_user_id: 4,
    actor_email: 'manager.rspuram@thulasipharmacy.local',
    action: 'escalation.evaluated',
    entity_type: 'escalation',
    entity_id: '601',
    details: { level: 1, target: 'branch_manager' },
    ip_address: '127.0.0.1',
    created_at: new Date(Date.now() - 1800000).toISOString(),
  },
];

export const MOCK_SYSTEM_HEALTH = {
  checked_at: new Date().toISOString(),
  summary: {
    total: 10,
    connected_and_verified: 7,
    partial: 2,
    disconnected_or_not_configured: 0,
    blocked: 1,
    failed: 0,
  },
  components: [
    {
      key: 'backend',
      name: 'Backend API (FastAPI / Uvicorn)',
      status: 'CONNECTED AND VERIFIED' as const,
      connection: 'Connected',
      latency_ms: 0.1,
      checked_at: new Date().toISOString(),
      last_successful_check: new Date().toISOString(),
      last_error: null,
      details: { app_name: 'ThulasiConnect', environment: 'production-showcase', python_version: '3.13.7', audio_storage_enabled: false },
    },
    {
      key: 'database',
      name: 'PostgreSQL Database',
      status: 'CONNECTED AND VERIFIED' as const,
      connection: 'Connected',
      latency_ms: 4.2,
      checked_at: new Date().toISOString(),
      last_successful_check: new Date().toISOString(),
      last_error: null,
      details: { server_version: '16.16', alembic_revision: 'cc32ff675d54', public_tables: 27 },
    },
    {
      key: 'ollama',
      name: 'Local Ollama Service',
      status: 'CONNECTED AND VERIFIED' as const,
      connection: 'Connected',
      latency_ms: 480.0,
      checked_at: new Date().toISOString(),
      last_successful_check: new Date().toISOString(),
      last_error: null,
      details: { version: '0.40.16', endpoint: 'http://127.0.0.1:11434', installed_models: ['qwen2.5:1.5b'] },
    },
    {
      key: 'ai_model',
      name: 'AI Model (qwen2.5:1.5b)',
      status: 'CONNECTED AND VERIFIED' as const,
      connection: 'Connected',
      latency_ms: 1200.0,
      checked_at: new Date().toISOString(),
      last_successful_check: new Date().toISOString(),
      last_error: null,
      details: { configured_model: 'qwen2.5:1.5b', model_present: true, live_inference_ok: true },
    },
    {
      key: 'faster_whisper',
      name: 'Faster-Whisper Speech-to-Text',
      status: 'CONNECTED AND VERIFIED' as const,
      connection: 'Connected',
      latency_ms: null,
      checked_at: new Date().toISOString(),
      last_successful_check: new Date().toISOString(),
      last_error: null,
      details: { model_size: 'base', device: 'cpu', compute_type: 'int8', vad_filter: true, audio_storage_enabled: false },
    },
    {
      key: 'websocket',
      name: 'Live Transcription WebSocket',
      status: 'CONNECTED AND VERIFIED' as const,
      connection: 'Connected',
      latency_ms: null,
      checked_at: new Date().toISOString(),
      last_successful_check: new Date().toISOString(),
      last_error: null,
      details: { path: '/api/ws/transcription/live', auth_required: true, buffer_mode: 'in_memory_ephemeral_only' },
    },
    {
      key: 'scheduler',
      name: 'Automated Escalation Scheduler',
      status: 'CONNECTED AND VERIFIED' as const,
      connection: 'Connected',
      latency_ms: null,
      checked_at: new Date().toISOString(),
      last_successful_check: new Date().toISOString(),
      last_error: null,
      details: { running: true, interval_seconds: 60, run_count: 742, error_count: 0 },
    },
    {
      key: 'notifications',
      name: 'Notification Delivery Services',
      status: 'CONNECTED BUT NOT FULLY VERIFIED' as const,
      connection: 'Connected',
      latency_ms: null,
      checked_at: new Date().toISOString(),
      last_successful_check: new Date().toISOString(),
      last_error: 'External channels (Email/SMS/WhatsApp) are NOT CONFIGURED; in-app delivery is operational.',
      details: { in_app: 'CONNECTED AND VERIFIED', email_smtp: 'NOT CONFIGURED', sms_gateway: 'NOT CONFIGURED', whatsapp_business: 'NOT CONFIGURED' },
    },
    {
      key: 'shopaid',
      name: 'ShopAid Inventory Integration',
      status: 'CONNECTED BUT NOT FULLY VERIFIED' as const,
      connection: 'Connected',
      latency_ms: null,
      checked_at: new Date().toISOString(),
      last_successful_check: new Date().toISOString(),
      last_error: 'Live ShopAid API is blocked pending official vendor API documentation and read-only credentials.',
      details: { live_api: 'BLOCKED BY EXTERNAL DEPENDENCY', csv_fallback: 'CONNECTED AND VERIFIED', csv_reference_items: 4 },
    },
    {
      key: 'telephony',
      name: 'Telephony / PBX / SIP Integration',
      status: 'BLOCKED BY EXTERNAL DEPENDENCY' as const,
      connection: 'Disconnected',
      latency_ms: null,
      checked_at: new Date().toISOString(),
      last_successful_check: null,
      last_error: 'No physical PBX, SIP trunk, or authorized cloud telephony provider is connected.',
      details: { adapter_status: 'disconnected', mode: 'webhook_listener', browser_mic_prototype: 'CONNECTED AND VERIFIED' },
    },
  ],
};

/**
 * Dispatches mock responses for all ThulasiConnect REST endpoints when the backend is unreachable.
 */
export function getMockResponse<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): T | undefined {
  const method = (options.method || 'GET').toUpperCase();
  const cleanPath = path.split('?')[0];

  // SECURITY GUARD: Mock authentication is strictly disabled in all environments.
  // Authentication must always be verified by the live backend database.
  if (cleanPath.startsWith('/api/auth/')) {
    return undefined;
  }

  // SECURITY GUARD: In production builds, mock data fallbacks are completely disabled.
  if (import.meta.env.PROD || import.meta.env.VITE_ENABLE_DEV_MOCK_FALLBACK !== 'true') {
    return undefined;
  }

  // 2. Dashboard
  if (cleanPath === '/api/dashboard/overview') {
    return MOCK_DASHBOARD as T;
  }

  // 3. Calls
  if (cleanPath === '/api/calls' && method === 'GET') {
    return MOCK_CALLS as T;
  }

  if (cleanPath.startsWith('/api/calls/') && cleanPath.endsWith('/transcript')) {
    return { message: 'Transcript recorded successfully', segments: MOCK_CALL_DETAIL.transcript?.segments || [] } as T;
  }

  if (cleanPath.startsWith('/api/calls/') && method === 'GET') {
    return MOCK_CALL_DETAIL as T;
  }

  if (cleanPath === '/api/calls' && method === 'POST') {
    const body = (options.body as Record<string, any>) || {};
    const newCall: CallOut = {
      id: Date.now(),
      call_reference: `CAL-${Date.now().toString().slice(-6)}`,
      branch_id: body.branch_id || 1,
      branch_name: 'Coimbatore - RS Puram Main',
      employee_id: 5,
      employee_name: 'K. Meenakshi',
      customer_id: body.customer_id || 1,
      customer_name: body.customer_name || 'Walk-in Customer',
      customer_phone: body.customer_phone || '9840000000',
      call_direction: body.call_direction || 'inbound',
      call_source_type: body.call_source_type || 'manual_telephone_call',
      attendance_status: 'attended',
      registration_status: 'registered',
      outcome_id: 1,
      outcome_code: body.outcome_code || 'medicine_inquiry_logged',
      outcome_label: 'Medicine Inquiry Logged',
      outcome_notes: body.notes || 'Logged via ThulasiConnect showcase.',
      summary: body.summary || 'Customer medicine inquiry.',
      detected_language: 'ta-en',
      has_transcript: Boolean(body.transcript_text),
      request_count: 1,
      followup_count: 0,
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    return newCall as T;
  }

  if (cleanPath === '/api/calls/outcomes') {
    return MOCK_CALL_OUTCOMES as T;
  }

  // 4. Customers
  if (cleanPath === '/api/customers' && method === 'GET') {
    return MOCK_CUSTOMERS as T;
  }

  if (cleanPath === '/api/customers' && method === 'POST') {
    const body = (options.body as Record<string, any>) || {};
    const newCust: CustomerOut = {
      id: Date.now(),
      branch_id: 1,
      full_name: body.full_name || 'New Customer',
      phone_number: body.phone_number || '9000000000',
      preferred_language: body.preferred_language || 'ta-en',
      notes: body.notes || null,
      call_count: 1,
      created_at: new Date().toISOString(),
    };
    return newCust as T;
  }

  if (cleanPath.startsWith('/api/customers/') && method === 'PATCH') {
    const body = (options.body as Record<string, any>) || {};
    return { ...MOCK_CUSTOMERS[0], ...body } as T;
  }

  // 5. Medicine Requests
  if (cleanPath === '/api/requests' && method === 'GET') {
    return MOCK_REQUESTS as T;
  }

  if (cleanPath === '/api/requests' && method === 'POST') {
    const body = (options.body as Record<string, any>) || {};
    const newReq: MedicineRequestOut = {
      id: Date.now(),
      request_reference: `REQ-${Date.now().toString().slice(-6)}`,
      branch_id: body.branch_id || 1,
      branch_name: 'Coimbatore - RS Puram Main',
      call_id: body.call_id || 101,
      call_reference: 'CAL-202602-0101',
      customer_id: body.customer_id || 1,
      customer_name: body.customer_name || 'Karthik Subramanian',
      customer_phone: body.customer_phone || '9840012345',
      assigned_employee_id: 5,
      assigned_employee_name: 'K. Meenakshi',
      status: 'pending',
      priority: body.priority || 'normal',
      inquiry_type: 'medicine_availability',
      employee_notes: body.employee_notes || null,
      resolution_details: null,
      cancellation_reason: null,
      required_followup_at: body.required_followup_at || null,
      resolved_at: null,
      closed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: body.items || [
        {
          id: Date.now(),
          medicine_name: 'Dolo 650',
          strength: '650mg',
          dosage_form: 'tablet',
          quantity: '2 strips',
          availability_status: 'available',
          price_inquiry: true,
          quoted_price: '₹62.00',
          verification_status: 'employee_confirmed',
          notes: null,
        },
      ],
      status_history: [
        {
          id: 1,
          from_status: null,
          to_status: 'pending',
          changed_by_user_id: 5,
          changed_by_name: 'K. Meenakshi',
          note: 'Request registered via ThulasiConnect showcase.',
          changed_at: new Date().toISOString(),
        },
      ],
    };
    return newReq as T;
  }

  if (cleanPath.startsWith('/api/requests/') && method === 'PATCH') {
    const body = (options.body as Record<string, any>) || {};
    return { ...MOCK_REQUESTS[0], ...body } as T;
  }

  // 6. Follow-ups & Escalations
  if (cleanPath === '/api/followups' && method === 'GET') {
    return MOCK_FOLLOWUPS as T;
  }

  if (cleanPath === '/api/followups' && method === 'POST') {
    const body = (options.body as Record<string, any>) || {};
    const newFu: FollowUpOut = {
      id: Date.now(),
      branch_id: 1,
      branch_name: 'Coimbatore - RS Puram Main',
      call_id: body.call_id || 101,
      call_reference: 'CAL-202602-0101',
      request_id: body.request_id || 301,
      request_reference: 'REQ-202602-0301',
      customer_id: 1,
      customer_name: 'Karthik Subramanian',
      customer_phone: '9840012345',
      assigned_employee_id: 5,
      assigned_employee_name: 'K. Meenakshi',
      title: body.title || 'Scheduled Customer Callback',
      notes: body.notes || null,
      due_at: body.due_at || new Date(Date.now() + 3600000).toISOString(),
      priority: body.priority || 'normal',
      status: 'pending',
      is_overdue: false,
      completion_notes: null,
      completed_at: null,
      reminder_sent_at: null,
      created_at: new Date().toISOString(),
    };
    return newFu as T;
  }

  if (cleanPath.startsWith('/api/followups/') && method === 'PATCH') {
    const body = (options.body as Record<string, any>) || {};
    return { ...MOCK_FOLLOWUPS[0], ...body } as T;
  }

  if (cleanPath === '/api/followups/evaluate-escalations') {
    return {
      evaluated_overdue: 2,
      newly_marked_overdue: 1,
      reminders_created: 1,
      escalations_created: 1,
      notifications_created: 2,
      config_warnings_created: 0,
    } as T;
  }

  if (cleanPath === '/api/escalations') {
    return MOCK_ESCALATIONS as T;
  }

  // 7. Organization
  if (cleanPath === '/api/branches') {
    return MOCK_BRANCHES as T;
  }

  if (cleanPath === '/api/branches/metrics') {
    return MOCK_DASHBOARD.branch_comparison as T;
  }

  if (cleanPath === '/api/zones') {
    return MOCK_ZONES as T;
  }

  if (cleanPath === '/api/zones/metrics') {
    return MOCK_DASHBOARD.zone_comparison as T;
  }

  if (cleanPath === '/api/employees') {
    return MOCK_DASHBOARD.employee_comparison.map((e) => ({
      id: e.employee_id,
      user_id: e.employee_id,
      employee_code: e.employee_code,
      full_name: e.full_name,
      email: `${e.employee_code.toLowerCase()}@thulasipharmacy.local`,
      phone: '+91 94430 00000',
      designation: e.designation,
      branch_id: e.branch_id,
      branch_name: e.branch_name,
      zone_id: 1,
      zone_name: 'West Tamil Nadu Zone',
      roles: ['pharmacist'],
      is_active: true,
    })) as T;
  }

  if (cleanPath === '/api/performance/employees') {
    return { employees: MOCK_DASHBOARD.employee_comparison } as T;
  }

  // 8. Notifications
  if (cleanPath === '/api/notifications' && method === 'GET') {
    return MOCK_NOTIFICATIONS as T;
  }

  if (cleanPath === '/api/notifications/unread-count') {
    return { unread_count: MOCK_NOTIFICATIONS.filter((n) => !n.is_read).length } as T;
  }

  if (cleanPath.includes('/api/notifications/') && cleanPath.endsWith('/read')) {
    return { ...MOCK_NOTIFICATIONS[0], is_read: true, read_at: new Date().toISOString() } as T;
  }

  // 9. Administration & Settings
  if (cleanPath === '/api/users' || cleanPath === '/api/admin/users') {
    return Object.values(DEMO_USERS) as T;
  }

  if (cleanPath === '/api/roles') {
    return MOCK_ROLES as T;
  }

  if (cleanPath === '/api/permissions') {
    return MOCK_PERMISSIONS as T;
  }

  if (cleanPath === '/api/integrations') {
    return MOCK_INTEGRATIONS as T;
  }

  if (cleanPath.startsWith('/api/integrations/shopaid/catalog')) {
    return MOCK_SHOPAID_CATALOG as T;
  }

  if (cleanPath === '/api/audit-logs') {
    return MOCK_AUDIT_LOGS as T;
  }

  if (cleanPath === '/api/admin/system-health') {
    return MOCK_SYSTEM_HEALTH as T;
  }

  // 10. AI Extraction (Showcase simulation)
  if (cleanPath === '/api/transcription/extract') {
    const aiExtract: AIExtractResponse = {
      source: 'ollama',
      model_used: 'qwen2.5:1.5b',
      disclaimer: 'AI suggestion only. Registered pharmacist verification required.',
      summary_suggestion: 'Customer inquired about Dolo 650mg (2 strips) and Telma 40mg (1 strip) stock and pricing.',
      customer_name_mentioned: 'Karthik Subramanian',
      urgency_indicator: 'normal',
      medicines: [
        {
          medicine_name: 'Dolo 650',
          strength: '650mg',
          dosage_form: 'tablet',
          quantity: '2 strips',
          availability_question: true,
          pricing_question: true,
          verification_status: 'ai_suggested',
          notes: 'Paracetamol 650mg for fever',
        },
        {
          medicine_name: 'Telma 40',
          strength: '40mg',
          dosage_form: 'tablet',
          quantity: '1 strip',
          availability_question: true,
          pricing_question: true,
          verification_status: 'ai_suggested',
          notes: 'Telmisartan 40mg for BP maintenance',
        },
      ],
      availability_questions: ['Do you have Dolo 650 mg 2 strips in stock?', 'Do you have Telma 40 mg 1 strip in stock?'],
      pricing_questions: ['Please call me back with the price.'],
      missing_information: [],
      suggested_followup_needed: true,
      customer_details_to_confirm: ['Delivery address vs counter pickup'],
    };
    return aiExtract as T;
  }

  // 11. Reports
  if (cleanPath.startsWith('/api/reports/')) {
    return {
      report_type: cleanPath.split('/').pop(),
      generated_at: new Date().toISOString(),
      rows: MOCK_DASHBOARD.branch_comparison,
      summary: MOCK_DASHBOARD.kpis,
    } as T;
  }

  return undefined;
}
