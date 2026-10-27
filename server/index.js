import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
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

app.get('/api/health', (req, res) => res.json({ ok: true, features: env.features, bakongEnv: env.bakong.env }));
app.use('/api/bakong', bakong);
app.use('/api/contact', contact);
app.use('/api/admin', adminRoutes);
app.use('/api', notFoundApi);

// Production: serve the built SPA from the same origin (no CORS needed).
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
if (env.isProd && fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(errorHandler);

// Export the Express app for serverless hosts (e.g. Vercel) and start a listener
// only when this file is executed directly by `npm run dev:server` / `npm start`.
export default app;
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  app.listen(env.port, () => {
    console.log(`[server] http://localhost:${env.port}  (bakong=${env.bakong.env}, features=${JSON.stringify(env.features)})`);
  });
}
