// Safe fetch wrapper for the /api backend.
// Reads the body as text first so an empty / HTML / non-JSON response produces a clear message
// instead of "Failed to execute 'json' on 'Response': Unexpected end of JSON input".
const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export class ApiClientError extends Error {
  constructor(message, { status = 0, code = 'unknown', fields, data } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.data = data;
  }
}

export async function apiFetch(path, { method = 'GET', body, token, signal } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      signal,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    throw new ApiClientError('Network error: cannot reach the server. Check your connection and that the API is running.', { code: 'network' });
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { /* not JSON */ }
  }

  if (!data) {
    const hint = res.ok
      ? 'The server returned an empty or non-JSON response.'
      : `The API answered with HTTP ${res.status} and no JSON body. Is the API server running (npm run dev) and is /api routed to it?`;
    throw new ApiClientError(hint, { status: res.status, code: 'bad_response' });
  }
  if (!res.ok || data.ok === false) {
    throw new ApiClientError(data.message || `Request failed (${res.status}).`, {
      status: res.status, code: data.error || 'error', fields: data.fields, data,
    });
  }
  return data;
}
