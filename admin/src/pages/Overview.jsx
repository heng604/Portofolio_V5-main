import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FolderGit2, Boxes, Award, MessageSquare, Mail, Coins, TrendingUp, RefreshCw } from "lucide-react";
import { apiFetch } from "../lib/api";
import { ErrorBox, Skeleton, StatusBadge, money, when } from "../lib/ui.jsx";

const Card = ({ icon: Icon, label, value, hint, to }) => (
  <Link to={to} className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors block">
    <Icon className="w-5 h-5 text-indigo-400" aria-hidden="true" />
    <p className="text-2xl font-bold text-white mt-2">{value ?? "-"}</p>
    <p className="text-sm text-gray-200">{label}</p>
    {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
  </Link>
);

export default function Overview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try { setData(await apiFetch("/api/admin/stats", { auth: true })); } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const c = data?.content, p = data?.payments;
  const edits = (data?.recentAudit || []).filter((a) => !a.entity.startsWith("payments"));
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div><h1 className="text-2xl font-bold text-white">Overview</h1><p className="text-sm text-gray-400">Live numbers from your database. Revenue counts only payments verified by the server.</p></div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-sm text-gray-300 hover:bg-white/5"><RefreshCw className="w-4 h-4" aria-hidden="true" />Refresh</button>
      </div>
      {error && <ErrorBox message={error} onRetry={load} />}
      {!data && !error && <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} />)}</div>}
      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card icon={FolderGit2} to="/content/projects" label="Projects" value={c.projects} hint={`${c.publishedProjects ?? "-"} published`} />
            <Card icon={Boxes} to="/content/techstack" label="Skills & tools" value={c.techStack} hint="Tech stack entries" />
            <Card icon={Award} to="/content/certificates" label="Certificates" value={c.certificates} />
            <Card icon={Mail} to="/content/messages" label="Unread messages" value={c.unreadMessages} hint={`${c.comments ?? "-"} comments`} />
            <Card icon={Coins} to="/payments" label="Verified tips" value={p.verifiedCount} hint={`${p.byStatus.pending || 0} pending, ${p.byStatus.failed || 0} failed`} />
            <Card icon={TrendingUp} to="/payments" label="Verified revenue (USD)" value={money(p.revenue.USD, "USD")} hint={`30 days: ${money(p.last30.USD, "USD")}`} />
            <Card icon={TrendingUp} to="/payments" label="Verified revenue (KHR)" value={money(p.revenue.KHR, "KHR")} hint={`30 days: ${money(p.last30.KHR, "KHR")}`} />
            <Card icon={MessageSquare} to="/content/comments" label="Comments" value={c.comments} />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-4" aria-labelledby="rp">
              <div className="flex justify-between items-center mb-3"><h2 id="rp" className="font-semibold text-white">Recent transactions</h2><Link to="/payments" className="text-xs text-indigo-300 underline">All</Link></div>
              {data.recentPayments.length === 0 ? <p className="text-sm text-gray-500 py-6 text-center">No transactions yet.</p> : (
                <ul className="divide-y divide-white/5">
                  {data.recentPayments.map((t) => (
                    <li key={t.id} className="py-2 flex items-center justify-between gap-2 text-sm">
                      <div><p className="text-gray-200">{money(t.amount, t.currency)} {t.is_test && <span className="text-[10px] text-amber-300">TEST</span>}</p><p className="text-xs text-gray-500">{when(t.created_at)}</p></div>
                      <StatusBadge s={t.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="rounded-2xl border border-white/10 bg-white/5 p-4" aria-labelledby="ru">
              <h2 id="ru" className="font-semibold text-white mb-3">Recent content updates</h2>
              {edits.length === 0 ? <p className="text-sm text-gray-500 py-6 text-center">No edits recorded yet (run the admin_v2 migration to enable the audit log).</p> : (
                <ul className="divide-y divide-white/5">
                  {edits.map((a) => (
                    <li key={a.id} className="py-2 text-sm"><p className="text-gray-200">{a.action} <span className="text-indigo-300">{a.entity}</span> {a.entity_id && <span className="text-gray-500 text-xs">({String(a.entity_id).slice(0, 24)})</span>}</p><p className="text-xs text-gray-500">{a.actor_email} - {when(a.created_at)}</p></li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section aria-labelledby="qa">
            <h2 id="qa" className="font-semibold text-white mb-2">Quick actions</h2>
            <div className="flex flex-wrap gap-2 text-sm">
              {[["/content/projects", "Edit projects"], ["/content/texts", "Edit hero & about text"], ["/content/certificates", "Manage certificates"], ["/appearance", "Sections & SEO"], ["/payments", "Review payments"]].map(([to, l]) => (
                <Link key={to} to={to} className="px-4 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-200 hover:bg-indigo-600/30">{l}</Link>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
