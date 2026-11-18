import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Building2, Plus, Settings2 } from 'lucide-react';
import { apiRequest, ApiError } from '../services/api';
import { useAuth } from '../features/authentication/AuthContext';
import type { BranchMetric, BranchOut, UserSummary, ZoneOut } from '../types/api';
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

export function BranchesPage() {
  const { hasPermission } = useAuth();
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<BranchOut | null>(null);

  // Form state
  const [zoneId, setZoneId] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [hours, setHours] = useState('08:00 - 22:00');
  const [escMinutes, setEscMinutes] = useState('60');
  const [managerUserId, setManagerUserId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const isAdmin = hasPermission('admin:branches');
  const canEditSettings = isAdmin || hasPermission('branches:manage_settings');

  const { data: branches, isLoading, error, refetch } = useQuery({
    queryKey: ['branches'],
    queryFn: () => apiRequest<BranchOut[]>('/api/branches'),
  });

  const { data: perf } = useQuery({
    queryKey: ['performance', 'branches'],
    queryFn: () => apiRequest<{ branches: BranchMetric[] }>('/api/performance/branches?days=30'),
    enabled: hasPermission('performance:read_branch', 'performance:read_zone', 'performance:read_org'),
  });

  const { data: zones } = useQuery({
    queryKey: ['zones'],
    queryFn: () => apiRequest<ZoneOut[]>('/api/zones'),
    enabled: isAdmin,
  });

  const { data: adminUsers } = useQuery({
    queryKey: ['admin', 'users', 'for-branches'],
    queryFn: () => apiRequest<UserSummary[]>('/api/users?is_active=true'),
    enabled: isAdmin,
  });

  const perfMap = new Map((perf?.branches || []).map((b) => [b.branch_id, b]));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest('/api/branches', {
        method: 'POST',
        body: {
          zone_id: Number(zoneId),
          code: code.trim(),
          name: name.trim(),
          city: city.trim(),
          phone_number: phone.trim() || undefined,
          operating_hours: hours.trim() || undefined,
          escalation_overdue_minutes: Number(escMinutes) || 60,
          branch_manager_user_id: managerUserId ? Number(managerUserId) : undefined,
        },
      });
      notify('Branch created.');
      setCreateOpen(false);
      setCode('');
      setName('');
      setCity('');
      setPhone('');
      setManagerUserId('');
      await queryClient.invalidateQueries({ queryKey: ['branches'] });
    } catch (err) {
      notify(err instanceof ApiError ? err.detail : 'Failed to create branch.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        phone_number: phone.trim() || undefined,
        operating_hours: hours.trim() || undefined,
        escalation_overdue_minutes: Number(escMinutes) || 60,
      };
      if (isAdmin) {
        payload.branch_manager_user_id = managerUserId ? Number(managerUserId) : 0;
        payload.is_active = isActive;
      }
      await apiRequest(`/api/branches/${editing.id}`, {
        method: 'PATCH',
        body: payload,
      });
      notify(`Updated settings for ${editing.name}.`);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ['branches'] });
    } catch (err) {
      notify(err instanceof ApiError ? err.detail : 'Failed to update branch.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Branch Directory & Operational Supervision"
        subtitle="Manage pharmacy branches, manager mappings, staffing integrity warnings, and 30-day call accountability."
        actions={
          isAdmin ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Branch
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorBanner message={(error as Error).message} onRetry={() => void refetch()} />
      ) : !branches || branches.length === 0 ? (
        <EmptyState title="No branches available" description="No branches are currently assigned to your role." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {branches.map((b) => {
            const m = perfMap.get(b.id);
            return (
              <Card key={b.id} className="p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-[#3F72AF]" />
                      <div>
                        <h3 className="text-sm font-bold text-[#112D4E]">{b.name}</h3>
                        <p className="text-xs text-[#112D4E]/60">
                          {b.code} • {b.city} • {b.zone_name || 'No zone'}
                        </p>
                      </div>
                    </div>
                    <Badge tone={b.is_active ? 'green' : 'neutral'}>{b.is_active ? 'Active' : 'Inactive'}</Badge>
                  </div>

                  {b.warnings && b.warnings.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {b.warnings.map((w, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900"
                        >
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 space-y-1.5 text-xs text-[#112D4E]/80">
                    <div>Manager: <strong>{b.branch_manager_name || 'Unassigned'}</strong></div>
                    <div>
                      Active Staff: <strong>{b.employee_count}</strong> ({b.pharmacist_count ?? 0} pharmacist(s))
                    </div>
                    <div>Phone: {b.phone_number || '—'} • Hours: {b.operating_hours || '—'}</div>
                    <div>Escalation Threshold: <strong>{b.escalation_overdue_minutes || 60} mins overdue</strong></div>
                  </div>

                  {m && (
                    <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-[#F9F7F7] p-2.5 text-center text-xs">
                      <div>
                        <div className="font-bold text-[#112D4E]">{m.registered_calls}</div>
                        <div className="text-[10px] text-[#112D4E]/60">Reg. Calls</div>
                      </div>
                      <div>
                        <div className="font-bold text-[#112D4E]">{m.pending_requests}</div>
                        <div className="text-[10px] text-[#112D4E]/60">Pending Reqs</div>
                      </div>
                      <div>
                        <div className="font-bold text-rose-600">{m.open_escalations}</div>
                        <div className="text-[10px] text-[#112D4E]/60">Escalations</div>
                      </div>
                    </div>
                  )}
                </div>

                {canEditSettings && (
                  <div className="mt-4 pt-3 border-t border-[#DBE2EF] flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditing(b);
                        setPhone(b.phone_number || '');
                        setHours(b.operating_hours || '');
                        setEscMinutes(String(b.escalation_overdue_minutes || 60));
                        setManagerUserId(b.branch_manager_user_id ? String(b.branch_manager_user_id) : '');
                        setIsActive(b.is_active);
                      }}
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      Branch Settings
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={createOpen} title="Add New Pharmacy Branch" onClose={() => setCreateOpen(false)}>
        <form onSubmit={handleCreate} className="space-y-3 text-sm">
          <div>
            <label className="mb-1 block text-xs font-semibold">Zone *</label>
            <select required value={zoneId} onChange={(e) => setZoneId(e.target.value)} className={inputClass}>
              <option value="">Select Zone</option>
              {(zones || []).map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name} ({z.code})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold">Branch Code *</label>
              <input type="text" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="CBE-PLM" className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">City *</label>
              <input type="text" required value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Branch Name *</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Branch Manager (optional)</label>
            <select value={managerUserId} onChange={(e) => setManagerUserId(e.target.value)} className={inputClass}>
              <option value="">Unassigned</option>
              {(adminUsers || []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.roles.join(', ')})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold">Phone</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Escalation Threshold (mins)</label>
              <input type="number" min={5} value={escMinutes} onChange={(e) => setEscMinutes(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create Branch'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(editing)} title={editing ? `Operational Settings — ${editing.name}` : ''} onClose={() => setEditing(null)}>
        <form onSubmit={handleSaveSettings} className="space-y-3 text-sm">
          <div>
            <label className="mb-1 block text-xs font-semibold">Branch Phone Number</label>
            <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Operating Hours</label>
            <input type="text" value={hours} onChange={(e) => setHours(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Overdue Follow-up Escalation Threshold (Minutes)</label>
            <input type="number" min={5} max={10080} value={escMinutes} onChange={(e) => setEscMinutes(e.target.value)} className={inputClass} />
          </div>
          {isAdmin && (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold">Assigned Branch Manager</label>
                <select value={managerUserId} onChange={(e) => setManagerUserId(e.target.value)} className={inputClass}>
                  <option value="">Unassigned</option>
                  {(adminUsers || []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.roles.join(', ')})
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs font-medium text-[#112D4E]">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                Branch is active
              </label>
            </>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
