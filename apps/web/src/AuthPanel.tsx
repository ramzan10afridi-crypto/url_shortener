import { useState, type FormEvent } from 'react';
import type { AuthUser } from '@url-shortener/shared';
import { api, setToken } from './api';

interface Props {
  onAuthChange: (user: AuthUser) => void;
}

export function AuthPanel({ onAuthChange }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await (mode === 'login'
        ? api.login({ email, password })
        : api.register({ email, password }));
      setToken(res.token);
      onAuthChange(res.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-hero">
        <h1>URL Shortener</h1>
        <p className="muted">Sign in to shorten URLs and track their clicks.</p>
      </div>
      <form onSubmit={onSubmit} className="card auth-card">
        <div className="tabs">
          <button
            type="button"
            className={mode === 'login' ? 'tab active' : 'tab'}
            onClick={() => {
              setMode('login');
              setError(null);
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'tab active' : 'tab'}
            onClick={() => {
              setMode('register');
              setError(null);
            }}
          >
            Register
          </button>
        </div>
        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label>
          Password <span className="muted">(min 8 chars)</span>
          <input
            type="password"
            required
            minLength={mode === 'register' ? 8 : 1}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}
