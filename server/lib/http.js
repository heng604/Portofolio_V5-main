// Every API response is JSON. This is what prevents the browser error
// "Failed to execute 'json' on 'Response': Unexpected end of JSON input".
export class ApiError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || req.socket?.remoteAddress || 'unknown';
}

export function errorHandler(err, req, res, _next) { // eslint-disable-line no-unused-vars
  if (err instanceof ApiError) {
    return res.status(err.status).json({ ok: false, error: err.code, message: err.message, ...err.extra });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, error: 'bad_json', message: 'Request body is not valid JSON.' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ ok: false, error: 'too_large', message: 'Request body too large.' });
  }
  console.error('[api] unhandled error:', err?.message || err);
  return res.status(500).json({ ok: false, error: 'server_error', message: 'Something went wrong on the server. Please try again.' });
}
