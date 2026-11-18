import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { apiRequest } from '../services/api';
import type { BranchOut, EmployeeMetric } from '../types/api';
import {
  Badge,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingState,
  PageHeader,
} from '../components/ui';

export function EmployeesPage() {
  const [days, setDays] = useState(30);
  const [branchId, setBranchId] = useState('');

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => apiRequest<BranchOut[]>('/api/branches'),
  });

  const params = new URLSearchParams({ days: String(days) });
  if (branchId) params.set('branch_id', branchId);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['performance', 'employees', days, branchId],
    queryFn: () =>
      apiRequest<{
        period_days: number;
        metric_definitions: Record<string, string>;
        employees: EmployeeMetric[];
      }>(`/api/performance/employees?${params.toString()}`),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Employee Performance & Accountability"
        subtitle="Operational metrics calculated transparently from registered calls, requests, and follow-up records."
        actions={
          <div className="flex items-center gap-2">
            {branches && branches.length > 1 && (
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="rounded-lg border border-[#DBE2EF] bg-white px-3 py-2 text-xs font-medium"
              >
                <option value="">All Authorized Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="rounded-lg border border-[#DBE2EF] bg-white px-3 py-2 text-xs font-medium"
            >
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>
          </div>
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorBanner message={(error as Error).message} onRetry={() => void refetch()} />
      ) : !data || data.employees.length === 0 ? (
        <EmptyState
          title="No employee metrics available"
          description="No active employee profiles exist within your authorized scope."
        />
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F9F7F7] text-xs uppercase text-[#112D4E]/65">
                  <tr className="bg-[#F9F7F7] text-xs uppercase text-[#112D4E]/65">
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Branch</th>
                    <th className="px-4 py-3">Reg. Calls</th>
                    <th className="px-4 py-3">Mic Tests</th>
                    <th className="px-4 py-3">Reqs Created</th>
                    <th className="px-4 py-3">Assigned (Resolved/Total)</th>
                    <th className="px-4 py-3">Pending</th>
                    <th className="px-4 py-3">Overdue FU</th>
                    <th className="px-4 py-3">Avg Resolution</th>
                    <th className="px-4 py-3">Reg. Completeness</th>
                    <th className="px-4 py-3">FU Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DBE2EF]">
                  {data.employees.map((e) => (
                    <tr key={e.employee_id} className="hover:bg-[#F9F7F7]/70">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#112D4E]">{e.full_name}</div>
                        <div className="text-xs text-[#112D4E]/55">
                          {e.employee_code} • {e.designation}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">{e.branch_name || '—'}</td>
                      <td className="px-4 py-3 font-semibold">{e.calls_registered}</td>
                      <td className="px-4 py-3 text-xs text-[#112D4E]/65">{e.microphone_test_sessions}</td>
                      <td className="px-4 py-3 font-medium">{e.requests_created}</td>
                      <td className="px-4 py-3">
                        {e.requests_resolved} / {e.requests_assigned ?? e.requests_created}
                      </td>
                      <td className="px-4 py-3">{e.pending_workload}</td>
                      <td className="px-4 py-3">
                        <Badge tone={e.overdue_followups > 0 ? 'red' : 'green'}>{e.overdue_followups}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {e.avg_resolution_hours !== null ? `${e.avg_resolution_hours}h` : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {e.registration_completeness_pct !== null ? `${e.registration_completeness_pct}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {e.followup_completion_rate_pct !== null ? `${e.followup_completion_rate_pct}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#112D4E]">
              <Info className="h-4 w-4 text-[#3F72AF]" />
              Metric Calculation Methodology
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 text-xs">
              {Object.entries(data.metric_definitions).map(([key, desc]) => (
                <div key={key} className="rounded-lg border border-[#DBE2EF] bg-[#F9F7F7] p-3">
                  <div className="font-semibold text-[#112D4E]">{key.replace(/_/g, ' ')}</div>
                  <p className="mt-1 text-[#112D4E]/75">{desc}</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
