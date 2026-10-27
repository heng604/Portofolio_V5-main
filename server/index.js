import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import crypto from 'node:crypto';
import { BakongKHQR, khqrData, IndividualInfo } from 'bakong-khqr';

const app = express();
const PORT = Number(process.env.API_PORT || 8787);
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'Seangheng2006@gmail.com').trim().toLowerCase();
const siteUrl = process.env.SITE_URL || 'http://localhost:5173';
const allowedOrigin = (process.env.CORS_ORIGIN || siteUrl).split(',').map(v => v.trim());
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin(origin, cb) { if (!origin || allowedOrigin.includes(origin)) return cb(null, true); return cb(new Error('Origin not allowed')); }, credentials: true }));
app.use(express.json({ limit: '32kb' }));
app.use('/api/', rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }));

const required = (name) => { const value = process.env[name]; if (!value) throw new Error(`Missing required environment variable: ${name}`); return value; };
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminDb = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }) : null;
const authClient = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } }) : null;

const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(5000),
  website: z.string().max(0).optional().default(''), // honeypot
});
const paymentSchema = z.object({ amount: z.number().finite().positive().max(1000000), currency: z.enum(['USD', 'KHR']) });

async function requireAdmin(req, res, next) {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token || !authClient) return res.status(401).json({ error: 'Authentication required' });
    const { data, error } = await authClient.auth.getUser(token);
    const user = data?.user;
    if (error || !user) return res.status(401).json({ error: 'Invalid session' });
    if ((user.email || '').toLowerCase() !== ADMIN_EMAIL) return res.status(404).json({ error: 'Not found' });
    req.adminUser = user;
    next();
  } catch { res.status(401).json({ error: 'Authentication could not be verified' }); }
}

app.get('/api/health', (_req, res) => res.json({ ok: true, mode: process.env.BAKONG_MODE === 'sandbox' ? 'sandbox' : 'production' }));

