import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, Plus, Search, UserRound } from 'lucide-react';
import { apiRequest, ApiError } from '../services/api';
import { useAuth } from '../features/authentication/AuthContext';
import type { BranchOut, CustomerOut } from '../types/api';
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

export function CustomersPage() {
  const { hasPermission } = useAuth();
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerOut | null>(null);

  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('ta-en');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const canWrite = hasPermission('customers:write');

  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (branchFilter) params.set('branch_id', branchFilter);

  const { data: customers, isLoading, error, refetch } = useQuery({
    queryKey: ['customers', search, branchFilter],
    queryFn: () => apiRequest<CustomerOut[]>(`/api/customers?${params.toString()}`),
  });

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => apiRequest<BranchOut[]>('/api/branches'),
  });

  const openCreate = () => {
    setEditing(null);
    setFullName('');
    setPhoneNumber('');
    setPreferredLanguage('ta-en');
    setNotes('');
    setModalOpen(true);
  };

  const openEdit = (c: CustomerOut) => {
    setEditing(c);
    setFullName(c.full_name);
    setPhoneNumber(c.phone_number);
    setPreferredLanguage(c.preferred_language || 'ta-en');
    setNotes(c.notes || '');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await apiRequest(`/api/customers/${editing.id}`, {
          method: 'PATCH',
          body: {
            full_name: fullName.trim(),
            phone_number: phoneNumber.trim(),
            preferred_language: preferredLanguage,
            notes: notes.trim() || null,
          },
        });
        notify('Customer details updated.');
      } else {
        await apiRequest('/api/customers', {
          method: 'POST',
          body: {
            full_name: fullName.trim(),
            phone_number: phoneNumber.trim(),
            preferred_language: preferredLanguage,
            notes: notes.trim() || undefined,
          },
        });
        notify('Customer registered in branch directory.');
      }
      setModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
    } catch (err) {
      notify(err instanceof ApiError ? err.detail : 'Failed to save customer.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const branchNameMap = new Map((branches || []).map((b) => [b.id, b.name]));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customer Directory"
        subtitle="Branch-scoped customer contact records with data minimization and call history counts."
        actions={
          canWrite ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Register Customer
            </Button>
          ) : undefined
        }
      />

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-[#112D4E]/45" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer name or phone number..."
              className={`${inputClass} pl-9`}
            />
          </div>
          {branches && branches.length > 1 && (
            <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className={inputClass}>
              <option value="">All Authorized Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </Card>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorBanner message={(error as Error).message} onRetry={() => void refetch()} />
      ) : !customers || customers.length === 0 ? (
        <EmptyState
          title="No customers found"
          description="Customers registered manually or automatically during call/request creation appear here."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F9F7F7] text-xs uppercase text-[#112D4E]/65">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Phone Number</th>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Preferred Language</th>
                  <th className="px-4 py-3">Calls Logged</th>
                  <th className="px-4 py-3">Notes</th>
                  {canWrite && <th className="px-4 py-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DBE2EF]">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-[#F9F7F7]/70">
                    <td className="px-4 py-3 font-semibold text-[#112D4E]">
                      <div className="flex items-center gap-2">
                        <UserRound className="h-4 w-4 text-[#3F72AF]" />
                        <span>{c.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{c.phone_number}</td>
                    <td className="px-4 py-3 text-xs">
                      {c.branch_id ? branchNameMap.get(c.branch_id) || `Branch #${c.branch_id}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="blue">{c.preferred_language}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold">{c.call_count}</td>
                    <td className="px-4 py-3 text-xs text-[#112D4E]/75 max-w-xs truncate">{c.notes || '—'}</td>
                    {canWrite && (
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                          <Edit2 className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={modalOpen}
        title={editing ? `Edit Customer — ${editing.full_name}` : 'Register Branch Customer'}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleSubmit} className="space-y-3 text-sm">
          <div>
            <label className="mb-1 block text-xs font-semibold">Full Name *</label>
            <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold">Phone Number *</label>
              <input type="tel" required value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Preferred Language</label>
              <select value={preferredLanguage} onChange={(e) => setPreferredLanguage(e.target.value)} className={inputClass}>
                <option value="ta-en">Tamil + English (Tanglish)</option>
                <option value="ta">Tamil</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Notes (Non-clinical callback preferences only)</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Customer'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
