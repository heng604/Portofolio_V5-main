import crypto from 'node:crypto';
import { Resend } from 'resend';
import { db } from './supabase.js';
import { getConfig } from '../env.js';
import { ApiError } from './http.js';
import { validateContact, esc, strip } from './pure.js';

export const hashIp = (ip) => crypto.createHash('sha256').update(`${getConfig().ipSalt}:${ip}`).digest('hex');

export async function handleContact(body, ip) {
  // Honeypot: bots fill hidden "website". Pretend success, store nothing.
  if (String(body?.website || '').trim()) return { ok: true };
  const cfg = getConfig();
  const v = validateContact(body);
  const ipHash = hashIp(ip);
  const since = (mins) => new Date(Date.now() - mins * 60_000).toISOString();

  // Abuse protection that works across serverless instances (DB-backed).
  const { count: hourCount } = await db().from('contact_submissions').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', since(60));
  if ((hourCount || 0) >= 5) throw new ApiError(429, 'rate_limited', 'Too many messages. Please try again later.');

  const contentHash = crypto.createHash('sha256').update(`${v.email}|${v.subject}|${v.message}`).digest('hex');
  const { count: dupes } = await db().from('contact_submissions').select('id', { count: 'exact', head: true }).eq('content_hash', contentHash).gte('created_at', since(10));
  if ((dupes || 0) > 0) throw new ApiError(409, 'duplicate', 'This message was already sent. No need to send it again.');

  const { data: row, error } = await db().from('contact_submissions')
    .insert({ ...v, ip_hash: ipHash, content_hash: contentHash, status: 'received', user_agent: strip(body?.ua, 200) || null })
    .select('id').single();
  if (error) {
    console.error('[contact] insert failed:', error.message);
    throw new ApiError(500, 'db_error', 'Could not save your message. Is the SQL schema installed?');
  }

  try {
    const resend = new Resend(cfg.resend.apiKey);
    const { error: sendErr } = await resend.emails.send({
      from: cfg.resend.from,
      to: [cfg.resend.to],
      replyTo: v.email,
      subject: `[Portfolio] ${v.subject}`,
      text: `From: ${v.name} <${v.email}>\nSubject: ${v.subject}\n\n${v.message}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px"><h2 style="margin:0 0 12px">New portfolio message</h2>
        <p><b>Name:</b> ${esc(v.name)}<br><b>Email:</b> ${esc(v.email)}<br><b>Subject:</b> ${esc(v.subject)}</p>
        <div style="white-space:pre-wrap;border-left:3px solid #6366f1;padding:8px 12px;background:#f5f5ff">${esc(v.message)}</div></div>`,
    });
    if (sendErr) throw new Error(sendErr.message || 'resend error');
    await db().from('contact_submissions').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', row.id);
    return { ok: true };
  } catch (e) {
    console.error('[contact] resend failed:', e?.message);
    await db().from('contact_submissions').update({ status: 'failed', error: String(e?.message || e).slice(0, 300) }).eq('id', row.id);
    throw new ApiError(502, 'email_failed', 'Your message was saved but the email could not be delivered. Please try again later or contact me on Telegram.');
  }
}
