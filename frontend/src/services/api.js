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
