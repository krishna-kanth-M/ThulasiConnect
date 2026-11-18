import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Cpu, KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '../features/authentication/AuthContext';
import { apiRequest, ApiError } from '../services/api';
import { Badge, Button, Card, inputClass, PageHeader, useToast } from '../components/ui';

export function SettingsPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: aiStatus } = useQuery({
    queryKey: ['transcription', 'status'],
    queryFn: () => apiRequest<any>('/api/transcription/status'),
  });

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: { current_password: currentPassword, new_password: newPassword },
      });
      notify('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      notify(err instanceof ApiError ? err.detail : 'Failed to change password.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Account & Local AI Settings"
        subtitle="Review your assigned role permissions, update your password, and inspect local CPU speech/LLM readiness."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-5 space-y-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#112D4E]">
            <ShieldCheck className="h-4 w-4 text-[#3F72AF]" />
            Profile & Authorization Scope
          </h2>
          <div className="space-y-2 text-xs">
            <div>Name: <strong>{user?.full_name}</strong></div>
            <div>Email: <strong>{user?.email}</strong></div>
            <div>Primary Role: <Badge tone="navy">{user?.primary_role}</Badge></div>
            <div>Data Scope: <Badge tone="blue">{user?.scope_level}</Badge></div>
            <div>Branch: <strong>{user?.branch_name || 'Organization / Zonal Scope'}</strong></div>
            <div>Zone: <strong>{user?.zone_name || 'Organization Scope'}</strong></div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-3 border-t border-[#DBE2EF] pt-4 text-xs">
            <h3 className="flex items-center gap-1.5 font-bold text-[#112D4E]">
              <KeyRound className="h-3.5 w-3.5 text-[#3F72AF]" />
              Change Password
            </h3>
            <div>
              <label className="mb-1 block font-semibold">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold">New Password (min 8 characters)</label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
              />
            </div>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#112D4E]">
            <Cpu className="h-4 w-4 text-[#3F72AF]" />
            Local Speech-to-Text & LLM Runtime Status
          </h2>
          {aiStatus ? (
            <div className="space-y-3 text-xs">
              <div className="rounded-lg border border-[#DBE2EF] bg-[#F9F7F7] p-3 space-y-1">
                <div className="font-semibold text-[#112D4E]">Faster-Whisper (Speech-to-Text)</div>
                <div>Model: <strong>{aiStatus.speech_to_text.model_size}</strong> ({aiStatus.speech_to_text.device} / {aiStatus.speech_to_text.compute_type})</div>
                <div>VAD Filter: <strong>{aiStatus.speech_to_text.vad_filter ? 'Enabled (Silero)' : 'Disabled'}</strong></div>
                <div>Audio Storage: <Badge tone="green">Disabled (In-Memory Only)</Badge></div>
              </div>
              <div className="rounded-lg border border-[#DBE2EF] bg-[#F9F7F7] p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#112D4E]">Local Ollama LLM</span>
                  <Badge tone={aiStatus.local_llm.available ? 'green' : 'amber'}>
                    {aiStatus.local_llm.available ? 'Online' : 'Offline (Fallback Active)'}
                  </Badge>
                </div>
                <div>Configured Model: <strong>{aiStatus.local_llm.configured_model}</strong></div>
                <div>Endpoint: <code>{aiStatus.local_llm.endpoint}</code></div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#112D4E]/60">Checking local AI services...</p>
          )}
        </Card>
      </div>
    </div>
  );
}
