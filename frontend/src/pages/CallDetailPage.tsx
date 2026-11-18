import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, ShieldCheck } from 'lucide-react';
import { apiRequest, ApiError } from '../services/api';
import type { CallDetailOut, CallOutcomeOut, TranscriptSegment } from '../types/api';
import { useAuth } from '../features/authentication/AuthContext';
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

export function CallDetailPage() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const { data: call, isLoading, error, refetch } = useQuery({
    queryKey: ['calls', id],
    queryFn: () => apiRequest<CallDetailOut>(`/api/calls/${id}`),
    enabled: Boolean(id),
  });

  const { data: outcomes } = useQuery({
    queryKey: ['call-outcomes'],
    queryFn: () => apiRequest<CallOutcomeOut[]>('/api/call-outcomes'),
  });

  const [summary, setSummary] = useState('');
  const [regStatus, setRegStatus] = useState('registered');
  const [outcomeCode, setOutcomeCode] = useState('');
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (call) {
      setSummary(call.summary || '');
      setRegStatus(call.registration_status);
      setOutcomeCode(call.outcome_code || '');
      setSegments(call.transcript?.segments || []);
    }
  }, [call]);

  const canEdit = hasPermission('calls:update_own', 'calls:update_branch');

  const handleSaveChanges = async () => {
    if (!call) return;
    setSaving(true);
    try {
      await apiRequest(`/api/calls/${call.id}`, {
        method: 'PATCH',
        body: {
          summary: summary.trim() || undefined,
          registration_status: regStatus,
          outcome_code: outcomeCode,
        },
      });
      if (segments.length > 0) {
        await apiRequest(`/api/calls/${call.id}/transcript`, {
          method: 'POST',
          body: {
            language_detected: call.transcript?.language_detected || call.detected_language || 'ta-en',
            review_status: 'employee_edited',
            segments: segments.map((s, idx) => ({ ...s, sequence_index: idx })),
          },
        });
      }
      notify('Call details and transcript corrections saved.');
      await queryClient.invalidateQueries({ queryKey: ['calls', id] });
    } catch (err) {
      notify(err instanceof ApiError ? err.detail : 'Failed to update call.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <LoadingState />;
  if (error || !call) {
    return (
      <ErrorBanner
        message={error instanceof Error ? error.message : 'Unable to load call details.'}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Call ${call.call_reference}`}
        subtitle={`${call.branch_name || `Branch #${call.branch_id}`} • Started ${new Date(call.started_at).toLocaleString()}`}
        actions={
          <>
            <Link to="/calls">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4" />
                Back to Calls
              </Button>
            </Link>
            {canEdit && (
              <Button size="sm" disabled={saving} onClick={handleSaveChanges}>
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="p-5 space-y-3 text-sm">
          <h2 className="border-b border-[#DBE2EF] pb-2 font-bold text-[#112D4E]">Call Metadata</h2>
          <div className="flex justify-between text-xs">
            <span className="text-[#112D4E]/60">Source Type</span>
            <Badge tone={call.call_source_type === 'browser_microphone_test' ? 'amber' : 'blue'}>
              {call.call_source_type}
            </Badge>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[#112D4E]/60">Customer</span>
            <span className="font-semibold">
              {call.customer_name || 'Unspecified'} ({call.customer_phone || '—'})
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[#112D4E]/60">Employee</span>
            <span className="font-semibold">{call.employee_name || 'Unassigned'}</span>
          </div>

          <div className="pt-2 space-y-2.5 text-xs">
            <div>
              <label className="mb-1 block font-semibold">Registration Status</label>
              <select
                disabled={!canEdit}
                value={regStatus}
                onChange={(e) => setRegStatus(e.target.value)}
                className={inputClass}
              >
                <option value="draft">Draft</option>
                <option value="registered">Registered</option>
                <option value="completed">Completed</option>
                <option value="unregistered">Unregistered</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block font-semibold">Outcome</label>
              <select
                disabled={!canEdit}
                value={outcomeCode}
                onChange={(e) => setOutcomeCode(e.target.value)}
                className={inputClass}
              >
                <option value="">None selected</option>
                {(outcomes || []).map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-semibold">Summary</label>
              <textarea
                rows={4}
                disabled={!canEdit}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="rounded-lg border border-[#DBE2EF] bg-[#F9F7F7] p-3 text-[11px] text-[#112D4E]/80">
            <div className="flex items-center gap-1.5 font-semibold text-[#112D4E]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#3F72AF]" />
              <span>No Audio Stored</span>
            </div>
            <p className="mt-1">Audio playback is intentionally disabled. Only verified text transcripts are retained.</p>
          </div>

          {/* Linked Requests & Follow-Ups Navigation */}
          <div className="border-t border-[#DBE2EF] pt-3 space-y-2 text-xs">
            <div className="font-bold text-[#112D4E]">Linked Operational Records</div>
            <div className="flex items-center justify-between">
              <span className="text-[#112D4E]/70">Medicine Requests ({call.request_ids.length})</span>
              <Link to={`/requests?call_id=${call.id}`} className="font-semibold text-[#3F72AF] hover:underline">
                {call.request_ids.length > 0 ? `View Requests (${call.request_ids.map((r) => `#${r}`).join(', ')})` : 'Open Requests'}
              </Link>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#112D4E]/70">Scheduled Follow-ups ({call.followup_ids.length})</span>
              <Link to="/followups" className="font-semibold text-[#3F72AF] hover:underline">
                {call.followup_ids.length > 0 ? `View Follow-ups (${call.followup_ids.map((f) => `#${f}`).join(', ')})` : 'Open Follow-ups'}
              </Link>
            </div>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between border-b border-[#DBE2EF] pb-2">
            <div>
              <h2 className="text-sm font-bold text-[#112D4E]">Text Transcript Segments</h2>
              <p className="text-xs text-[#112D4E]/60">
                {call.transcript
                  ? `Model: ${call.transcript.model_used || 'N/A'} • Review: ${call.transcript.review_status}`
                  : 'No transcript stored for this call yet.'}
              </p>
            </div>
            {call.detected_language && <Badge tone="blue">Lang: {call.detected_language}</Badge>}
          </div>

          {segments.length === 0 ? (
            <EmptyState
              title="No transcript recorded"
              description="This call was registered without speech transcription segments."
            />
          ) : (
            <div className="space-y-2.5">
              {segments.map((seg, idx) => (
                <div key={idx} className="rounded-lg border border-[#DBE2EF] bg-[#F9F7F7] p-3 text-xs">
                  <div className="mb-1 flex items-center justify-between text-[11px] text-[#112D4E]/65">
                    <div className="flex items-center gap-2">
                      <Badge tone="navy">{seg.speaker_label}</Badge>
                      <span className="font-mono">
                        {seg.start_seconds.toFixed(1)}s – {seg.end_seconds.toFixed(1)}s
                      </span>
                    </div>
                    {seg.confidence !== null && <span>Conf: {Math.round(seg.confidence * 100)}%</span>}
                  </div>
                  <textarea
                    rows={2}
                    disabled={!canEdit}
                    value={seg.text}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSegments((prev) =>
                        prev.map((s, i) => (i === idx ? { ...s, text: val, is_edited: true } : s)),
                      );
                    }}
                    className="w-full rounded border border-[#DBE2EF] bg-white p-2 text-xs text-[#112D4E]"
                  />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
