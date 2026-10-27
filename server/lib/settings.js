import { db } from './supabase.js';
import { getConfig } from '../env.js';

// Public, non-secret Bakong recipient/limits settings are editable in the admin dashboard
// (table site_settings, keys "bakong.*"). Secrets (token) are NEVER stored in the database.
export async function loadBakongSettings() {
  const cfg = getConfig().bakong;
  const { data } = await db().from('site_settings').select('key,value').like('key', 'bakong.%');
  const s = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
  const str = (k, fb) => (typeof s[k] === 'string' && s[k].trim() ? s[k].trim() : fb);
  const num = (k, fb) => (Number.isFinite(Number(s[k])) && s[k] !== '' && s[k] != null ? Number(s[k]) : fb);
  const bool = (k, fb) => (typeof s[k] === 'boolean' ? s[k] : fb);
  return {
    enabled: bool('bakong.enabled', true),
    accountId: cfg.accountId,                                   // from env (account must match your Bakong token)
    nameEn: str('bakong.recipient_name_en', cfg.merchantName),
    nameKm: str('bakong.recipient_name_km', ''),
    city: str('bakong.city', cfg.merchantCity),
    limits: {
      USD: { min: num('bakong.usd_min', 0.5), max: num('bakong.usd_max', 500) },
      KHR: { min: num('bakong.khr_min', 2000), max: num('bakong.khr_max', 2_000_000) },
    },
    presets: {
      USD: [1, 2, 5, 10],
      KHR: [4000, 10000, 20000, 40000],
    },
  };
}
