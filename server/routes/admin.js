import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../env.js';
import { ApiError, asyncRoute } from '../lib/http.js';
import { requireAdmin, getUserFromRequest, isAdminUser } from '../lib/auth.js';
import { admin } from '../lib/supabase.js';
import * as store from '../lib/store.js';
import { parseAmount, diagnoseBakong } from '../lib/bakong.js';
import { writeAudit, listAudit } from '../lib/audit.js';
import { createPayment, verifyAndRecord } from './bakong.js';

export const router = Router();

// Used by the SPA to decide between dashboard / login / 404. Never trusts the browser.
router.get('/me', asyncRoute(async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!user) return res.json({ ok: true, authenticated: false, isAdmin: false });
  res.json({ ok: true, authenticated: true, isAdmin: isAdminUser(user) });
}));

// Authorization is enforced on the server for EVERY route below (Supabase JWT verified, then admin email).
// The API authenticates with a Bearer header (not cookies), so classic CSRF does not apply.
router.use(rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ ok: false, code: 'rate_limited', message: 'Too many requests.' }) }));
router.use(requireAdmin);

router.get('/config', (req, res) => res.json({
  ok: true,
  bakong: { configured: env.features.bakong, environment: env.bakong.env, accountId: env.bakong.accountId || null,
            merchantName: env.bakong.merchantName || null, baseUrl: env.bakong.baseUrl || null, tokenSet: !!env.bakong.token },
  resend: { configured: env.features.resend, from: env.resend.from || null, to: env.resend.to },
  supabase: { configured: env.features.supabase }, adminEmail: env.adminEmail,
}));

router.get('/payments', asyncRoute(async (req, res) => {
  const status = ['pending', 'confirmed', 'expired', 'cancelled', 'failed'].includes(req.query.status) ? req.query.status : undefined;
  const rows = await store.listPayments({ status, limit: 200 });
  // md5/qr are not needed in the log table
  res.json({ ok: true, payments: rows.map(({ qr, md5, ...r }) => r) });
}));

// "Test Bakong": makes a real KHQR so the UI can be exercised. It is flagged is_test.
// If someone actually pays it, normal server-side verification still applies.
router.post('/bakong/test', asyncRoute(async (req, res) => {
  if (!env.features.bakong) throw new ApiError(503, 'Bakong is not configured.', 'bakong_off');
  const { amount, currency } = parseAmount(req.body?.amount ?? 0.01, req.body?.currency ?? 'USD');
  const p = await createPayment({ amount, currency, isTest: true });
  res.status(201).json({ ok: true, payment: { id: p.id, status: p.status, amount: Number(p.amount), currency: p.currency, qr: p.qr, token: p.token,
    expiresAt: p.expires_at, isTest: true, environment: p.environment, recipient: { name: env.bakong.merchantName, city: env.bakong.merchantCity } } });
}));

router.get('/messages', asyncRoute(async (req, res) => {
  if (!admin) throw new ApiError(503, 'Supabase is not configured.', 'supabase_off');
  const { data, error } = await admin.from('contact_submissions').select('*').order('created_at', { ascending: false }).limit(300);
  if (error) throw error;
  res.json({ ok: true, messages: data });
}));
router.patch('/messages/:id', asyncRoute(async (req, res) => {
  if (!admin) throw new ApiError(503, 'Supabase is not configured.', 'supabase_off');
  const { error } = await admin.from('contact_submissions').update({ is_read: !!req.body?.is_read }).eq('id', req.params.id);
  if (error) throw error;
  res.json({ ok: true });
}));
router.delete('/messages/:id', asyncRoute(async (req, res) => {
  if (!admin) throw new ApiError(503, 'Supabase is not configured.', 'supabase_off');
  const { error } = await admin.from('contact_submissions').delete().eq('id', req.params.id);
  if (error) throw error;
  res.json({ ok: true });
}));

const STATUSES = ['pending', 'confirmed', 'expired', 'cancelled', 'failed'];
const UUID = /^[0-9a-f-]{36}$/i;
const stripSecrets = ({ qr, ...r }) => r; // the KHQR payload is not needed by the admin UI

