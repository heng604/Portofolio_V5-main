import { Router } from 'express';
import { env } from '../env.js';
import { ApiError, asyncRoute } from '../lib/http.js';
import { requireAdmin, getUserFromRequest, isAdminUser } from '../lib/auth.js';
import { admin } from '../lib/supabase.js';
import * as store from '../lib/store.js';
import { parseAmount } from '../lib/bakong.js';
import { createPayment } from './bakong.js';

export const router = Router();

// Used by the SPA to decide between dashboard / login / 404. Never trusts the browser.
router.get('/me', asyncRoute(async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!user) return res.json({ ok: true, authenticated: false, isAdmin: false });
  res.json({ ok: true, authenticated: true, isAdmin: isAdminUser(user) });
}));

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
  res.status(201).json({ ok: true, payment: { id: p.id, status: p.status, amount: Number(p.amount), currency: p.currency, qr: p.qr,
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
