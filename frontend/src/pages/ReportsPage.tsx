import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Download } from 'lucide-react';
import { apiRequest, ApiError, downloadCsvReport } from '../services/api';
import type { BranchOut } from '../types/api';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  inputClass,
  LoadingState,
  PageHeader,
  useToast,
} from '../components/ui';

const REPORT_TYPES = [
  { id: 'daily_calls', label: 'Daily Call Report (24h)' },
  { id: 'weekly_calls', label: 'Weekly Call Report (7d)' },
  { id: 'monthly_calls', label: 'Monthly Call Report (30d)' },
  { id: 'branch_performance', label: 'Branch Performance Report' },
  { id: 'employee_performance', label: 'Employee Performance Report' },
  { id: 'pending_requests', label: 'Pending Customer Requests Report' },
  { id: 'overdue_followups', label: 'Overdue Follow-ups Report' },
  { id: 'escalations', label: 'Escalations Report' },
];

export function ReportsPage() {
  const { notify } = useToast();
  const [reportType, setReportType] = useState('monthly_calls');
  const [branchId, setBranchId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exporting, setExporting] = useState(false);

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => apiRequest<BranchOut[]>('/api/branches'),
  });

  const buildQuery = () => {
    const p = new URLSearchParams();
    if (branchId) p.set('branch_id', branchId);
    if (dateFrom) p.set('date_from', new Date(dateFrom).toISOString());
    if (dateTo) p.set('date_to', new Date(`${dateTo}T23:59:59`).toISOString());
    return p.toString();
  };

  const queryStr = buildQuery();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['reports', reportType, queryStr],
    queryFn: () =>
      apiRequest<{
        report_type: string;
        date_from: string;
        date_to: string;
        row_count: number;
        columns: string[];
        rows: Record<string, any>[];
      }>(`/api/reports/${reportType}${queryStr ? `?${queryStr}` : ''}`),
  });

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      await downloadCsvReport(
        `/api/reports/${reportType}/export.csv${queryStr ? `?${queryStr}` : ''}`,
        `thulasiconnect_${reportType}.csv`,
      );
      notify('CSV report exported.');
    } catch (err) {
      notify(err instanceof ApiError ? err.detail : 'CSV export failed.', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports & Operational Analytics"
        subtitle="Generate date-filtered operational reports strictly from live PostgreSQL records with authorized CSV export."
        actions={
          <Button onClick={handleExportCsv} disabled={exporting}>
            <Download className="h-4 w-4" />
            {exporting ? 'Exporting CSV...' : 'Export CSV'}
          </Button>
        }
      />

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold">Report Type</label>
            <select value={reportType} onChange={(e) => setReportType(e.target.value)} className={inputClass}>
              {REPORT_TYPES.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Branch Filter</label>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputClass}>
              <option value="">All Authorized Branches</option>
              {(branches || []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">From Date</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">To Date</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass} />
          </div>
        </div>
      </Card>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorBanner message={(error as Error).message} onRetry={() => void refetch()} />
      ) : !data || data.rows.length === 0 ? (
        <EmptyState
          title="No report rows in selected date range"
          description="Try widening the date filter or selecting a different report type."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#DBE2EF] px-5 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#112D4E]">
              <BarChart3 className="h-4 w-4 text-[#3F72AF]" />
              <span>{REPORT_TYPES.find((r) => r.id === reportType)?.label}</span>
            </div>
            <Badge tone="blue">{data.row_count} rows</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F9F7F7] uppercase text-[#112D4E]/65">
                <tr>
                  {data.columns.map((col) => (
                    <th key={col} className="px-3.5 py-2.5 whitespace-nowrap">
                      {col.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DBE2EF]">
                {data.rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-[#F9F7F7]/70">
                    {data.columns.map((col) => (
                      <td key={col} className="px-3.5 py-2.5 whitespace-nowrap text-[#112D4E]/85">
                        {row[col] === null || row[col] === undefined || row[col] === '' ? '—' : String(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
