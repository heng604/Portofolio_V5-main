// Safe fetch wrapper for the /api server.
// Reads the body as TEXT and parses it defensively, so an empty or HTML response
// (server not running, proxy error, 502 ...) becomes a readable error instead of
// "Failed to execute 'json' on 'Response': Unexpected end of JSON input".
import { supabase } from "../supabase";

export class ApiRequestError extends Error {
  constructor(message, { status = 0, code = "error", errors = null, network = false } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.errors = errors;
    this.network = network;
  }
}

export async function apiFetch(path, { method = "GET", body, auth = false, signal } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
  }

  let res;
  try {
    res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, signal });
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    throw new ApiRequestError("Cannot reach the server. Check your connection and that the API server is running.", { network: true });
  }

  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }

  if (!json) {
    const hint = text.trim().startsWith("<")
      ? `The /api request returned HTML instead of JSON. Locally, run "npm run dev:all". On Vercel, make sure the API function and server environment variables are deployed; a static-only deployment cannot process Bakong payments.`
      : text ? "The server returned an unreadable response." : "The server returned an empty response. Is the API server running (npm run dev:all)?";
    throw new ApiRequestError(`${hint} (HTTP ${res.status})`, { status: res.status, code: "bad_response", network: true });
  }
  if (!res.ok || json.ok === false) {
    throw new ApiRequestError(json.message || `Request failed (HTTP ${res.status})`, { status: res.status, code: json.code, errors: json.errors });
  }
  return json;
}
