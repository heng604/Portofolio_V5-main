// Stateless payment tokens: the server signs {id, md5, amount, currency, exp} with HMAC so the payment can be
// verified later WITHOUT a database (works on Vercel/serverless, and when Supabase is unreachable).
// The browser cannot change the amount: any edit breaks the signature.
import crypto from 'node:crypto';
import { env } from '../env.js';
import { ApiError } from './http.js';

const secret = () =>
  process.env.PAYMENT_SIGNING_SECRET ||
  crypto.createHash('sha256').update(`khqr|${env.bakong.token}|${env.supabaseServiceKey}|${env.bakong.accountId}`).digest('hex');

const b64 = (b) => Buffer.from(b).toString('base64url');
const mac = (data) => crypto.createHmac('sha256', secret()).update(data).digest('base64url');

export function signPayment(p) {
  const data = b64(JSON.stringify(p));
  return `${data}.${mac(data)}`;
}

export function verifyPayment(token) {
  const [data, sig] = String(token || '').split('.');
  if (!data || !sig) throw new ApiError(400, 'Invalid payment token.', 'bad_token');
  const expected = mac(data);
  const ok = sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!ok) throw new ApiError(400, 'Invalid payment token.', 'bad_token');
  try { return JSON.parse(Buffer.from(data, 'base64url').toString('utf8')); }
  catch { throw new ApiError(400, 'Invalid payment token.', 'bad_token'); }
}
