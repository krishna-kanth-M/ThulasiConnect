import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Clock, Edit2, Plus, RefreshCw } from 'lucide-react';
import { apiRequest, ApiError } from '../services/api';
import { useAuth } from '../features/authentication/AuthContext';
import type { EmployeeOut, EscalationOut, FollowUpOut } from '../types/api';
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

export function FollowUpsPage() {
  const { hasPermission } = useAuth();
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [completing, setCompleting] = useState<FollowUpOut | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');

  // Reassign / Edit Follow-Up Modal (Branch Managers)
  const [reassigning, setReassigning] = useState<FollowUpOut | null>(null);
  const [reassignEmployeeId, setReassignEmployeeId] = useState('');
  const [reassignDueAt, setReassignDueAt] = useState('');
  const [reassignPriority, setReassignPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');

  // Resolve Escalation Modal (with custom notes)
  const [resolvingEsc, setResolvingEsc] = useState<EscalationOut | null>(null);
  const [escResolutionNotes, setEscResolutionNotes] = useState('');

  // Create form
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [assigneeId, setAssigneeId] = useState('');
  const [notes, setNotes] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [saving, setSaving] = useState(false);

  const canUpdateFollowups = hasPermission('followups:update_own', 'followups:update_branch');
  const canReassignFollowups = hasPermission('followups:update_branch');
  const canViewEscalations = hasPermission('escalations:read_branch', 'escalations:read_zone', 'escalations:read_org');
  const canManageEscalations = hasPermission(
    'escalations:manage_branch',
    'escalations:manage_zone',
    'escalations:manage_org',
  );
  const canEvaluateEscalations =
    canManageEscalations || hasPermission('admin:settings');

  const params = new URLSearchParams();
  if (statusFilter) params.set('status', statusFilter);

  const { data: followups, isLoading, error, refetch } = useQuery({
    queryKey: ['followups', statusFilter],
    queryFn: () => apiRequest<FollowUpOut[]>(`/api/followups?${params.toString()}`),
  });

  const { data: escalations } = useQuery({
    queryKey: ['escalations'],
    queryFn: () => apiRequest<EscalationOut[]>('/api/escalations'),
    enabled: canViewEscalations,
  });

  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => apiRequest<EmployeeOut[]>('/api/employees'),
  });

  const handleEvaluateEscalations = async () => {
    setEvaluating(true);
    try {
      const res = await apiRequest<{
        evaluated_overdue: number;
        reminders_created: number;
        escalations_created: number;
      }>('/api/followups/evaluate-escalations', { method: 'POST' });
      notify(
        `Evaluated ${res.evaluated_overdue} overdue follow-ups: ${res.reminders_created} reminder(s), ${res.escalations_created} escalation(s) created.`,
        'info',
      );
      await queryClient.invalidateQueries({ queryKey: ['followups'] });
      await queryClient.invalidateQueries({ queryKey: ['escalations'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch (err) {
      notify(err instanceof ApiError ? err.detail : 'Escalation evaluation failed.', 'error');
    } finally {
      setEvaluating(false);
    }
  };

  const handleCreateFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest('/api/followups', {
        method: 'POST',
        body: {
          title: title.trim(),
          due_at: new Date(dueAt).toISOString(),
          priority,
          assigned_employee_id: assigneeId ? Number(assigneeId) : undefined,
          notes: notes.trim() || undefined,
        },
      });
      notify('Follow-up scheduled.');
      setCreateOpen(false);
      setTitle('');
      setDueAt('');
      setNotes('');
      await queryClient.invalidateQueries({ queryKey: ['followups'] });
    } catch (err) {
      notify(err instanceof ApiError ? err.detail : 'Failed to create follow-up.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completing) return;
    setSaving(true);
    try {
      await apiRequest(`/api/followups/${completing.id}`, {
        method: 'PATCH',
        body: { status: 'completed', completion_notes: completionNotes.trim() || 'Completed.' },
      });
      notify('Follow-up marked completed.');
      setCompleting(null);
      setCompletionNotes('');
      await queryClient.invalidateQueries({ queryKey: ['followups'] });
      await queryClient.invalidateQueries({ queryKey: ['escalations'] });
    } catch (err) {
      notify(err instanceof ApiError ? err.detail : 'Update failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReassignFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassigning) return;
    setSaving(true);
    try {
      await apiRequest(`/api/followups/${reassigning.id}`, {
        method: 'PATCH',
        body: {
          assigned_employee_id: reassignEmployeeId ? Number(reassignEmployeeId) : undefined,
          due_at: reassignDueAt ? new Date(reassignDueAt).toISOString() : undefined,
          priority: reassignPriority,
        },
      });
      notify('Follow-up assignment and due date updated.');
      setReassigning(null);
      await queryClient.invalidateQueries({ queryKey: ['followups'] });
    } catch (err) {
      notify(err instanceof ApiError ? err.detail : 'Failed to update follow-up.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAcknowledgeEscalation = async (id: number) => {
    try {
      await apiRequest(`/api/escalations/${id}`, {
        method: 'PATCH',
        body: { status: 'acknowledged', resolution_notes: 'Acknowledged by supervisor.' },
      });
      notify(`Escalation #${id} acknowledged.`);
      await queryClient.invalidateQueries({ queryKey: ['escalations'] });
    } catch (err) {
      notify(err instanceof ApiError ? err.detail : 'Failed to acknowledge escalation.', 'error');
    }
  };

  const handleResolveEscalation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingEsc) return;
    setSaving(true);
    try {
      await apiRequest(`/api/escalations/${resolvingEsc.id}`, {
        method: 'PATCH',
        body: {
          status: 'resolved',
          resolution_notes: escResolutionNotes.trim(),
        },
      });
      notify(`Escalation #${resolvingEsc.id} resolved.`);
      setResolvingEsc(null);
      setEscResolutionNotes('');
      await queryClient.invalidateQueries({ queryKey: ['escalations'] });
    } catch (err) {
      notify(err instanceof ApiError ? err.detail : 'Failed to resolve escalation.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Follow-ups, Reminders & Escalations"
        subtitle="Prevent missed callbacks with scheduled reminders, automated background overdue monitoring, and hierarchical escalations."
        actions={
          <>
            {canEvaluateEscalations && (
              <Button variant="outline" size="sm" disabled={evaluating} onClick={handleEvaluateEscalations}>
                <RefreshCw className={`h-4 w-4 ${evaluating ? 'animate-spin' : ''}`} />
                Run Escalation Check Now
              </Button>
            )}
            {hasPermission('followups:create') && (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Schedule Follow-up
              </Button>
            )}
          </>
        }
      />

      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#112D4E]">
          <Clock className="h-4 w-4 text-[#3F72AF]" />
          Filter Follow-ups:
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-[#DBE2EF] bg-white px-3 py-1.5 text-xs"
        >
          <option value="">All Statuses</option>
          <option value="overdue">Overdue</option>
          <option value="pending">Pending (Upcoming)</option>
          <option value="completed">Completed</option>
        </select>
      </Card>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorBanner message={(error as Error).message} onRetry={() => void refetch()} />
      ) : !followups || followups.length === 0 ? (
        <EmptyState
          title="No follow-ups scheduled"
          description="Schedule a customer callback or create one directly from a medicine request."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F9F7F7] text-xs uppercase text-[#112D4E]/65">
                <tr>
                  <th className="px-4 py-3">Task / Callback</th>
                  <th className="px-4 py-3">Customer / Linked Ref</th>
                  <th className="px-4 py-3">Branch / Assignee</th>
                  <th className="px-4 py-3">Due At</th>
                  <th className="px-4 py-3">Priority & Status</th>
                  {canUpdateFollowups && <th className="px-4 py-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DBE2EF]">
                {followups.map((f) => (
                  <tr key={f.id} className="hover:bg-[#F9F7F7]/70">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#112D4E]">{f.title}</div>
                      {f.notes && <div className="text-xs text-[#112D4E]/65">{f.notes}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-medium">{f.customer_name || '—'}</div>
                      <div className="text-[#112D4E]/60">
                        {f.request_reference || f.call_reference || f.customer_phone || ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-medium">{f.branch_name}</div>
                      <div className="text-[#112D4E]/60">{f.assigned_employee_name}</div>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono">
                      {new Date(f.due_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone={f.priority === 'urgent' ? 'red' : f.priority === 'high' ? 'amber' : 'neutral'}>
                          {f.priority}
                        </Badge>
                        <Badge tone={f.is_overdue ? 'red' : f.status === 'completed' ? 'green' : 'blue'}>
                          {f.is_overdue ? 'overdue' : f.status}
                        </Badge>
                      </div>
                    </td>
                    {canUpdateFollowups && (
                      <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                        {f.status !== 'completed' && f.status !== 'cancelled' && canReassignFollowups && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setReassigning(f);
                              setReassignEmployeeId(String(f.assigned_employee_id));
                              setReassignDueAt(f.due_at.slice(0, 16));
                              setReassignPriority(f.priority);
                            }}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            Reassign
                          </Button>
                        )}
                        {f.status !== 'completed' && f.status !== 'cancelled' && (
                          <Button size="sm" variant="secondary" onClick={() => setCompleting(f)}>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Complete
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Management Escalations Queue */}
      {canViewEscalations && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#DBE2EF] px-5 py-3.5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              <h2 className="text-sm font-bold text-[#112D4E]">Supervisory Escalations Queue</h2>
            </div>
            <Badge tone="red">{(escalations || []).filter((e) => e.status !== 'resolved').length} Open</Badge>
          </div>
          {!escalations || escalations.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No escalations triggered"
                description="Overdue follow-ups exceeding branch or zonal thresholds appear here automatically."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F9F7F7] text-xs uppercase text-[#112D4E]/65">
                  <tr>
                    <th className="px-4 py-3">Level</th>
                    <th className="px-4 py-3">Branch</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">Target</th>
                    <th className="px-4 py-3">Status</th>
                    {canManageEscalations && <th className="px-4 py-3 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DBE2EF]">
                  {escalations.map((e) => (
                    <tr key={e.id} className="hover:bg-[#F9F7F7]/70">
                      <td className="px-4 py-3">
                        <Badge tone={e.escalation_level >= 2 ? 'red' : 'amber'}>Level {e.escalation_level}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium">{e.branch_name}</td>
                      <td className="px-4 py-3 text-xs text-[#112D4E]/80 max-w-md">
                        <div>{e.reason}</div>
                        {e.resolution_notes && (
                          <div className="mt-1 text-[11px] text-emerald-700">Note: {e.resolution_notes}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div>{e.target_user_name || e.target_role}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={e.status === 'resolved' ? 'green' : e.status === 'acknowledged' ? 'blue' : 'red'}>
                          {e.status}
                        </Badge>
                      </td>
                      {canManageEscalations && (
                        <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                          {e.status === 'open' && (
                            <Button size="sm" variant="outline" onClick={() => void handleAcknowledgeEscalation(e.id)}>
                              Acknowledge
                            </Button>
                          )}
                          {e.status !== 'resolved' && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setResolvingEsc(e);
                                setEscResolutionNotes('');
                              }}
                            >
                              Resolve
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Create Follow-up Modal */}
      <Modal open={createOpen} title="Schedule Follow-up Reminder" onClose={() => setCreateOpen(false)}>
        <form onSubmit={handleCreateFollowUp} className="space-y-3 text-sm">
          <div>
            <label className="mb-1 block text-xs font-semibold">Follow-up Title *</label>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold">Due Date & Time *</label>
              <input type="datetime-local" required value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as any)} className={inputClass}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          {employees && employees.length > 1 && (
            <div>
              <label className="mb-1 block text-xs font-semibold">Assign To Employee</label>
              <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={inputClass}>
                <option value="">Myself (default)</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.employee_code})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-semibold">Notes</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Scheduling...' : 'Schedule Follow-up'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Complete Follow-up Modal */}
      <Modal
        open={Boolean(completing)}
        title={completing ? `Complete Follow-up: ${completing.title}` : ''}
        onClose={() => setCompleting(null)}
      >
        <form onSubmit={handleCompleteFollowUp} className="space-y-3 text-sm">
          <div>
            <label className="mb-1 block text-xs font-semibold">Completion Notes *</label>
            <textarea
              rows={3}
              required
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              placeholder="Record callback outcome (e.g., customer confirmed pickup at 6 PM)..."
              className={inputClass}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCompleting(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              Mark Completed
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reassign Follow-up Modal */}
      <Modal
        open={Boolean(reassigning)}
        title={reassigning ? `Reassign Follow-up: ${reassigning.title}` : ''}
        onClose={() => setReassigning(null)}
      >
        <form onSubmit={handleReassignFollowUp} className="space-y-3 text-sm">
          <div>
            <label className="mb-1 block text-xs font-semibold">Assigned Employee</label>
            <select value={reassignEmployeeId} onChange={(e) => setReassignEmployeeId(e.target.value)} className={inputClass}>
              {(employees || []).map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.employee_code})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold">Due Date & Time</label>
              <input
                type="datetime-local"
                value={reassignDueAt}
                onChange={(e) => setReassignDueAt(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Priority</label>
              <select
                value={reassignPriority}
                onChange={(e) => setReassignPriority(e.target.value as any)}
                className={inputClass}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setReassigning(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              Save Assignment
            </Button>
          </div>
        </form>
      </Modal>

      {/* Resolve Escalation Modal */}
      <Modal
        open={Boolean(resolvingEsc)}
        title={resolvingEsc ? `Resolve Level ${resolvingEsc.escalation_level} Escalation #${resolvingEsc.id}` : ''}
        onClose={() => setResolvingEsc(null)}
      >
        <form onSubmit={handleResolveEscalation} className="space-y-3 text-sm">
          <div>
            <label className="mb-1 block text-xs font-semibold">Supervisory Resolution Notes *</label>
            <textarea
              rows={3}
              required
              value={escResolutionNotes}
              onChange={(e) => setEscResolutionNotes(e.target.value)}
              placeholder="Document the corrective action taken to resolve this escalation..."
              className={inputClass}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setResolvingEsc(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              Confirm Resolution
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
