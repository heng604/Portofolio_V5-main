import { env } from '../env.js';
import { admin } from './supabase.js';
import { ApiError } from './http.js';

// Validates the Supabase access token SERVER-SIDE (signature + expiry are checked by
// Supabase Auth), then compares the verified email with ADMIN_EMAIL.
export async function getUserFromRequest(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!token) return null;
  if (!admin) throw new ApiError(503, 'Supabase is not configured on the server.', 'supabase_off');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export const isAdminUser = (user) =>
  !!user &&
  typeof user.email === 'string' &&
  user.email.trim().toLowerCase() === env.adminEmail &&
  // Supabase sets email_confirmed_at once the provider (Google) has verified the address.
  !!user.email_confirmed_at;

export async function requireAdmin(req, res, next) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ ok: false, code: 'unauthenticated', message: 'Sign in required.' });
    // 404 (not 403) on purpose: do not reveal that an admin area exists.
    if (!isAdminUser(user)) return res.status(404).json({ ok: false, code: 'not_found', message: 'Not found.' });
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}
