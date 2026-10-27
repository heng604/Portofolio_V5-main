import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import { env } from '../env.js';
import { ApiError, asyncRoute } from '../lib/http.js';
import { parseAmount, generateKhqr, checkTransactionByMd5, matchesPayment } from '../lib/bakong.js';
import * as store from '../lib/store.js';

export const router = Router();

const limiter = (max, windowMs = 60_000) =>
  rateLimit({
    windowMs, max, standardHeaders: true, legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ ok: false, code: 'rate_limited', message: 'Too many requests. Please slow down.' }),
  });

const requireBakong = (req, res, next) =>
  env.features.bakong ? next() : next(new ApiError(503, 'Bakong is not configured on the server (see .env.example).', 'bakong_off'));

const UUID = /^[0-9a-f-]{36}$/i;
const lastCheck = new Map(); // paymentId -> ms (throttle upstream calls)
const MIN_CHECK_GAP_MS = 3000;

const recipient = () => ({ name: env.bakong.merchantName, city: env.bakong.merchantCity });

const publicView = (p) => ({
  id: p.id, status: p.status, amount: Number(p.amount), currency: p.currency,
  qr: p.status === 'pending' ? p.qr : undefined,
  expiresAt: p.expires_at, confirmedAt: p.confirmed_at || null,
  isTest: !!p.is_test, environment: p.environment, recipient: recipient(),
});

router.get('/config', (req, res) => {
  res.json({
    ok: true, enabled: env.features.bakong, environment: env.bakong.env,
    currencies: ['USD', 'KHR'], recipient: recipient(),
    limits: { USD: { min: 0.01, max: 1000 }, KHR: { min: 100, max: 4000000 } },
    persistent: store.usingDatabase(), verification: env.bakongVerify,
  });
});

export async function createPayment({ amount, currency, isTest = false }) {
  const id = crypto.randomUUID();
  const now = Date.now();
  const expiresAtMs = now + env.bakong.qrTtlSeconds * 1000;
  const billNumber = `TIP-${id.slice(0, 8).toUpperCase()}`;
  const { qr, md5 } = generateKhqr({ amount, currency, billNumber, expiresAtMs });
  const row = await store.insertPayment({
    id, md5, qr, amount, currency, recipient_account: env.bakong.accountId, bill_number: billNumber,
    status: 'pending', is_test: isTest, environment: env.bakong.env,
    created_at: new Date(now).toISOString(), expires_at: new Date(expiresAtMs).toISOString(),
  });
  return row;
}

router.post('/create', requireBakong, limiter(10), asyncRoute(async (req, res) => {
  const { amount, currency } = parseAmount(req.body?.amount, req.body?.currency);
  const row = await createPayment({ amount, currency });
  res.status(201).json({ ok: true, payment: publicView(row) });
}));

router.get('/status/:id', requireBakong, limiter(40), asyncRoute(async (req, res) => {
  if (!UUID.test(req.params.id)) throw new ApiError(400, 'Invalid payment id.', 'bad_id');
  let p = await store.getPayment(req.params.id);
  if (!p) throw new ApiError(404, 'Payment not found.', 'not_found');
  if (p.status !== 'pending') return res.json({ ok: true, payment: publicView(p) });

  if (!env.bakongVerify) return res.json({ ok: true, verification: false, payment: publicView(p) }); // no API token: QR works, auto-confirm cannot
  const now = Date.now();
  if (now - (lastCheck.get(p.id) || 0) < MIN_CHECK_GAP_MS) return res.json({ ok: true, payment: publicView(p) });
  lastCheck.set(p.id, now);

  // Ask Bakong first: a payment made just before expiry must still be honoured.
  const result = await checkTransactionByMd5(p.md5);
  if (result.found) {
    const txn = result.txn;
    const m = matchesPayment(txn, p);
    if (!m.ok) {
      // Money arrived but does not match what was requested: never mark as success.
      p = await store.updatePayment(p.id, { status: 'failed', failure_reason: `mismatch account:${m.sameAccount} currency:${m.sameCurrency} amount:${m.sameAmount}`, txn_hash: txn.hash || null });
      return res.json({ ok: true, payment: publicView(p) });
    }
    const dup = txn.hash ? await store.findByTxnHash(txn.hash) : null;
    if (dup && dup.id !== p.id) {
      p = await store.updatePayment(p.id, { status: 'failed', failure_reason: 'duplicate_transaction' });
      return res.json({ ok: true, payment: publicView(p) });
    }
    p = await store.updatePayment(p.id, {
      status: 'confirmed', txn_hash: txn.hash || null, payer_account: txn.fromAccountId || null,
      confirmed_at: new Date().toISOString(),
    });
  } else if (new Date(p.expires_at).getTime() < now) {
    p = await store.updatePayment(p.id, { status: 'expired' });
  }
  res.json({ ok: true, payment: publicView(p) });
}));

router.post('/cancel/:id', requireBakong, limiter(20), asyncRoute(async (req, res) => {
  if (!UUID.test(req.params.id)) throw new ApiError(400, 'Invalid payment id.', 'bad_id');
  const p = await store.getPayment(req.params.id);
  if (!p) throw new ApiError(404, 'Payment not found.', 'not_found');
  if (p.status !== 'pending') return res.json({ ok: true, payment: publicView(p) });
  // Cancelling only hides it in the UI. If the user already paid, a later status check cannot revive it.
  res.json({ ok: true, payment: publicView(await store.updatePayment(p.id, { status: 'cancelled' })) });
}));
