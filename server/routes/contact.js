import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import { Resend } from 'resend';
import { env } from '../env.js';
import { ApiError, asyncRoute } from '../lib/http.js';
import { admin } from '../lib/supabase.js';

export const router = Router();

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ ok: false, code: 'rate_limited', message: 'Too many messages. Please try again later.' }),
});

const clean = (v, max) =>
  String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const recent = new Map(); // fingerprint -> ms  (duplicate-submission guard)
const DUP_WINDOW = 10 * 60 * 1000;

const resend = env.features.resend ? new Resend(env.resend.apiKey) : null;

router.post('/', limiter, asyncRoute(async (req, res) => {
  const b = req.body || {};
  // Honeypot: real users never fill this hidden field. Pretend success to bots.
  if (clean(b.website, 200)) return res.json({ ok: true });

  const name = clean(b.name, 100);
  const email = clean(b.email, 200).toLowerCase();
  const subject = clean(b.subject, 150).replace(/[\r\n]+/g, ' ');
  const message = clean(b.message, 5000);
  const errors = {};
  if (name.length < 2) errors.name = 'Name is required (min 2 characters).';
  if (!EMAIL.test(email)) errors.email = 'Enter a valid email address.';
  if (subject.length < 3) errors.subject = 'Subject is required (min 3 characters).';
  if (message.length < 10) errors.message = 'Message must be at least 10 characters.';
  if (Object.keys(errors).length) return res.status(400).json({ ok: false, code: 'validation', message: 'Please fix the highlighted fields.', errors });

  if (!resend) throw new ApiError(503, 'Contact email is not configured on the server.', 'resend_off');

  const fp = crypto.createHash('sha256').update(`${email}|${subject}|${message}`).digest('hex');
  const now = Date.now();
  for (const [k, t] of recent) if (now - t > DUP_WINDOW) recent.delete(k);
  if (recent.has(fp)) throw new ApiError(409, 'This message was already sent. Thank you!', 'duplicate');
  recent.set(fp, now);

  let rowId = null;
  if (admin) {
    const { data, error } = await admin.from('contact_submissions')
      .insert({ name, email, subject, message, status: 'received', ip_hash: crypto.createHash('sha256').update(String(req.ip)).digest('hex') })
      .select('id').single();
    if (error) console.error('[contact] db insert failed:', error.message); else rowId = data.id;
  }

  const { error } = await resend.emails.send({
    from: env.resend.from,
    to: [env.resend.to],
    replyTo: email,
    subject: `[Portfolio] ${subject}`,
    text: `From: ${name} <${email}>\n\n${message}`,
    html: `<p><b>From:</b> ${esc(name)} &lt;${esc(email)}&gt;</p><p><b>Subject:</b> ${esc(subject)}</p><hr><p style="white-space:pre-wrap">${esc(message)}</p>`,
  });
  if (error) {
    recent.delete(fp); // allow a retry
    console.error('[contact] resend error:', error);
    if (admin && rowId) await admin.from('contact_submissions').update({ status: 'email_failed' }).eq('id', rowId);
    throw new ApiError(502, 'Your message could not be delivered. Please try again later or use Telegram.', 'email_failed');
  }
  if (admin && rowId) await admin.from('contact_submissions').update({ status: 'sent' }).eq('id', rowId);
  res.json({ ok: true });
}));
