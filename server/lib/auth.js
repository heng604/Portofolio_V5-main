import { ApiError } from './http.js';
import { db } from './supabase.js';
import { getConfig } from '../env.js';

// Admin gate used by every /api/admin/* route. The access token is validated by Supabase Auth
// (signature + expiry), then the e-mail is compared with ADMIN_EMAIL from the SERVER environment.
// Anyone else receives a 404-style response so the admin API is not discoverable.
export async function requireAdmin(req, _res, next) {
  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) throw new ApiError(404, 'not_found', 'Not found.');
    const { data, error } = await db().auth.getUser(token);
    const user = data?.user;
    const email = String(user?.email || '').toLowerCase();
    const confirmed = Boolean(user?.email_confirmed_at || user?.confirmed_at);
    if (error || !user || !confirmed || email !== getConfig().adminEmail) {
      throw new ApiError(404, 'not_found', 'Not found.');
    }
    req.adminUser = user;
    next();
  } catch (e) {
    next(e instanceof ApiError ? e : new ApiError(404, 'not_found', 'Not found.'));
  }
}
