import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  HeartPulse,
  Mic,
  PhoneCall,
  RefreshCw,
  Server,
  ShieldAlert,
  Sparkles,
  Wifi,
  XCircle,
} from 'lucide-react';
import { Badge, Button, Card, ErrorBanner, LoadingState, PageHeader, StatCard } from '../components/ui';
import { apiRequest } from '../services/api';

interface HealthComponent {
  key: string;
  name: string;
  status:
    | 'CONNECTED AND VERIFIED'
    | 'CONNECTED BUT NOT FULLY VERIFIED'
    | 'CONFIGURED BUT DISCONNECTED'
    | 'NOT CONFIGURED'
    | 'FAILED'
    | 'BLOCKED BY EXTERNAL DEPENDENCY'
    | 'NOT TESTED';
  connection: string;
  latency_ms: number | null;
  checked_at: string;
  last_successful_check: string | null;
  last_error: string | null;
  details: Record<string, unknown>;
}

interface SystemHealthResponse {
  checked_at: string;
  summary: {
    total: number;
    connected_and_verified: number;
    partial: number;
    disconnected_or_not_configured: number;
    blocked: number;
    failed: number;
  };
  components: HealthComponent[];
}

function statusTone(status: HealthComponent['status']): 'green' | 'amber' | 'red' | 'neutral' {
  switch (status) {
    case 'CONNECTED AND VERIFIED':
      return 'green';
    case 'CONNECTED BUT NOT FULLY VERIFIED':
    case 'BLOCKED BY EXTERNAL DEPENDENCY':
      return 'amber';
    case 'FAILED':
      return 'red';
    default:
      return 'neutral';
  }
}

function componentIcon(key: string) {
  switch (key) {
    case 'backend':
      return <Server className="h-4 w-4 text-[#3F72AF]" />;
    case 'database':
      return <Database className="h-4 w-4 text-[#3F72AF]" />;
    case 'ollama':
    case 'ai_model':
      return <Cpu className="h-4 w-4 text-[#3F72AF]" />;
    case 'faster_whisper':
      return <Mic className="h-4 w-4 text-[#3F72AF]" />;
    case 'websocket':
      return <Wifi className="h-4 w-4 text-[#3F72AF]" />;
    case 'telephony':
      return <PhoneCall className="h-4 w-4 text-[#3F72AF]" />;
    default:
      return <Activity className="h-4 w-4 text-[#3F72AF]" />;
  }
}

function formatDetailValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (Array.isArray(val)) return val.length ? val.join(', ') : 'None';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function SystemHealthPage() {
  const [probeAi, setProbeAi] = useState(false);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['admin', 'system-health', probeAi],
    queryFn: () =>
      apiRequest<SystemHealthResponse>(`/api/admin/system-health?probe_ai=${probeAi ? 'true' : 'false'}`),
    refetchInterval: 60_000,
  });

  const handleRefresh = () => {
    setProbeAi(false);
    void refetch();
  };

  const handleProbeAi = () => {
    if (probeAi) {
      void refetch();
    } else {
      setProbeAi(true);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Health & Integration Diagnostics"
        subtitle="Live connectivity checks across API, PostgreSQL, local Ollama AI, Faster-Whisper STT, WebSockets, scheduler, and external adapters."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleProbeAi} disabled={isFetching}>
              <Sparkles className="h-4 w-4" />
              <span>{isFetching && probeAi ? 'Probing Ollama...' : 'Probe Live Ollama Inference'}</span>
            </Button>
            <Button variant="primary" size="sm" onClick={handleRefresh} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              <span>{isFetching ? 'Checking...' : 'Run Live Health Check'}</span>
            </Button>
          </>
        }
      />

      {error && (
        <ErrorBanner
          message={error instanceof Error ? error.message : 'Unable to fetch live system health diagnostics.'}
          onRetry={() => void refetch()}
        />
      )}

      {isLoading && <LoadingState message="Running live connectivity probes across ThulasiConnect services..." />}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard
              label="Connected & Verified"
              value={data.summary.connected_and_verified}
              sublabel={`of ${data.summary.total} monitored components`}
              icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
              tone="accent"
            />
            <StatCard
              label="Partial / Degraded"
              value={data.summary.partial}
              sublabel="Operational with local fallback"
              icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
              tone={data.summary.partial > 0 ? 'warning' : 'default'}
            />
            <StatCard
              label="Blocked (External)"
              value={data.summary.blocked}
              sublabel="Requires vendor creds / hardware"
              icon={<ShieldAlert className="h-5 w-5 text-amber-600" />}
              tone={data.summary.blocked > 0 ? 'warning' : 'default'}
            />
            <StatCard
              label="Disconnected / Unset"
              value={data.summary.disconnected_or_not_configured}
              sublabel="Stopped or unconfigured"
              icon={<HeartPulse className="h-5 w-5 text-[#3F72AF]" />}
            />
            <StatCard
              label="Failed Probes"
              value={data.summary.failed}
              sublabel="Immediate remediation needed"
              icon={<XCircle className="h-5 w-5 text-rose-600" />}
              tone={data.summary.failed > 0 ? 'danger' : 'default'}
            />
          </div>

          <Card className="border-l-4 border-l-[#3F72AF] p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-[#112D4E]/80">
                <span className="font-semibold text-[#112D4E]">Live Verification Policy:</span> Every card below
                reflects a live backend probe executed on request. No secrets, passwords, API keys, tokens, or
                database connection strings are transmitted or displayed.
              </div>
              <div className="text-xs font-medium text-[#112D4E]/65 whitespace-nowrap">
                Last Checked: {formatTimestamp(data.checked_at)}
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {data.components.map((comp) => (
              <Card key={comp.key} className="flex flex-col justify-between p-5">
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F9F7F7] border border-[#DBE2EF]">
                        {componentIcon(comp.key)}
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-[#112D4E]">{comp.name}</h2>
                        <div className="text-xs text-[#112D4E]/65">
                          Connection: <span className="font-medium text-[#112D4E]">{comp.connection}</span>
                          {comp.latency_ms !== null && (
                            <span className="ml-2 text-[#112D4E]/60">({comp.latency_ms} ms)</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Badge tone={statusTone(comp.status)}>{comp.status}</Badge>
                  </div>

                  {comp.last_error && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
                      <span className="font-semibold">Diagnostic Note: </span>
                      {comp.last_error}
                    </div>
                  )}

                  {Object.keys(comp.details).length > 0 && (
                    <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-2 border-t border-[#DBE2EF]/80 pt-3 text-xs sm:grid-cols-2">
                      {Object.entries(comp.details).map(([k, v]) => (
                        <div key={k} className="flex flex-col">
                          <dt className="text-[11px] font-medium uppercase tracking-wide text-[#112D4E]/55">
                            {k.replace(/_/g, ' ')}
                          </dt>
                          <dd className="mt-0.5 font-medium text-[#112D4E] break-words">{formatDetailValue(v)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#DBE2EF]/80 pt-3 text-[11px] text-[#112D4E]/60">
                  <span>Last Successful Check: {formatTimestamp(comp.last_successful_check)}</span>
                  <span>Probed: {formatTimestamp(comp.checked_at)}</span>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
