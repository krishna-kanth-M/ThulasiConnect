import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, MapPin, Plus } from 'lucide-react';
import { apiRequest, ApiError } from '../services/api';
import { useAuth } from '../features/authentication/AuthContext';
import type { BranchMetric, UserSummary, ZoneOut } from '../types/api';
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

export function ZonesPage() {
  const { hasPermission } = useAuth();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = hasPermission('admin:zones');

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ZoneOut | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [zonalManagerId, setZonalManagerId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const { data: zones, isLoading, error, refetch } = useQuery({
    queryKey: ['zones'],
    queryFn: () => apiRequest<ZoneOut[]>('/api/zones'),
  });

  const { data: branchPerf } = useQuery({
    queryKey: ['performance', 'branches'],
    queryFn: () => apiRequest<{ branches: BranchMetric[] }>('/api/performance/branches?days=30'),
  });

  const { data: adminUsers } = useQuery({
    queryKey: ['admin', 'users', 'for-zones'],
    queryFn: () => apiRequest<UserSummary[]>('/api/users?is_active=true'),
    enabled: isAdmin,
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest('/api/zones', {
        method: 'POST',
        body: {
          code: code.trim(),
          name: name.trim(),
          region_description: desc.trim() || undefined,
          zonal_manager_user_id: zonalManagerId ? Number(zonalManagerId) : undefined,
        },
      });
      notify('Zone created.');
      setCreateOpen(false);
      setCode('');
      setName('');
      setDesc('');
      setZonalManagerId('');
      await queryClient.invalidateQueries({ queryKey: ['zones'] });
    } catch (err) {
      notify(err instanceof ApiError ? err.detail : 'Failed to create zone.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      await apiRequest(`/api/zones/${editing.id}`, {
        method: 'PATCH',
        body: {
          name: name.trim(),
          region_description: desc.trim() || null,
          zonal_manager_user_id: zonalManagerId ? Number(zonalManagerId) : 0,
          is_active: isActive,
        },
      });
      notify(`Updated zone ${name.trim()}.`);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ['zones'] });
    } catch (err) {
      notify(err instanceof ApiError ? err.detail : 'Failed to update zone.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Zones & Regional Supervision"
        subtitle="Compare branch accountability across authorized geographical zones."
        actions={
          isAdmin ? (
            <Button
              onClick={() => {
                setCode('');
                setName('');
                setDesc('');
                setZonalManagerId('');
                setCreateOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Add Zone
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorBanner message={(error as Error).message} onRetry={() => void refetch()} />
      ) : !zones || zones.length === 0 ? (
        <EmptyState title="No zones configured" description="Authorized zones will appear here." />
      ) : (
        <div className="space-y-5">
          {zones.map((z) => {
            const zBranches = (branchPerf?.branches || []).filter((b) => b.zone_id === z.id);
            return (
              <Card key={z.id} className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DBE2EF] bg-[#F9F7F7] px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <MapPin className="h-5 w-5 text-[#3F72AF]" />
                    <div>
                      <h2 className="text-sm font-bold text-[#112D4E]">
                        {z.name} <span className="font-mono text-xs text-[#112D4E]/55">({z.code})</span>
                      </h2>
                      <p className="text-xs text-[#112D4E]/65">
                        Zonal Manager: <strong>{z.zonal_manager_name || 'Unassigned'}</strong> • {z.region_description || 'No description'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="blue">{z.branch_count} Branches</Badge>
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(z);
                          setName(z.name);
                          setDesc(z.region_description || '');
                          setZonalManagerId(z.zonal_manager_user_id ? String(z.zonal_manager_user_id) : '');
                          setIsActive(z.is_active);
                        }}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        Edit Zone
                      </Button>
                    )}
                  </div>
                </div>

                {zBranches.length === 0 ? (
                  <div className="p-4 text-xs text-[#112D4E]/60">No branches mapped to this zone yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs uppercase text-[#112D4E]/60 border-b border-[#DBE2EF]">
                        <tr>
                          <th className="px-4 py-2.5">Branch</th>
                          <th className="px-4 py-2.5">Registered Calls</th>
                          <th className="px-4 py-2.5">Pending Reqs</th>
                          <th className="px-4 py-2.5">Resolved Reqs</th>
                          <th className="px-4 py-2.5">Overdue FU</th>
                          <th className="px-4 py-2.5">Open Escalations</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#DBE2EF]">
                        {zBranches.map((b) => (
                          <tr key={b.branch_id}>
                            <td className="px-4 py-2.5 font-medium">
                              {b.branch_name} <span className="text-xs text-[#112D4E]/55">({b.city})</span>
                            </td>
                            <td className="px-4 py-2.5">{b.registered_calls}</td>
                            <td className="px-4 py-2.5">{b.pending_requests}</td>
                            <td className="px-4 py-2.5">{b.resolved_requests}</td>
                            <td className="px-4 py-2.5">
                              <Badge tone={b.overdue_followups > 0 ? 'red' : 'green'}>{b.overdue_followups}</Badge>
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge tone={b.open_escalations > 0 ? 'amber' : 'neutral'}>{b.open_escalations}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={createOpen} title="Add New Zone" onClose={() => setCreateOpen(false)}>
        <form onSubmit={handleCreate} className="space-y-3 text-sm">
          <div>
            <label className="mb-1 block text-xs font-semibold">Zone Code *</label>
            <input type="text" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="TN-NORTH" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Zone Name *</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="North Tamil Nadu Zone" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Zonal Manager (optional)</label>
            <select value={zonalManagerId} onChange={(e) => setZonalManagerId(e.target.value)} className={inputClass}>
              <option value="">Unassigned</option>
              {(adminUsers || []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.roles.join(', ')})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Region Description</label>
            <textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} className={inputClass} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create Zone'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(editing)} title={editing ? `Edit Zone — ${editing.code}` : ''} onClose={() => setEditing(null)}>
        <form onSubmit={handleUpdate} className="space-y-3 text-sm">
          <div>
            <label className="mb-1 block text-xs font-semibold">Zone Name *</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Assigned Zonal Manager</label>
            <select value={zonalManagerId} onChange={(e) => setZonalManagerId(e.target.value)} className={inputClass}>
              <option value="">Unassigned</option>
              {(adminUsers || []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.roles.join(', ')})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Region Description</label>
            <textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} className={inputClass} />
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-[#112D4E]">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Zone is active
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Zone'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
