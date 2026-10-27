import express from 'express';
import { getEnvReport, getConfig } from './env.js';
import { ApiError, wrap, clientIp, errorHandler } from './lib/http.js';
import { rateLimit } from './lib/rateLimit.js';
import { requireAdmin } from './lib/auth.js';
import { handleContact, hashIp } from './lib/contact.js';
import { createPayment, refreshPayment, cancelPayment } from './lib/payments.js';
import { loadBakongSettings } from './lib/settings.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use('/api', (req, res, next) => {
  res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
  next();
});
app.use(express.json({ limit: '20kb' }));

const report = () => getEnvReport();
const need = (group) => (req, _res, next) => {
  const r = report();
  const missing = [...r.core, ...(r[group] || [])];
  if (missing.length) return next(new ApiError(503, 'not_configured', 'The server is not fully configured yet.', { missing }));
  next();
};

app.get('/api/health', (_req, res) => {
  const r = report();
  res.json({
    ok: r.core.length === 0,
    time: new Date().toISOString(),
    // names of missing variables only, never values
    missing: { core: r.core, resend: r.resend, bakong: r.bakong },
    bakongMode: getConfig().bakong.mode,
  });
});

// ---------- public ----------
app.post('/api/contact', rateLimit({ name: 'contact', windowMs: 60_000, max: 3 }), need('resend'),
  wrap(async (req, res) => res.json(await handleContact(req.body, clientIp(req)))));

app.get('/api/bakong/config', need('bakong'), wrap(async (_req, res) => {
  const s = await loadBakongSettings();
  res.json({ ok: true, enabled: s.enabled, mode: getConfig().bakong.mode, recipient: { name: s.nameEn, nameKm: s.nameKm }, limits: s.limits, presets: s.presets, expiresMinutes: getConfig().bakong.expiresMinutes });
}));

app.post('/api/bakong/create', rateLimit({ name: 'bk-create', windowMs: 10 * 60_000, max: 10 }), need('bakong'),
  wrap(async (req, res) => {
    const { amount, currency, name, message } = req.body || {};
    const payment = await createPayment({ amount, currency: String(currency || '').toUpperCase(), tipperName: name, message, ipHash: hashIp(clientIp(req)) });
    res.status(201).json({ ok: true, payment });
  }));

app.get('/api/bakong/status/:id', rateLimit({ name: 'bk-status', windowMs: 60_000, max: 40 }), need('bakong'),
  wrap(async (req, res) => res.json({ ok: true, payment: await refreshPayment(req.params.id) })));

app.post('/api/bakong/cancel/:id', rateLimit({ name: 'bk-cancel', windowMs: 60_000, max: 20 }), need('bakong'),
  wrap(async (req, res) => res.json({ ok: true, payment: await cancelPayment(req.params.id) })));

// ---------- admin (verified server-side) ----------
app.get('/api/admin/me', need('core'), requireAdmin, (req, res) => res.json({ ok: true, email: req.adminUser.email }));

app.post('/api/admin/bakong/test', requireAdmin, need('bakong'), wrap(async (req, res) => {
  const currency = String(req.body?.currency || 'USD').toUpperCase();
  const amount = Number(req.body?.amount) || (currency === 'KHR' ? 100 : 0.01);
  const payment = await createPayment({ amount, currency, tipperName: 'Admin test', message: 'Admin Bakong test', isTest: true });
  res.status(201).json({ ok: true, payment });
}));

app.use('/api', (_req, _res, next) => next(new ApiError(404, 'not_found', 'API route not found.')));
app.use(errorHandler);

export default app;
