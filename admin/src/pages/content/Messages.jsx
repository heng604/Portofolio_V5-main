import { useCallback, useEffect, useMemo, useState } from "react";
import { Mail, Trash2, MailOpen, Search } from "lucide-react";
import { apiFetch } from "../../lib/api";

export default function Messages() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setRows((await apiFetch("/api/admin/messages", { auth: true })).messages); } catch (e) { setError(e.message); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? rows.filter((r) => [r.name, r.email, r.subject, r.message].some((v) => v.toLowerCase().includes(s))) : rows;
  }, [rows, q]);

  const toggle = async (r) => {
    try { await apiFetch(`/api/admin/messages/${r.id}`, { method: "PATCH", body: { is_read: !r.is_read }, auth: true }); setRows((x) => x.map((m) => (m.id === r.id ? { ...m, is_read: !r.is_read } : m))); }
    catch (e) { setError(e.message); }
  };
  const remove = async (r) => {
    if (!window.confirm(`Delete the message from ${r.name}? This cannot be undone.`)) return;
    try { await apiFetch(`/api/admin/messages/${r.id}`, { method: "DELETE", auth: true }); setRows((x) => x.filter((m) => m.id !== r.id)); setNotice("Message deleted."); }
    catch (e) { setError(e.message); }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2"><Mail className="w-5 h-5 text-indigo-400" aria-hidden="true" />Contact messages</h1>
      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
        <input aria-label="Search messages" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search..." className="w-full bg-[#0d0d22] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-500/60" />
      </div>
      {error && <p role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</p>}
      {notice && <p role="status" className="p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-300 text-sm">{notice}</p>}
      {loading && <p className="text-gray-500 text-sm">Loading...</p>}
      {!loading && shown.length === 0 && <p className="text-gray-500 text-sm">No messages.</p>}
      <ul className="space-y-3">
        {shown.map((r) => (
          <li key={r.id} className={`p-4 rounded-xl border ${r.is_read ? "bg-white/[0.02] border-white/8" : "bg-indigo-500/5 border-indigo-500/30"}`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="font-semibold text-white break-words">{r.subject}</p>
                <p className="text-xs text-gray-400 break-all">{r.name} &lt;{r.email}&gt; - {new Date(r.created_at).toLocaleString()} - <span className={r.status === "sent" ? "text-green-400" : "text-amber-400"}>{r.status}</span></p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => toggle(r)} className="p-2 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5" aria-label={r.is_read ? "Mark unread" : "Mark read"}><MailOpen className="w-4 h-4" /></button>
                <button onClick={() => remove(r)} className="p-2 rounded-lg border border-red-500/25 text-red-400 hover:bg-red-500/10" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-300 whitespace-pre-wrap break-words">{r.message}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
