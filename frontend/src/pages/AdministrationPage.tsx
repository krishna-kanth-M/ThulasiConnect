import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Edit2,
  FileSpreadsheet,
  PlugZap,
  Plus,
  Save,
  ScrollText,
  Settings2,
  Shield,
  Sliders,
  Upload,
  Users,
} from 'lucide-react';
import { apiRequest, ApiError } from '../services/api';
import type {
  AuditLogOut,
  BranchOut,
  IntegrationConfigOut,
  PermissionOut,
  RoleOut,
  ShopAidCatalogItemOut,
  UserSummary,
  ZoneOut,
} from '../types/api';
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

type AdminTab = 'users' | 'roles' | 'integrations' | 'policy' | 'audit';

export function AdministrationPage() {
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<AdminTab>('users');

  // Create / Edit User Modal
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserSummary | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['pharmacist']);
  const [branchId, setBranchId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [saving, setSaving] = useState(false);

  // Role Permission Editor
  const [editingRole, setEditingRole] = useState<RoleOut | null>(null);
  const [rolePermDraft, setRolePermDraft] = useState<string[]>([]);

  // Integration Config Modal
  const [editingIntegration, setEditingIntegration] = useState<IntegrationConfigOut | null>(null);
  const [intEndpoint, setIntEndpoint] = useState('');
  const [intMode, setIntMode] = useState<'read_only' | 'csv_fallback' | 'webhook_listener'>('read_only');
  const [intMessage, setIntMessage] = useState('');

  // Policy State
  const [bmMins, setBmMins] = useState('60');
  const [zmMins, setZmMins] = useState('240');
  const [ownerMins, setOwnerMins] = useState('1440');

  // ShopAid CSV Upload & Result Feedback
  const [csvUploading, setCsvUploading] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [lastCsvSummary, setLastCsvSummary] = useState<{
    imported: number;
    updated: number;
    duplicate_skus_in_file?: number;
    failed_count?: number;
    failed_rows?: Array<{ row: number; reason: string }>;
  } | null>(null);

  // Audit Log Filters
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditEntityFilter, setAuditEntityFilter] = useState('');
  const [auditActorFilter, setAuditActorFilter] = useState('');

  const { data: users, isLoading: loadingUsers, error: usersErr } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => apiRequest<UserSummary[]>('/api/users'),
    enabled: tab === 'users',
  });

  const { data: roles } = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: () => apiRequest<RoleOut[]>('/api/roles'),
  });

  const { data: allPermissions } = useQuery({
    queryKey: ['admin', 'permissions'],
    queryFn: () => apiRequest<PermissionOut[]>('/api/permissions'),
    enabled: tab === 'roles',
  });

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => apiRequest<BranchOut[]>('/api/branches'),
  });

  const { data: zones } = useQuery({
    queryKey: ['zones'],
    queryFn: () => apiRequest<ZoneOut[]>('/api/zones'),
  });

  const { data: integrations } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => apiRequest<IntegrationConfigOut[]>('/api/integrations'),
    enabled: tab === 'integrations',
  });

  const { data: catalogItems } = useQuery({
    queryKey: ['shopaid', 'catalog', catalogSearch],
    queryFn: () =>
      apiRequest<ShopAidCatalogItemOut[]>(`/api/integrations/shopaid/catalog?q=${encodeURIComponent(catalogSearch)}`),
    enabled: tab === 'integrations',
  });

  const { data: policy } = useQuery({
    queryKey: ['settings', 'escalation-policy'],
    queryFn: () =>
      apiRequest<{
        branch_manager_overdue_minutes: number;
        zonal_manager_overdue_minutes: number;
        owner_overdue_minutes: number;
      }>('/api/settings/escalation-policy'),
    enabled: tab === 'policy',
  });

  useEffect(() => {
    if (policy) {
      setBmMins(String(policy.branch_manager_overdue_minutes));
      setZmMins(String(policy.zonal_manager_overdue_minutes));
      setOwnerMins(String(policy.owner_overdue_minutes));
    }
  }, [policy]);

  const auditParams = new URLSearchParams({ limit: '100' });
  if (auditActionFilter.trim()) auditParams.set('action', auditActionFilter.trim());
  if (auditEntityFilter) auditParams.set('entity_type', auditEntityFilter);
  if (auditActorFilter.trim()) auditParams.set('actor_email', auditActorFilter.trim());

  const { data: auditLogs, isLoading: loadingAudit } = useQuery({
    queryKey: ['admin', 'audit-logs', auditActionFilter, auditEntityFilter, auditActorFilter],
    queryFn: () => apiRequest<AuditLogOut[]>(`/api/audit-logs?${auditParams.toString()}`),
    enabled: tab === 'audit',
  });

  const openCreateUser = () => {
    setEditingUser(null);
    setFullName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setSelectedRoles(['pharmacist']);
    setBranchId('');
    setZoneId('');
    setUserModalOpen(true);
  };

  const openEditUser = (u: UserSummary) => {
    setEditingUser(u);
    setFullName(u.full_name);
    setEmail(u.email);
    setPhone(u.phone || '');
    setPassword('');
    setSelectedRoles([...u.roles]);
    setBranchId(u.branch_id ? String(u.branch_id) : '');
    setZoneId(u.zone_id ? String(u.zone_id) : '');
    setUserModalOpen(true);
  };

  const toggleRoleSelection = (code: string) => {
    setSelectedRoles((prev) =>
      prev.includes(code) ? prev.filter((r) => r !== code) : [...prev, code],
    );
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRoles.length === 0) {
      notify('Select at least one role.', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editingUser) {
        const body: Record<string, any> = {
          full_name: fullName.trim(),
          phone: phone.trim(),
          branch_id: branchId ? Number(branchId) : 0,
          zone_id: zoneId ? Number(zoneId) : 0,
        };
        const rolesChanged =
          selectedRoles.length !== editingUser.roles.length ||
          selectedRoles.some((r) => !editingUser.roles.includes(r));
        if (rolesChanged) {
          body.role_codes = selectedRoles;
        }
        if (password.trim()) {
          body.reset_password = password.trim();
        }
        await apiRequest(`/api/users/${editingUser.id}`, { method: 'PATCH', body });
        notify(`Updated user ${fullName.trim()}.`);
      } else {
        await apiRequest('/api/users', {
          method: 'POST',
          body: {
            full_name: fullName.trim(),
            email: email.trim(),
            phone: phone.trim() || undefined,
            password,
            role_codes: selectedRoles,
            branch_id: branchId ? Number(branchId) : null,
            zone_id: zoneId ? Number(zoneId) : null,
          },
        });
        notify('User account created.');
      }
      setUserModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    } catch (err) {
      notify(err instanceof ApiError ? err.detail : 'Failed to save user.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (u: UserSummary) => {
    try {
      await apiRequest(`/api/users/${u.id}`, {
        method: 'PATCH',
        body: { is_active: !u.is_active },
      });
      notify(`${u.full_name} ${u.is_active ? 'deactivated' : 'activated'}.`);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    } catch (err) {
      notify(err instanceof ApiError ? err.detail : 'Status change failed.', 'error');
    }
  };

  const handleSaveRolePermissions = async () => {
    if (!editingRole) return;
    setSaving(true);
    try {
      await apiRequest(`/api/roles/${editingRole.id}/permissions`, {
        method: 'PUT',
        body: { permission_codes: rolePermDraft },
      });
      notify(`Updated permissions for ${editingRole.name}. Takes effect immediately.`);
      setEditingRole(null);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
    } catch (err) {
      notify(err instanceof ApiError ? err.detail : 'Failed to update role permissions.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveIntegrationConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIntegration) return;
    setSaving(true);
    try {
      await apiRequest(`/api/integrations/${editingIntegration.integration_key}`, {
        method: 'PATCH',
        body: {
          endpoint_url: intEndpoint.trim(),
          mode: intMode,
          status_message: intMessage.trim() || undefined,
        },
      });
      notify(`Updated integration configuration for ${editingIntegration.display_name}.`);
      setEditingIntegration(null);
      await queryClient.invalidateQueries({ queryKey: ['integrations'] });
    } catch (err) {
      notify(err instanceof ApiError ? err.detail : 'Failed to update integration.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest('/api/settings/escalation-policy', {
        method: 'PUT',
        body: {
          branch_manager_overdue_minutes: Number(bmMins),
          zonal_manager_overdue_minutes: Number(zmMins),
          owner_overdue_minutes: Number(ownerMins),
        },
      });
      notify('Escalation thresholds updated.');
    } catch (err) {
      notify(err instanceof ApiError ? err.detail : 'Policy update failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadShopAidCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiRequest<any>('/api/integrations/shopaid/import-csv', {
        method: 'POST',
        formData: fd,
      });
      setLastCsvSummary(res);
      notify(
        `CSV synced (${res.imported} added, ${res.updated} updated, ${res.failed_count || 0} failed). Live ShopAid API remains blocked/disconnected.`,
      );
      await queryClient.invalidateQueries({ queryKey: ['integrations'] });
      await queryClient.invalidateQueries({ queryKey: ['shopaid'] });
    } catch (err) {
      notify(err instanceof ApiError ? err.detail : 'CSV import failed.', 'error');
    } finally {
      setCsvUploading(false);
      e.target.value = '';
    }
  };

  const tabs: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
    { id: 'users', label: 'Users & Access', icon: <Users className="h-4 w-4" /> },
    { id: 'roles', label: 'Roles & Permissions', icon: <Shield className="h-4 w-4" /> },
    { id: 'integrations', label: 'Integrations (ShopAid, Telephony & Alerts)', icon: <PlugZap className="h-4 w-4" /> },
    { id: 'policy', label: 'Escalation Policy', icon: <Sliders className="h-4 w-4" /> },
    { id: 'audit', label: 'Audit Logs', icon: <ScrollText className="h-4 w-4" /> },
  ];

  const shopaidConfig = (integrations || []).find((i) => i.integration_key === 'shopaid_inventory');
  const shopaidHistory: Array<any> = shopaidConfig?.config?.import_history || [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="System Administration"
        subtitle="Separately controlled administration for user accounts, authoritative RBAC permissions, external adapters, escalation policies, and filterable audit trails."
      />

      <div className="flex flex-wrap gap-2 border-b border-[#DBE2EF] pb-3">
        {tabs.map((t) => (
          <Button
            key={t.id}
            size="sm"
            variant={tab === t.id ? 'primary' : 'outline'}
            onClick={() => setTab(t.id)}
          >
            {t.icon}
            {t.label}
          </Button>
        ))}
      </div>

      {/* USERS TAB */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={openCreateUser}>
              <Plus className="h-4 w-4" />
              Create User Account
            </Button>
          </div>
          {loadingUsers ? (
            <LoadingState />
          ) : usersErr ? (
            <ErrorBanner message={(usersErr as Error).message} />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#F9F7F7] text-xs uppercase text-[#112D4E]/65">
                    <tr>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Roles</th>
                      <th className="px-4 py-3">Branch / Zone</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Controls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DBE2EF]">
                    {(users || []).map((u) => (
                      <tr key={u.id} className="hover:bg-[#F9F7F7]/70">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-[#112D4E]">{u.full_name}</div>
                          <div className="text-xs text-[#112D4E]/60">{u.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {u.roles.map((r) => (
                              <Badge key={r} tone="blue">
                                {r}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div>{u.branch_name || '—'}</div>
                          <div className="text-[#112D4E]/55">{u.zone_name || ''}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={u.is_active ? 'green' : 'red'}>{u.is_active ? 'Active' : 'Inactive'}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                          <Button size="sm" variant="outline" onClick={() => openEditUser(u)}>
                            <Edit2 className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void handleToggleActive(u)}>
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ROLES & AUTHORITATIVE PERMISSIONS TAB */}
      {tab === 'roles' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {(roles || []).map((r) => (
            <Card key={r.id} className="p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-[#112D4E]">{r.name}</h3>
                  <Badge tone="navy">Level {r.hierarchy_level}</Badge>
                </div>
                <p className="mt-1 text-xs text-[#112D4E]/65">{r.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {r.permissions.map((p) => (
                    <Badge key={p} tone="neutral">
                      {p}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#DBE2EF] flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingRole(r);
                    setRolePermDraft([...r.permissions]);
                  }}
                >
                  <Shield className="h-3.5 w-3.5" />
                  Edit Permissions ({r.permissions.length})
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* INTEGRATIONS TAB */}
      {tab === 'integrations' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {(integrations || []).map((cfg) => (
              <Card key={cfg.id} className="p-5 flex flex-col justify-between space-y-3">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-[#112D4E]">{cfg.display_name}</h3>
                    <Badge
                      tone={
                        cfg.status === 'connected'
                          ? 'green'
                          : cfg.status === 'csv_fallback_only' || cfg.status === 'configured_unverified'
                            ? 'amber'
                            : 'red'
                      }
                    >
                      {cfg.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <p className="text-xs leading-relaxed text-[#112D4E]/80">{cfg.status_message}</p>
                  <div className="rounded-lg bg-[#F9F7F7] p-3 text-xs space-y-1">
                    <div>Mode: <strong>{cfg.mode}</strong></div>
                    <div>Endpoint: <code className="break-all">{cfg.endpoint_url || 'Not configured'}</code></div>
                    <div>
                      Last Sync: {cfg.last_synced_at ? new Date(cfg.last_synced_at).toLocaleString() : 'Never'}
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t border-[#DBE2EF] flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingIntegration(cfg);
                      setIntEndpoint(cfg.endpoint_url || '');
                      setIntMode((cfg.mode as any) || 'read_only');
                      setIntMessage(cfg.status_message || '');
                    }}
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    Configure Adapter
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <Card className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-[#112D4E]">
                  <FileSpreadsheet className="h-4 w-4 text-[#3F72AF]" />
                  ShopAid Read-Only CSV Reference Catalog Fallback
                </h3>
                <p className="text-xs text-[#112D4E]/65">
                  Upload UTF-8 CSV (<code>sku,medicine_name,strength,dosage_form,manufacturer,mrp_price,stock_status</code>). Never writes to ShopAid.
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#3F72AF] px-4 py-2 text-xs font-medium text-white hover:bg-[#325d91]">
                <Upload className="h-3.5 w-3.5" />
                {csvUploading ? 'Importing...' : 'Import Reference CSV'}
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleUploadShopAidCsv} />
              </label>
            </div>

            {lastCsvSummary && (
              <div className="rounded-lg border border-[#DBE2EF] bg-[#F9F7F7] p-3 text-xs space-y-1">
                <div className="font-semibold text-[#112D4E]">
                  Last Import Summary: {lastCsvSummary.imported} added • {lastCsvSummary.updated} updated •{' '}
                  {lastCsvSummary.duplicate_skus_in_file || 0} duplicate SKU(s) • {lastCsvSummary.failed_count || 0} failed row(s)
                </div>
                {lastCsvSummary.failed_rows && lastCsvSummary.failed_rows.length > 0 && (
                  <div className="text-rose-700">
                    Failed rows: {lastCsvSummary.failed_rows.map((f) => `Row ${f.row} (${f.reason})`).join('; ')}
                  </div>
                )}
              </div>
            )}

            {shopaidHistory.length > 0 && (
              <div className="rounded-lg border border-[#DBE2EF] bg-white p-3 text-xs">
                <div className="mb-1.5 font-semibold text-[#112D4E]">Recent CSV Import History</div>
                <div className="space-y-1">
                  {shopaidHistory.slice(0, 5).map((h, i) => (
                    <div key={i} className="flex flex-wrap justify-between text-[11px] text-[#112D4E]/75">
                      <span>
                        <strong>{h.filename}</strong> — +{h.imported} / ~{h.updated} / {h.failed_count} failed
                      </span>
                      <span className="font-mono">{new Date(h.imported_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <input
              type="text"
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder="Filter imported CSV reference catalog..."
              className={inputClass}
            />

            {!catalogItems || catalogItems.length === 0 ? (
              <EmptyState
                title="No CSV reference items imported"
                description="Live ShopAid API is BLOCKED BY EXTERNAL DEPENDENCY. Upload a CSV export above to enable reference medicine lookups."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F9F7F7] uppercase text-[#112D4E]/65">
                    <tr>
                      <th className="px-3 py-2">SKU</th>
                      <th className="px-3 py-2">Medicine</th>
                      <th className="px-3 py-2">Strength / Form</th>
                      <th className="px-3 py-2">MRP</th>
                      <th className="px-3 py-2">Snapshot Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DBE2EF]">
                    {catalogItems.map((i) => (
                      <tr key={i.id}>
                        <td className="px-3 py-2 font-mono">{i.sku}</td>
                        <td className="px-3 py-2 font-semibold">{i.medicine_name}</td>
                        <td className="px-3 py-2">{i.strength || '—'} {i.dosage_form || ''}</td>
                        <td className="px-3 py-2">{i.mrp_price ? `Rs.${i.mrp_price}` : '—'}</td>
                        <td className="px-3 py-2">
                          <Badge tone="amber">{i.stock_status_snapshot}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ESCALATION POLICY TAB */}
      {tab === 'policy' && (
        <Card className="max-w-xl p-6">
          <h3 className="text-sm font-bold text-[#112D4E]">Hierarchical Escalation Thresholds</h3>
          <p className="mt-1 text-xs text-[#112D4E]/65">
            Evaluated automatically every 60 seconds by the local background scheduler. Default SLAs: 60 / 240 / 1440 min.
          </p>
          <form onSubmit={handleSavePolicy} className="mt-4 space-y-4 text-sm">
            <div>
              <label className="mb-1 block text-xs font-semibold">Level 1 — Branch Manager Escalation (minutes overdue)</label>
              <input type="number" min={5} required value={bmMins} onChange={(e) => setBmMins(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Level 2 — Zonal Manager Escalation (minutes overdue)</label>
              <input type="number" min={15} required value={zmMins} onChange={(e) => setZmMins(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Level 3 — Owner Critical Escalation (minutes overdue)</label>
              <input type="number" min={30} required value={ownerMins} onChange={(e) => setOwnerMins(e.target.value)} className={inputClass} />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving Policy...' : 'Save Escalation Policy'}
            </Button>
          </form>
        </Card>
      )}

      {/* AUDIT LOGS TAB WITH FILTERS */}
      {tab === 'audit' && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input
                type="text"
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                placeholder="Filter by action (e.g. auth.login, admin.user)..."
                className={inputClass}
              />
              <select
                aria-label="Entity Type Filter"
                value={auditEntityFilter}
                onChange={(e) => setAuditEntityFilter(e.target.value)}
                className={inputClass}
              >
                <option value="">All Entity Types</option>
                <option value="user">user</option>
                <option value="role">role</option>
                <option value="branch">branch</option>
                <option value="zone">zone</option>
                <option value="customer">customer</option>
                <option value="call">call</option>
                <option value="call_transcript">call_transcript</option>
                <option value="medicine_request">medicine_request</option>
                <option value="follow_up">follow_up</option>
                <option value="escalation">escalation</option>
                <option value="integration_config">integration_config</option>
                <option value="shopaid_catalog">shopaid_catalog</option>
                <option value="app_setting">app_setting</option>
              </select>
              <input
                type="text"
                value={auditActorFilter}
                onChange={(e) => setAuditActorFilter(e.target.value)}
                placeholder="Filter by actor email..."
                className={inputClass}
              />
            </div>
          </Card>

          {loadingAudit ? (
            <LoadingState />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F9F7F7] uppercase text-[#112D4E]/65">
                    <tr>
                      <th className="px-4 py-2.5">Timestamp</th>
                      <th className="px-4 py-2.5">Actor</th>
                      <th className="px-4 py-2.5">Action</th>
                      <th className="px-4 py-2.5">Entity</th>
                      <th className="px-4 py-2.5">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DBE2EF]">
                    {(auditLogs || []).map((log) => (
                      <tr key={log.id} className="hover:bg-[#F9F7F7]/70">
                        <td className="px-4 py-2.5 font-mono whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5">{log.actor_email || 'System'}</td>
                        <td className="px-4 py-2.5">
                          <Badge tone="blue">{log.action}</Badge>
                        </td>
                        <td className="px-4 py-2.5 font-mono">
                          {log.entity_type}
                          {log.entity_id ? `#${log.entity_id}` : ''}
                        </td>
                        <td className="px-4 py-2.5 max-w-md truncate font-mono text-[11px] text-[#112D4E]/75">
                          {log.details ? JSON.stringify(log.details) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Create / Edit User Modal (Multi-Role Supported) */}
      <Modal
        open={userModalOpen}
        title={editingUser ? `Edit User — ${editingUser.email}` : 'Create User Account'}
        onClose={() => setUserModalOpen(false)}
      >
        <form onSubmit={handleSaveUser} className="space-y-3 text-sm">
          <div>
            <label className="mb-1 block text-xs font-semibold">Full Name *</label>
            <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
          </div>
          {!editingUser && (
            <div>
              <label className="mb-1 block text-xs font-semibold">Work Email *</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold">Phone</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">
                {editingUser ? 'Reset Password (optional, min 8)' : 'Initial Password (min 8) *'}
              </label>
              <input
                type="password"
                required={!editingUser}
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold">Assigned Roles *</label>
            <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-[#DBE2EF] bg-[#F9F7F7] p-2.5 text-xs">
              {(roles || []).map((r) => (
                <label key={r.code} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(r.code)}
                    onChange={() => toggleRoleSelection(r.code)}
                  />
                  <span>{r.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold">Assigned Branch</label>
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputClass}>
                <option value="">None</option>
                {(branches || []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Assigned Zone</label>
              <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className={inputClass}>
                <option value="">Auto / None</option>
                {(zones || []).map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setUserModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : editingUser ? 'Save User' : 'Create User'}</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Role Permissions Modal */}
      <Modal
        open={Boolean(editingRole)}
        title={editingRole ? `Edit Permissions — ${editingRole.name}` : ''}
        onClose={() => setEditingRole(null)}
        maxWidth="max-w-2xl"
      >
        {editingRole && (
          <div className="space-y-4 text-xs">
            <p className="text-[#112D4E]/75">
              Changes persist to PostgreSQL <code>role_permissions</code> and take effect immediately on API requests and user sessions.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 max-h-96 overflow-y-auto rounded-lg border border-[#DBE2EF] bg-[#F9F7F7] p-3">
              {(allPermissions || []).map((p) => {
                const checked = rolePermDraft.includes(p.code);
                return (
                  <label key={p.code} className="flex items-start gap-2 rounded bg-white p-2 border border-[#DBE2EF] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setRolePermDraft((prev) =>
                          prev.includes(p.code) ? prev.filter((x) => x !== p.code) : [...prev, p.code],
                        )
                      }
                    />
                    <div>
                      <div className="font-mono font-semibold text-[#112D4E]">{p.code}</div>
                      {p.description && <div className="text-[11px] text-[#112D4E]/60">{p.description}</div>}
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingRole(null)}>Cancel</Button>
              <Button type="button" disabled={saving} onClick={handleSaveRolePermissions}>
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Saving...' : 'Save Role Permissions'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Configure Integration Adapter Modal */}
      <Modal
        open={Boolean(editingIntegration)}
        title={editingIntegration ? `Configure Adapter — ${editingIntegration.display_name}` : ''}
        onClose={() => setEditingIntegration(null)}
      >
        <form onSubmit={handleSaveIntegrationConfig} className="space-y-3 text-sm">
          <div>
            <label className="mb-1 block text-xs font-semibold">Endpoint URL (leave blank if not configured)</label>
            <input
              type="text"
              value={intEndpoint}
              onChange={(e) => setIntEndpoint(e.target.value)}
              placeholder="https://... (only enter verified vendor URL)"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Adapter Mode</label>
            <select value={intMode} onChange={(e) => setIntMode(e.target.value as any)} className={inputClass}>
              <option value="read_only">read_only</option>
              <option value="csv_fallback">csv_fallback</option>
              <option value="webhook_listener">webhook_listener</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Status Notes</label>
            <textarea rows={3} value={intMessage} onChange={(e) => setIntMessage(e.target.value)} className={inputClass} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditingIntegration(null)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Configuration'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
