import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, FileText, PhoneCall, Plus, Search } from 'lucide-react';
import { apiRequest, ApiError } from '../services/api';
import { useAuth } from '../features/authentication/AuthContext';
import type { BranchOut, CallOut, CallOutcomeOut, CustomerOut, EmployeeOut } from '../types/api';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  inputClass,
  LoadingState,
  Modal,
  PageHeader,
  useToast,
} from '../components/ui';

const SOURCE_LABELS: Record<string, { label: string; tone: 'blue' | 'amber' | 'green' }> = {
  manual_telephone_call: { label: 'Manual Telephone', tone: 'blue' },
  browser_microphone_test: { label: 'Browser Mic Test', tone: 'amber' },
  verified_telephony_integration: { label: 'Verified Telephony', tone: 'green' },
};

export function CallsPage() {
  const { hasPermission } = useAuth();
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [sourceType, setSourceType] = useState('');
  const [regStatus, setRegStatus] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  // New Manual Call Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerOut[]>([]);
  const [callDirection, setCallDirection] = useState<'inbound' | 'outbound'>('inbound');
  const [attendanceStatus, setAttendanceStatus] = useState<'attended' | 'missed'>('attended');
  const [outcomeCode, setOutcomeCode] = useState('medicine_inquiry_logged');
  const [summary, setSummary] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (sourceType) params.set('call_source_type', sourceType);
  if (regStatus) params.set('registration_status', regStatus);
  if (branchFilter) params.set('branch_id', branchFilter);
  if (employeeFilter) params.set('employee_id', employeeFilter);
  if (outcomeFilter) params.set('outcome_code', outcomeFilter);
  if (dateFrom) params.set('date_from', new Date(dateFrom).toISOString());
  if (dateTo) params.set('date_to', new Date(`${dateTo}T23:59:59`).toISOString());

  const { data: calls, isLoading, error, refetch } = useQuery({
    queryKey: ['calls', search, sourceType, regStatus, branchFilter, employeeFilter, outcomeFilter, dateFrom, dateTo],
    queryFn: () => apiRequest<CallOut[]>(`/api/calls?${params.toString()}`),
  });

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => apiRequest<BranchOut[]>('/api/branches'),
  });

  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => apiRequest<EmployeeOut[]>('/api/employees'),
  });

  const { data: outcomes } = useQuery({
    queryKey: ['call-outcomes'],
    queryFn: () => apiRequest<CallOutcomeOut[]>('/api/call-outcomes'),
  });

  const handleCustomerLookup = async (val: string) => {
    setCustomerPhone(val);
    if (val.trim().length < 3) {
      setCustomerSuggestions([]);
      return;
    }
    try {
      const hits = await apiRequest<CustomerOut[]>(
        `/api/customers?search=${encodeURIComponent(val.trim())}&limit=5`,
      );
      setCustomerSuggestions(hits);
    } catch {
      setCustomerSuggestions([]);
    }
  };

  const handleCreateManualCall = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiRequest('/api/calls', {
        method: 'POST',
        body: {
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          call_direction: callDirection,
          call_source_type: 'manual_telephone_call',
          attendance_status: attendanceStatus,
          registration_status: attendanceStatus === 'missed' ? 'unregistered' : 'registered',
          outcome_code: outcomeCode || undefined,
          summary: summary.trim() || undefined,
        },
      });
      notify('Telephone call registered.');
      setModalOpen(false);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerSuggestions([]);
      setSummary('');
      await queryClient.invalidateQueries({ queryKey: ['calls'] });
    } catch (err) {
      notify(err instanceof ApiError ? err.detail : 'Failed to register call.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Call Management"
        subtitle="Audit every customer call with explicit call-source distinction, registration status, date/staff filters, and text-only transcripts."
        actions={
          hasPermission('calls:create') ? (
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" />
              Register Manual Call
            </Button>
          ) : undefined
        }
      />

      {/* Complete Filter Bar (Search, Source, Status, Outcome, Branch, Employee, Date Range) */}
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-[#112D4E]/45" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search call ref, customer, phone..."
              className={`${inputClass} pl-9`}
            />
          </div>
          <select aria-label="Call Source Filter" value={sourceType} onChange={(e) => setSourceType(e.target.value)} className={inputClass}>
            <option value="">All Call Sources</option>
            <option value="manual_telephone_call">Manual Telephone Calls</option>
            <option value="browser_microphone_test">Browser Microphone Tests</option>
            <option value="verified_telephony_integration">Verified Telephony</option>
          </select>
          <select aria-label="Registration Status Filter" value={regStatus} onChange={(e) => setRegStatus(e.target.value)} className={inputClass}>
            <option value="">All Registration Statuses</option>
            <option value="registered">Registered</option>
            <option value="completed">Completed</option>
            <option value="unregistered">Unregistered</option>
            <option value="draft">Draft</option>
          </select>
          <select aria-label="Call Outcome Filter" value={outcomeFilter} onChange={(e) => setOutcomeFilter(e.target.value)} className={inputClass}>
            <option value="">All Outcomes</option>
            {(outcomes || []).map((o) => (
              <option key={o.code} value={o.code}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select aria-label="Branch Filter" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className={inputClass}>
            <option value="">All Authorized Branches</option>
            {(branches || []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select aria-label="Employee Filter" value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className={inputClass}>
            <option value="">All Authorized Employees</option>
            {(employees || []).map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.full_name} ({emp.employee_code})
              </option>
            ))}
          </select>
          <input
            type="date"
            aria-label="From Date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={inputClass}
          />
          <input
            type="date"
            aria-label="To Date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={inputClass}
          />
        </div>
      </Card>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorBanner message={(error as Error).message} onRetry={() => void refetch()} />
      ) : !calls || calls.length === 0 ? (
        <EmptyState
          title="No calls match the selected filters"
          description="Register a manual telephone call or start a Live Call Desk session to see calls here."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F9F7F7] text-xs uppercase text-[#112D4E]/65">
                <tr>
                  <th className="px-4 py-3">Call Ref</th>
                  <th className="px-4 py-3">Date & Time</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Branch / Staff</th>
                  <th className="px-4 py-3">Source Type</th>
                  <th className="px-4 py-3">Status & Outcome</th>
                  <th className="px-4 py-3">Linked</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DBE2EF]">
                {calls.map((c) => {
                  const src = SOURCE_LABELS[c.call_source_type] || { label: c.call_source_type, tone: 'blue' as const };
                  return (
                    <tr key={c.id} className="hover:bg-[#F9F7F7]/70">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-[#3F72AF]">{c.call_reference}</td>
                      <td className="px-4 py-3 text-xs text-[#112D4E]/80">
                        {new Date(c.started_at).toLocaleString()}
                        <div className="text-[11px] uppercase text-[#112D4E]/55">{c.call_direction}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#112D4E]">{c.customer_name || 'Unspecified'}</div>
                        <div className="text-xs text-[#112D4E]/60">{c.customer_phone || 'No phone'}</div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="font-medium">{c.branch_name || `Branch #${c.branch_id}`}</div>
                        <div className="text-[#112D4E]/60">{c.employee_name || 'Unassigned'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={src.tone}>{src.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <Badge
                          tone={
                            c.registration_status === 'completed'
                              ? 'green'
                              : c.registration_status === 'unregistered'
                                ? 'red'
                                : 'blue'
                          }
                        >
                          {c.registration_status}
                        </Badge>
                        {c.outcome_label && <div className="mt-1 text-[11px] text-[#112D4E]/70">{c.outcome_label}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#112D4E]/75">
                        <div className="flex items-center gap-2">
                          <span>{c.request_count} req</span>
                          <span>•</span>
                          <span>{c.followup_count} fu</span>
                          {c.has_transcript && (
                            <span title="Text transcript stored">
                              <FileText className="h-3.5 w-3.5 text-[#3F72AF]" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/calls/${c.id}`}>
                          <Button size="sm" variant="outline">
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={modalOpen} title="Register Manual Telephone Call" onClose={() => setModalOpen(false)}>
        <form onSubmit={handleCreateManualCall} className="space-y-3 text-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold">Customer Phone (Autocomplete) *</label>
              <input
                type="tel"
                required
                value={customerPhone}
                onChange={(e) => void handleCustomerLookup(e.target.value)}
                placeholder="Type phone to match existing customer"
                className={inputClass}
              />
              {customerSuggestions.length > 0 && (
                <div className="mt-1 rounded-lg border border-[#DBE2EF] bg-[#F9F7F7] p-1.5 text-xs space-y-1">
                  {customerSuggestions.map((cs) => (
                    <button
                      key={cs.id}
                      type="button"
                      onClick={() => {
                        setCustomerName(cs.full_name);
                        setCustomerPhone(cs.phone_number);
                        setCustomerSuggestions([]);
                      }}
                      className="flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-white cursor-pointer"
                    >
                      <span className="font-semibold">{cs.full_name}</span>
                      <span className="font-mono text-[11px] text-[#3F72AF]">{cs.phone_number}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Customer Name *</label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold">Direction</label>
              <select value={callDirection} onChange={(e) => setCallDirection(e.target.value as any)} className={inputClass}>
                <option value="inbound">Inbound</option>
                <option value="outbound">Outbound</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Attendance Status</label>
              <select
                value={attendanceStatus}
                onChange={(e) => setAttendanceStatus(e.target.value as any)}
                className={inputClass}
              >
                <option value="attended">Attended</option>
                <option value="missed">Missed Call (Needs Callback)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Outcome</label>
            <select value={outcomeCode} onChange={(e) => setOutcomeCode(e.target.value)} className={inputClass}>
              {(outcomes || []).map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Call Summary</label>
            <textarea
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Summary of customer medicine question or callback instructions..."
              className={inputClass}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              <PhoneCall className="h-4 w-4" />
              {submitting ? 'Saving...' : 'Save Call'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
