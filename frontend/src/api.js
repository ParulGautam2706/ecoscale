const BASE = import.meta.env.VITE_API_BASE_URL || '/api';

async function handle(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  health: () => fetch(`${BASE}/health`).then(handle),
  dashboard: () => fetch(`${BASE}/dashboard`).then(handle),
  regions: () => fetch(`${BASE}/regions`).then(handle),
  resources: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetch(`${BASE}/resources${qs ? `?${qs}` : ''}`).then(handle);
  },
  recommendations: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetch(`${BASE}/recommendations${qs ? `?${qs}` : ''}`).then(handle);
  },
  simulate: (resource_id, action) =>
    fetch(`${BASE}/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource_id, action }),
    }).then(handle),
};
