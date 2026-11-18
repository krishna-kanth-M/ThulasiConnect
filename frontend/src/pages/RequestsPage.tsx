import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Eye, History, Plus, Search, Trash2 } from 'lucide-react';
import { apiRequest, ApiError } from '../services/api';
import { useAuth } from '../features/authentication/AuthContext';
import type { EmployeeOut, MedicineRequestItem, MedicineRequestOut } from '../types/api';
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

const STATUS_OPTIONS = [
  'new',
  'in_progress',
  'waiting_for_info',
  'waiting_for_stock',
  'follow_up_required',
  'resolved',
  'closed',
  'cancelled',
];

function statusTone(status: string): 'blue' | 'amber' | 'green' | 'red' | 'neutral' {
  if (status === 'resolved' || status === 'closed') return 'green';
  if (status === 'cancelled') return 'red';
  if (status === 'waiting_for_stock' || status === 'waiting_for_info' || status === 'follow_up_required') return 'amber';
  if (status === 'new' || status === 'in_progress') return 'blue';
  return 'neutral';
}

export function RequestsPage() {
  const { hasPermission } = useAuth();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const callIdFilter = searchParams.get('call_id') || '';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<MedicineRequestOut | null>(null);

  // Create Request State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [employeeNotes, setEmployeeNotes] = useState('');
  const [followupDue, setFollowupDue] = useState('');
  const [items, setItems] = useState<MedicineRequestItem[]>([
    {
      medicine_name: '',
      strength: '',
      dosage_form: '',
      quantity: '',
      availability_status: 'unknown',
      price_inquiry: false,
      quoted_price: '',
      verification_status: 'employee_confirmed',
      notes: '',
    },
  ]);
  const [saving, setSaving] = useState(false);

  // Update Modal State
  const [editStatus, setEditStatus] = useState('');
  const [editAssignee, setEditAssignee] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editResolution, setEditResolution] = useState('');
  const [editCancelReason, setEditCancelReason] = useState('');
  const [editFollowupAt, setEditFollowupAt] = useState('');
  const [editItems, setEditItems] = useState<MedicineRequestItem[]>([]);

  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (statusFilter) params.set('status', statusFilter);
  if (priorityFilter) params.set('priority', priorityFilter);
  if (callIdFilter) params.set('call_id', callIdFilter);

  const { data: requests, isLoading, error, refetch } = useQuery({
    queryKey: ['requests', search, statusFilter, priorityFilter, callIdFilter],
    queryFn: () => apiRequest<MedicineRequestOut[]>(`/api/requests?${params.toString()}`),
  });

  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => apiRequest<EmployeeOut[]>('/api/employees'),
  });

  const openDetail = (req: MedicineRequestOut) => {
    setSelected(req);
    setEditStatus(req.status);
    setEditAssignee(req.assigned_employee_id ? String(req.assigned_employee_id) : '');
    setEditNote('');
    setEditResolution(req.resolution_details || '');
    setEditCancelReason(req.cancellation_reason || '');
    setEditFollowupAt(req.required_followup_at ? req.required_followup_at.slice(0, 16) : '');
    setEditItems(req.items.map((i) => ({ ...i })));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter((i) => i.medicine_name.trim());
    if (validItems.length === 0) {
      notify('Add at least one medicine item.', 'error');
      return;
    }
    setSaving(true);
    try {
      const dueIso = followupDue ? new Date(followupDue).toISOString() : undefined;
      await apiRequest('/api/requests', {
        method: 'POST',
        body: {
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          priority,
          employee_notes: employeeNotes.trim() || undefined,
          required_followup_at: dueIso,
          create_followup: Boolean(dueIso),
          items: validItems.map((i) => ({
            ...i,
            strength: i.strength || null,
            dosage_form: i.dosage_form || null,
            quantity: i.quantity || null,
            quoted_price: i.quoted_price || null,
            notes: i.notes || null,
          })),
        },
      });
      notify('Medicine request created.');
      setCreateOpen(false);
      setCustomerName('');
      setCustomerPhone('');
      setEmployeeNotes('');
      setFollowupDue('');
      setItems([
        {
          medicine_name: '',
          strength: '',
          dosage_form: '',
          quantity: '',
          availability_status: 'unknown',
          price_inquiry: false,
          quoted_price: '',
          verification_status: 'employee_confirmed',
          notes: '',
        },
      ]);
      await queryClient.invalidateQueries({ queryKey: ['requests'] });
    } catch (err) {
      notify(err instanceof ApiError ? err.detail : 'Failed to create request.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    if (editStatus === 'cancelled' && !editCancelReason.trim()) {
      notify('Please provide a cancellation reason.', 'error');
      return;
    }
    const validEditItems = editItems.filter((i) => i.medicine_name.trim());
    if (validEditItems.length === 0) {
      notify('Request must keep at least one medicine item.', 'error');
      return;
    }
    setSaving(true);
    try {
      const updated = await apiRequest<MedicineRequestOut>(`/api/requests/${selected.id}`, {
        method: 'PATCH',
        body: {
          status: editStatus,
          assigned_employee_id: editAssignee ? Number(editAssignee) : undefined,
          resolution_details: editResolution.trim() || undefined,
          cancellation_reason: editCancelReason.trim() || undefined,
          required_followup_at: editFollowupAt ? new Date(editFollowupAt).toISOString() : undefined,
          status_note: editNote.trim() || undefined,
          items: validEditItems.map((i) => ({
            medicine_name: i.medicine_name.trim(),
            strength: i.strength || null,
            dosage_form: i.dosage_form || null,
            quantity: i.quantity || null,
            availability_status: i.availability_status,
            price_inquiry: i.price_inquiry,
            quoted_price: i.quoted_price || null,
            verification_status: i.verification_status,
            notes: i.notes || null,
          })),
        },
      });
      setSelected(updated);
      setEditItems(updated.items.map((i) => ({ ...i })));
      setEditNote('');
      notify(`Request ${updated.request_reference} updated.`);
      await queryClient.invalidateQueries({ queryKey: ['requests'] });
    } catch (err) {
      notify(err instanceof ApiError ? err.detail : 'Failed to update request.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const canUpdate = hasPermission('requests:update_own', 'requests:update_branch');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customer & Medicine Requests"
        subtitle="Track multi-item medicine inquiries through availability checks, follow-ups, and verified resolution."
        actions={
          hasPermission('requests:create') ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New Medicine Request
            </Button>
          ) : undefined
        }
      />

      <Card className="p-4 space-y-2">
        {callIdFilter && (
          <div className="flex items-center justify-between rounded-lg border border-[#DBE2EF] bg-[#DBE2EF]/35 px-3 py-1.5 text-xs">
            <span>Filtered to Call ID #{callIdFilter}</span>
            <button
              type="button"
              onClick={() => {
                searchParams.delete('call_id');
                setSearchParams(searchParams);
              }}
              className="font-semibold text-[#3F72AF] hover:underline cursor-pointer"
            >
              Clear Call Filter
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-[#112D4E]/45" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reference, customer, phone..."
              className={`${inputClass} pl-9`}
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputClass}>
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className={inputClass}>
            <option value="">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </div>
      </Card>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorBanner message={(error as Error).message} onRetry={() => void refetch()} />
      ) : !requests || requests.length === 0 ? (
        <EmptyState
          title="No customer medicine requests found"
          description="Requests created from the Live Call Desk or manually will appear here."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F9F7F7] text-xs uppercase text-[#112D4E]/65">
                <tr>
                  <th className="px-4 py-3">Request Ref</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Medicines</th>
                  <th className="px-4 py-3">Branch / Assignee</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DBE2EF]">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-[#F9F7F7]/70">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-[#3F72AF]">
                      {r.request_reference}
                      {r.call_reference && (
                        <div className="text-[11px] text-[#112D4E]/55">Call: {r.call_reference}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#112D4E]">{r.customer_name}</div>
                      <div className="text-xs text-[#112D4E]/60">{r.customer_phone}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.items.map((item, idx) => (
                        <div key={idx} className="font-medium text-[#112D4E]">
                          • {item.medicine_name} {item.strength || ''}{' '}
                          {item.quantity ? `(${item.quantity})` : ''}
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-medium">{r.branch_name || `Branch #${r.branch_id}`}</div>
                      <div className="text-[#112D4E]/60">{r.assigned_employee_name || 'Unassigned'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={r.priority === 'urgent' ? 'red' : r.priority === 'high' ? 'amber' : 'neutral'}
                      >
                        {r.priority}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(r.status)}>{r.status.replace(/_/g, ' ')}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => openDetail(r)}>
                        <Eye className="h-3.5 w-3.5" />
                        Manage
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create Multi-Item Request Modal */}
      <Modal open={createOpen} title="Create Customer Medicine Request" onClose={() => setCreateOpen(false)} maxWidth="max-w-2xl">
        <form onSubmit={handleCreate} className="space-y-4 text-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold">Customer Name *</label>
              <input type="text" required value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Customer Phone *</label>
              <input type="tel" required value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className={inputClass} />
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
            <div>
              <label className="mb-1 block text-xs font-semibold">Follow-up Due (optional)</label>
              <input type="datetime-local" value={followupDue} onChange={(e) => setFollowupDue(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-[#112D4E]">Requested Medicines</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  setItems((prev) => [
                    ...prev,
                    {
                      medicine_name: '',
                      strength: '',
                      dosage_form: '',
                      quantity: '',
                      availability_status: 'unknown',
                      price_inquiry: false,
                      quoted_price: '',
                      verification_status: 'employee_confirmed',
                      notes: '',
                    },
                  ])
                }
              >
                <Plus className="h-3.5 w-3.5" /> Add Medicine
              </Button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 rounded-lg border border-[#DBE2EF] bg-[#F9F7F7] p-2.5">
                <input
                  type="text"
                  required
                  placeholder="Medicine Name *"
                  value={item.medicine_name}
                  onChange={(e) =>
                    setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, medicine_name: e.target.value } : x)))
                  }
                  className={`${inputClass} col-span-5`}
                />
                <input
                  type="text"
                  placeholder="Strength"
                  value={item.strength || ''}
                  onChange={(e) =>
                    setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, strength: e.target.value } : x)))
                  }
                  className={`${inputClass} col-span-3`}
                />
                <input
                  type="text"
                  placeholder="Quantity"
                  value={item.quantity || ''}
                  onChange={(e) =>
                    setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))
                  }
                  className={`${inputClass} col-span-3`}
                />
                <div className="col-span-1 flex items-center justify-center">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-rose-600 hover:text-rose-800 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold">Employee Notes</label>
            <textarea rows={2} value={employeeNotes} onChange={(e) => setEmployeeNotes(e.target.value)} className={inputClass} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              <ClipboardList className="h-4 w-4" />
              {saving ? 'Creating...' : 'Create Request'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Manage Request & Status History Modal */}
      <Modal
        open={Boolean(selected)}
        title={selected ? `Request ${selected.request_reference}` : ''}
        onClose={() => setSelected(null)}
        maxWidth="max-w-2xl"
      >
        {selected && (
          <div className="space-y-5 text-sm">
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-[#F9F7F7] p-3 text-xs">
              <div>
                <span className="text-[#112D4E]/60">Customer:</span>{' '}
                <strong>
                  {selected.customer_name} ({selected.customer_phone})
                </strong>
              </div>
              <div>
                <span className="text-[#112D4E]/60">Branch:</span> <strong>{selected.branch_name}</strong>
              </div>
              <div className="col-span-2">
                <span className="text-[#112D4E]/60">Items:</span>
                <div className="mt-1 space-y-1">
                  {selected.items.map((i) => (
                    <div key={i.id} className="flex items-center justify-between rounded border border-[#DBE2EF] bg-white px-2.5 py-1.5">
                      <span>
                        <strong>{i.medicine_name}</strong> {i.strength || ''} {i.dosage_form || ''}{' '}
                        {i.quantity ? `• Qty: ${i.quantity}` : ''}
                      </span>
                      <Badge tone="blue">{i.availability_status.replace(/_/g, ' ')}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {canUpdate && (
              <form onSubmit={handleUpdate} className="space-y-3 border-t border-[#DBE2EF] pt-4 text-xs">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold uppercase text-[#112D4E]">Edit Medicine Items</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setEditItems((prev) => [
                          ...prev,
                          {
                            medicine_name: '',
                            strength: '',
                            dosage_form: '',
                            quantity: '',
                            availability_status: 'unknown',
                            price_inquiry: false,
                            quoted_price: '',
                            verification_status: 'employee_confirmed',
                            notes: '',
                          },
                        ])
                      }
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Item
                    </Button>
                  </div>
                  {editItems.map((it, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-1.5 rounded-lg border border-[#DBE2EF] bg-[#F9F7F7] p-2">
                      <input
                        type="text"
                        required
                        placeholder="Medicine *"
                        value={it.medicine_name}
                        onChange={(e) =>
                          setEditItems((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, medicine_name: e.target.value } : x)),
                          )
                        }
                        className={`${inputClass} col-span-4`}
                      />
                      <input
                        type="text"
                        placeholder="Strength"
                        value={it.strength || ''}
                        onChange={(e) =>
                          setEditItems((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, strength: e.target.value } : x)),
                          )
                        }
                        className={`${inputClass} col-span-2`}
                      />
                      <input
                        type="text"
                        placeholder="Qty"
                        value={it.quantity || ''}
                        onChange={(e) =>
                          setEditItems((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)),
                          )
                        }
                        className={`${inputClass} col-span-2`}
                      />
                      <select
                        value={it.availability_status}
                        onChange={(e) =>
                          setEditItems((prev) =>
                            prev.map((x, i) =>
                              i === idx ? { ...x, availability_status: e.target.value as any } : x,
                            ),
                          )
                        }
                        className={`${inputClass} col-span-3`}
                      >
                        <option value="unknown">Unknown</option>
                        <option value="available">Available</option>
                        <option value="out_of_stock">Out of Stock</option>
                        <option value="order_required">Order Required</option>
                        <option value="partial">Partial</option>
                      </select>
                      <div className="col-span-1 flex items-center justify-center">
                        {editItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setEditItems((prev) => prev.filter((_, i) => i !== idx))}
                            aria-label="Remove medicine item"
                            className="text-rose-600 hover:text-rose-800 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block font-semibold">Workflow Status</label>
                    <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className={inputClass}>
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold">Follow-up Target</label>
                    <input
                      type="datetime-local"
                      value={editFollowupAt}
                      onChange={(e) => setEditFollowupAt(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  {hasPermission('requests:assign_branch') && (
                    <div>
                      <label className="mb-1 block font-semibold">Assigned Employee</label>
                      <select value={editAssignee} onChange={(e) => setEditAssignee(e.target.value)} className={inputClass}>
                        <option value="">Unassigned</option>
                        {(employees || []).map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.full_name} ({emp.employee_code})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {editStatus === 'cancelled' && (
                  <div>
                    <label className="mb-1 block font-semibold text-rose-700">Cancellation Reason *</label>
                    <input
                      type="text"
                      required
                      value={editCancelReason}
                      onChange={(e) => setEditCancelReason(e.target.value)}
                      placeholder="Explain why request was cancelled..."
                      className={inputClass}
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1 block font-semibold">Resolution Details</label>
                  <input
                    type="text"
                    value={editResolution}
                    onChange={(e) => setEditResolution(e.target.value)}
                    placeholder="Stock confirmed, customer informed, order reserved..."
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold">Status Change Note</label>
                  <input
                    type="text"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="Optional note logged to status history..."
                    className={inputClass}
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={saving}>
                    {saving ? 'Updating...' : 'Save Status Update'}
                  </Button>
                </div>
              </form>
            )}

            <div className="border-t border-[#DBE2EF] pt-4">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-[#112D4E]">
                <History className="h-3.5 w-3.5 text-[#3F72AF]" />
                Status Change History
              </h3>
              <div className="space-y-2">
                {selected.status_history.map((h) => (
                  <div key={h.id} className="rounded-lg border border-[#DBE2EF] bg-[#F9F7F7] px-3 py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">
                        {h.from_status ? `${h.from_status.replace(/_/g, ' ')} → ` : ''}
                        {h.to_status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[11px] text-[#112D4E]/60">
                        {new Date(h.changed_at).toLocaleString()}
                      </span>
                    </div>
                    {h.note && <div className="mt-0.5 text-[#112D4E]/75">{h.note}</div>}
                    {h.changed_by_name && <div className="text-[11px] text-[#112D4E]/55">By {h.changed_by_name}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
