import { useEffect, useState } from 'react';
import type { AuthUser } from '@url-shortener/shared';
import { api, getToken, setToken } from './api';
import { AuthPanel } from './AuthPanel';
import { Dashboard } from './Dashboard';
import { UrlDetail } from './UrlDetail';

type View = { name: 'list' } | { name: 'detail'; urlId: string };

export function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>({ name: 'list' });

  useEffect(() => {
    (async () => {
      if (getToken()) {
        try {
          setUser(await api.me());
        } catch {
          setToken(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <main className="wrap">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="wrap">
        <AuthPanel onAuthChange={setUser} />
      </main>
    );
  }

  return (
    <main className="wrap">
      {view.name === 'list' ? (
        <Dashboard
          user={user}
          onSignOut={() => {
            setUser(null);
            setView({ name: 'list' });
          }}
          onOpenAnalytics={(urlId) => setView({ name: 'detail', urlId })}
        />
      ) : (
        <UrlDetail urlId={view.urlId} onBack={() => setView({ name: 'list' })} />
      )}
    </main>
  );
}
