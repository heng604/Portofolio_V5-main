// Payment persistence. Uses Supabase (service role) when configured, otherwise an
// in-memory Map so local development works. In-memory data is lost on restart.
import { admin } from './supabase.js';

const mem = new Map();
const TABLE = 'payments';

export const usingDatabase = () => !!admin;

export async function insertPayment(row) {
  if (!admin) { mem.set(row.id, { ...row }); return row; }
  const { data, error } = await admin.from(TABLE).insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function getPayment(id) {
  if (!admin) return mem.get(id) || null;
  const { data, error } = await admin.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updatePayment(id, patch) {
  if (!admin) { const p = { ...mem.get(id), ...patch }; mem.set(id, p); return p; }
  const { data, error } = await admin.from(TABLE).update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function findByTxnHash(hash) {
  if (!admin) return [...mem.values()].find((p) => p.txn_hash === hash) || null;
  const { data, error } = await admin.from(TABLE).select('id').eq('txn_hash', hash).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listPayments({ status, limit = 100 } = {}) {
  if (!admin) {
    return [...mem.values()].filter((p) => !status || p.status === status)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, limit);
  }
  let q = admin.from(TABLE).select('*').order('created_at', { ascending: false }).limit(limit);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}
