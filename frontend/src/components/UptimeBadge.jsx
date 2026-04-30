import { useState, useEffect } from 'react';
import { getEndpointMetrics } from '../services/api';

function colorClass(pct) {
  if (pct >= 99.9) return 'text-green-300 bg-green-900/40 border-green-700';
  if (pct >= 99.0) return 'text-green-400 bg-green-900/30 border-green-800/60';
  if (pct >= 95.0) return 'text-yellow-400 bg-yellow-900/30 border-yellow-700/60';
  return 'text-red-400 bg-red-900/30 border-red-700/60';
}

export default function UptimeBadge({ endpointId, period = '24h' }) {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getEndpointMetrics(endpointId, period)
      .then((m) => { if (!cancelled) setMetrics(m); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [endpointId, period]);

  if (!metrics) {
    return (
      <span className="text-xs font-mono px-2 py-0.5 rounded border bg-gray-700/40 text-gray-500 border-gray-600">
        —
      </span>
    );
  }

  const pct = metrics.uptime_percent;
  const tooltip =
    `${period}: ${metrics.total_checks} checks` +
    ` · ↑ ${metrics.checks_up} · ↓ ${metrics.checks_down} · ~ ${metrics.checks_degraded}` +
    (metrics.avg_latency_ms != null ? ` · avg ${metrics.avg_latency_ms} ms` : '');

  return (
    <span
      title={tooltip}
      className={`text-xs font-mono px-2 py-0.5 rounded border ${colorClass(pct)}`}
    >
      {pct.toFixed(1)}%
    </span>
  );
}
