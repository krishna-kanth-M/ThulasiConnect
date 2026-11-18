import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ClipboardList,
  Clock,
  Headphones,
  Info,
  PhoneCall,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiRequest } from '../services/api';
import type { DashboardOverview } from '../types/api';
import { useAuth } from '../features/authentication/AuthContext';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingState,
  PageHeader,
  StatCard,
} from '../components/ui';

export function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const [days, setDays] = useState(30);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard', 'overview', days],
    queryFn: () => apiRequest<DashboardOverview>(`/api/dashboard/overview?days=${days}`),
  });

  if (isLoading) return <LoadingState message="Calculating real-time operational metrics..." />;
  if (error || !data) {
    return (
      <ErrorBanner
        message={error instanceof Error ? error.message : 'Unable to load dashboard.'}
        onRetry={() => void refetch()}
      />
    );
  }

  const roleHeading: Record<string, string> = {
    pharmacist: 'Pharmacist Operational Dashboard',
    branch_manager: `Branch Supervision Dashboard${user?.branch_name ? ` — ${user.branch_name}` : ''}`,
    zonal_manager: `Zonal Supervision Dashboard${user?.zone_name ? ` — ${user.zone_name}` : ''}`,
    owner: 'Executive Organization Dashboard',
    system_admin: 'Organization & System Overview',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={roleHeading[data.view_role] || 'Overview Dashboard'}
        subtitle={`Scope: ${data.scope_level.toUpperCase()} • Metrics computed strictly from stored records over the last ${data.period_days} days.`}
        actions={
          <>
            <select
              aria-label="Dashboard reporting window"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="rounded-lg border border-[#DBE2EF] bg-white px-3 py-2 text-xs font-medium text-[#112D4E]"
            >
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>
            {hasPermission('live_call:use') && (
              <Link to="/live-call">
                <Button size="sm">
                  <Headphones className="h-4 w-4" />
                  Open Live Call Desk
                </Button>
              </Link>
            )}
          </>
        }
      />

      {/* Honest Telephony Status Notice */}
      {!data.telephony_connected && (
        <div className="flex items-start gap-3 rounded-xl border border-[#DBE2EF] bg-[#DBE2EF]/35 px-4 py-3 text-xs text-[#112D4E]">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#3F72AF]" />
          <div>
            <span className="font-semibold">Telephony Source Transparency:</span> {data.telephony_note} Browser
            microphone test sessions ({data.kpis.microphone_test_sessions}) are tracked separately from telephone calls.
          </div>
        </div>
      )}

      {/* Dedicated System Administrator Overview Panel */}
      {data.view_role === 'system_admin' && data.system_admin_summary && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="User Accounts"
              value={`${data.system_admin_summary.users_active} / ${data.system_admin_summary.users_total}`}
              sublabel={`${data.system_admin_summary.users_inactive} inactive • ${data.system_admin_summary.failed_logins_24h} failed logins (24h)`}
              tone="accent"
            />
            <StatCard
              label="Zones & Branches"
              value={`${data.system_admin_summary.zones_total} Zones • ${data.system_admin_summary.branches_total} Branches`}
              sublabel={`${data.system_admin_summary.org_warnings.length} configuration warning(s)`}
              tone={data.system_admin_summary.org_warnings.length > 0 ? 'warning' : 'default'}
            />
            <StatCard
              label="Background Escalation Scheduler"
              value={data.system_admin_summary.scheduler.running ? 'RUNNING' : 'STOPPED'}
              sublabel={`Every ${data.system_admin_summary.scheduler.interval_seconds}s • ${data.system_admin_summary.scheduler.run_count} cycle(s) • ${data.system_admin_summary.scheduler.error_count} error(s)`}
              tone={data.system_admin_summary.scheduler.running ? 'accent' : 'danger'}
            />
            <StatCard
              label="PostgreSQL Health"
              value={data.system_admin_summary.database_healthy ? 'CONNECTED' : 'DEGRADED'}
              sublabel={`${data.system_admin_summary.integrations.length} integration adapters monitored`}
              tone={data.system_admin_summary.database_healthy ? 'default' : 'danger'}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#112D4E]">Organization Staffing & Integrity Warnings</h2>
                <Link to="/branches" className="text-xs font-medium text-[#3F72AF] hover:underline">
                  Review Branches
                </Link>
              </div>
              {data.system_admin_summary.org_warnings.length === 0 ? (
                <p className="text-xs text-[#112D4E]/65">No organizational configuration warnings detected.</p>
              ) : (
                <div className="space-y-2">
                  {data.system_admin_summary.org_warnings.map((w, idx) => (
                    <div key={idx} className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
                      <span className="font-semibold">
                        {w.branch_name} ({w.branch_code}):
                      </span>{' '}
                      {w.message}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#112D4E]">Recent Audit Activity</h2>
                <Link to="/administration" className="text-xs font-medium text-[#3F72AF] hover:underline">
                  Open Administration
                </Link>
              </div>
              <div className="space-y-1.5 text-xs">
                {data.system_admin_summary.recent_audit_logs.slice(0, 6).map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded bg-[#F9F7F7] px-2.5 py-1.5">
                    <span className="truncate">
                      <Badge tone="blue">{a.action}</Badge>{' '}
                      <span className="text-[#112D4E]/75">{a.actor_email || 'system'}</span>
                    </span>
                    <span className="font-mono text-[10px] text-[#112D4E]/55">
                      {new Date(a.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Phone Calls Today"
          value={data.kpis.calls_today}
          sublabel={`${data.kpis.registered_calls} registered (${data.period_days}d) • ${data.kpis.microphone_tests_today ?? 0} mic tests today`}
          icon={<PhoneCall className="h-4 w-4" />}
          tone="accent"
        />
        <StatCard
          label="Pending Requests"
          value={data.kpis.pending_requests}
          sublabel={`${data.kpis.resolved_requests} resolved • ${data.kpis.overdue_requests} past target time`}
          icon={<ClipboardList className="h-4 w-4" />}
          tone={data.kpis.overdue_requests > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Overdue Follow-ups"
          value={data.kpis.overdue_followups}
          sublabel={`${data.kpis.upcoming_followups} upcoming callbacks scheduled`}
          icon={<Clock className="h-4 w-4" />}
          tone={data.kpis.overdue_followups > 0 ? 'danger' : 'default'}
        />
        <StatCard
          label={data.scope_level === 'self' ? 'Registration Rate' : 'Open Escalations'}
          value={
            data.scope_level === 'self'
              ? data.kpis.registration_rate_pct !== null
                ? `${data.kpis.registration_rate_pct}%`
                : 'N/A'
              : data.kpis.open_escalations
          }
          sublabel={
            data.scope_level === 'self'
              ? `${data.kpis.microphone_test_sessions} mic test sessions`
              : `${data.kpis.missed_calls} missed • ${data.kpis.unregistered_calls} unregistered`
          }
          icon={
            data.scope_level === 'self' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )
          }
          tone={data.scope_level !== 'self' && data.kpis.open_escalations > 0 ? 'danger' : 'default'}
        />
      </div>

      {/* 7-Day Trend + Unread Reminders / Escalations */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#112D4E]">7-Day Call Activity Trend</h2>
              <p className="text-xs text-[#112D4E]/60">
                Separates telephone calls from browser microphone sessions and missed calls.
              </p>
            </div>
            <Badge tone="blue">Live DB Data</Badge>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.trend_7d}>
                <CartesianGrid strokeDasharray="3 3" stroke="#DBE2EF" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#112D4E' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#112D4E' }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="telephone_calls" name="Telephone Calls" fill="#3F72AF" radius={[4, 4, 0, 0]} />
                <Bar dataKey="microphone_tests" name="Mic Test Sessions" fill="#112D4E" radius={[4, 4, 0, 0]} />
                <Bar dataKey="missed_calls" name="Missed Calls" fill="#e11d48" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#112D4E]">
              <Bell className="h-4 w-4 text-[#3F72AF]" />
              Active Reminders & Alerts
            </h2>
            <Link to="/notifications" className="text-xs font-medium text-[#3F72AF] hover:underline">
              View All
            </Link>
          </div>
          {data.recent_notifications.length === 0 ? (
            <EmptyState
              title="No unread alerts"
              description="Reminders and escalation notices assigned to your account will appear here."
            />
          ) : (
            <div className="space-y-2.5">
              {data.recent_notifications.map((n) => (
                <div key={n.id} className="rounded-lg border border-[#DBE2EF] bg-[#F9F7F7] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#112D4E]">{n.title}</span>
                    <Badge tone={n.severity === 'critical' ? 'red' : n.severity === 'warning' ? 'amber' : 'blue'}>
                      {n.category}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-[#112D4E]/75">{n.message}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Role-Specific Hierarchical Drilldown Tables */}
      {data.scope_level === 'org' && data.zone_comparison.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#DBE2EF] px-5 py-3.5">
            <div>
              <h2 className="text-sm font-bold text-[#112D4E]">Zone-Level Executive Summary</h2>
              <p className="text-xs text-[#112D4E]/60">Aggregated operational performance across all zones.</p>
            </div>
            <Link to="/zones" className="text-xs font-medium text-[#3F72AF] hover:underline">
              Manage Zones
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F9F7F7] text-xs uppercase text-[#112D4E]/65">
                <tr>
                  <th className="px-4 py-3">Zone</th>
                  <th className="px-4 py-3">Branches</th>
                  <th className="px-4 py-3">Telephone Calls</th>
                  <th className="px-4 py-3">Reg. Rate</th>
                  <th className="px-4 py-3">Pending Requests</th>
                  <th className="px-4 py-3">Overdue Follow-ups</th>
                  <th className="px-4 py-3">Open Escalations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DBE2EF]">
                {data.zone_comparison.map((z) => (
                  <tr key={z.zone_id} className="hover:bg-[#F9F7F7]/70">
                    <td className="px-4 py-3 font-medium">
                      {z.zone_name} <span className="text-xs text-[#112D4E]/50">({z.zone_code})</span>
                    </td>
                    <td className="px-4 py-3">{z.branch_count}</td>
                    <td className="px-4 py-3">{z.telephone_calls}</td>
                    <td className="px-4 py-3">{z.registration_rate_pct !== null ? `${z.registration_rate_pct}%` : '—'}</td>
                    <td className="px-4 py-3">{z.pending_requests}</td>
                    <td className="px-4 py-3">
                      <Badge tone={z.overdue_followups > 0 ? 'red' : 'green'}>{z.overdue_followups}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={z.open_escalations > 0 ? 'amber' : 'neutral'}>{z.open_escalations}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {(data.scope_level === 'zone' || data.scope_level === 'org') && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#DBE2EF] px-5 py-3.5">
            <div>
              <h2 className="text-sm font-bold text-[#112D4E]">Branch Performance Comparison</h2>
              <p className="text-xs text-[#112D4E]/60">Authorized branches sorted by name with live operational counts.</p>
            </div>
            <Link to="/branches" className="text-xs font-medium text-[#3F72AF] hover:underline">
              Branch Directory
            </Link>
          </div>
          {data.branch_comparison.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No branches in scope" description="No branches are currently assigned to your scope." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F9F7F7] text-xs uppercase text-[#112D4E]/65">
                  <tr>
                    <th className="px-4 py-3">Branch</th>
                    <th className="px-4 py-3">Zone</th>
                    <th className="px-4 py-3">Registered Calls</th>
                    <th className="px-4 py-3">Mic Tests</th>
                    <th className="px-4 py-3">Pending Reqs</th>
                    <th className="px-4 py-3">Overdue Follow-ups</th>
                    <th className="px-4 py-3">Escalations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DBE2EF]">
                  {data.branch_comparison.map((b) => (
                    <tr key={b.branch_id} className="hover:bg-[#F9F7F7]/70">
                      <td className="px-4 py-3 font-medium">
                        {b.branch_name}
                        <div className="text-xs text-[#112D4E]/55">{b.city}</div>
                      </td>
                      <td className="px-4 py-3 text-xs">{b.zone_name || '—'}</td>
                      <td className="px-4 py-3">{b.registered_calls}</td>
                      <td className="px-4 py-3 text-[#112D4E]/70">{b.microphone_test_sessions}</td>
                      <td className="px-4 py-3">{b.pending_requests}</td>
                      <td className="px-4 py-3">
                        <Badge tone={b.overdue_followups > 0 ? 'red' : 'green'}>{b.overdue_followups}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={b.open_escalations > 0 ? 'amber' : 'neutral'}>{b.open_escalations}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {data.scope_level === 'branch' && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#DBE2EF] px-5 py-3.5">
            <div>
              <h2 className="text-sm font-bold text-[#112D4E]">Branch Employee Activity & Workload</h2>
              <p className="text-xs text-[#112D4E]/60">Individual operational metrics within your assigned branch.</p>
            </div>
            <Link to="/employees" className="text-xs font-medium text-[#3F72AF] hover:underline">
              Full Performance View
            </Link>
          </div>
          {data.employee_comparison.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No active employees" description="No active employees are assigned to this branch yet." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F9F7F7] text-xs uppercase text-[#112D4E]/65">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Registered Calls</th>
                    <th className="px-4 py-3">Requests Resolved</th>
                    <th className="px-4 py-3">Pending Workload</th>
                    <th className="px-4 py-3">Overdue Follow-ups</th>
                    <th className="px-4 py-3">Follow-up Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DBE2EF]">
                  {data.employee_comparison.map((emp) => (
                    <tr key={emp.employee_id} className="hover:bg-[#F9F7F7]/70">
                      <td className="px-4 py-3 font-medium">
                        {emp.full_name}
                        <div className="text-xs text-[#112D4E]/55">
                          {emp.employee_code} • {emp.designation}
                        </div>
                      </td>
                      <td className="px-4 py-3">{emp.calls_registered}</td>
                      <td className="px-4 py-3">{emp.requests_resolved} / {emp.requests_created}</td>
                      <td className="px-4 py-3">{emp.pending_workload}</td>
                      <td className="px-4 py-3">
                        <Badge tone={emp.overdue_followups > 0 ? 'red' : 'green'}>{emp.overdue_followups}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {emp.followup_completion_rate_pct !== null ? `${emp.followup_completion_rate_pct}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {data.scope_level === 'self' && data.personal_performance && (
        <Card className="p-5">
          <h2 className="text-sm font-bold text-[#112D4E]">My Personal Performance Summary ({data.period_days} Days)</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg bg-[#F9F7F7] p-3">
              <div className="text-xs text-[#112D4E]/60">Requests Resolved</div>
              <div className="mt-1 text-lg font-bold">
                {data.personal_performance.requests_resolved} / {data.personal_performance.requests_created}
              </div>
            </div>
            <div className="rounded-lg bg-[#F9F7F7] p-3">
              <div className="text-xs text-[#112D4E]/60">Avg Resolution Time</div>
              <div className="mt-1 text-lg font-bold">
                {data.personal_performance.avg_resolution_hours !== null
                  ? `${data.personal_performance.avg_resolution_hours}h`
                  : '—'}
              </div>
            </div>
            <div className="rounded-lg bg-[#F9F7F7] p-3">
              <div className="text-xs text-[#112D4E]/60">Call Registration Quality</div>
              <div className="mt-1 text-lg font-bold">
                {data.personal_performance.registration_completeness_pct !== null
                  ? `${data.personal_performance.registration_completeness_pct}%`
                  : '—'}
              </div>
            </div>
            <div className="rounded-lg bg-[#F9F7F7] p-3">
              <div className="text-xs text-[#112D4E]/60">Follow-up Completion</div>
              <div className="mt-1 text-lg font-bold">
                {data.personal_performance.followup_completion_rate_pct !== null
                  ? `${data.personal_performance.followup_completion_rate_pct}%`
                  : '—'}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
