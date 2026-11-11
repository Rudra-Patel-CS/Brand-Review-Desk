import React, { useEffect, useState } from 'react';
import { AuthSession, AuthUser, setCsrfToken } from '../utils/auth.js';

type AuthMode = 'login' | 'bootstrap';

interface AuthPageProps {
  onAuthSuccess: (session: AuthSession) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [bootstrapRequired, setBootstrapRequired] = useState<boolean | null>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [showRegistrationNotice, setShowRegistrationNotice] = useState(false);
  const [demoAccount, setDemoAccount] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Check DB status & bootstrap status
    Promise.all([
      fetch('/api/status', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
      fetch('/api/auth/bootstrap-status', { credentials: 'include' }).then((r) => r.json()).catch(() => null)
    ]).then(([statusData, bootstrapData]) => {
      if (cancelled) return;
      if (statusData) setDbConnected(Boolean(statusData.connected));

      if (bootstrapData && bootstrapData.bootstrapRequired) {
        setBootstrapRequired(true);
        setMode('bootstrap');
      } else {
        setBootstrapRequired(false);
        setMode('login');
      }
      if (bootstrapData?.demoAccount?.email && bootstrapData?.demoAccount?.password) {
        setDemoAccount(bootstrapData.demoAccount);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const resetMessages = () => {
    setError(null);
    setSuccess(null);
    setShowRegistrationNotice(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    const cleanUsername = username.trim();
    const cleanEmail = email.trim();

    if (!cleanUsername) {
      setError(mode === 'login' ? 'Enter your username or email.' : 'Choose an administrator username.');
      return;
    }

    if (mode === 'bootstrap') {
      if (!EMAIL_RE.test(cleanEmail)) {
        setError('Enter a valid email address for the administrator.');
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    } else if (!password) {
      setError('Enter your password.');
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/bootstrap';
      const body =
        mode === 'login'
          ? { identifier: cleanUsername, password }
          : { username: cleanUsername, email: cleanEmail, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        throw new Error(data?.error || 'Authentication failed. Please check your credentials.');
      }

      if (data?.csrfToken) {
        setCsrfToken(data.csrfToken);
      }

      const user: AuthUser = data.user;
      onAuthSuccess({ user, csrfToken: data.csrfToken || '' });
    } catch (err) {
      const message =
        err instanceof TypeError
          ? 'Cannot reach the server. Make sure the backend server is running.'
          : err instanceof Error
            ? err.message
            : 'Request failed.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-xl border border-surface-container-high bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none transition placeholder:text-on-surface-variant/50 focus:border-secondary focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary/15';

  return (
    <div className="min-h-screen bg-surface flex font-sans text-on-surface antialiased">
      {/* Brand panel (desktop) */}
      <aside className="hidden lg:flex lg:w-[46%] xl:w-[42%] relative overflow-hidden bg-primary text-on-primary flex-col justify-between p-12">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, #ffffff 0, transparent 45%), radial-gradient(circle at 80% 70%, #a0d1bf 0, transparent 40%)'
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-on-primary/10 border border-on-primary/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">policy</span>
            </div>
            <div>
              <p className="font-serif text-2xl leading-none">Brand Review Desk</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-primary-fixed-dim mt-1.5">
                Editorial Compliance Workspace
              </p>
            </div>
          </div>

          <h1 className="font-serif text-4xl xl:text-[2.75rem] leading-[1.15] mt-16 max-w-md">
            Every campaign reviewed. Every claim backed by evidence.
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-on-primary/70">
            Sign in to audit creative copy against your brand rules, resolve flagged claims,
            and file signed-off dossiers to the archive.
          </p>

          <div className="mt-10 space-y-3">
            {[
              ['shield_person', 'Role-Based Access: Admin, Approver, Reviewer'],
              ['fact_check', 'Rule-based claim detection & OCR verification'],
              ['verified_user', 'Cryptographic review sign-off records'],
              ['lock', 'Server-managed sessions with HttpOnly cookies']
            ].map(([icon, label]) => (
              <div key={label} className="flex items-center gap-3 text-sm text-on-primary/80">
                <span className="material-symbols-outlined text-[18px] text-primary-fixed-dim">
                  {icon}
                </span>
                {label}
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-[11px] font-mono text-on-primary/50">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary-fixed-dim" />
          Enterprise Session Storage · Access Controlled
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-10">
        <div className="w-full max-w-md">
          {/* Mobile brand header */}
          <div className="lg:hidden mb-8 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-on-primary mb-4 shadow-sm">
              <span className="material-symbols-outlined text-[26px]">policy</span>
            </div>
            <h1 className="font-serif text-2xl text-primary tracking-tight">Brand Review Desk</h1>
            <p className="text-xs text-on-surface-variant mt-1">Editorial compliance workspace</p>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl shadow-[0_18px_50px_-24px_rgba(0,54,42,0.35)] border border-surface-container-high p-6 sm:p-8">
            <div className="flex items-start justify-between gap-3 mb-6">
              <div>
                <h2 className="font-serif text-2xl text-on-surface">
                  {mode === 'bootstrap' ? 'First-Admin Setup' : 'Welcome back'}
                </h2>
                <p className="text-xs text-on-surface-variant mt-1">
                  {mode === 'bootstrap'
                    ? 'Initialize the workspace with your administrator account.'
                    : 'Sign in to access your brand compliance workspace.'}
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] whitespace-nowrap ${
                  dbConnected === null
                    ? 'border-surface-container-high bg-surface-container-low text-on-surface-variant'
                    : dbConnected
                      ? 'border-secondary/20 bg-secondary/5 text-secondary'
                      : 'border-amber-200 bg-amber-50 text-amber-800'
                }`}
                title="Database connection status"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    dbConnected === null
                      ? 'bg-outline animate-pulse'
                      : dbConnected
                        ? 'bg-secondary animate-pulse'
                        : 'bg-amber-500'
                  }`}
                />
                {dbConnected === null ? 'Checking' : dbConnected ? 'Database online' : 'Storage fallback'}
              </span>
            </div>

            {mode === 'bootstrap' && (
              <div className="mb-5 p-3 rounded-xl bg-secondary/10 border border-secondary/20 text-xs text-on-surface">
                <div className="flex items-center gap-1.5 font-semibold text-secondary mb-1">
                  <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
                  Bootstrap Administrator
                </div>
                The workspace database currently has no users. Creating this first account grants Administrator
                privileges to provision other roles.
              </div>
            )}

            {showRegistrationNotice && (
              <div className="mb-4 p-3 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface space-y-1 animate-in fade-in">
                <div className="flex items-center gap-1.5 font-semibold text-primary">
                  <span className="material-symbols-outlined text-[16px]">lock</span>
                  Public Registration Disabled
                </div>
                <p className="text-on-surface-variant leading-relaxed">
                  For compliance security, accounts must be created by an Administrator. If you need access,
                  please ask your organization administrator to add your email.
                </p>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2 rounded-xl border border-error/20 bg-error-container px-4 py-3 text-sm text-on-error-container"
              >
                <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div
                role="status"
                className="mb-4 flex items-start gap-2 rounded-xl border border-secondary/20 bg-secondary/5 px-4 py-3 text-sm text-secondary"
              >
                <span className="material-symbols-outlined text-[18px] shrink-0">check_circle</span>
                <span>{success}</span>
              </div>
            )}

            {demoAccount && mode === 'login' && (
              <div className="mb-4 rounded-xl border border-secondary/30 bg-secondary/5 px-4 py-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-secondary">
                  <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
                  Judge Demo Account
                </div>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  Use this shared demo login to explore the full workspace (no registration needed):
                </p>
                <div className="font-mono text-[11px] text-on-surface bg-surface-container-lowest rounded-lg border border-surface-container-high px-3 py-2 space-y-0.5">
                  <div>Email: <strong>{demoAccount.email}</strong></div>
                  <div>Password: <strong>{demoAccount.password}</strong></div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUsername(demoAccount.email);
                    setPassword(demoAccount.password);
                  }}
                  className="text-[11px] font-semibold text-secondary hover:text-primary underline"
                >
                  Fill the login form with the demo account
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="auth-username" className="block text-xs font-semibold text-on-surface mb-1.5">
                  {mode === 'login' ? 'Username or email' : 'Admin Username'}
                </label>
                <input
                  id="auth-username"
                  name="username"
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  spellCheck={false}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={mode === 'login' ? 'Enter username or email' : 'e.g. admin.compliance'}
                  className={inputClass}
                />
              </div>

              {mode === 'bootstrap' && (
                <div>
                  <label htmlFor="auth-email" className="block text-xs font-semibold text-on-surface mb-1.5">
                    Admin Work Email
                  </label>
                  <input
                    id="auth-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@company.com"
                    className={inputClass}
                  />
                </div>
              )}

              <div>
                <label htmlFor="auth-password" className="block text-xs font-semibold text-on-surface mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="auth-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'bootstrap' ? 'Minimum 8 characters' : '••••••••'}
                    className={`${inputClass} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container transition"
                  >
                    <span className="material-symbols-outlined text-[19px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {mode === 'bootstrap' && (
                <div>
                  <label
                    htmlFor="auth-confirm-password"
                    className="block text-xs font-semibold text-on-surface mb-1.5"
                  >
                    Confirm Admin Password
                  </label>
                  <input
                    id="auth-confirm-password"
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className={inputClass}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-on-primary/30 border-t-on-primary animate-spin" />
                    {mode === 'login' ? 'Signing in…' : 'Creating administrator…'}
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">
                      {mode === 'login' ? 'login' : 'verified_user'}
                    </span>
                    {mode === 'login' ? 'Sign In to Desk' : 'Complete Setup & Enter Desk'}
                  </>
                )}
              </button>
            </form>

            {mode === 'login' && !bootstrapRequired && (
              <p className="mt-6 text-center text-[11px] leading-relaxed text-on-surface-variant">
                Need an account?{' '}
                <button
                  type="button"
                  onClick={() => setShowRegistrationNotice(!showRegistrationNotice)}
                  className="font-semibold text-secondary hover:underline"
                >
                  Request access
                </button>
              </p>
            )}
          </div>

          <p className="mt-5 text-center text-[10px] font-mono text-on-surface-variant/70">
            Protected workspace · Secure HttpOnly session · Role-based access
          </p>
        </div>
      </main>
    </div>
  );
}
