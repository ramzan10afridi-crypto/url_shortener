import { useEffect, useState, type FormEvent } from 'react';
import type { AuthUser, UrlDto } from '@url-shortener/shared';
import { api, setToken } from './api';

interface Props {
  user: AuthUser;
  onSignOut: () => void;
  onOpenAnalytics: (urlId: string) => void;
}

export function Dashboard({ user, onSignOut, onOpenAnalytics }: Props) {
  const [originalUrl, setOriginalUrl] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [items, setItems] = useState<UrlDto[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh(all = showAll) {
    try {
      setItems(await api.list(!all));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    refresh(showAll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.create({
        originalUrl,
        customCode: customCode.trim() || undefined,
      });
      setOriginalUrl('');
      setCustomCode('');
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handleSignOut() {
    setToken(null);
    onSignOut();
  }

  function toggleShowAll() {
    const next = !showAll;
    setShowAll(next);
    refresh(next);
  }

  return (
    <>
      <header className="topbar">
        <h1>URL Shortener By Ramazan ali</h1>
        <div className="user-menu">
          <span className="muted">{user.email}</span>
          <button type="button" className="link" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <form onSubmit={onSubmit} className="card">
        <label>
          Long URL
          <input
            type="url"
            required
            placeholder="https://example.com/some/very/long/path"
            value={originalUrl}
            onChange={(e) => setOriginalUrl(e.target.value)}
          />
        </label>
        <label>
          Custom code <span className="muted">(optional)</span>
          <input
            type="text"
            placeholder="my-link"
            value={customCode}
            onChange={(e) => setCustomCode(e.target.value)}
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? 'Shortening…' : 'Shorten'}
        </button>
        {error && <p className="error">{error}</p>}
      </form>

      <div className="list-header">
        <h2>{showAll ? 'All URLs' : 'My URLs'}</h2>
        <label className="toggle">
          <input type="checkbox" checked={showAll} onChange={toggleShowAll} />
          Show all
        </label>
      </div>

      <ul className="list">
        {items.map((u) => {
          const isMine = u.userId === user.id;
          return (
            <li key={u.id}>
              <a href={u.shortUrl} target="_blank" rel="noreferrer">
                {u.shortUrl}
              </a>
              <span className="clicks">{u.clicks} clicks</span>
              <div className="orig">{u.originalUrl}</div>
              {isMine && (
                <button
                  type="button"
                  className="link row-action"
                  onClick={() => onOpenAnalytics(u.id)}
                >
                  View analytics →
                </button>
              )}
            </li>
          );
        })}
        {items.length === 0 && <li className="muted">No links yet — shorten one above.</li>}
      </ul>
    </>
  );
}
