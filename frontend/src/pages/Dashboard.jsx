import { useState, useEffect, useCallback } from 'react';
import { getEndpoints } from '../services/api';
import useWebSocket from '../hooks/useWebSocket';
import EndpointList from '../components/EndpointList';

function StatCard({ label, value, color }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <p className="text-gray-400 text-sm mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const [endpoints, setEndpoints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEndpoints()
      .then(setEndpoints)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleWsMessage = useCallback((event) => {
    setEndpoints((prev) =>
      prev.map((ep) =>
        ep.id_endpoint === event.id_endpoint
          ? {
              ...ep,
              last_status: event.status,
              last_latency_ms: event.latency_ms,
              last_checked_at: event.checked_at,
            }
          : ep
      )
    );
  }, []);

  const { connected } = useWebSocket(handleWsMessage);

  const active = endpoints.filter((e) => e.is_active);
  const stats = {
    total: endpoints.length,
    up: active.filter((e) => e.last_status === 'up').length,
    down: active.filter((e) => e.last_status === 'down').length,
    degraded: active.filter((e) => e.last_status === 'degraded').length,
  };

  const handleEndpointCreated = (ep) => setEndpoints((prev) => [...prev, ep]);
  const handleEndpointUpdated = (ep) =>
    setEndpoints((prev) => prev.map((e) => (e.id_endpoint === ep.id_endpoint ? ep : e)));
  const handleEndpointDeleted = (id) =>
    setEndpoints((prev) => prev.filter((e) => e.id_endpoint !== id));

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Endpoint Monitor</h1>
        <div className="flex items-center gap-2 text-sm">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className={connected ? 'text-green-400' : 'text-red-400'}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total" value={stats.total} color="text-white" />
          <StatCard label="Online" value={stats.up} color="text-green-400" />
          <StatCard label="Offline" value={stats.down} color="text-red-400" />
          <StatCard label="Degraded" value={stats.degraded} color="text-yellow-400" />
        </div>

        {/* Endpoint list */}
        {loading ? (
          <div className="text-gray-500 text-center py-16 animate-pulse">Loading endpoints…</div>
        ) : (
          <EndpointList
            endpoints={endpoints}
            onEndpointCreated={handleEndpointCreated}
            onEndpointUpdated={handleEndpointUpdated}
            onEndpointDeleted={handleEndpointDeleted}
          />
        )}
      </main>
    </div>
  );
}
