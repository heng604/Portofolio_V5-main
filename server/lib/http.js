// Small helpers so every API response is ALWAYS valid JSON.
// (An empty / HTML body is what causes the browser error
//  "Failed to execute 'json' on 'Response': Unexpected end of JSON input".)
export class ApiError extends Error {
  constructor(status, message, code = 'error') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const notFoundApi = (req, res) =>
  res.status(404).json({ ok: false, code: 'not_found', message: 'API route not found.' });

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ ok: false, code: err.code, message: err.message });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, code: 'bad_json', message: 'Request body is not valid JSON.' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ ok: false, code: 'too_large', message: 'Request body too large.' });
  }
  console.error('[unhandled]', err); // full detail stays in server logs only
  return res.status(500).json({ ok: false, code: 'server_error', message: 'Something went wrong on the server.' });
};
