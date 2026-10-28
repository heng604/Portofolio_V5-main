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

// ---- Admin queries: search / filter / sort / pagination + revenue ----
const SORTABLE = new Set(['created_at', 'amount', 'status', 'confirmed_at', 'currency']);
const esc = (v) => String(v).replace(/[%,()*\\]/g, ' ').trim().slice(0, 64); // keep PostgREST filter syntax safe

export async function queryPayments({ status, currency, q, includeTest = true, sort = 'created_at', dir = 'desc', page = 1, pageSize = 20 } = {}) {
  sort = SORTABLE.has(sort) ? sort : 'created_at';
  pageSize = Math.min(Math.max(Number(pageSize) || 20, 1), 100);
  page = Math.max(Number(page) || 1, 1);
  const asc = dir === 'asc';
  if (!admin) {
    let rows = [...mem.values()];
    if (status) rows = rows.filter((p) => p.status === status);
    if (currency) rows = rows.filter((p) => p.currency === currency);
    if (!includeTest) rows = rows.filter((p) => !p.is_test);
    if (q) { const n = q.toLowerCase(); rows = rows.filter((p) => [p.id, p.md5, p.bill_number, p.txn_hash].some((f) => String(f || '').toLowerCase().includes(n))); }
    rows.sort((a, b) => (String(a[sort]) < String(b[sort]) ? -1 : 1) * (asc ? 1 : -1));
    return { rows: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length };
  }
  let query = admin.from(TABLE).select('*', { count: 'exact' });
  if (status) query = query.eq('status', status);
  if (currency) query = query.eq('currency', currency);
  if (!includeTest) query = query.eq('is_test', false);
  if (q) { const n = esc(q); if (n) query = query.or(`bill_number.ilike.%${n}%,txn_hash.ilike.%${n}%,md5.ilike.%${n}%,payer_account.ilike.%${n}%`); }
  query = query.order(sort, { ascending: asc }).range((page - 1) * pageSize, page * pageSize - 1);
  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: data, total: count ?? data.length };
}

// Revenue counts ONLY status = 'confirmed' (server-verified) and never test payments; one row per payment => no double counting.
export async function paymentSummary() {
  const rows = admin
    ? ((await admin.from(TABLE).select('status,amount,currency,is_test,confirmed_at,created_at').limit(50000)).data || [])
    : [...mem.values()];
  const out = { total: rows.length, byStatus: {}, revenue: { USD: 0, KHR: 0 }, verifiedCount: 0, last30: { USD: 0, KHR: 0 } };
  const since = Date.now() - 30 * 864e5;
  for (const p of rows) {
    out.byStatus[p.status] = (out.byStatus[p.status] || 0) + 1;
    if (p.status === 'confirmed' && !p.is_test) {
      out.verifiedCount += 1;
      out.revenue[p.currency] = Number((out.revenue[p.currency] + Number(p.amount)).toFixed(2));
      if (new Date(p.confirmed_at || p.created_at).getTime() >= since) out.last30[p.currency] = Number((out.last30[p.currency] + Number(p.amount)).toFixed(2));
    }
  }
  return out;
}
