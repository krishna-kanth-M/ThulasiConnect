import { expect, test } from '@playwright/test';

const DEV_PASSWORD = process.env.TEST_DEV_PASSWORD || 'ThulasiDev#2026';

async function signIn(page: any, email: string) {
  await page.goto('/login');
  await page.fill('#login-email', email);
  await page.fill('#login-password', DEV_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
}

test('1. unauthenticated redirect and invalid login rejection', async ({ page }) => {
  await page.goto('/calls');
  await page.waitForURL('/login');
  await page.fill('#login-email', 'admin@thulasipharmacy.local');
  await page.fill('#login-password', 'InvalidPass999');
  await page.click('button[type="submit"]');
  await expect(page.getByText('Invalid email or password.')).toBeVisible();
});

test('2. pharmacist full journey: dashboard, live call desk, customers, calls+filters, requests+item edit, followups', async ({
  page,
}) => {
  await signIn(page, 'pharmacist.rspuram@thulasipharmacy.local');

  // Role-aware navigation & reconciled KPIs
  await expect(page.getByRole('heading', { name: /Pharmacist Operational Dashboard/i })).toBeVisible();
  await expect(page.getByText('Phone Calls Today')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Live Call Desk', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Customers', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Administration' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Reports' })).toHaveCount(0);

  // Live Call Desk 3-panel + customer autocomplete + reset button + zero audio playback
  await page.getByRole('link', { name: 'Live Call Desk', exact: true }).click();
  await expect(page.getByText('1. Call Registration & Customer')).toBeVisible();
  await expect(page.getByText('2. Live Transcription (Faster-Whisper CPU INT8)')).toBeVisible();
  await expect(page.getByText('3. Customer Requirements & Confirmation')).toBeVisible();
  await expect(page.getByRole('button', { name: /Start Next Call/i })).toBeVisible();
  await expect(page.locator('audio')).toHaveCount(0);

  // Customer Directory (/customers)
  await page.getByRole('link', { name: 'Customers', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Customer Directory' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Register Customer' })).toBeVisible();

  // Calls page (date/employee/outcome filters) & Call Detail (linked operational records + no audio)
  await page.getByRole('link', { name: 'Calls', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Call Management' })).toBeVisible();
  await expect(page.getByLabel('From Date')).toBeVisible();
  await expect(page.getByLabel('Employee Filter')).toBeVisible();
  await expect(page.getByLabel('Call Outcome Filter')).toBeVisible();
  await page.locator('table').getByRole('link', { name: 'View', exact: true }).first().click();
  await expect(page.getByText('No Audio Stored')).toBeVisible();
  await expect(page.getByText('Linked Operational Records')).toBeVisible();
  await expect(page.locator('audio')).toHaveCount(0);

  // Customer Requests (post-creation item editing visible inside Manage modal)
  await page.getByRole('link', { name: 'Customer Requests' }).click();
  await expect(page.getByRole('heading', { name: 'Customer & Medicine Requests' })).toBeVisible();
  await page.getByRole('button', { name: 'Manage' }).first().click();
  await expect(page.getByText('Edit Medicine Items')).toBeVisible();
  await page.getByLabel('Close modal').click();

  // Follow-ups: Pharmacist CANNOT see management-only "Run Escalation Check Now" button (DEF-08 fix)
  await page.getByRole('link', { name: 'Follow-ups' }).click();
  await expect(page.getByRole('heading', { name: 'Follow-ups, Reminders & Escalations' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Run Escalation Check Now/i })).toHaveCount(0);

  await page.getByRole('button', { name: 'Sign Out' }).click();
  await page.waitForURL('/login');
});

