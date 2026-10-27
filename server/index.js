// Local / VPS entry point:  npm run server   (Vite proxies /api to this port in development)
import app from './app.js';
import { getEnvReport } from './env.js';

const r = getEnvReport();
if (r.core.length) {
  console.error(`\n[startup] Missing REQUIRED environment variables: ${r.core.join(', ')}\nCopy .env.example to .env and fill them in (see README).\n`);
  process.exit(1);
}
if (r.resend.length) console.warn(`[startup] Contact form disabled until set: ${r.resend.join(', ')}`);
if (r.bakong.length) console.warn(`[startup] Bakong tips disabled until set: ${r.bakong.join(', ')}`);

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => console.log(`[api] listening on http://localhost:${port}`));
