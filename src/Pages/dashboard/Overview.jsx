import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FolderGit2, Award, Boxes, MessageSquare, Settings as Cog, ExternalLink } from "lucide-react";
import { supabase } from "../../supabase";

const CARDS = [
  { table: "projects", label: "Projects", to: "projects", icon: FolderGit2, hint: "Add, edit, reorder, publish/hide" },
  { table: "certificates", label: "Certificates", to: "certificates", icon: Award, hint: "Upload images, import built-in" },
  { table: "tech_stack", label: "Tech stack", to: "techstack", icon: Boxes, hint: "Icons grouped by category" },
  { table: "portfolio_comments", label: "Comments", to: "comments", icon: MessageSquare, hint: "Pin or delete visitor comments" },
];

export default function Overview() {
  const [counts, setCounts] = useState({});
  useEffect(() => {
    CARDS.forEach(async ({ table }) => {
      const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
      setCounts((c) => ({ ...c, [table]: count ?? "-" }));
    });
  }, []);
  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-white">Overview</h1>
      <p className="text-gray-400 text-sm">Everything on the public site is edited here. Changes go live on the next page load.</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {CARDS.map(({ table, label, to, icon: Icon, hint }) => (
          <Link key={table} to={to} className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
            <Icon className="w-5 h-5 text-indigo-400" aria-hidden="true" />
            <p className="text-2xl font-bold text-white mt-2">{counts[table] ?? "..."}</p>
            <p className="text-sm text-gray-200">{label}</p>
            <p className="text-xs text-gray-500 mt-1">{hint}</p>
          </Link>
        ))}
      </div>
      <Link to="settings" className="flex items-center gap-3 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 hover:bg-indigo-500/15">
        <Cog className="w-5 h-5 text-indigo-300" aria-hidden="true" />
        <div><p className="text-white text-sm font-semibold">Site settings &amp; CV</p><p className="text-xs text-gray-400">Home, About, photos, stats, portfolio titles, contact and footer text, social links, SEO</p></div>
      </Link>
      <a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-indigo-300 underline"><ExternalLink className="w-4 h-4" aria-hidden="true" />View live site</a>
    </div>
  );
}
