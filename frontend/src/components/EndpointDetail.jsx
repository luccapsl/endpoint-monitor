import { useState, useEffect } from 'react';
import LatencyChart from './LatencyChart';
import UptimeBadge from './UptimeBadge';
import CheckHistoryTable from './CheckHistoryTable';
import { filterPeriods } from '../utils/periods';
import { getSystemInfo } from '../services/api';

const STATUS_STYLES = {
  up: 'bg-green-500/20 text-green-400 border-green-700',
  down: 'bg-red-500/20 text-red-400 border-red-700',
  degraded: 'bg-yellow-500/20 text-yellow-400 border-yellow-700',
};

function asUtc(dateStr) {
  if (!dateStr) return null;
  return dateStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr)
    ? dateStr
    : dateStr + 'Z';
}

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const diffS = Math.floor((Date.now() - new Date(asUtc(dateStr)).getTime()) / 1000);
  if (diffS < 5) return 'just now';
  if (diffS < 60) return `${diffS}s ago`;
  if (diffS < 3600) return `${Math.floor(diffS / 60)}m ago`;
  return `${Math.floor(diffS / 3600)}h ago`;
}

function intervalLabel(s) {
  if (s >= 3600) return `${s / 3600}h`;
  if (s >= 60) return `${s / 60}m`;
  return `${s}s`;
}

export default function EndpointDetail({ endpoint, latestEvent, onClose, onEdit }) {
  const [live, setLive] = useState(endpoint);
  const [, setTick] = useState(0);
  const [availablePeriods, setAvailablePeriods] = useState([]);

  useEffect(() => {
    getSystemInfo()
      .then(({ retention_hours }) => setAvailablePeriods(filterPeriods(retention_hours)))
      .catch(() => setAvailablePeriods(filterPeriods(72)));
  }, []);

  // Keep local state in sync with the parent endpoint (e.g. after edit)
  useEffect(() => {
    setLive(endpoint);
  }, [endpoint]);

  // Apply incoming WS events
  useEffect(() => {
    if (!latestEvent || latestEvent.id_endpoint !== endpoint.id_endpoint) return;
    setLive((prev) => ({
      ...prev,
      last_status: latestEvent.status,
      last_latency_ms: latestEvent.latency_ms,
      last_checked_at: latestEvent.checked_at,
    }));
  }, [latestEvent, endpoint.id_endpoint]);

  // Drive "Xs ago" counter
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const statusStyle = live.last_status
    ? STATUS_STYLES[live.last_status]
    : 'bg-gray-700/40 text-gray-400 border-gray-600';
  const timeAgoStr = live.last_checked_at ? timeAgo(live.last_checked_at) : null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Clickable backdrop */}
      <div className="flex-1 bg-black/50" onClick={onClose} />

      {/* Drawer */}
      <div className="w-full max-w-2xl bg-gray-900 border-l border-gray-700 flex flex-col overflow-y-auto shadow-2xl">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-700 px-6 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white truncate">{live.name}</h2>
            <p className="text-gray-400 text-sm mt-0.5">
              <span className="font-mono">{live.hostname}:{live.port}</span>
              {' · '}
              <span className="uppercase font-mono text-xs bg-gray-700 px-1.5 py-0.5 rounded">
                {live.type}
              </span>
              {' · every '}
              {intervalLabel(live.check_interval_s)}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 mt-0.5">
            <button
              onClick={() => onEdit(live)}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Edit
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors text-2xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6 flex-1">
          {/* Current status */}
          <div className={`flex items-center gap-3 rounded-lg px-4 py-3 border ${statusStyle}`}>
            <span className="font-semibold capitalize">
              {live.last_status ?? 'checking…'}
            </span>
            {live.last_latency_ms != null && (
              <span className="text-sm opacity-75">{live.last_latency_ms} ms</span>
            )}
            <span className="ml-auto text-sm opacity-60">
              {timeAgoStr ? `Checked ${timeAgoStr}` : 'Not yet checked'}
            </span>
          </div>

          {/* Uptime badges */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-2">Uptime</h3>
            <div className="flex flex-wrap gap-4">
              {availablePeriods.map((p) => (
                <div key={p.value} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{p.label}</span>
                  <UptimeBadge endpointId={live.id_endpoint} period={p.value} />
                </div>
              ))}
            </div>
          </div>

          {/* Latency chart */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Latency</h3>
            <LatencyChart endpointId={live.id_endpoint} latestEvent={latestEvent} />
          </div>

          {/* Check history */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Check History</h3>
            <CheckHistoryTable endpointId={live.id_endpoint} latestEvent={latestEvent} />
          </div>
        </div>
      </div>
    </div>
  );
}
