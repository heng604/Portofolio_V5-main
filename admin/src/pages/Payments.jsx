import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, FlaskConical, RefreshCw, Search, Stethoscope } from "lucide-react";
import { apiFetch } from "../lib/api";
import TipJar from "@portfolio/components/TipJar";
import { Dialog, ErrorBox, Skeleton, StatusBadge, money, useToast, when } from "../lib/ui.jsx";

const SORTS = [["created_at", "Created"], ["amount", "Amount"], ["status", "Status"], ["confirmed_at", "Verified at"]];
const PAGE_SIZE = 15;

function Detail({ id, onClose, onChanged }) {
  const toast = useToast();
  const [p, setP] = useState(null);
  const [err, setErr] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState("");
  const [confirmVoid, setConfirmVoid] = useState(false);

  const load = useCallback(async () => {
    try { setP((await apiFetch(`/api/admin/payments/${id}`, { auth: true })).payment); } catch (e) { setErr(e.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const reverify = async () => {
    setBusy("reverify");
    try { const r = await apiFetch(`/api/admin/payments/${id}/reverify`, { method: "POST", body: {}, auth: true }); toast(`Bakong says: ${r.payment.status === "confirmed" ? "verified" : r.payment.status}`); await load(); onChanged(); }
    catch (e) { toast(e.message, "error"); }
    setBusy("");
  };
  const voidIt = async () => {
    setBusy("void");
    try { await apiFetch(`/api/admin/payments/${id}/void`, { method: "POST", body: { reason }, auth: true }); toast("Payment voided and logged in the audit trail."); setConfirmVoid(false); setReason(""); await load(); onChanged(); }
    catch (e) { toast(e.message, "error"); }
    setBusy("");
  };

  const rows = p && [
    ["Transaction ID", p.id], ["Bill number", p.bill_number], ["Bakong txn hash", p.txn_hash], ["QR md5 reference", p.md5], ["Provider", "Bakong KHQR"],
    ["Amount", money(p.amount, p.currency)], ["Currency", p.currency], ["Method", p.payer_account ? `Bakong (payer ${p.payer_account})` : "Bakong KHQR"],
    ["Environment", `${p.environment}${p.is_test ? " (test)" : ""}`], ["Created", when(p.created_at)], ["Expires", when(p.expires_at)],
    ["Verified", when(p.confirmed_at)], ["Updated", when(p.updated_at)], ["Note", p.failure_reason],
  ];
  return (
    <Dialog side title="Transaction detail" onClose={onClose}>
      {err && <ErrorBox message={err} />}
      {!p && !err && <Skeleton className="h-48" />}
      {p && (
        <div className="space-y-4">
          <StatusBadge s={p.status} />
          <dl className="text-sm space-y-2">{rows.map(([k, v]) => v ? <div key={k}><dt className="text-xs text-gray-500">{k}</dt><dd className="text-gray-200 break-all font-mono text-xs sm:text-sm">{v}</dd></div> : null)}</dl>
          {p.status !== "cancelled" && p.status !== "confirmed" && (
            <button onClick={reverify} disabled={!!busy} className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm text-white">{busy === "reverify" ? "Asking Bakong..." : "Re-verify with Bakong"}</button>
          )}
          {["pending", "expired", "failed"].includes(p.status) && (
            <div className="rounded-xl border border-white/10 p-3 space-y-2">
              <p className="text-xs text-gray-400">Void this record (audited). Payments can never be marked paid by hand - only Bakong verification can do that.</p>
              <label htmlFor="void-reason" className="sr-only">Reason</label>
              <textarea id="void-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (10-500 characters)" rows={2} className="w-full bg-[#0d0d22] border border-white/10 rounded-lg px-3 py-2 text-sm" />
              {!confirmVoid ? <button disabled={reason.trim().length < 10} onClick={() => setConfirmVoid(true)} className="px-3 py-1.5 rounded-lg border border-red-500/40 text-red-300 text-sm disabled:opacity-40">Void...</button>
                : <div className="flex gap-2 items-center text-sm"><span className="text-red-300">Really void?</span><button onClick={voidIt} disabled={!!busy} className="px-3 py-1.5 rounded-lg bg-red-700 text-white">{busy === "void" ? "..." : "Yes, void"}</button><button onClick={() => setConfirmVoid(false)} className="px-3 py-1.5 rounded-lg border border-white/15">No</button></div>}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

export default function Payments() {
  const toast = useToast();
  const [f, setF] = useState({ q: "", status: "", currency: "", sort: "created_at", dir: "desc", includeTest: true, page: 1 });
  const [q, setQ] = useState("");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [diag, setDiag] = useState(null);
  const [test, setTest] = useState(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => { const t = setTimeout(() => setF((x) => ({ ...x, q, page: 1 })), 350); return () => clearTimeout(t); }, [q]);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    const qs = new URLSearchParams({ page: f.page, pageSize: PAGE_SIZE, sort: f.sort, dir: f.dir, includeTest: String(f.includeTest) });
    if (f.q) qs.set("q", f.q); if (f.status) qs.set("status", f.status); if (f.currency) qs.set("currency", f.currency);
    try { setData(await apiFetch(`/api/admin/payments?${qs}`, { auth: true })); } catch (e) { setErr(e.message); }
    setLoading(false);
  }, [f]);
  useEffect(() => { load(); }, [load]);

  const diagnose = async () => {
    setDiag({ busy: true });
    try { setDiag((await apiFetch("/api/admin/bakong/diagnose", { method: "POST", body: {}, auth: true })).result); } catch (e) { setDiag({ healthy: false, message: e.message }); }
  };
  const runTest = async () => {
    setTesting(true);
    try { setTest((await apiFetch("/api/admin/bakong/test", { method: "POST", body: { amount: 0.01, currency: "USD" }, auth: true })).payment); load(); } catch (e) { toast(e.message, "error"); }
    setTesting(false);
  };

  const s = data?.summary;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const sel = "bg-[#0d0d22] border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200";
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div><h1 className="text-2xl font-bold text-white">Payments</h1><p className="text-sm text-gray-400">Bakong KHQR tips. "Verified" = confirmed by the server against Bakong.</p></div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-sm text-gray-300 hover:bg-white/5"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />Refresh</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[["Verified revenue (USD)", s && money(s.revenue.USD, "USD")], ["Verified revenue (KHR)", s && money(s.revenue.KHR, "KHR")], ["Verified payments", s?.verifiedCount], ["Pending", s?.byStatus.pending || 0]].map(([l, v]) => (
          <div key={l} className="p-4 rounded-2xl bg-white/5 border border-white/10"><p className="text-xs text-gray-400">{l}</p>{s ? <p className="text-xl font-bold text-white mt-1">{v}</p> : <Skeleton className="h-7 mt-1" />}</div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-wrap items-center gap-3">
        <button onClick={diagnose} disabled={diag?.busy} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/15 text-sm hover:bg-white/5"><Stethoscope className="w-4 h-4" aria-hidden="true" />{diag?.busy ? "Checking..." : "Diagnose Bakong connection"}</button>
        <button onClick={runTest} disabled={testing} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/15 text-sm hover:bg-white/5"><FlaskConical className="w-4 h-4" aria-hidden="true" />{testing ? "Generating..." : "Test QR (0.01 USD)"}</button>
        {diag && !diag.busy && <p role="status" className={`text-sm ${diag.healthy ? "text-emerald-300" : "text-red-300"}`}>{diag.message}{diag.httpStatus ? ` (HTTP ${diag.httpStatus}, via ${diag.via})` : ""}</p>}
      </div>
      {test && <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs text-amber-300 mb-3">Real KHQR flagged as test. It is only verified if someone actually pays it; test payments are excluded from revenue.</p><TipJar preset={test} /></div>}

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[12rem] max-w-sm"><Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input aria-label="Search transactions" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Bill no., txn hash, md5, payer..." className={`${sel} w-full pl-9`} /></div>
        <select aria-label="Status" className={sel} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value, page: 1 })}><option value="">All statuses</option>{["pending", "confirmed", "failed", "expired", "cancelled"].map((x) => <option key={x} value={x}>{x === "confirmed" ? "verified" : x}</option>)}</select>
        <select aria-label="Currency" className={sel} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value, page: 1 })}><option value="">USD + KHR</option><option>USD</option><option>KHR</option></select>
        <select aria-label="Sort by" className={sel} value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })}>{SORTS.map(([v, l]) => <option key={v} value={v}>Sort: {l}</option>)}</select>
        <button onClick={() => setF({ ...f, dir: f.dir === "asc" ? "desc" : "asc" })} className={sel} aria-label="Toggle sort direction">{f.dir === "asc" ? "Asc" : "Desc"}</button>
        <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={f.includeTest} onChange={(e) => setF({ ...f, includeTest: e.target.checked, page: 1 })} />Show test</label>
      </div>

      {err && <ErrorBox message={err} onRetry={load} />}
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm text-left text-gray-300">
          <thead className="text-xs uppercase text-gray-500 bg-white/5"><tr>{["Created", "Reference", "Amount", "Status", "Method", "Verified at"].map((h) => <th key={h} scope="col" className="px-3 py-2 whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>
            {loading && !data && Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={6} className="p-2"><Skeleton className="h-8" /></td></tr>)}
            {data && data.payments.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-gray-500">No transactions match.</td></tr>}
            {data?.payments.map((p) => (
              <tr key={p.id} className="border-t border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => setOpenId(p.id)}>
                <td className="px-3 py-2 whitespace-nowrap">{when(p.created_at)}</td>
                <td className="px-3 py-2 font-mono text-xs"><button className="underline text-indigo-300" onClick={(e) => { e.stopPropagation(); setOpenId(p.id); }}>{p.bill_number || p.id.slice(0, 8)}</button> {p.is_test && <span className="text-amber-300">TEST</span>}</td>
                <td className="px-3 py-2 whitespace-nowrap">{money(p.amount, p.currency)}</td>
                <td className="px-3 py-2"><StatusBadge s={p.status} /></td>
                <td className="px-3 py-2">Bakong KHQR</td>
                <td className="px-3 py-2 whitespace-nowrap">{when(p.confirmed_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-gray-400">
        <span>{data ? `${data.total} transaction${data.total === 1 ? "" : "s"}` : ""}</span>
        <div className="flex items-center gap-2">
          <button aria-label="Previous page" disabled={f.page <= 1} onClick={() => setF({ ...f, page: f.page - 1 })} className="p-2 rounded-lg border border-white/10 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
          <span>Page {f.page} / {pages}</span>
          <button aria-label="Next page" disabled={f.page >= pages} onClick={() => setF({ ...f, page: f.page + 1 })} className="p-2 rounded-lg border border-white/10 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
      {openId && <Detail id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}
