// Pure tests (no dependencies): safe JSON reading and 401 classification.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readUpstream, classifyBakong } from '../lib/upstream.js';

const resp = (status, text) => ({ status, ok: status < 400, text: async () => text });

test('empty body does not throw (the old "Unexpected end of JSON input")', async () => {
  const up = await readUpstream(resp(200, ''));
  assert.equal(up.kind, 'empty'); assert.equal(up.body, null);
  assert.equal(classifyBakong(up), 'bad_response');
});
test('HTML error page is handled', async () => {
  const up = await readUpstream(resp(502, '<html>Bad gateway</html>'));
  assert.equal(up.kind, 'html'); assert.equal(classifyBakong(up), 'server_error');
});
test('invalid JSON / plain text are handled', async () => {
  assert.equal((await readUpstream(resp(200, '{"a":'))).kind, 'text');
  assert.equal(classifyBakong(await readUpstream(resp(200, 'oops'))), 'bad_response');
});
test('401 with JSON body = token problem; 401 with HTML/empty = blocked before the API', async () => {
  assert.equal(classifyBakong(await readUpstream(resp(401, '{"responseCode":1,"responseMessage":"Unauthorized"}'))), 'auth_token');
  assert.equal(classifyBakong(await readUpstream(resp(401, '<html>blocked</html>'))), 'auth_blocked');
  assert.equal(classifyBakong(await readUpstream(resp(403, ''))), 'auth_blocked');
});
test('relay secret mismatch is its own class', async () => {
  const up = await readUpstream(resp(401, '{"ok":false,"message":"bad secret"}'));
  assert.equal(classifyBakong(up, true), 'auth_relay');
});
test('documented found / not-found answers', async () => {
  assert.equal(classifyBakong(await readUpstream(resp(200, '{"responseCode":0,"data":{"hash":"h"}}'))), 'ok');
  assert.equal(classifyBakong(await readUpstream(resp(200, '{"responseCode":1,"errorCode":3}'))), 'not_found');
  assert.equal(classifyBakong(await readUpstream(resp(429, '{}'))), 'rate_limited');
});
test('405 with empty body = wrong endpoint', async () => {
  assert.equal(classifyBakong(await readUpstream(resp(405, ''))), 'wrong_endpoint');
});
