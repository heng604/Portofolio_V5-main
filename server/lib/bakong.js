// Bakong KHQR generation (official `bakong-khqr` package) and transaction
// verification (official Bakong Open API: POST /v1/check_transaction_by_md5).
import { createRequire } from 'node:module';
import { env } from '../env.js';
import { ApiError } from './http.js';

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
export async function checkTransactionByMd5(md5) {
  let res;
  try {
    // With a relay configured, Bakong is called from a Cambodian IP (see relay/server.js).
    const url = `${env.bakong.relayUrl || env.bakong.baseUrl}/v1/check_transaction_by_md5`;
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${env.bakong.token}` };
    if (env.bakong.relayUrl) headers['x-relay-secret'] = env.bakong.relaySecret;
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ md5 }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    throw new ApiError(504, `Could not reach ${env.bakong.relayUrl ? 'the Bakong relay' : 'the Bakong API'} (timeout / network).`, 'bakong_unreachable');
  }

  // Read as TEXT first and parse defensively. Calling res.json() on an empty or HTML
  // body throws "Unexpected end of JSON input".
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }

  if (res.status === 401 || res.status === 403) {
    throw new ApiError(502, `Bakong rejected the request (HTTP ${res.status}): the token is invalid/expired, OR Bakong blocks this server's IP (Vercel is outside Cambodia) - use the relay, see README.`, 'bakong_auth');
  }
  if (!body) {
    throw new ApiError(502, `Bakong API returned HTTP ${res.status} with ${text ? 'a non-JSON' : 'an empty'} body.`, 'bakong_bad_response');
  }
  if (body.responseCode === 0 && body.data) return { found: true, txn: body.data };
  // Documented "transaction could not be found" = not paid yet.
  if (body.responseCode === 1 && Number(body.errorCode) === 3) return { found: false };
  console.error('[bakong] unexpected response:', res.status, body.responseCode, body.errorCode, body.responseMessage);
  throw new ApiError(502, `Bakong API error: ${body.responseMessage || 'unknown'}`, 'bakong_error');
}

// Strict match of a Bakong transaction against what we asked for.
export function matchesPayment(txn, payment) {
  const sameAccount = String(txn.toAccountId || '').toLowerCase() === env.bakong.accountId.toLowerCase();
  const sameCurrency = String(txn.currency || '').toUpperCase() === payment.currency;
  const sameAmount = Math.abs(Number(txn.amount) - Number(payment.amount)) < 1e-6;
  return { ok: sameAccount && sameCurrency && sameAmount, sameAccount, sameCurrency, sameAmount };
}
