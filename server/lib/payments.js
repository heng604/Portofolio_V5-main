import crypto from 'node:crypto';
import { db } from './supabase.js';
import { getConfig } from '../env.js';
import { ApiError } from './http.js';
import { loadBakongSettings } from './settings.js';
import { generateKhqr, normalizeAmount, checkTransactionByMd5, matchesExpected } from './bakong.js';

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max);

export const publicView = (p, settings) => ({
  id: p.id,
  status: p.status,                 // pending | paid | expired | cancelled | failed
  amount: Number(p.amount),
  currency: p.currency,
  qr: p.status === 'pending' ? p.qr_payload : undefined,
  expiresAt: p.expires_at,
  paidAt: p.paid_at,
  failureReason: p.failure_reason || undefined,
  mode: p.mode,
  isTest: p.is_test,
  recipient: { name: p.recipient_name, nameKm: settings?.nameKm || undefined },
});

export async function createPayment({ amount, currency, tipperName, message, isTest = false, ipHash }) {
  const cfg = getConfig();
  const settings = await loadBakongSettings();
  if (!settings.enabled && !isTest) throw new ApiError(503, 'tips_disabled', 'Tips are currently disabled.');
  if (!['USD', 'KHR'].includes(currency)) throw new ApiError(400, 'invalid_currency', 'Currency must be USD or KHR.');
  const amt = normalizeAmount(amount, currency);
  const lim = settings.limits[currency];
  if (amt < lim.min || amt > lim.max) {
    throw new ApiError(400, 'amount_out_of_range', `Amount must be between ${lim.min} and ${lim.max} ${currency}.`, { min: lim.min, max: lim.max });
  }
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + cfg.bakong.expiresMinutes * 60_000);
  const billNumber = id.replace(/-/g, '').slice(0, 12).toUpperCase();
  const { qr, md5 } = generateKhqr({ amount: amt, currency, expiresAtMs: expiresAt.getTime(), billNumber, recipient: settings });

  const row = {
    id, md5, qr_payload: qr, amount: amt, currency, status: 'pending', mode: cfg.bakong.mode, is_test: isTest,
    recipient_name: settings.nameEn, recipient_account: settings.accountId, bill_number: billNumber,
    tipper_name: clean(tipperName, 60) || null, message: clean(message, 280) || null,
    expires_at: expiresAt.toISOString(), ip_hash: ipHash || null,
  };
  const { data, error } = await db().from('payments').insert(row).select().single();
  if (error) {
    console.error('[payments] insert failed:', error.message);
    throw new ApiError(500, 'db_error', 'Could not create the payment record. Is the SQL schema installed?');
  }
  return publicView(data, settings);
}

const MIN_RECHECK_MS = 2500;

export async function refreshPayment(id) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, 'not_found', 'Payment not found.');
  const { data: p, error } = await db().from('payments').select('*').eq('id', id).maybeSingle();
  if (error) throw new ApiError(500, 'db_error', 'Could not read the payment record.');
  if (!p) throw new ApiError(404, 'not_found', 'Payment not found.');
  const settings = await loadBakongSettings();
  if (p.status !== 'pending') return publicView(p, settings);

  // throttle calls to the Bakong API
  if (p.last_checked_at && Date.now() - new Date(p.last_checked_at).getTime() < MIN_RECHECK_MS) return publicView(p, settings);
  await db().from('payments').update({ last_checked_at: new Date().toISOString(), check_count: (p.check_count || 0) + 1 }).eq('id', id);

  const result = await checkTransactionByMd5(p.md5);
  if (result.state === 'found') {
    const tx = result.data;
    const m = matchesExpected(tx, p, p.recipient_account);
    const hash = tx.hash ? String(tx.hash) : null;
    if (!m.ok) {
      const reason = `mismatch:${!m.toOk ? ' recipient' : ''}${!m.amtOk ? ' amount' : ''}${!m.curOk ? ' currency' : ''}`;
      const { data: f } = await db().from('payments').update({ status: 'failed', failure_reason: reason, bakong_response: safeTx(tx) }).eq('id', id).eq('status', 'pending').select().single();
      return publicView(f || p, settings);
    }
    // Only a pending row can become paid; unique(bakong_hash) rejects the same transaction used twice.
    const { data: paid, error: upErr } = await db().from('payments')
      .update({ status: 'paid', paid_at: new Date().toISOString(), bakong_hash: hash, bakong_response: safeTx(tx) })
      .eq('id', id).eq('status', 'pending').select().maybeSingle();
    if (upErr) {
      if (upErr.code === '23505') {
        const { data: f } = await db().from('payments').update({ status: 'failed', failure_reason: 'duplicate_transaction' }).eq('id', id).eq('status', 'pending').select().single();
        return publicView(f || p, settings);
      }
      throw new ApiError(500, 'db_error', 'Could not record the verified payment.');
    }
    if (paid) return publicView(paid, settings);
    const { data: again } = await db().from('payments').select('*').eq('id', id).single();
    return publicView(again, settings);
  }

  if (new Date(p.expires_at).getTime() < Date.now()) {
    const { data: e } = await db().from('payments').update({ status: 'expired' }).eq('id', id).eq('status', 'pending').select().maybeSingle();
    if (e) return publicView(e, settings);
  }
  const { data: cur } = await db().from('payments').select('*').eq('id', id).single();
  return publicView(cur, settings);
}

export async function cancelPayment(id) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, 'not_found', 'Payment not found.');
  const { data } = await db().from('payments').update({ status: 'cancelled' }).eq('id', id).eq('status', 'pending').select().maybeSingle();
  if (data) return publicView(data, await loadBakongSettings());
  return refreshPayment(id); // already paid/expired/etc: report the real state
}

// Keep only non-sensitive transaction fields for the admin payment log.
function safeTx(tx) {
  const { hash, fromAccountId, toAccountId, currency, amount, description, createdDateMs, acknowledgedDateMs, trackingStatus } = tx;
  return { hash, fromAccountId, toAccountId, currency, amount, description, createdDateMs, acknowledgedDateMs, trackingStatus };
}