router.get('/stats', asyncRoute(async (req, res) => {
  const count = async (table, f) => {
    if (!admin) return null;
    let q = admin.from(table).select('*', { count: 'exact', head: true });
    if (f) q = f(q);
    const { count: c, error } = await q;
    return error ? null : c;
  };
  const [projects, certificates, techStack, comments, unread, payments, recent, audit] = await Promise.all([
    count('projects'), count('certificates'), count('tech_stack'), count('portfolio_comments'),
    count('contact_submissions', (q) => q.eq('is_read', false)),
    store.paymentSummary(),
    store.queryPayments({ pageSize: 6 }),
    listAudit(8).catch(() => []),
  ]);
  const published = admin ? await count('projects', (q) => q.eq('is_published', true)) : null;
  res.json({ ok: true, content: { projects, publishedProjects: published, certificates, techStack, comments, unreadMessages: unread }, payments, recentPayments: recent.rows.map(stripSecrets), recentAudit: audit });
}));

router.get('/payments', asyncRoute(async (req, res) => {
  const { status, currency, q, sort, dir, page, pageSize, includeTest } = req.query;
  const out = await store.queryPayments({
    status: STATUSES.includes(status) ? status : undefined,
    currency: ['USD', 'KHR'].includes(currency) ? currency : undefined,
    q: typeof q === 'string' ? q.slice(0, 64) : undefined,
    sort, dir: dir === 'asc' ? 'asc' : 'desc', page, pageSize,
    includeTest: includeTest !== 'false',
  });
  res.json({ ok: true, total: out.total, payments: out.rows.map(stripSecrets), summary: await store.paymentSummary() });
}));

router.get('/payments/:id', asyncRoute(async (req, res) => {
  if (!UUID.test(req.params.id)) throw new ApiError(400, 'Invalid payment id.', 'bad_id');
  const p = await store.getPayment(req.params.id);
  if (!p) throw new ApiError(404, 'Payment not found.', 'not_found');
  res.json({ ok: true, payment: stripSecrets(p) });
}));

// Re-ask Bakong. This is the ONLY way a payment can become confirmed outside the visitor's own polling.
router.post('/payments/:id/reverify', asyncRoute(async (req, res) => {
  if (!UUID.test(req.params.id)) throw new ApiError(400, 'Invalid payment id.', 'bad_id');
  if (!env.features.bakong || !env.bakongVerify) throw new ApiError(503, 'Bakong verification is not configured (BAKONG_API_TOKEN).', 'bakong_off');
  const p = await store.getPayment(req.params.id);
  if (!p) throw new ApiError(404, 'Payment not found.', 'not_found');
  if (p.status === 'cancelled') throw new ApiError(409, 'Cancelled payments cannot be re-verified.', 'bad_state');
  const t = { id: p.id, md5: p.md5, amount: Number(p.amount), currency: p.currency, exp: new Date(p.expires_at).getTime() };
  const result = await verifyAndRecord(t);
  await writeAudit({ actor: req.user.email, action: 'payment.reverify', entity: 'payments', entityId: p.id, details: { before: p.status, after: result.status } });
  res.json({ ok: true, payment: result });
}));

// Audited correction. Deliberately CANNOT mark a payment as paid: confirmation only comes from Bakong.
router.post('/payments/:id/void', asyncRoute(async (req, res) => {
  if (!UUID.test(req.params.id)) throw new ApiError(400, 'Invalid payment id.', 'bad_id');
  const reason = String(req.body?.reason || '').trim();
  if (reason.length < 10 || reason.length > 500) throw new ApiError(400, 'A reason of 10-500 characters is required.', 'bad_reason');
  const p = await store.getPayment(req.params.id);
  if (!p) throw new ApiError(404, 'Payment not found.', 'not_found');
  if (!['pending', 'expired', 'failed'].includes(p.status)) throw new ApiError(409, `A ${p.status} payment cannot be voided.`, 'bad_state');
  const updated = await store.updatePayment(p.id, { status: 'cancelled', failure_reason: `admin: ${reason}`.slice(0, 200) });
  await writeAudit({ actor: req.user.email, action: 'payment.void', entity: 'payments', entityId: p.id, details: { before: p.status, reason } });
  res.json({ ok: true, payment: stripSecrets(updated) });
}));

router.post('/bakong/diagnose', asyncRoute(async (req, res) => {
  if (!env.features.bakong) throw new ApiError(503, 'Bakong is not configured.', 'bakong_off');
  if (!env.bakongVerify) return res.json({ ok: true, result: { healthy: false, kind: 'no_token', message: 'BAKONG_API_TOKEN is not set.' } });
  res.json({ ok: true, result: await diagnoseBakong() });
}));

router.get('/audit', asyncRoute(async (req, res) => {
  res.json({ ok: true, entries: await listAudit(Math.min(Number(req.query.limit) || 50, 200)) });
}));
