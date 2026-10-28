// Bakong KHQR generation (official `bakong-khqr` package) and transaction
// verification (official Bakong Open API: POST /v1/check_transaction_by_md5).
import { createRequire } from 'node:module';
import { env } from '../env.js';
import { ApiError } from './http.js';
import { readUpstream, classifyBakong, AUTH_HELP } from './upstream.js';

const require = createRequire(import.meta.url); // bakong-khqr is CommonJS
const { BakongKHQR, khqrData, IndividualInfo } = require('bakong-khqr');

export const LIMITS = {
  USD: { min: 0.01, max: 1000, decimals: 2, code: () => khqrData.currency.usd },
  KHR: { min: 100, max: 4_000_000, decimals: 0, code: () => khqrData.currency.khr },
};

export function parseAmount(rawAmount, rawCurrency) {
  const currency = String(rawCurrency || '').toUpperCase();
  const lim = LIMITS[currency];
  if (!lim) throw new ApiError(400, 'Currency must be USD or KHR.', 'bad_currency');
  const n = typeof rawAmount === 'number' ? rawAmount : Number(String(rawAmount ?? '').trim());
  if (!Number.isFinite(n)) throw new ApiError(400, 'Enter a valid amount.', 'bad_amount');
  const amount = Number(n.toFixed(lim.decimals));
  if (Math.abs(amount - n) > 1e-9) {
    throw new ApiError(400, currency === 'KHR' ? 'KHR amounts must be whole numbers.' : 'USD amounts allow at most 2 decimals.', 'bad_amount');
  }
  if (amount < lim.min || amount > lim.max) {
    throw new ApiError(400, `Amount must be between ${lim.min} and ${lim.max} ${currency}.`, 'bad_amount');
  }
  return { amount, currency };
}

export function generateKhqr({ amount, currency, billNumber, expiresAtMs }) {
  let result;
  try {
    const info = new IndividualInfo(env.bakong.accountId, env.bakong.merchantName, env.bakong.merchantCity, {
      currency: LIMITS[currency].code(),
      amount,
      billNumber,
      expirationTimestamp: expiresAtMs, // required by the library for dynamic (amount) QR
    });
    result = new BakongKHQR().generateIndividual(info);
  } catch (e) {
    console.error('[bakong] KHQR generation threw:', e);
    throw new ApiError(502, `Could not generate the KHQR: ${e?.message || e?.status?.message || 'invalid Bakong account ID / merchant details'}. Check BAKONG_ACCOUNT_ID (format name@bank), BAKONG_MERCHANT_NAME and BAKONG_MERCHANT_CITY.`, 'khqr_failed');
  }
  if (!result || result.status?.code !== 0 || !result.data?.qr || !result.data?.md5) {
    console.error('[bakong] KHQR generation failed:', result?.status);
    throw new ApiError(502, `Could not generate the KHQR: ${result?.status?.message || 'unknown reason'}. Check BAKONG_ACCOUNT_ID (format name@bank) and merchant name/city.`, 'khqr_failed');
  }
  return { qr: result.data.qr, md5: result.data.md5 };
}

// Returns { found:false } when the transaction does not exist (yet), or
// { found:true, txn } with the Bakong transaction. Throws ApiError on any other problem.
// `fetchImpl` is injectable so tests can mock Bakong without network access.
export async function callBakong(md5, fetchImpl = fetch) {
  const via = env.bakong.relayUrl ? 'the Bakong relay' : 'the Bakong API';
  let res;
  try {
    // With a relay configured, Bakong is called from a Cambodian IP (see relay/server.js).
    const url = `${env.bakong.relayUrl || env.bakong.baseUrl}/v1/check_transaction_by_md5`;
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${env.bakong.token}` };
    if (env.bakong.relayUrl) headers['x-relay-secret'] = env.bakong.relaySecret;
    res = await fetchImpl(url, { method: 'POST', headers, body: JSON.stringify({ md5 }), signal: AbortSignal.timeout(10_000) });
  } catch (e) {
    const timeout = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    throw new ApiError(504, `Could not reach ${via} (${timeout ? 'timeout' : 'network error'}).`, timeout ? 'bakong_timeout' : 'bakong_unreachable');
  }
  const up = await readUpstream(res);
  const kind = classifyBakong(up, !!env.bakong.relayUrl);
  return { up, kind, via };
}

export async function checkTransactionByMd5(md5, fetchImpl = fetch) {
  const { up, kind } = await callBakong(md5, fetchImpl);
  // Server-side diagnostics only (no token, no body dump beyond Bakong's own message).
  if (kind !== 'ok' && kind !== 'not_found') {
    console.error('[bakong] check failed:', { httpStatus: up.status, kind, bodyKind: up.kind, responseCode: up.body?.responseCode, errorCode: up.body?.errorCode, message: up.body?.responseMessage });
  }
  if (kind === 'auth_token' || kind === 'auth_blocked' || kind === 'auth_relay') throw new ApiError(502, AUTH_HELP[kind], `bakong_${kind}`);
  if (kind === 'rate_limited') throw new ApiError(503, 'Bakong is rate limiting requests. Retrying shortly.', 'bakong_rate_limited');
  if (kind === 'server_error') throw new ApiError(502, `Bakong API is having problems (HTTP ${up.status}).`, 'bakong_server_error');
  if (kind === 'bad_response') throw new ApiError(502, `Bakong API returned HTTP ${up.status} with ${up.kind === 'empty' ? 'an empty' : 'a non-JSON'} body.`, 'bakong_bad_response');
  if (kind === 'validation') throw new ApiError(502, `Bakong API rejected the request: ${up.body?.responseMessage || 'validation error'}`, 'bakong_validation');
  if (kind === 'not_found') return { found: false };
  return { found: true, txn: up.body.data };
}

// Admin "Diagnose" button: asks Bakong about a random md5. A healthy token + route answers "not found".
export async function diagnoseBakong(fetchImpl = fetch) {
  const probe = Array.from({ length: 32 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
  try {
    const { up, kind, via } = await callBakong(probe, fetchImpl);
    const healthy = kind === 'ok' || kind === 'not_found';
    return { healthy, kind, httpStatus: up.status, bodyKind: up.kind, via, message: healthy ? 'Bakong accepted the token.' : (AUTH_HELP[kind] || `Unexpected answer from Bakong (${kind}).`) };
  } catch (e) {
    return { healthy: false, kind: e.code || 'error', httpStatus: 0, bodyKind: null, via: env.bakong.relayUrl ? 'relay' : 'direct', message: e.message };
  }
}

// Strict match of a Bakong transaction against what we asked for.
export function matchesPayment(txn, payment) {
  const sameAccount = String(txn.toAccountId || '').toLowerCase() === env.bakong.accountId.toLowerCase();
  const sameCurrency = String(txn.currency || '').toUpperCase() === payment.currency;
  const sameAmount = Math.abs(Number(txn.amount) - Number(payment.amount)) < 1e-6;
  return { ok: sameAccount && sameCurrency && sameAmount, sameAccount, sameCurrency, sameAmount };
}