test('3. branch manager journey: supervision dashboard, escalations, staffing warnings, reports CSV', async ({
  page,
}) => {
  await signIn(page, 'manager.rspuram@thulasipharmacy.local');
  await expect(page.getByRole('heading', { name: /Branch Supervision Dashboard/i })).toBeVisible();

  // Follow-ups & Escalations: Branch manager CAN run escalation check & reassign
  await page.getByRole('link', { name: 'Follow-ups' }).click();
  await expect(page.getByRole('button', { name: /Run Escalation Check Now/i })).toBeVisible();

  // Branches page surfaces Gandhipuram 0-pharmacist staffing warning
  await page.getByRole('link', { name: 'Branches' }).click();
  await expect(page.getByRole('heading', { name: 'Branch Directory & Operational Supervision' })).toBeVisible();
  await expect(page.getByText(/No active pharmacists assigned/i)).toBeVisible();

  // Reports & CSV export
  await page.getByRole('link', { name: 'Reports' }).click();
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();

  await page.getByRole('button', { name: 'Sign Out' }).click();
  await page.waitForURL('/login');
});

test('4. zonal manager & owner journeys: hierarchical dashboards and read-only follow-up guard', async ({
  page,
}) => {
  // Zonal Manager (West)
  await signIn(page, 'zonal.west@thulasipharmacy.local');
  await expect(page.getByRole('heading', { name: /Zonal Supervision Dashboard/i })).toBeVisible();
  await page.getByRole('link', { name: 'Zones', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Zones & Regional Supervision' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /West Tamil Nadu Zone/i })).toBeVisible();
  await expect(page.getByText('South Tamil Nadu Zone')).toHaveCount(0);

  // DEF-06 fix: read-only Zonal Manager must NOT see Complete button on follow-ups
  await page.getByRole('link', { name: 'Follow-ups' }).click();
  await expect(page.getByRole('button', { name: 'Complete', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign Out' }).click();
  await page.waitForURL('/login');

  // Owner
  await signIn(page, 'owner@thulasipharmacy.local');
  await expect(page.getByRole('heading', { name: /Executive Organization Dashboard/i })).toBeVisible();
  await expect(page.getByText('Zone-Level Executive Summary')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Administration' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign Out' }).click();
  await page.waitForURL('/login');
});

test('5. system administrator journey: dedicated admin dashboard, user edit, role permissions, integrations, zones edit, audit filters', async ({
  page,
}) => {
  await signIn(page, 'admin@thulasipharmacy.local');

  // Dedicated System Admin Dashboard
  await expect(page.getByText('Background Escalation Scheduler')).toBeVisible();
  await expect(page.getByText('RUNNING', { exact: true })).toBeVisible();
  await expect(page.getByText('Organization Staffing & Integrity Warnings')).toBeVisible();

  // Administration Tabs
  await page.getByRole('link', { name: 'Administration', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'System Administration' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit', exact: true }).first()).toBeVisible();

  // Roles & Permissions interactive editor
  await page.getByRole('button', { name: /Roles & Permissions/i }).click();
  await page.getByRole('button', { name: /Edit Permissions/i }).first().click();
  await expect(page.getByRole('button', { name: 'Save Role Permissions' })).toBeVisible();
  await page.getByLabel('Close modal').click();

  // Integrations (ShopAid + Telephony + Notification Delivery Channels + Configure Adapter)
  await page.getByRole('button', { name: /Integrations/i }).click();
  await expect(page.getByText(/ShopAid Inventory Software/i)).toBeVisible();
  await expect(page.getByText(/Pharmacy Telephony/i)).toBeVisible();
  await expect(page.getByText(/Notification Delivery Channels/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Configure Adapter' }).first()).toBeVisible();

  // Audit Logs filters
  await page.getByRole('button', { name: /Audit Logs/i }).click();
  await expect(page.getByLabel('Entity Type Filter')).toBeVisible();
  await expect(page.getByText('auth.login_success').first()).toBeVisible();

  // Zones Edit modal
  await page.getByRole('link', { name: 'Zones', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit Zone' }).first()).toBeVisible();

  // Live System Health Dashboard (System Administrator only)
  await page.getByRole('link', { name: 'System Health', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'System Health & Integration Diagnostics' })).toBeVisible();
  await expect(page.getByText('PostgreSQL Database')).toBeVisible();
  await expect(page.getByText('Local Ollama Service')).toBeVisible();
  await expect(page.getByText('Faster-Whisper Speech-to-Text')).toBeVisible();
  await expect(page.getByText('Telephony / PBX / SIP Integration')).toBeVisible();

  await page.getByRole('button', { name: 'Sign Out' }).click();
  await page.waitForURL('/login');
});
