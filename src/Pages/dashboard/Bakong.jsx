import { useCallback, useEffect, useState } from "react";
import { QrCode, RefreshCw, FlaskConical, ShieldCheck, ShieldAlert } from "lucide-react";
import { apiFetch } from "../../lib/api";
import TipJar from "../../components/TipJar";

const SIMS = [
  ["", "Live (real verification)"],
  ["pending", "Simulate: pending"],
  ["expired", "Simulate: expired"],
  ["error", "Simulate: network error"],
  ["success", "Simulate: success view"],
];
const badge = (s) =>
  ({ confirmed: "bg-green-500/15 text-green-300 border-green-500/30", pending: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
     failed: "bg-red-500/15 text-red-300 border-red-500/30" }[s] || "bg-white/5 text-gray-300 border-white/15");

export default function Bakong() {
  const [cfg, setCfg] = useState(null);
  const [payments, setPayments] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [testPayment, setTestPayment] = useState(null);
  const [sim, setSim] = useState("");
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [c, p] = await Promise.all([
        apiFetch("/api/admin/config", { auth: true }),
        apiFetch(`/api/admin/payments${filter ? `?status=${filter}` : ""}`, { auth: true }),
      ]);
      setCfg(c); setPayments(p.payments);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const runTest = async () => {
    setTesting(true); setError("");
    try { const r = await apiFetch("/api/admin/bakong/test", { method: "POST", body: { amount: 0.01, currency: "USD" }, auth: true }); setTestPayment(r.payment); setSim(""); load(); }
    catch (e) { setError(e.message); }
    setTesting(false);
  };

  const prod = cfg?.bakong?.environment === "production";
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2"><QrCode className="w-5 h-5 text-indigo-400" aria-hidden="true" />Bakong &amp; Payments</h1>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-gray-300 text-sm hover:bg-white/5"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />Refresh</button>
      </div>
      {error && <p role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</p>}

      {cfg && (
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
            <p className="flex items-center gap-2 font-semibold text-white">{cfg.bakong.configured ? <ShieldCheck className="w-4 h-4 text-green-400" aria-hidden="true" /> : <ShieldAlert className="w-4 h-4 text-red-400" aria-hidden="true" />}Bakong</p>
            <p className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${prod ? "bg-red-600 text-white" : "bg-amber-400 text-black"}`}>{prod ? "PRODUCTION - REAL MONEY" : "SANDBOX / TEST MODE"}</p>
            <p className="text-gray-400">Recipient: {cfg.bakong.merchantName || "-"} ({cfg.bakong.accountId || "-"})</p>
            <p className="text-gray-400">API: {cfg.bakong.baseUrl || "-"}</p>
            <p className="text-gray-400">API token: {cfg.bakong.tokenSet ? "set (hidden)" : "NOT set"}</p>
            <p className="text-xs text-gray-500">Recipient/token are read from the server .env and cannot be edited here (security).</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
            <p className="font-semibold text-white">Other services</p>
            <p className="text-gray-400">Resend: {cfg.resend.configured ? `ready (to ${cfg.resend.to})` : "not configured"}</p>
            <p className="text-gray-400">Supabase service role: {cfg.supabase.configured ? "configured" : "not configured (payments kept in memory only)"}</p>
            <p className="text-gray-400">Admin email: {cfg.adminEmail}</p>
          </div>
        </div>
      )}

      <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={runTest} disabled={testing || !cfg?.bakong.configured} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium">
            <FlaskConical className="w-4 h-4" aria-hidden="true" />{testing ? "Generating..." : "Test Bakong"}
          </button>
          {testPayment && (
            <select aria-label="Test state" value={sim} onChange={(e) => setSim(e.target.value)} className="bg-[#0d0d22] border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200">
              {SIMS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          )}
        </div>
        <p className="text-xs text-amber-300">
          Test Bakong generates a real KHQR for 0.01 USD and lets you preview the pending / expired / error / success screens.
          Simulated screens are labelled and never mark anything as paid. In "Live" mode the status is verified by the server exactly like a real tip - so only an actual matching transfer can confirm it.
        </p>
        {testPayment && <TipJar preset={testPayment} simulate={sim || null} />}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">Payment log</h2>
          <select aria-label="Filter status" value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-[#0d0d22] border border-white/10 rounded-xl px-3 py-1.5 text-sm text-gray-200">
            <option value="">All</option>{["pending", "confirmed", "expired", "cancelled", "failed"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm text-left text-gray-300">
            <thead className="text-xs uppercase text-gray-500 bg-white/5"><tr>{["Date", "Amount", "Status", "Env", "Test", "Txn hash", "Note"].map((h) => <th key={h} className="px-3 py-2 whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>
              {payments.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">{loading ? "Loading..." : "No payments yet."}</td></tr>}
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-white/5">
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(p.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{Number(p.amount)} {p.currency}</td>
                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full border text-xs ${badge(p.status)}`}>{p.status}</span></td>
                  <td className="px-3 py-2">{p.environment}</td><td className="px-3 py-2">{p.is_test ? "yes" : ""}</td>
                  <td className="px-3 py-2 font-mono text-xs">{p.txn_hash ? `${p.txn_hash.slice(0, 10)}...` : ""}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{p.failure_reason || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
