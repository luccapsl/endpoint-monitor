const API_BASE = '/api';

// ---------------------------------------------------------------------------
// Setup (Phase 1)
// ---------------------------------------------------------------------------

export async function checkSetupStatus() {
  const res = await fetch(`${API_BASE}/setup/status`);
  return res.json();
}

export async function testConnection(config) {
  const res = await fetch(`${API_BASE}/setup/test-connection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return res.json();
}

export async function saveSetup(config) {
  const res = await fetch(`${API_BASE}/setup/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return res.json();
}

// ---------------------------------------------------------------------------
// Endpoints (Phase 2)
// ---------------------------------------------------------------------------

export async function getEndpoints() {
  const res = await fetch(`${API_BASE}/endpoints`);
  if (!res.ok) throw new Error(`Failed to fetch endpoints: ${res.status}`);
  return res.json();
}

export async function getEndpoint(id) {
  const res = await fetch(`${API_BASE}/endpoints/${id}`);
  if (!res.ok) throw new Error(`Endpoint ${id} not found`);
  return res.json();
}

export async function createEndpoint(data) {
  const res = await fetch(`${API_BASE}/endpoints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to create endpoint: ${res.status}`);
  }
  return res.json();
}

export async function updateEndpoint(id, data) {
  const res = await fetch(`${API_BASE}/endpoints/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to update endpoint: ${res.status}`);
  }
  return res.json();
}

export async function deleteEndpoint(id) {
  const res = await fetch(`${API_BASE}/endpoints/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete endpoint: ${res.status}`);
}

export async function toggleEndpoint(id) {
  const res = await fetch(`${API_BASE}/endpoints/${id}/toggle`, { method: 'PATCH' });
  if (!res.ok) throw new Error(`Failed to toggle endpoint: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Metrics & History (Phases 3 & 5)
// ---------------------------------------------------------------------------

export async function getEndpointHistory(id, limit = 50, since = null) {
  const params = new URLSearchParams({ limit });
  if (since) params.set('since', since);
  const res = await fetch(`${API_BASE}/endpoints/${id}/history?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch history: ${res.status}`);
  return res.json();
}

export async function getEndpointMetrics(id, period = '24h') {
  const res = await fetch(`${API_BASE}/endpoints/${id}/metrics?period=${period}`);
  if (!res.ok) throw new Error(`Failed to fetch metrics: ${res.status}`);
  return res.json();
}

export async function getEndpointChart(id, period = '1h', points = 60) {
  const res = await fetch(
    `${API_BASE}/endpoints/${id}/chart?period=${period}&points=${points}`
  );
  if (!res.ok) throw new Error(`Failed to fetch chart data: ${res.status}`);
  return res.json();
}

export async function getSystemInfo() {
  const res = await fetch(`${API_BASE}/setup/info`);
  if (!res.ok) return { retention_hours: 72 };
  return res.json();
}
