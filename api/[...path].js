import app from '../server/index.js';

// Vercel invokes this Express app for /api/* requests. Keep API requests out of
// the static SPA rewrite so they return JSON rather than index.html.
export default app;
