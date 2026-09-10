import { useEffect, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AnalyticsResponse } from '@url-shortener/shared';
import { api } from './api';

interface Props {
  urlId: string;
  onBack: () => void;
}

export function UrlDetail({ urlId, onBack }: Props) {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setData(await api.analytics(urlId));
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [urlId]);

  if (error) {
    return (
      <div>
        <button type="button" className="link" onClick={onBack}>
          ← Back
        </button>
        <p className="error">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <button type="button" className="link" onClick={onBack}>
          ← Back
        </button>
        <p className="muted">Loading analytics…</p>
      </div>
    );
  }

  const chartData = data.timeline.map((p) => ({
    date: p.date.slice(5), // MM-DD for the axis
    clicks: p.count,
  }));

  return (
    <>
      <div className="detail-header">
        <button type="button" className="link" onClick={onBack}>
          ← Back
        </button>
        <div className="detail-title">
          <div className="short">/{data.shortCode}</div>
          <div className="orig">{data.originalUrl}</div>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat">
          <div className="stat-value">{data.totalClicks}</div>
          <div className="stat-label">Total clicks</div>
        </div>
        <div className="stat">
          <div className="stat-value">{data.byCountry.length}</div>
          <div className="stat-label">Countries</div>
        </div>
        <div className="stat">
          <div className="stat-value">{data.byReferrer.length}</div>
          <div className="stat-label">Referrers</div>
        </div>
      </div>

      <div className="card">
        <h3>Clicks over the last 30 days</h3>
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="clicks"
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <h3>Top countries</h3>
          <BucketList data={data.byCountry} emptyLabel="No geo data yet." />
        </div>
        <div className="card">
          <h3>Top referrers</h3>
          <BucketList data={data.byReferrer} emptyLabel="No clicks yet." />
        </div>
      </div>
    </>
  );
}

function BucketList({
  data,
  emptyLabel,
}: {
  data: { key: string; count: number }[];
  emptyLabel: string;
}) {
  if (data.length === 0) return <p className="muted">{emptyLabel}</p>;
  const max = Math.max(...data.map((d) => d.count));
  return (
    <ul className="bucket-list">
      {data.slice(0, 8).map((d) => (
        <li key={d.key}>
          <div className="bucket-row">
            <span className="bucket-key">{d.key}</span>
            <span className="bucket-count">{d.count}</span>
          </div>
          <div className="bucket-bar">
            <div className="bucket-fill" style={{ width: `${(d.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
