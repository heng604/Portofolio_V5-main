import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { env } from './env.js';
import { errorHandler, notFoundApi } from './lib/http.js';
import { router as bakong } from './routes/bakong.js';
import { router as contact } from './routes/contact.js';
import { router as adminRoutes } from './routes/admin.js';

const app = express();
app.set('trust proxy', 1); // correct client IPs behind Vercel/Render/nginx for rate limiting
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false })); // CSP is relaxed: the SPA uses inline styles + Spline/Lottie
app.use(express.json({ limit: '32kb' }));

// Misconfiguration on serverless hosts (where the process cannot exit): answer with the reason as JSON.
app.use('/api', (req, res, next) => (env.problems.length
  ? res.status(503).json({ ok: false, code: 'server_misconfigured', message: 'Server configuration error: ' + env.problems.join(' ') })
  : next()));

app.get('/api/health', (req, res) => res.json({ ok: true, features: env.features, bakongEnv: env.bakong.env }));
app.use('/api/bakong', bakong);
app.use('/api/contact', contact);
app.use('/api/admin', adminRoutes);
app.use('/api', notFoundApi);

// Production (self-hosted): serve the built SPA from the same origin (no CORS needed).
// On Vercel the static files are served by Vercel itself and only /api reaches this app.
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
if (env.isProd && !process.env.VERCEL && fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(errorHandler);


export default app;
