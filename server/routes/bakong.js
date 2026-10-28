import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import { env } from '../env.js';
import { ApiError, asyncRoute } from '../lib/http.js';
import { parseAmount, generateKhqr, checkTransactionByMd5, matchesPayment } from '../lib/bakong.js';
import * as store from '../lib/store.js';
import { signPayment, verifyPayment } from '../lib/token.js';

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
  id: p.id, token: p.token, status: p.status, amount: Number(p.amount), currency: p.currency,
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
  const row = {
    id, md5, qr, amount, currency, recipient_account: env.bakong.accountId, bill_number: billNumber,
    status: 'pending', is_test: isTest, environment: env.bakong.env,
    created_at: new Date(now).toISOString(), expires_at: new Date(expiresAtMs).toISOString(),
  };
  // The database is only a log now. If Supabase is down/misconfigured the QR still works.
  try { await store.insertPayment(row); }
  catch (e) { console.error('[bakong] payment log not saved (continuing):', e?.message || e); }
  row.token = signPayment({ id, md5, amount, currency, acct: env.bakong.accountId, exp: expiresAtMs });
  return row;
}

router.post('/create', requireBakong, limiter(10), asyncRoute(async (req, res) => {
  const { amount, currency } = parseAmount(req.body?.amount, req.body?.currency);
  const row = await createPayment({ amount, currency });
  res.status(201).json({ ok: true, payment: publicView(row) });
}));

// Stateless check: the signed token carries amount/currency/md5. We ask Bakong whether that md5 was paid.
// Success is decided ONLY here, from Bakong's answer. Confirmation is idempotent: repeated polls or duplicate
// requests never create a second confirmation (the txn hash is unique, and a confirmed row is never rewritten).
export async function verifyAndRecord(t, { check = checkTransactionByMd5 } = {}) {
  const now = Date.now();
  const base = { id: t.id, amount: t.amount, currency: t.currency, expiresAt: new Date(t.exp).toISOString() };
  const result = await check(t.md5);
  if (!result.found) return { ...base, status: now > t.exp ? 'expired' : 'pending' };

  const m = matchesPayment(result.txn, { amount: t.amount, currency: t.currency });
  if (!m.ok) {
    console.error('[bakong] txn mismatch for', t.id, { sameAccount: m.sameAccount, sameCurrency: m.sameCurrency, sameAmount: m.sameAmount });
    store.updatePayment(t.id, { status: 'failed', failure_reason: 'mismatch' }).catch(() => {});
    return { ...base, status: 'failed' };
  }
  const hash = result.txn.hash || null;
  let existing = null;
  try { existing = await store.getPayment(t.id); } catch { /* DB is only a log */ }
  if (existing?.status === 'confirmed') return { ...base, status: 'confirmed', confirmedAt: existing.confirmed_at };

  if (hash) {
    const other = await store.findByTxnHash(hash).catch(() => null);
    if (other && other.id !== t.id) {
      store.updatePayment(t.id, { status: 'failed', failure_reason: 'duplicate_txn' }).catch(() => {});
      return { ...base, status: 'failed' };
    }
  }
  const confirmedAt = new Date().toISOString();
  store.updatePayment(t.id, { status: 'confirmed', txn_hash: hash, payer_account: result.txn.fromAccountId || null, confirmed_at: confirmedAt, failure_reason: null })
    .catch((e) => console.error('[bakong] could not log confirmation:', e?.message || e));
  return { ...base, status: 'confirmed', confirmedAt };
}

router.post('/check', requireBakong, limiter(40), asyncRoute(async (req, res) => {
  const t = verifyPayment(req.body?.token);
  const now = Date.now();
  if (!env.bakongVerify) {
    return res.json({ ok: true, verification: false, payment: { id: t.id, status: now > t.exp ? 'expired' : 'pending', amount: t.amount, currency: t.currency, expiresAt: new Date(t.exp).toISOString() } });
  }
  if (now - (lastCheck.get(t.id) || 0) < MIN_CHECK_GAP_MS) {
    return res.json({ ok: true, payment: { id: t.id, status: now > t.exp ? 'expired' : 'pending', amount: t.amount, currency: t.currency, expiresAt: new Date(t.exp).toISOString() } });
  }
  lastCheck.set(t.id, now);
  const payment = await verifyAndRecord(t);
  if (payment.status === 'expired') store.updatePayment(t.id, { status: 'expired' }).catch(() => {});
  res.json({ ok: true, payment });
}));

router.post('/cancel', requireBakong, limiter(20), asyncRoute(async (req, res) => {
  const t = verifyPayment(req.body?.token);
  store.updatePayment(t.id, { status: 'cancelled' }).catch(() => {});
  res.json({ ok: true, payment: { id: t.id, status: 'cancelled', amount: t.amount, currency: t.currency } });
}));
