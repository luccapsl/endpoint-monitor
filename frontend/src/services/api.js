const API_BASE = '/api';

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
