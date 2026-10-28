// Audit trail for sensitive server-side actions (payments). Content/settings changes are audited
// inside the database by triggers (see supabase/migrations). Failures here never break the request.
import { admin } from './supabase.js';

export async function writeAudit({ actor, action, entity, entityId, details = {} }) {
  const row = { actor_email: actor || 'system', action, entity, entity_id: entityId ? String(entityId) : null, details };
  if (!admin) { console.info('[audit]', JSON.stringify(row)); return; }
  const { error } = await admin.from('audit_logs').insert(row);
  if (error) console.error('[audit] insert failed:', error.message);
}

export async function listAudit(limit = 20) {
  if (!admin) return [];
  const { data, error } = await admin.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data;
}
