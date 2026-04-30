import { useState, useEffect } from 'react';
import { getEndpointHistory } from '../services/api';

const STATUS_BADGE = {
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

export default function CheckHistoryTable({ endpointId, latestEvent }) {
  const [rows, setRows] = useState([]);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getEndpointHistory(endpointId, limit)
      .then((data) => { if (!cancelled) setRows(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [endpointId, limit]);

  // Prepend new WS events to the top of the table
  useEffect(() => {
    if (!latestEvent || latestEvent.id_endpoint !== endpointId) return;
    const newRow = {
      id_check_result: `ws-${Date.now()}`,
      checked_at: latestEvent.checked_at,
      status: latestEvent.status,
      latency_ms: latestEvent.latency_ms,
      status_code: latestEvent.status_code,
      error_message: latestEvent.error_message,
    };
    setRows((prev) => [newRow, ...prev]);
  }, [latestEvent, endpointId]);

  if (loading) {
    return (
      <div className="text-gray-500 text-sm animate-pulse py-4">Loading history…</div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-gray-500 text-sm py-4 text-center">No check history yet.</div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-left border-b border-gray-700">
              <th className="pb-2 pr-4 font-medium">Timestamp</th>
              <th className="pb-2 pr-4 font-medium">Status</th>
              <th className="pb-2 pr-4 font-medium">Latency</th>
              <th className="pb-2 pr-4 font-medium">Code</th>
              <th className="pb-2 font-medium">Error</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id_check_result}
                className="border-b border-gray-700/40 hover:bg-gray-700/20 transition-colors"
              >
                <td className="py-2 pr-4 text-gray-400 whitespace-nowrap text-xs">
                  {new Date(asUtc(row.checked_at)).toLocaleString()}
                </td>
                <td className="py-2 pr-4">
                  <span
                    className={`px-2 py-0.5 rounded border text-xs font-medium capitalize ${
                      STATUS_BADGE[row.status] ?? ''
                    }`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="py-2 pr-4 text-gray-300 text-xs">
                  {row.latency_ms != null ? `${row.latency_ms} ms` : '—'}
                </td>
                <td className="py-2 pr-4 text-gray-400 text-xs">
                  {row.status_code ?? '—'}
                </td>
                <td
                  className="py-2 text-gray-500 text-xs max-w-xs truncate"
                  title={row.error_message ?? ''}
                >
                  {row.error_message || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length >= limit && (
        <button
          onClick={() => setLimit((l) => l + 50)}
          className="mt-3 text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          Load more
        </button>
      )}
    </div>
  );
}
