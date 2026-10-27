// Bakong relay: run this on a machine with a CAMBODIAN IP (home PC, VPS in Cambodia) and expose it with
// HTTPS (e.g. Cloudflare Tunnel: `cloudflared tunnel --url http://localhost:8788`).
// Why: the Bakong Open API often refuses requests from foreign/datacenter IPs such as Vercel's.
// The website server calls this relay, the relay calls Bakong from inside Cambodia.
//
//   RELAY_SECRET=some-long-random-string node relay/server.js
//
// Then on Vercel set: BAKONG_RELAY_URL=https://your-tunnel-url   BAKONG_RELAY_SECRET=some-long-random-string
import http from 'node:http';

const SECRET = process.env.RELAY_SECRET || '';
const BASE = (process.env.BAKONG_API_BASE_URL || 'https://api-bakong.nbc.gov.kh').replace(/\/+$/, '');
const PORT = Number(process.env.PORT) || 8788;
if (!SECRET || SECRET.length < 16) { console.error('Set RELAY_SECRET (16+ characters).'); process.exit(1); }

http.createServer(async (req, res) => {
  const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  if (req.method !== 'POST' || req.url !== '/v1/check_transaction_by_md5') return send(404, { ok: false });
  if (req.headers['x-relay-secret'] !== SECRET) return send(401, { ok: false, message: 'bad secret' });
  let body = '';
  for await (const c of req) { body += c; if (body.length > 2000) return send(413, { ok: false }); }
  let md5; try { md5 = JSON.parse(body).md5; } catch { return send(400, { ok: false }); }
  if (!/^[0-9a-f]{32}$/i.test(md5 || '')) return send(400, { ok: false, message: 'bad md5' });
  try {
    const r = await fetch(`${BASE}/v1/check_transaction_by_md5`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization || '' },
      body: JSON.stringify({ md5 }),
      signal: AbortSignal.timeout(10000),
    });
    const text = await r.text();
    res.writeHead(r.status, { 'Content-Type': 'application/json' });
    res.end(text);
  } catch (e) { send(504, { ok: false, message: 'relay could not reach Bakong: ' + e.message }); }
}).listen(PORT, () => console.log(`Bakong relay on :${PORT} -> ${BASE}`));
