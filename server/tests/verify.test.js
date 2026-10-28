// Needs `npm install` (imports express + bakong-khqr via the route module). Bakong is MOCKED - no network, no real payments.
import test from 'node:test';
import assert from 'node:assert/strict';

Object.assign(process.env, {
  ADMIN_EMAIL: 'admin@example.com', SITE_URL: 'http://localhost:5173',
  BAKONG_ACCOUNT_ID: 'test@aclb', BAKONG_MERCHANT_NAME: 'Test', BAKONG_API_TOKEN: 'x',
  BAKONG_API_BASE_URL: 'https://example.invalid',
});
delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY; // in-memory store

const { verifyAndRecord } = await import('../routes/bakong.js');
const { callBakong, checkTransactionByMd5, diagnoseBakong } = await import('../lib/bakong.js');
const store = await import('../lib/store.js');

const mkToken = (id, extra = {}) => ({ id, md5: 'a'.repeat(32), amount: 1.5, currency: 'USD', exp: Date.now() + 60_000, ...extra });
const seed = (id) => store.insertPayment({ id, md5: id, qr: 'q', amount: 1.5, currency: 'USD', status: 'pending', created_at: new Date().toISOString() });
const good = (hash = 'H1') => async () => ({ found: true, txn: { hash, toAccountId: 'test@aclb', currency: 'USD', amount: 1.5, fromAccountId: 'payer@x' } });
const fetchReturning = (status, text) => async () => ({ status, ok: status < 400, text: async () => text });

test('not found at Bakong -> pending (never success)', async () => {
  const r = await verifyAndRecord(mkToken('00000000-0000-0000-0000-000000000001'), { check: async () => ({ found: false }) });
  assert.equal(r.status, 'pending');
});
test('past expiry and not found -> expired', async () => {
  const r = await verifyAndRecord(mkToken('00000000-0000-0000-0000-000000000002', { exp: Date.now() - 1 }), { check: async () => ({ found: false }) });
  assert.equal(r.status, 'expired');
});
test('verified payment -> confirmed, and a duplicate request is idempotent', async () => {
  const id = '00000000-0000-0000-0000-000000000003'; await seed(id);
  const a = await verifyAndRecord(mkToken(id), { check: good('H3') });
  await new Promise((r) => setTimeout(r, 5));
  const b = await verifyAndRecord(mkToken(id), { check: good('H3') });
  assert.equal(a.status, 'confirmed'); assert.equal(b.status, 'confirmed');
  assert.equal(a.confirmedAt, b.confirmedAt, 'confirmation time must not be rewritten');
});
test('wrong amount / currency / account -> failed', async () => {
  for (const txn of [{ amount: 1.4 }, { currency: 'KHR' }, { toAccountId: 'evil@bank' }]) {
    const r = await verifyAndRecord(mkToken('00000000-0000-0000-0000-000000000004'), { check: async () => ({ found: true, txn: { hash: 'X', toAccountId: 'test@aclb', currency: 'USD', amount: 1.5, ...txn } }) });
    assert.equal(r.status, 'failed');
  }
});
test('the same Bakong transaction cannot confirm two payments', async () => {
  const a = '00000000-0000-0000-0000-000000000005', b = '00000000-0000-0000-0000-000000000006';
  await seed(a); await seed(b);
  assert.equal((await verifyAndRecord(mkToken(a), { check: good('SAME') })).status, 'confirmed');
  assert.equal((await verifyAndRecord(mkToken(b), { check: good('SAME') })).status, 'failed');
});
test('Bakong 401 JSON -> ApiError bakong_auth_token (not a success)', async () => {
  await assert.rejects(() => checkTransactionByMd5('a'.repeat(32), fetchReturning(401, '{"responseCode":1}')), { code: 'bakong_auth_token' });
});
test('Bakong 401 HTML -> bakong_auth_blocked; empty 200 -> bakong_bad_response', async () => {
  await assert.rejects(() => checkTransactionByMd5('a'.repeat(32), fetchReturning(401, '<html/>')), { code: 'bakong_auth_blocked' });
  await assert.rejects(() => checkTransactionByMd5('a'.repeat(32), fetchReturning(200, '')), { code: 'bakong_bad_response' });
});
test('network failure -> bakong_unreachable', async () => {
  await assert.rejects(() => checkTransactionByMd5('a'.repeat(32), async () => { throw new Error('boom'); }), { code: 'bakong_unreachable' });
});
test('diagnose reports healthy only when Bakong accepts the token', async () => {
  assert.equal((await diagnoseBakong(fetchReturning(200, '{"responseCode":1,"errorCode":3}'))).healthy, true);
  assert.equal((await diagnoseBakong(fetchReturning(401, '{}'))).healthy, false);
});
test('admin query: revenue counts verified, non-test payments once', async () => {
  const sum = await store.paymentSummary();
  assert.equal(sum.revenue.USD, 3); // two distinct confirmed payments of 1.50
  const page = await store.queryPayments({ status: 'confirmed', pageSize: 1, page: 1 });
  assert.equal(page.rows.length, 1); assert.equal(page.total, 2);
});
