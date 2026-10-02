// Central fetch wrapper — injects auth header, handles errors uniformly.
// All service files import this instead of calling fetch directly.
const API_BASE = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  try {
    const raw = localStorage.getItem('attendx.auth');
    return raw ? JSON.parse(raw).token : null;
  } catch {
    return null;
  }
}

function logout() {
  localStorage.removeItem('attendx.auth');
  window.location.href = '/login';
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // Don't set Content-Type for FormData — browser sets multipart boundary
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    // Token expired — force re-login
    const body = await res.json().catch(() => ({}));
    if (body.code === 'AUTH_TOKEN_EXPIRED') {
      logout();
    }
    const err = new Error(body.message || 'Unauthorized');
    err.code = body.code;
    throw err;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: `HTTP ${res.status}`, code: 'UNKNOWN' }));
    const err = new Error(body.message || `HTTP ${res.status}`);
    err.code = body.code;
    throw err;
  }

  if (res.status === 204) return null;
  return res.json();
}

// Shorthand helpers
export const api = {
  get: (path) => apiFetch(path),
  post: (path, body) => apiFetch(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => apiFetch(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (path, body) => apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del: (path) => apiFetch(path, { method: 'DELETE' }),
  postForm: (path, formData) => apiFetch(path, { method: 'POST', body: formData }),
};
