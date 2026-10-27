// Loads .env and validates it at startup.
// - Core variables are mandatory: the server refuses to start without them.
// - Feature groups (Supabase, Bakong, Resend) may be absent entirely (feature is
//   disabled with a warning), but a PARTIALLY configured group is a fatal error,
//   because that is almost always a typo that would otherwise fail at runtime.
import 'dotenv/config';

const get = (k) => (process.env[k] ?? '').trim();

const GROUPS = {
  supabase: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
  // Only the account + name are needed to GENERATE a KHQR. The token (BAKONG_API_TOKEN) is only needed to
  // auto-detect payment (success popup); see `bakongVerify` below.
  bakong: ['BAKONG_ACCOUNT_ID', 'BAKONG_MERCHANT_NAME'],
  resend: ['RESEND_API_KEY', 'RESEND_FROM'],
};

const problems = [];
const warnings = [];

// Defaults make a first deploy work: the admin email is the one you specified; on Vercel the site URL is automatic.
const adminEmail = (get('ADMIN_EMAIL') || 'seangheng2006@gmail.com').toLowerCase();
const siteUrl = (get('SITE_URL') || (get('VERCEL_URL') ? `https://${get('VERCEL_URL')}` : 'http://localhost:5173')).replace(/\/+$/, '');

const features = {};
for (const [name, keys] of Object.entries(GROUPS)) {
  const missing = keys.filter((k) => !get(k));
  if (missing.length === 0) features[name] = true;
  else if (missing.length === keys.length) {
    features[name] = false;
    warnings.push(`${name} is NOT configured -> that feature is disabled (${keys.join(', ')}).`);
  } else {
    features[name] = false;
    problems.push(`${name} is partially configured. Missing: ${missing.join(', ')}`);
  }
}

const bakongEnv = (get('BAKONG_ENV') || 'sandbox').toLowerCase();
if (!['sandbox', 'production'].includes(bakongEnv)) problems.push('BAKONG_ENV must be "sandbox" or "production".');

if (problems.length && !process.env.VERCEL) {
  console.error('\n[env] Invalid configuration:\n - ' + problems.join('\n - ') + '\n');
  console.error('[env] Copy .env.example to .env and fill the values (see README.md).');
  process.exit(1);
}
warnings.forEach((w) => console.warn('[env] ' + w));

if (problems.length) console.error('[env] Invalid configuration: ' + problems.join(' | '));

export const env = Object.freeze({
  problems,
  bakongVerify: !!get('BAKONG_API_TOKEN'),
  port: Number(get('PORT')) || 8787,
  isProd: get('NODE_ENV') === 'production',
  siteUrl,
  adminEmail,
  features,
  supabaseUrl: get('SUPABASE_URL'),
  supabaseServiceKey: get('SUPABASE_SERVICE_ROLE_KEY'),
  bakong: {
    env: bakongEnv,
    accountId: get('BAKONG_ACCOUNT_ID'),
    merchantName: get('BAKONG_MERCHANT_NAME'),
    merchantCity: get('BAKONG_MERCHANT_CITY') || 'Phnom Penh',
    baseUrl: (get('BAKONG_API_BASE_URL') || 'https://api-bakong.nbc.gov.kh').replace(/\/+$/, ''),
    token: get('BAKONG_API_TOKEN'),
    qrTtlSeconds: Math.min(Math.max(Number(get('BAKONG_QR_TTL_SECONDS')) || 600, 120), 3600),
  },
  resend: {
    apiKey: get('RESEND_API_KEY'),
    from: get('RESEND_FROM'),
    to: get('CONTACT_TO_EMAIL') || adminEmail,
  },
});
