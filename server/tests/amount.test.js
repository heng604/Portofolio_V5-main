// Run with: npm test   (needs `npm install` first because it imports bakong-khqr)
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.ADMIN_EMAIL = 'admin@example.com';
process.env.SITE_URL = 'http://localhost:5173';
process.env.BAKONG_ACCOUNT_ID = 'test@aclb';
process.env.BAKONG_MERCHANT_NAME = 'Test';
process.env.BAKONG_API_BASE_URL = 'https://example.invalid';
process.env.BAKONG_API_TOKEN = 'x';

const { parseAmount, matchesPayment, generateKhqr } = await import('../lib/bakong.js');

test('accepts valid USD and KHR', () => {
  assert.deepEqual(parseAmount('1.5', 'usd'), { amount: 1.5, currency: 'USD' });
  assert.deepEqual(parseAmount(4000, 'KHR'), { amount: 4000, currency: 'KHR' });
});
test('rejects invalid amounts', () => {
  for (const [a, c] of [[0, 'USD'], [-1, 'USD'], ['abc', 'USD'], [1.234, 'USD'], [100.5, 'KHR'], [50, 'KHR'], [5000, 'USD'], [1, 'EUR']]) {
    assert.throws(() => parseAmount(a, c), `${a} ${c} should be rejected`);
  }
});
test('payment matching requires account, currency and amount', () => {
  const p = { currency: 'USD', amount: 1.5 };
  assert.equal(matchesPayment({ toAccountId: 'test@aclb', currency: 'USD', amount: 1.5 }, p).ok, true);
  assert.equal(matchesPayment({ toAccountId: 'other@aclb', currency: 'USD', amount: 1.5 }, p).ok, false);
  assert.equal(matchesPayment({ toAccountId: 'test@aclb', currency: 'KHR', amount: 1.5 }, p).ok, false);
  assert.equal(matchesPayment({ toAccountId: 'test@aclb', currency: 'USD', amount: 1.4 }, p).ok, false);
});
test('generates a KHQR string and md5', () => {
  const r = generateKhqr({ amount: 1, currency: 'USD', billNumber: 'TIP-TEST', expiresAtMs: Date.now() + 600000 });
  assert.match(r.qr, /^000201/);
  assert.equal(r.md5.length, 32);
});
