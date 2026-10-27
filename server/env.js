// Loads .env and validates it at startup.
// - Core variables are mandatory: the server refuses to start without them.
// - Feature groups (Supabase, Bakong, Resend) may be absent entirely (feature is
//   disabled with a warning), but a PARTIALLY configured group is a fatal error,
//   because that is almost always a typo that would otherwise fail at runtime.
import 'dotenv/config';

const get = (k) => (process.env[k] ?? '').trim();

const GROUPS = {
  supabase: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
  bakong: ['BAKONG_ACCOUNT_ID', 'BAKONG_MERCHANT_NAME', 'BAKONG_API_BASE_URL', 'BAKONG_API_TOKEN'],
  resend: ['RESEND_API_KEY', 'RESEND_FROM'],
};

const problems = [];
const warnings = [];

const adminEmail = get('ADMIN_EMAIL').toLowerCase();
if (!adminEmail) problems.push('ADMIN_EMAIL is required (the only account allowed into /dashboard).');
const siteUrl = get('SITE_URL').replace(/\/+$/, '');
if (!siteUrl) problems.push('SITE_URL is required (e.g. http://localhost:5173).');

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

if (problems.length) {
  console.error('\n[env] Invalid configuration:\n - ' + problems.join('\n - ') + '\n');
  console.error('[env] Copy .env.example to .env and fill the values (see README.md).');
  process.exit(1);
}
warnings.forEach((w) => console.warn('[env] ' + w));

export const env = Object.freeze({
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
    baseUrl: get('BAKONG_API_BASE_URL').replace(/\/+$/, ''),
    token: get('BAKONG_API_TOKEN'),
    qrTtlSeconds: Math.min(Math.max(Number(get('BAKONG_QR_TTL_SECONDS')) || 600, 120), 3600),
  },
  resend: {
    apiKey: get('RESEND_API_KEY'),
    from: get('RESEND_FROM'),
    to: get('CONTACT_TO_EMAIL') || adminEmail,
  },
});
