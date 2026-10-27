// Bakong KHQR generation (official `bakong-khqr` SDK) + transaction verification
// (official NBC Bakong Open API). Token stays on the server.
import { createRequire } from 'node:module';
import { getConfig } from '../env.js';
import { ApiError } from './http.js';
export { normalizeAmount, matchesExpected } from './pure.js';

const require = createRequire(import.meta.url);
const { BakongKHQR, khqrData, IndividualInfo } = require('bakong-khqr');

export const CURRENCIES = { USD: khqrData.currency.usd, KHR: khqrData.currency.khr };

export function generateKhqr({ amount, currency, expiresAtMs, billNumber, recipient }) {
  const { bakong } = getConfig();
  const optional = {
    currency: CURRENCIES[currency],
    amount,
    expirationTimestamp: expiresAtMs,
    billNumber,
    storeLabel: 'Portfolio Tips',
    purposeOfTransaction: 'Tip',
  };
  if (bakong.mobile) optional.mobileNumber = bakong.mobile;
  if (recipient.nameKm) {
    optional.languagePreference = 'km';
    optional.merchantNameAlternateLanguage = recipient.nameKm;
    optional.merchantCityAlternateLanguage = recipient.cityKm || 'ភ្នំពេញ';
  }
  const info = new IndividualInfo(recipient.accountId, recipient.nameEn, recipient.city, optional);
  const result = new BakongKHQR().generateIndividual(info);
  if (!result || result.status?.code !== 0 || !result.data?.qr || !result.data?.md5) {
    console.error('[bakong] KHQR generation failed:', result?.status);
    throw new ApiError(502, 'khqr_failed', `KHQR could not be generated: ${result?.status?.message || 'unknown error'}.`);
  }
  return { qr: result.data.qr, md5: result.data.md5 };
}

// Official endpoint: POST {base}/v1/check_transaction_by_md5  (Bearer token, body {md5}).
// Returns { state: 'found' | 'not_found', data? }. Throws ApiError on transport/auth problems.
export async function checkTransactionByMd5(md5) {
  const { bakong } = getConfig();
  let res;
  try {
    res = await fetch(`${bakong.baseUrl}/v1/check_transaction_by_md5`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bakong.token}` },
      body: JSON.stringify({ md5 }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    throw new ApiError(502, 'bakong_unreachable', 'Could not reach the Bakong API. Will retry.', { detail: e?.name });
  }
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }

  if (res.status === 401 || res.status === 403) {
    // Bakong also blocks some non-Cambodian IPs; see README troubleshooting.
    throw new ApiError(502, 'bakong_auth', 'Bakong rejected the request (token invalid/expired or IP not allowed).');
  }
  if (!body) throw new ApiError(502, 'bakong_bad_response', `Bakong returned an empty or non-JSON response (HTTP ${res.status}).`);
  if (body.responseCode === 0 && body.data) return { state: 'found', data: body.data };
  // responseCode 1 + errorCode 3 = "transaction not found" (not paid yet)
  return { state: 'not_found', raw: { responseCode: body.responseCode, errorCode: body.errorCode } };
}

