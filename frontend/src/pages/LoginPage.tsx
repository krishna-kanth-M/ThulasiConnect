import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../features/authentication/AuthContext';
import { apiRequest, ApiError } from '../services/api';
import { Button, Card, ErrorBanner, inputClass, useToast } from '../components/ui';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { notify } = useToast();

  const [mode, setMode] = useState<'login' | 'reset_request' | 'reset_confirm'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [devTokenNotice, setDevTokenNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      notify('Signed in to ThulasiConnect.');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Unable to sign in. Verify your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDevTokenNotice(null);
    setSubmitting(true);
    try {
      const res = await apiRequest<{ message: string; dev_reset_token?: string }>(
        '/api/auth/password-reset/request',
        { method: 'POST', body: { email: email.trim() }, skipAuth: true },
      );
      notify(res.message, 'info');
      if (res.dev_reset_token) {
        setResetToken(res.dev_reset_token);
        setDevTokenNotice(res.dev_reset_token);
      }
      setMode('reset_confirm');
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Unable to request password reset.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/auth/password-reset/confirm', {
        method: 'POST',
        body: { token: resetToken.trim(), new_password: newPassword },
        skipAuth: true,
      });
      notify(res.message);
      setPassword('');
      setNewPassword('');
      setResetToken('');
      setDevTokenNotice(null);
      setMode('login');
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Password reset failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F9F7F7]">
      {/* Brand Information Column */}
      <div className="hidden w-5/12 flex-col justify-between bg-[#112D4E] p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3F72AF]">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-bold">ThulasiConnect</div>
            <div className="text-xs text-[#DBE2EF]/80">Thulasi Pharmacy Operations Platform</div>
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl font-bold leading-tight">
            Accountable Call Management & Multi-Branch Supervision.
          </h1>
          <p className="text-sm leading-relaxed text-[#DBE2EF]/85">
            Track every customer medicine inquiry from call intake to verified resolution with local in-memory
            transcription, structured request tracking, timely callback reminders, and hierarchical escalations.
          </p>
          <div className="rounded-xl border border-white/15 bg-white/8 p-4 text-xs text-[#DBE2EF]">
            <div className="flex items-center gap-2 font-semibold text-white">
              <ShieldCheck className="h-4 w-4 text-[#DBE2EF]" />
              <span>Privacy-First, Transcription-Only Architecture</span>
            </div>
            <p className="mt-1.5 leading-relaxed text-[#DBE2EF]/80">
              ThulasiConnect never records or stores telephone call audio. Live speech is processed locally in RAM and
              discarded immediately after transcription.
            </p>
          </div>
        </div>

        <div className="text-xs text-[#DBE2EF]/60">
          Role-Based Access Control • Local PostgreSQL 16 • Faster-Whisper CPU INT8 • Local Ollama
        </div>
      </div>

      {/* Authentication Form Column */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#112D4E] text-white">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold text-[#112D4E]">ThulasiConnect</div>
              <div className="text-xs text-[#112D4E]/65">Pharmacy Call Supervision</div>
            </div>
          </div>

          <Card className="p-6 sm:p-8">
            {mode === 'login' && (
              <>
                <h2 className="text-xl font-bold text-[#112D4E]">Sign in to your workspace</h2>
                <p className="mt-1 text-xs text-[#112D4E]/65">
                  Use your authorized Thulasi Pharmacy staff credentials.
                </p>

                {error && (
                  <div className="mt-4">
                    <ErrorBanner message={error} />
                  </div>
                )}

                <form onSubmit={handleLogin} className="mt-5 space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#112D4E]" htmlFor="login-email">
                      Work Email
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-[#112D4E]/45" />
                      <input
                        id="login-email"
                        type="email"
                        required
                        autoComplete="username"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@thulasipharmacy.local"
                        className={`${inputClass} pl-9`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#112D4E]" htmlFor="login-password">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-[#112D4E]/45" />
                      <input
                        id="login-password"
                        type="password"
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password"
                        className={`${inputClass} pl-9`}
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={submitting} className="w-full" size="lg">
                    {submitting ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>

                <div className="mt-4 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setMode('reset_request');
                    }}
                    className="font-medium text-[#3F72AF] hover:underline cursor-pointer"
                  >
                    Forgot / Reset Password?
                  </button>
                  <span className="text-[#112D4E]/50">RBAC Protected</span>
                </div>
              </>
            )}

            {mode === 'reset_request' && (
              <>
                <h2 className="text-xl font-bold text-[#112D4E]">Request Password Reset</h2>
                <p className="mt-1 text-xs text-[#112D4E]/65">
                  Enter your account email to generate a single-use 30-minute reset token.
                </p>
                {error && (
                  <div className="mt-4">
                    <ErrorBanner message={error} />
                  </div>
                )}
                <form onSubmit={handleResetRequest} className="mt-5 space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#112D4E]" htmlFor="reset-email">
                      Account Email
                    </label>
                    <input
                      id="reset-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@thulasipharmacy.local"
                      className={inputClass}
                    />
                  </div>
                  <Button type="submit" disabled={submitting} className="w-full">
                    {submitting ? 'Generating token...' : 'Generate Reset Token'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setError(null);
                      setMode('login');
                    }}
                  >
                    Back to Sign In
                  </Button>
                </form>
              </>
            )}

            {mode === 'reset_confirm' && (
              <>
                <h2 className="text-xl font-bold text-[#112D4E]">Confirm Password Reset</h2>
                <p className="mt-1 text-xs text-[#112D4E]/65">
                  Paste your reset token and choose a new password (minimum 8 characters).
                </p>
                {devTokenNotice && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    <div className="font-semibold">Local Development Mode Token</div>
                    <div className="mt-1 break-all font-mono text-[11px]">{devTokenNotice}</div>
                  </div>
                )}
                {error && (
                  <div className="mt-4">
                    <ErrorBanner message={error} />
                  </div>
                )}
                <form onSubmit={handleResetConfirm} className="mt-4 space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#112D4E]" htmlFor="reset-token">
                      Reset Token
                    </label>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-[#112D4E]/45" />
                      <input
                        id="reset-token"
                        type="text"
                        required
                        value={resetToken}
                        onChange={(e) => setResetToken(e.target.value)}
                        className={`${inputClass} pl-9 font-mono text-xs`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#112D4E]" htmlFor="reset-new-pw">
                      New Password
                    </label>
                    <input
                      id="reset-new-pw"
                      type="password"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <Button type="submit" disabled={submitting} className="w-full">
                    {submitting ? 'Updating password...' : 'Update Password'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setError(null);
                      setMode('login');
                    }}
                  >
                    Back to Sign In
                  </Button>
                </form>
              </>
            )}
          </Card>

          <p className="mt-4 text-center text-[11px] text-[#112D4E]/60">
            Initial development admin setup is documented in <code className="font-mono">README.md</code> using{' '}
            <code className="font-mono">python -m app.cli.bootstrap_admin</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