app.post('/api/contact', rateLimit({ windowMs: 15 * 60_000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false }), async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Please check the contact form fields.' });
  const { name, email, subject, message, website } = parsed.data;
  if (website) return res.status(202).json({ ok: true });
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return res.status(503).json({ error: 'Contact delivery is not configured yet.' });
  try {
    if (adminDb) {
      const { error } = await adminDb.from('contact_submissions').insert({ name, email, subject, message, status: 'received' });
      if (error) console.error('Contact storage failed:', error.message);
    }
    const resend = new Resend(required('RESEND_API_KEY'));
    const result = await resend.emails.send({
      from: required('RESEND_FROM_EMAIL'), to: [process.env.CONTACT_TO_EMAIL || ADMIN_EMAIL], replyTo: email,
      subject: `[Portfolio contact] ${subject}`,
      text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\n\n${message}`,
    });
    if (result.error) throw new Error('Email provider rejected the message');
    return res.status(200).json({ ok: true });
  } catch (error) { console.error('Contact delivery failed:', error.message); return res.status(502).json({ error: 'Message could not be sent. Please try again later.' }); }
});

function bakongConfig() {
  return {
    accountId: required('BAKONG_ACCOUNT_ID'),
    accountName: required('BAKONG_ACCOUNT_NAME'),
    token: required('BAKONG_API_TOKEN'),
    baseUrl: (process.env.BAKONG_API_BASE_URL || (process.env.BAKONG_MODE === 'sandbox' ? 'https://sit-api-bakong.nbc.gov.kh' : 'https://api-bakong.nbc.gov.kh')).replace(/\/$/, ''),
  };
}

app.post('/api/tips', async (req, res) => {
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid positive amount and choose USD or KHR.' });
  try {
    const config = bakongConfig();
    const { amount, currency } = parsed.data;
    if (currency === 'USD' && amount < 0.01) return res.status(400).json({ error: 'Minimum USD tip is 0.01.' });
    if (currency === 'KHR' && (!Number.isInteger(amount) || amount < 100)) return res.status(400).json({ error: 'KHR tips must be a whole number of at least 100.' });
    const billNumber = `TIP${Date.now()}${crypto.randomBytes(8).toString('hex').toUpperCase()}`.slice(0, 25);
    const optionalData = {
      currency: currency === 'USD' ? khqrData.currency.usd : khqrData.currency.khr,
      amount,
      billNumber,
      storeLabel: 'Portfolio Tip',
      terminalLabel: 'Portfolio',
      purposeOfTransaction: 'Portfolio tip',
      expirationTimestamp: Date.now() + 10 * 60_000,
      merchantCategoryCode: '5999',
    };
    const info = new IndividualInfo(config.accountId, config.accountName, process.env.BAKONG_MERCHANT_CITY || 'PHNOM PENH', optionalData);
    const generated = new BakongKHQR().generateIndividual(info);
    if (!generated || generated.status?.code !== 0 || !generated.data?.qr || !generated.data?.md5) throw new Error('KHQR SDK could not generate a QR');
    const qrText = generated.data.qr;
    const md5 = generated.data.md5;
    const qrImage = await QRCode.toDataURL(qrText, { errorCorrectionLevel: 'M', margin: 1, width: 480 });
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    if (adminDb) {
      const { error } = await adminDb.from('tip_payments').insert({ id: billNumber, amount, currency, recipient_account_id: config.accountId, recipient_name: config.accountName, khqr_md5: md5, status: 'pending', expires_at: expiresAt, mode: process.env.BAKONG_MODE === 'sandbox' ? 'sandbox' : 'production' });
      if (error) throw new Error('Could not create payment record');
    }
    return res.json({ paymentId: billNumber, amount, currency, recipientName: config.accountName, recipientAccountId: config.accountId, qrText, qrImage, expiresAt, mode: process.env.BAKONG_MODE === 'sandbox' ? 'sandbox' : 'production', status: 'pending' });
  } catch (error) { console.error('KHQR generation failed:', error.message); return res.status(503).json({ error: 'KHQR generation is unavailable. Verify Bakong credentials and SDK configuration.' }); }
});

app.post('/api/tips/:id/cancel', async (req, res) => {
  const id = String(req.params.id || '');
  if (!/^TIP[0-9A-Z]+$/.test(id)) return res.status(400).json({ error: 'Invalid payment reference' });
  if (!adminDb) return res.status(503).json({ error: 'Payment database is not configured' });
  const { error } = await adminDb.from('tip_payments').update({ status: 'cancelled' }).eq('id', id).eq('status', 'pending');
  if (error) return res.status(500).json({ error: 'Could not cancel payment session' });
  return res.json({ status: 'cancelled' });
});

app.get('/api/tips/:id/status', async (req, res) => {
  const id = String(req.params.id || '');
  if (!/^TIP[0-9A-Z]+$/.test(id)) return res.status(400).json({ error: 'Invalid payment reference' });
  if (!adminDb) return res.status(503).json({ error: 'Payment database is not configured' });
  try {
    const { data: payment, error } = await adminDb.from('tip_payments').select('*').eq('id', id).maybeSingle();
    if (error || !payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.status === 'success') return res.json({ status: 'success', amount: payment.amount, currency: payment.currency });
    if (new Date(payment.expires_at).getTime() < Date.now()) {
      await adminDb.from('tip_payments').update({ status: 'expired' }).eq('id', id).eq('status', 'pending');
      return res.json({ status: 'expired' });
    }
    const config = bakongConfig();
    const response = await fetch(`${config.baseUrl}/v1/check_transaction_by_md5`, {
      method: 'POST', headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ md5: payment.khqr_md5 }), signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return res.status(502).json({ error: 'Bakong status service is temporarily unavailable' });
    const result = await response.json();
    const tx = result?.data;
    if (result?.responseCode === 0 && tx) {
      const exactAmount = Math.abs(Number(tx.amount) - Number(payment.amount)) < 0.00001;
      const exactCurrency = String(tx.currency).toUpperCase() === payment.currency;
      const exactRecipient = String(tx.toAccountId || '').toLowerCase() === String(payment.recipient_account_id).toLowerCase();
      if (exactAmount && exactCurrency && exactRecipient && tx.hash) {
        const { error: updateError } = await adminDb.from('tip_payments').update({ status: 'success', transaction_hash: tx.hash, verified_at: new Date().toISOString(), from_account_id: tx.fromAccountId || null }).eq('id', id).eq('status', 'pending');
        if (updateError) throw new Error('Could not persist verified payment');
        return res.json({ status: 'success', amount: payment.amount, currency: payment.currency });
      }
      return res.status(409).json({ status: 'pending', error: 'Transaction was found but did not match this tip. No success was recorded.' });
    }
    return res.json({ status: 'pending' });
  } catch (error) { console.error('Tip verification failed:', error.message); return res.status(502).json({ error: 'Unable to verify payment right now. Keep this screen open and retry.' }); }
});

app.post('/api/admin/bakong-test', requireAdmin, async (_req, res) => {
  // Deliberately simulated: this endpoint never calls a payment API and never creates a real payment.
  return res.json({ mode: 'simulation', status: 'pending', message: 'Test UI only. No KHQR was issued and no money moved.' });
});

app.get('/api/admin/health', requireAdmin, (_req, res) => res.json({ ok: true, admin: reqUserEmail(_req) }));
function reqUserEmail(req) { return req.adminUser?.email || ADMIN_EMAIL; }

app.use((err, _req, res, _next) => { console.error('Unhandled API error:', err.message); res.status(500).json({ error: 'Unexpected server error' }); });
app.listen(PORT, () => console.log(`Portfolio API listening on http://localhost:${PORT} (${process.env.BAKONG_MODE === 'sandbox' ? 'SANDBOX' : 'PRODUCTION'} Bakong mode)`));
