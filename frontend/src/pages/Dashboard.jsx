import { useState, useEffect, useCallback } from 'react';
import { getEndpoints } from '../services/api';
import useWebSocket from '../hooks/useWebSocket';
import EndpointList from '../components/EndpointList';
import EndpointDetail from '../components/EndpointDetail';

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
  const [latestEvent, setLatestEvent] = useState(null);

  // Which endpoint the detail drawer is showing
  const [detailEndpoint, setDetailEndpoint] = useState(null);

  // When Edit is clicked inside EndpointDetail, close the drawer and tell
  // EndpointList to open its edit form for that endpoint.
  const [triggerEdit, setTriggerEdit] = useState(null);

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
    setLatestEvent(event);
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
  const handleEndpointUpdated = (ep) => {
    setEndpoints((prev) => prev.map((e) => (e.id_endpoint === ep.id_endpoint ? ep : e)));
    // Keep the detail drawer in sync after an edit
    if (detailEndpoint?.id_endpoint === ep.id_endpoint) setDetailEndpoint(ep);
  };
  const handleEndpointDeleted = (id) => {
    setEndpoints((prev) => prev.filter((e) => e.id_endpoint !== id));
    if (detailEndpoint?.id_endpoint === id) setDetailEndpoint(null);
  };

  // Always pass the freshest version of the endpoint to the drawer
  const detailLive = detailEndpoint
    ? (endpoints.find((e) => e.id_endpoint === detailEndpoint.id_endpoint) ?? detailEndpoint)
    : null;

  const handleViewDetail = (ep) => setDetailEndpoint(ep);
  const handleCloseDetail = () => setDetailEndpoint(null);
  const handleEditFromDetail = (ep) => {
    setDetailEndpoint(null);
    setTriggerEdit(ep);
  };

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
            onViewDetail={handleViewDetail}
            triggerEdit={triggerEdit}
            onTriggerEditConsumed={() => setTriggerEdit(null)}
          />
        )}
      </main>

      {/* Detail drawer — overlays the dashboard without a route change */}
      {detailLive && (
        <EndpointDetail
          endpoint={detailLive}
          latestEvent={latestEvent}
          onClose={handleCloseDetail}
          onEdit={handleEditFromDetail}
        />
      )}
    </div>
  );
}
