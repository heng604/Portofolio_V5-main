import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAmount, matchesExpected, validateContact, esc } from '../lib/pure.js';

test('USD amounts: 2 decimals max, positive', () => {
  assert.equal(normalizeAmount('1.5', 'USD'), 1.5);
  assert.equal(normalizeAmount(0.01, 'USD'), 0.01);
  assert.throws(() => normalizeAmount(1.234, 'USD'), { code: 'invalid_amount' });
  assert.throws(() => normalizeAmount(0, 'USD'), { code: 'invalid_amount' });
  assert.throws(() => normalizeAmount(-5, 'USD'), { code: 'invalid_amount' });
  assert.throws(() => normalizeAmount('abc', 'USD'), { code: 'invalid_amount' });
  assert.throws(() => normalizeAmount(Infinity, 'USD'), { code: 'invalid_amount' });
});

test('KHR amounts must be whole numbers', () => {
  assert.equal(normalizeAmount(4000, 'KHR'), 4000);
  assert.throws(() => normalizeAmount(4000.5, 'KHR'), { code: 'invalid_amount' });
});

test('transaction matching checks recipient, amount and currency', () => {
  const p = { currency: 'USD', amount: '2.50' };
  const tx = { toAccountId: 'Me@ABA', currency: 'USD', amount: 2.5 };
  assert.equal(matchesExpected(tx, p, 'me@aba').ok, true);
  assert.equal(matchesExpected({ ...tx, amount: 2.4 }, p, 'me@aba').amtOk, false);
  assert.equal(matchesExpected({ ...tx, currency: 'KHR' }, p, 'me@aba').curOk, false);
  assert.equal(matchesExpected({ ...tx, toAccountId: 'other@aba' }, p, 'me@aba').toOk, false);
  const k = { currency: 'KHR', amount: '4000' };
  assert.equal(matchesExpected({ toAccountId: 'a@b', currency: 'KHR', amount: 4000 }, k, 'a@b').ok, true);
  assert.equal(matchesExpected({ toAccountId: 'a@b', currency: 'KHR', amount: 3999 }, k, 'a@b').ok, false);
});

test('contact validation', () => {
  const ok = validateContact({ name: 'Sok', email: 'Sok@Example.com', subject: 'Hello', message: 'A long enough message.' });
  assert.equal(ok.email, 'sok@example.com');
  assert.throws(() => validateContact({ name: 'S', email: 'bad', subject: 'x', message: 'short' }), (e) => e.code === 'validation' && Object.keys(e.extra.fields).length === 4);
  const crlf = validateContact({ name: 'A\r\nBcc: x', email: 'a@b.co', subject: 'Hi\r\nBcc: evil@x.com', message: 'ten chars ok' });
  assert.ok(!/[\r\n]/.test(crlf.subject) && !/[\r\n]/.test(crlf.name), 'header injection characters removed');
});

test('html escaping', () => {
  assert.equal(esc('<script>"x"&\'</script>'), '&lt;script&gt;&quot;x&quot;&amp;&#39;&lt;/script&gt;');
});
