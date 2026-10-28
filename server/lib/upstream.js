// Pure helpers (no imports) for talking to the Bakong Open API safely.
// Never call res.json() on an upstream response: an empty / HTML / truncated body throws
// "Unexpected end of JSON input". Read TEXT first, then parse defensively.

export async function readUpstream(res) {
  let text = '';
  try { text = await res.text(); } catch { text = ''; }
  let body = null;
  let parseError = false;
  if (text) {
    try { body = JSON.parse(text); } catch { parseError = true; }
  }
  const trimmed = text.trim();
  const kind = !trimmed ? 'empty' : parseError ? (trimmed.startsWith('<') ? 'html' : 'text') : 'json';
  return { status: res.status, ok: res.ok, text, body, kind };
}

// Turns an upstream result into a stable, secret-free classification.
//   auth_token  : Bakong answered (JSON) and rejected the token -> expired / invalid / wrong token
//   auth_blocked: 401/403 with an empty/HTML body -> request was stopped before the API (IP/geo block, WAF)
//   rate_limited, server_error, bad_response, validation, ok, not_found
export function classifyBakong({ status, body, kind }, viaRelay = false) {
  if (viaRelay && status === 401 && kind === 'json' && body?.message === 'bad secret') return 'auth_relay';
  if (status === 401 || status === 403) {
    return kind === 'json' ? 'auth_token' : 'auth_blocked';
  }
  if (status === 404 || status === 405) return 'wrong_endpoint';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'server_error';
  if (kind !== 'json' || !body || typeof body !== 'object') return 'bad_response';
  if (body.responseCode === 0 && body.data) return 'ok';
  if (body.responseCode === 1 && Number(body.errorCode) === 3) return 'not_found';
  if (status >= 400) return 'validation';
  return 'bad_response';
}

export const AUTH_HELP = {
  auth_relay: 'The relay refused the request: BAKONG_RELAY_SECRET does not match RELAY_SECRET on the relay.',
  auth_token: 'Bakong rejected the API token (expired or invalid). Tokens expire: renew it in the Bakong Open API portal and update BAKONG_API_TOKEN (no quotes, no "Bearer " prefix).',
  auth_blocked: 'HTTP 401/403 with a non-JSON body: the request was blocked before reaching the Bakong API. Bakong is reachable from Cambodian IPs; run the relay (relay/server.js) on a Cambodian host and set BAKONG_RELAY_URL / BAKONG_RELAY_SECRET.',
};
