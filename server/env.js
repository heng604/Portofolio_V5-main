// Server-side environment handling. NEVER import this file from src/ (browser code).
import 'dotenv/config';

const CORE = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ADMIN_EMAIL', 'SITE_URL'];
const RESEND = ['RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'CONTACT_TO_EMAIL'];
const BAKONG = ['BAKONG_API_TOKEN', 'BAKONG_ACCOUNT_ID', 'BAKONG_MERCHANT_NAME'];

const missing = (keys) => keys.filter((k) => !String(process.env[k] || '').trim());
const looksPlaceholder = (v = '') => /^(your[-_]|xxx|changeme|<)/i.test(v.trim());

export function getEnvReport() {
  const bad = (keys) => keys.filter((k) => !process.env[k]?.trim() || looksPlaceholder(process.env[k]));
  return { core: bad(CORE), resend: bad(RESEND), bakong: bad(BAKONG) };
}

export function getConfig() {
  const mode = (process.env.BAKONG_MODE || 'sandbox').toLowerCase() === 'production' ? 'production' : 'sandbox';
  const defaultBase = mode === 'production' ? 'https://api-bakong.nbc.gov.kh' : 'https://sit-api-bakong.nbc.gov.kh';
  return {
    siteUrl: (process.env.SITE_URL || '').replace(/\/$/, ''),
    adminEmail: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
    supabaseUrl: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    resend: {
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.RESEND_FROM_EMAIL,
      to: process.env.CONTACT_TO_EMAIL,
    },
    bakong: {
      mode,
      baseUrl: (process.env.BAKONG_API_BASE_URL || defaultBase).replace(/\/$/, ''),
      token: process.env.BAKONG_API_TOKEN,
      accountId: process.env.BAKONG_ACCOUNT_ID,
      merchantName: process.env.BAKONG_MERCHANT_NAME,
      merchantCity: process.env.BAKONG_MERCHANT_CITY || 'Phnom Penh',
      mobile: process.env.BAKONG_MOBILE_NUMBER || undefined,
      expiresMinutes: Math.min(Math.max(Number(process.env.BAKONG_QR_EXPIRES_MINUTES) || 10, 2), 60),
    },
    ipSalt: process.env.IP_HASH_SALT || 'change-this-salt',
  };
}

export { missing };
