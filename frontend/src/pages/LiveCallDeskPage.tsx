import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Check,
  Mic,
  MicOff,
  Plus,
  Save,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { apiRequest, ApiError, getStoredToken, getWebSocketUrl } from '../services/api';
import { useAuth } from '../features/authentication/AuthContext';
import type {
  AIExtractResponse,
  CallDetailOut,
  CallOutcomeOut,
  CustomerOut,
  MedicineRequestItem,
  ShopAidCatalogItemOut,
  TranscriptSegment,
} from '../types/api';
import { Badge, Button, Card, ErrorBanner, inputClass, PageHeader, useToast } from '../components/ui';

function downsampleTo16kInt16(input: Float32Array, inputSampleRate: number): Int16Array {
  const targetRate = 16000;
  if (inputSampleRate === targetRate) {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }
  const ratio = inputSampleRate / targetRate;
  const newLen = Math.round(input.length / ratio);
  const out = new Int16Array(newLen);
  for (let i = 0; i < newLen; i++) {
    const idx = Math.min(input.length - 1, Math.floor(i * ratio));
    const s = Math.max(-1, Math.min(1, input[idx]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export function LiveCallDeskPage() {
  const { user } = useAuth();
  const { notify } = useToast();

  // Left Panel — Call Registration & Customer
  const [activeCall, setActiveCall] = useState<CallDetailOut | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerMatches, setCustomerMatches] = useState<CustomerOut[]>([]);
  const [callDirection, setCallDirection] = useState<'inbound' | 'outbound'>('inbound');
  const [callSourceType, setCallSourceType] = useState<'browser_microphone_test' | 'manual_telephone_call'>(
    'browser_microphone_test',
  );
  const [outcomeCode, setOutcomeCode] = useState('medicine_inquiry_logged');
  const [callSummary, setCallSummary] = useState('');
  const [registeringCall, setRegisteringCall] = useState(false);

  // Center Panel — Live In-Memory Transcription
  const [language, setLanguage] = useState<'auto' | 'en' | 'ta'>('auto');
  const [speakerLabel, setSpeakerLabel] = useState<'Unknown speaker' | 'Speaker 1' | 'Speaker 2'>('Unknown speaker');
  const [micActive, setMicActive] = useState(false);
  const [wsStatus, setWsStatus] = useState<'idle' | 'connecting' | 'listening' | 'processing' | 'error'>('idle');
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [manualLine, setManualLine] = useState('');
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [savingTranscript, setSavingTranscript] = useState(false);

  // Right Panel — AI Extraction & Employee Confirmation
  const [extractingAi, setExtractingAi] = useState(false);
  const [aiResult, setAiResult] = useState<AIExtractResponse | null>(null);
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
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [employeeNotes, setEmployeeNotes] = useState('');
  const [followupDueAt, setFollowupDueAt] = useState('');
  const [createFollowup, setCreateFollowup] = useState(true);
  const [savingRequest, setSavingRequest] = useState(false);

  // ShopAid CSV Reference Lookup (strictly read-only reference)
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogHits, setCatalogHits] = useState<ShopAidCatalogItemOut[]>([]);

  // Audio/WebSocket refs (strictly in-memory, discarded immediately on stop/unmount)
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const { data: outcomes } = useQuery({
    queryKey: ['call-outcomes'],
    queryFn: () => apiRequest<CallOutcomeOut[]>('/api/call-outcomes'),
  });

  const { data: sttStatus } = useQuery({
    queryKey: ['transcription', 'status'],
    queryFn: () => apiRequest<any>('/api/transcription/status'),
  });

  const cleanupAudioAndSocket = (sendStop = false) => {
    try {
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current.onaudioprocess = null;
        processorRef.current = null;
      }
      if (audioCtxRef.current) {
        void audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (wsRef.current) {
        if (sendStop && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'stop' }));
        } else {
          wsRef.current.close();
        }
        wsRef.current = null;
      }
    } finally {
      setMicActive(false);
    }
  };

  useEffect(() => {
    return () => cleanupAudioAndSocket(false);
  }, []);

  const handleSearchCustomers = async (val: string) => {
    setCustomerPhone(val);
    if (val.trim().length < 3) {
      setCustomerMatches([]);
      return;
    }
    try {
      const hits = await apiRequest<CustomerOut[]>(
        `/api/customers?search=${encodeURIComponent(val.trim())}&limit=5`,
      );
      setCustomerMatches(hits);
    } catch {
      setCustomerMatches([]);
    }
  };

  const handleResetCallDesk = () => {
    cleanupAudioAndSocket(false);
    setActiveCall(null);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerMatches([]);
    setCallSummary('');
    setSegments([]);
    setManualLine('');
    setAiResult(null);
    setDetectedLanguage(null);
    setTranscriptionError(null);
    setWsStatus('idle');
    setPriority('normal');
    setEmployeeNotes('');
    setFollowupDueAt('');
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
    notify('Live Call Desk reset for next call.', 'info');
  };

  const handleRegisterCall = async () => {
    setRegisteringCall(true);
    try {
      const created = await apiRequest<CallDetailOut>('/api/calls', {
        method: 'POST',
        body: {
          customer_name: customerName.trim() || undefined,
          customer_phone: customerPhone.trim() || undefined,
          call_direction: callDirection,
          call_source_type: callSourceType,
          outcome_code: outcomeCode || undefined,
          summary: callSummary.trim() || undefined,
          registration_status: 'registered',
        },
      });
      setActiveCall(created);
      notify(`Call registered (${created.call_reference}).`);
    } catch (err) {
      notify(err instanceof ApiError ? err.detail : 'Failed to register call.', 'error');
    } finally {
      setRegisteringCall(false);
    }
  };

  const handleStartMicrophone = async () => {
    setTranscriptionError(null);
    const token = getStoredToken();
    if (!token) {
      setTranscriptionError('Session token missing. Please sign in again.');
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setTranscriptionError(
        'Browser microphone API is unavailable in this context. Use manual transcript entry as fallback.',
      );
      return;
    }

    try {
      setWsStatus('connecting');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      });
      streamRef.current = stream;

      const wsUrl = getWebSocketUrl(
        `/api/ws/transcription/live?token=${encodeURIComponent(token)}&language=${encodeURIComponent(language)}&sample_rate=16000&speaker_label=${encodeURIComponent(speakerLabel)}`,
      );
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (event) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const float32 = event.inputBuffer.getChannelData(0);
          const int16 = downsampleTo16kInt16(float32, audioCtx.sampleRate);
          ws.send(int16.buffer);
        };

        source.connect(processor);
        processor.connect(audioCtx.destination);
        setMicActive(true);
        setWsStatus('listening');
        notify('Microphone active — in-memory transcription started (no audio saved).', 'info');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'status') {
            setWsStatus(msg.state === 'processing' ? 'processing' : 'listening');
          } else if (msg.type === 'segments') {
            if (msg.detected_language) setDetectedLanguage(msg.detected_language);
            if (Array.isArray(msg.segments) && msg.segments.length > 0) {
              setSegments((prev) => [...prev, ...msg.segments]);
            }
          } else if (msg.type === 'stopped') {
            setWsStatus('idle');
            setMicActive(false);
          } else if (msg.type === 'error') {
            setTranscriptionError(msg.message || 'Transcription error.');
            setWsStatus('error');
          }
        } catch {
          // ignore non-JSON frame
        }
      };

      ws.onerror = () => {
        setTranscriptionError('WebSocket connection error during live transcription.');
        setWsStatus('error');
        cleanupAudioAndSocket(false);
      };

      ws.onclose = () => {
        setMicActive(false);
        setWsStatus((prev) => (prev === 'error' ? 'error' : 'idle'));
      };
    } catch (err) {
      cleanupAudioAndSocket(false);
      setWsStatus('error');
      setTranscriptionError(
        err instanceof Error
          ? `Microphone permission or capture failed: ${err.message}`
          : 'Microphone access denied.',
      );
    }
  };

  const handleStopMicrophone = () => {
    cleanupAudioAndSocket(true);
    setWsStatus('idle');
    notify('Microphone stopped. Temporary audio buffers discarded.', 'info');
  };

  const handleAddManualSegment = () => {
    const trimmed = manualLine.trim();
    if (!trimmed) return;
    setSegments((prev) => [
      ...prev,
      {
        sequence_index: prev.length,
        speaker_label: speakerLabel,
        start_seconds: prev.length * 4,
        end_seconds: prev.length * 4 + 4,
        text: trimmed,
        language: language === 'auto' ? 'ta-en' : language,
        confidence: null,
        is_edited: true,
      },
    ]);
    setManualLine('');
  };

  const handleSaveTranscript = async () => {
    if (!activeCall) {
      notify('Register the call on the Left Panel before saving the transcript.', 'error');
      return;
    }
    if (segments.length === 0) {
      notify('Add or transcribe at least one segment before saving.', 'error');
      return;
    }
    setSavingTranscript(true);
    try {
      await apiRequest(`/api/calls/${activeCall.id}/transcript`, {
        method: 'POST',
        body: {
          language_detected: detectedLanguage || (language === 'auto' ? 'ta-en' : language),
          model_used: sttStatus?.speech_to_text?.model_size
            ? `faster-whisper-${sttStatus.speech_to_text.model_size}-cpu-int8`
            : 'faster-whisper-base-cpu-int8',
          review_status: segments.some((s) => s.is_edited) ? 'employee_edited' : 'ai_generated',
          segments: segments.map((s, idx) => ({ ...s, sequence_index: idx })),
          ai_extraction_json: aiResult ? JSON.stringify(aiResult) : undefined,
        },
      });
      notify('Transcript saved (text-only; zero audio stored).');
    } catch (err) {
      notify(err instanceof ApiError ? err.detail : 'Failed to save transcript.', 'error');
    } finally {
      setSavingTranscript(false);
    }
  };

  const handleExtractAI = async () => {
    const fullText = segments.map((s) => s.text).join('\n').trim();
    if (fullText.length < 3) {
      notify('Transcript is empty. Capture or type conversation text first.', 'error');
      return;
    }
    setExtractingAi(true);
    try {
      const res = await apiRequest<AIExtractResponse>('/api/transcription/extract', {
        method: 'POST',
        body: { transcript_text: fullText, language_hint: detectedLanguage || language },
      });
      setAiResult(res);
      if (res.summary_suggestion && !callSummary) {
        setCallSummary(res.summary_suggestion);
      }
      if (res.medicines.length > 0) {
        setItems(
          res.medicines.map((m) => ({
            medicine_name: m.medicine_name,
            strength: m.strength || '',
            dosage_form: m.dosage_form || '',
            quantity: m.quantity || '',
            availability_status: 'unknown',
            price_inquiry: m.pricing_question,
            quoted_price: '',
            verification_status: m.verification_status,
            notes: m.notes || '',
          })),
        );
      }
      notify(`Local AI (${res.model_used}) extracted suggestions. Review and confirm before saving.`, 'info');
    } catch (err) {
      notify(err instanceof ApiError ? err.detail : 'AI extraction failed.', 'error');
    } finally {
      setExtractingAi(false);
    }
  };

  const handleSearchCatalog = async () => {
    if (!catalogQuery.trim()) return;
    try {
      const res = await apiRequest<ShopAidCatalogItemOut[]>(
        `/api/integrations/shopaid/catalog?q=${encodeURIComponent(catalogQuery.trim())}`,
      );
      setCatalogHits(res);
    } catch {
      setCatalogHits([]);
    }
  };

  const handleSaveRequestAndClose = async (closeCallAfter: boolean) => {
    const validItems = items.filter((i) => i.medicine_name.trim().length > 0);
    if (validItems.length === 0) {
      notify('Enter at least one medicine item before saving.', 'error');
      return;
    }
    const unconfirmed = validItems.filter((i) => i.verification_status !== 'employee_confirmed');
    if (unconfirmed.length > 0) {
      notify(
        'Please review and explicitly click "Confirm" on all AI-suggested medicine items before saving.',
        'error',
      );
      return;
    }
    if (!customerName.trim() || !customerPhone.trim()) {
      notify('Customer name and phone number are required to track a medicine request.', 'error');
      return;
    }

    setSavingRequest(true);
    try {
      let callId = activeCall?.id;
      if (!callId) {
        const createdCall = await apiRequest<CallDetailOut>('/api/calls', {
          method: 'POST',
          body: {
            customer_name: customerName.trim(),
            customer_phone: customerPhone.trim(),
            call_direction: callDirection,
            call_source_type: callSourceType,
            outcome_code: outcomeCode || undefined,
            summary: callSummary.trim() || undefined,
            registration_status: closeCallAfter ? 'completed' : 'registered',
            ended_at: closeCallAfter ? new Date().toISOString() : undefined,
          },
        });
        setActiveCall(createdCall);
        callId = createdCall.id;
      } else {
        await apiRequest(`/api/calls/${callId}`, {
          method: 'PATCH',
          body: {
            customer_name: customerName.trim(),
            customer_phone: customerPhone.trim(),
            outcome_code: outcomeCode || undefined,
            summary: callSummary.trim() || undefined,
            registration_status: closeCallAfter ? 'completed' : 'registered',
            ended_at: closeCallAfter ? new Date().toISOString() : undefined,
          },
        });
      }

      if (segments.length > 0 && callId) {
        await apiRequest(`/api/calls/${callId}/transcript`, {
          method: 'POST',
          body: {
            language_detected: detectedLanguage || (language === 'auto' ? 'ta-en' : language),
            review_status: 'employee_edited',
            segments: segments.map((s, idx) => ({ ...s, sequence_index: idx })),
            ai_extraction_json: aiResult ? JSON.stringify(aiResult) : undefined,
          },
        });
      }

      const dueIso = followupDueAt ? new Date(followupDueAt).toISOString() : undefined;
      const savedReq = await apiRequest('/api/requests', {
        method: 'POST',
        body: {
          call_id: callId,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          priority,
          employee_notes: employeeNotes.trim() || undefined,
          required_followup_at: dueIso,
          create_followup: Boolean(createFollowup && dueIso),
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
      notify(
        `Saved confirmed request ${(savedReq as any).request_reference}${createFollowup && dueIso ? ' + callback reminder' : ''}.`,
      );
      if (closeCallAfter) {
        cleanupAudioAndSocket(true);
      }
    } catch (err) {
      notify(err instanceof ApiError ? err.detail : 'Failed to save request.', 'error');
    } finally {
      setSavingRequest(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Live Call Desk"
        subtitle="Authorized in-memory speech transcription, employee-verified medicine request intake, and follow-up scheduling."
        actions={
          <div className="flex items-center gap-2">
            {micActive ? (
              <Badge tone="red" className="animate-pulse">
                <Mic className="h-3.5 w-3.5" />
                MICROPHONE ACTIVE — IN-MEMORY ONLY
              </Badge>
            ) : (
              <Badge tone="neutral">Microphone Idle</Badge>
            )}
            <Badge tone="blue">Zero Audio Storage</Badge>
          </div>
        }
      />

      {/* 3-Panel Enterprise Call Desk Grid */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* LEFT PANEL: Call Registration & Customer */}
        <Card className="p-4 xl:col-span-3">
          <h2 className="border-b border-[#DBE2EF] pb-2.5 text-sm font-bold text-[#112D4E]">
            1. Call Registration & Customer
          </h2>

          <div className="mt-3 space-y-3 text-xs">
            <div className="rounded-lg bg-[#F9F7F7] p-2.5">
              <div className="text-[#112D4E]/60">Employee / Branch</div>
              <div className="font-semibold text-[#112D4E]">{user?.full_name}</div>
              <div className="text-[#112D4E]/70">{user?.branch_name || 'Organization Scope'}</div>
              {activeCall && (
                <div className="mt-1 font-mono text-[11px] text-[#3F72AF]">Ref: {activeCall.call_reference}</div>
              )}
            </div>

            <div>
              <label className="mb-1 block font-semibold">Call Source Type</label>
              <select
                value={callSourceType}
                onChange={(e) => setCallSourceType(e.target.value as any)}
                className={inputClass}
              >
                <option value="browser_microphone_test">Browser Microphone Prototype</option>
                <option value="manual_telephone_call">Manually Registered Telephone Call</option>
                <option value="verified_telephony_integration" disabled>
                  Verified Telephony Integration (Disconnected)
                </option>
              </select>
            </div>

            <div>
              <label className="mb-1 block font-semibold">Call Direction</label>
              <select
                value={callDirection}
                onChange={(e) => setCallDirection(e.target.value as any)}
                className={inputClass}
              >
                <option value="inbound">Inbound (Customer Called)</option>
                <option value="outbound">Outbound (Pharmacy Callback)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block font-semibold">Customer Name *</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block font-semibold">Customer Phone (Autocomplete) *</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => void handleSearchCustomers(e.target.value)}
                placeholder="e.g. 9840012345"
                className={inputClass}
              />
              {customerMatches.length > 0 && (
                <div className="mt-1 rounded-lg border border-[#DBE2EF] bg-[#F9F7F7] p-1.5 space-y-1">
                  {customerMatches.map((cm) => (
                    <button
                      key={cm.id}
                      type="button"
                      onClick={() => {
                        setCustomerName(cm.full_name);
                        setCustomerPhone(cm.phone_number);
                        setCustomerMatches([]);
                      }}
                      className="flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-white cursor-pointer"
                    >
                      <span className="font-semibold text-[#112D4E]">{cm.full_name}</span>
                      <span className="font-mono text-[11px] text-[#3F72AF]">{cm.phone_number}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block font-semibold">Call Outcome</label>
              <select
                value={outcomeCode}
                onChange={(e) => setOutcomeCode(e.target.value)}
                className={inputClass}
              >
                {(outcomes || []).map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block font-semibold">Call Summary</label>
              <textarea
                rows={3}
                value={callSummary}
                onChange={(e) => setCallSummary(e.target.value)}
                placeholder="Concise summary of inquiry..."
                className={inputClass}
              />
            </div>

            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={registeringCall || Boolean(activeCall)}
              onClick={handleRegisterCall}
            >
              {activeCall ? `Registered: ${activeCall.call_reference}` : registeringCall ? 'Registering...' : 'Register Call Session'}
            </Button>
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={handleResetCallDesk}>
              Start Next Call (Reset Desk)
            </Button>
          </div>
        </Card>

        {/* CENTER PANEL: Live Transcription Workspace */}
        <Card className="flex flex-col p-4 xl:col-span-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DBE2EF] pb-2.5">
            <div>
              <h2 className="text-sm font-bold text-[#112D4E]">2. Live Transcription (Faster-Whisper CPU INT8)</h2>
              <p className="text-[11px] text-[#112D4E]/60">
                Status: <span className="font-semibold uppercase">{wsStatus}</span>
                {detectedLanguage ? ` • Detected: ${detectedLanguage}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!micActive ? (
                <Button size="sm" onClick={handleStartMicrophone}>
                  <Mic className="h-3.5 w-3.5" />
                  Start Mic
                </Button>
              ) : (
                <Button size="sm" variant="danger" onClick={handleStopMicrophone}>
                  <MicOff className="h-3.5 w-3.5" />
                  Stop Mic Immediately
                </Button>
              )}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="mb-1 block font-semibold">Language Mode</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
                disabled={micActive}
                className={inputClass}
              >
                <option value="auto">Auto (English / Tamil / Tanglish)</option>
                <option value="en">English (en)</option>
                <option value="ta">Tamil (ta)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block font-semibold">Speaker Tag (Unverified)</label>
              <select
                value={speakerLabel}
                onChange={(e) => setSpeakerLabel(e.target.value as any)}
                className={inputClass}
              >
                <option value="Unknown speaker">Unknown speaker</option>
                <option value="Speaker 1">Speaker 1</option>
                <option value="Speaker 2">Speaker 2</option>
              </select>
            </div>
          </div>

          {transcriptionError && (
            <div className="mt-3">
              <ErrorBanner message={transcriptionError} />
            </div>
          )}

          {/* Transcript Segment Stream (Editable for correcting speech errors) */}
          <div className="mt-3 flex-1 space-y-2 overflow-y-auto rounded-lg border border-[#DBE2EF] bg-[#F9F7F7] p-3 min-h-[260px] max-h-[420px]">
            {segments.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-10 text-center text-xs text-[#112D4E]/60">
                <p className="font-semibold text-[#112D4E]">Ready for authorized live speech or manual entry</p>
                <p className="mt-1 max-w-sm">
                  Click <strong>Start Mic</strong> to stream temporary 4-second in-memory audio chunks to local
                  Faster-Whisper, or type notes below for manual telephone calls.
                </p>
              </div>
            ) : (
              segments.map((seg, idx) => (
                <div key={idx} className="rounded-lg border border-[#DBE2EF] bg-white p-2.5 text-xs">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#112D4E]/65">
                    <div className="flex items-center gap-2">
                      <Badge tone="blue">{seg.speaker_label}</Badge>
                      <span className="font-mono">
                        {seg.start_seconds.toFixed(1)}s – {seg.end_seconds.toFixed(1)}s
                      </span>
                      {seg.language && <span className="uppercase">{seg.language}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {seg.confidence !== null && <span>Conf: {Math.round(seg.confidence * 100)}%</span>}
                      {seg.is_edited && <Badge tone="green">Edited</Badge>}
                    </div>
                  </div>
                  <textarea
                    rows={2}
                    value={seg.text}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSegments((prev) =>
                        prev.map((s, i) => (i === idx ? { ...s, text: val, is_edited: true } : s)),
                      );
                    }}
                    className="w-full rounded border border-transparent bg-transparent p-1 text-xs text-[#112D4E] focus:border-[#3F72AF] focus:bg-[#F9F7F7] focus:outline-none"
                  />
                </div>
              ))
            )}
          </div>

          {/* Manual Segment Fallback Input */}
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={manualLine}
              onChange={(e) => setManualLine(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddManualSegment();
                }
              }}
              placeholder="Add or type manual call transcript line (English / Tamil / Tanglish)..."
              className={inputClass}
            />
            <Button type="button" variant="outline" size="sm" onClick={handleAddManualSegment}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#DBE2EF] pt-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={extractingAi || segments.length === 0}
              onClick={handleExtractAI}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {extractingAi ? 'Running Local Ollama...' : 'Extract Suggestions (Local AI)'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={savingTranscript || segments.length === 0 || !activeCall}
              onClick={handleSaveTranscript}
            >
              <Save className="h-3.5 w-3.5" />
              {savingTranscript ? 'Saving...' : 'Save Transcript'}
            </Button>
          </div>
        </Card>

        {/* RIGHT PANEL: Extracted Requirements & Employee Confirmation */}
        <Card className="flex flex-col p-4 xl:col-span-4">
          <div className="border-b border-[#DBE2EF] pb-2.5">
            <h2 className="text-sm font-bold text-[#112D4E]">3. Customer Requirements & Confirmation</h2>
            <p className="text-[11px] text-[#112D4E]/60">
              AI suggestions require explicit pharmacist confirmation before saving.
            </p>
          </div>

          {aiResult && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-900">
              <div className="flex items-center gap-1.5 font-semibold">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                <span>AI Suggestion Notice ({aiResult.model_used})</span>
              </div>
              <p className="mt-1">{aiResult.disclaimer}</p>
              {aiResult.missing_information.length > 0 && (
                <div className="mt-1.5">
                  <span className="font-semibold">Missing info to confirm:</span>{' '}
                  {aiResult.missing_information.join(' • ')}
                </div>
              )}
            </div>
          )}

          {/* Optional ShopAid CSV Reference Lookup */}
          <div className="mt-3 rounded-lg border border-[#DBE2EF] bg-[#F9F7F7] p-2.5">
            <div className="mb-1.5 flex items-center justify-between text-[11px]">
              <span className="font-semibold text-[#112D4E]">ShopAid Reference Lookup (CSV Snapshot)</span>
              <Badge tone="neutral">Live API Disconnected</Badge>
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={catalogQuery}
                onChange={(e) => setCatalogQuery(e.target.value)}
                placeholder="Search reference catalog..."
                className="flex-1 rounded-md border border-[#DBE2EF] bg-white px-2.5 py-1 text-xs"
              />
              <Button type="button" size="sm" variant="outline" onClick={handleSearchCatalog}>
                <Search className="h-3.5 w-3.5" />
              </Button>
            </div>
            {catalogHits.length > 0 && (
              <div className="mt-2 max-h-24 space-y-1 overflow-y-auto text-[11px]">
                {catalogHits.map((hit) => (
                  <div
                    key={hit.id}
                    className="flex items-center justify-between rounded bg-white px-2 py-1 border border-[#DBE2EF]"
                  >
                    <span>
                      <strong>{hit.medicine_name}</strong> {hit.strength || ''}{' '}
                      {hit.mrp_price ? `• Rs.${hit.mrp_price}` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setItems((prev) => [
                          ...prev.filter((x) => x.medicine_name.trim() !== ''),
                          {
                            medicine_name: hit.medicine_name,
                            strength: hit.strength || '',
                            dosage_form: hit.dosage_form || '',
                            quantity: '',
                            availability_status: 'unknown',
                            price_inquiry: Boolean(hit.mrp_price),
                            quoted_price: hit.mrp_price || '',
                            verification_status: 'employee_confirmed',
                            notes: `Ref SKU: ${hit.sku} (CSV snapshot — verify live stock in ShopAid)`,
                          },
                        ]);
                      }}
                      className="font-semibold text-[#3F72AF] hover:underline cursor-pointer"
                    >
                      + Use
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Medicine Items List */}
          <div className="mt-3 space-y-2.5 overflow-y-auto max-h-[320px] pr-0.5">
            {items.map((item, idx) => (
              <div key={idx} className="rounded-lg border border-[#DBE2EF] bg-white p-2.5 text-xs space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[#112D4E]">Item #{idx + 1}</span>
                    {item.verification_status === 'employee_confirmed' && (
                      <Badge tone="green">Employee Confirmed</Badge>
                    )}
                    {item.verification_status === 'ai_suggested' && (
                      <Badge tone="amber">AI Suggested — Unconfirmed</Badge>
                    )}
                    {item.verification_status === 'missing_info' && (
                      <Badge tone="red">Missing Info</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {item.verification_status !== 'employee_confirmed' && (
                      <button
                        type="button"
                        onClick={() =>
                          setItems((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, verification_status: 'employee_confirmed' } : x)),
                          )
                        }
                        className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-emerald-700 cursor-pointer"
                      >
                        <Check className="h-3 w-3" /> Confirm
                      </button>
                    )}
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                        aria-label="Remove item"
                        className="rounded p-1 text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="Medicine Name *"
                  value={item.medicine_name}
                  onChange={(e) =>
                    setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, medicine_name: e.target.value } : x)))
                  }
                  className={inputClass}
                />
                <div className="grid grid-cols-3 gap-1.5">
                  <input
                    type="text"
                    placeholder="Strength (650mg)"
                    value={item.strength || ''}
                    onChange={(e) =>
                      setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, strength: e.target.value } : x)))
                    }
                    className={inputClass}
                  />
                  <input
                    type="text"
                    placeholder="Form (Tablet)"
                    value={item.dosage_form || ''}
                    onChange={(e) =>
                      setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, dosage_form: e.target.value } : x)))
                    }
                    className={inputClass}
                  />
                  <input
                    type="text"
                    placeholder="Qty (2 strips)"
                    value={item.quantity || ''}
                    onChange={(e) =>
                      setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))
                    }
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <select
                    value={item.availability_status}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, availability_status: e.target.value as any } : x)),
                      )
                    }
                    className={inputClass}
                  >
                    <option value="unknown">Stock: Unknown</option>
                    <option value="available">Available</option>
                    <option value="out_of_stock">Out of Stock</option>
                    <option value="order_required">Order Required</option>
                    <option value="partial">Partial Stock</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Quoted Price (optional)"
                    value={item.quoted_price || ''}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, quoted_price: e.target.value, price_inquiry: Boolean(e.target.value) } : x,
                        ),
                      )
                    }
                    className={inputClass}
                  />
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 self-start"
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
            <Plus className="h-3.5 w-3.5" />
            Add Another Medicine
          </Button>

          {/* Priority, Notes & Follow-up Scheduling */}
          <div className="mt-3 space-y-2 border-t border-[#DBE2EF] pt-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block font-semibold">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className={inputClass}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block font-semibold">Follow-up Due</label>
                <input
                  type="datetime-local"
                  value={followupDueAt}
                  onChange={(e) => setFollowupDueAt(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-[#112D4E]">
              <input
                type="checkbox"
                checked={createFollowup}
                onChange={(e) => setCreateFollowup(e.target.checked)}
              />
              Create callback reminder automatically if follow-up date is set
            </label>

            <input
              type="text"
              placeholder="Employee notes / verification instructions..."
              value={employeeNotes}
              onChange={(e) => setEmployeeNotes(e.target.value)}
              className={inputClass}
            />

            {items.some((i) => i.medicine_name.trim() && i.verification_status !== 'employee_confirmed') && (
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5" />
                Confirm all AI-suggested items above before submitting.
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                disabled={savingRequest}
                onClick={() => void handleSaveRequestAndClose(false)}
              >
                Save Draft & Request
              </Button>
              <Button
                type="button"
                disabled={savingRequest}
                onClick={() => void handleSaveRequestAndClose(true)}
              >
                {savingRequest ? 'Saving...' : 'Save & Close Call'}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
