import { ApiError } from './http.js';

export const strip = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);
export const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;


export function validateContact(body = {}) {
  const v = {
    name: strip(body.name, 100).replace(/[\r\n]+/g, ' '),
    email: strip(body.email, 160).toLowerCase(),
    subject: strip(body.subject, 150).replace(/[\r\n]+/g, ' '),
    message: strip(body.message, 5000),
  };
  const errors = {};
  if (v.name.length < 2) errors.name = 'Name must be at least 2 characters.';
  if (!EMAIL_RE.test(v.email)) errors.email = 'Enter a valid email address.';
  if (v.subject.length < 3) errors.subject = 'Subject must be at least 3 characters.';
  if (v.message.length < 10) errors.message = 'Message must be at least 10 characters.';
  if (Object.keys(errors).length) throw new ApiError(400, 'validation', 'Please fix the highlighted fields.', { fields: errors });
  return v;
}


export function normalizeAmount(amount, currency) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) throw new ApiError(400, 'invalid_amount', 'Enter a valid amount greater than zero.');
  if (currency === 'KHR') {
    if (!Number.isInteger(n)) throw new ApiError(400, 'invalid_amount', 'KHR amounts must be whole numbers.');
    return n;
  }
  // USD: max 2 decimals
  const cents = Math.round(n * 100);
  if (Math.abs(cents - n * 100) > 1e-6) throw new ApiError(400, 'invalid_amount', 'USD amounts can have at most 2 decimals.');
  return cents / 100;
}


// Does the Bakong transaction match what we asked for? (recipient + amount + currency)
export function matchesExpected(tx, payment, accountId) {
  const toOk = String(tx.toAccountId || '').toLowerCase() === String(accountId).toLowerCase();
  const curOk = String(tx.currency || '').toUpperCase() === payment.currency;
  const paid = Number(tx.amount);
  const amtOk = payment.currency === 'KHR' ? paid === Number(payment.amount) : Math.abs(paid - Number(payment.amount)) < 0.005;
  return { ok: toOk && curOk && amtOk, toOk, curOk, amtOk };
}
