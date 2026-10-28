import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, FileText, Palette, Wallet, LogOut, Menu, ExternalLink, ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAdminStatus } from "../lib/useAdminStatus";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/content", label: "Portfolio content", icon: FileText },
  { to: "/appearance", label: "Appearance & settings", icon: Palette },
  { to: "/payments", label: "Payments", icon: Wallet },
];

export default function Layout() {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const { email } = useAdminStatus();
  const logout = async () => { await supabase.auth.signOut(); nav("/login", { replace: true }); };

  const Side = () => (
    <div className="flex flex-col h-full p-5 gap-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 grid place-items-center"><ShieldCheck className="w-5 h-5 text-white" aria-hidden="true" /></div>
        <div><p className="text-sm font-semibold text-white">Portfolio Admin</p><p className="text-xs text-gray-500 truncate max-w-[10rem]">{email}</p></div>
      </div>
      <nav aria-label="Admin" className="flex flex-col gap-1 flex-1">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors ${isActive ? "bg-indigo-500/20 border-indigo-500/40 text-white" : "border-transparent text-gray-400 hover:text-white hover:bg-white/5"}`}>
            <Icon className="w-4 h-4" aria-hidden="true" />{label}
          </NavLink>
        ))}
      </nav>
      <a href="/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 text-sm text-indigo-300 hover:text-indigo-200"><ExternalLink className="w-4 h-4" aria-hidden="true" />View public site</a>
      <button onClick={logout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:text-red-300 hover:bg-red-500/10"><LogOut className="w-4 h-4" aria-hidden="true" />Sign out</button>
    </div>
  );

  return (
    <div className="flex min-h-screen text-white">
      {open && <div className="fixed inset-0 z-20 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-white/10 bg-white/[0.03] sticky top-0 h-screen"><Side /></aside>
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-[#0a0a1a] border-r border-white/10 transition-transform lg:hidden ${open ? "translate-x-0" : "-translate-x-full"}`}><Side /></aside>
      <div className="flex-1 min-w-0">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-white/10 sticky top-0 bg-[#030014]/90 backdrop-blur z-10">
          <button aria-label="Open menu" onClick={() => setOpen(true)} className="p-2 rounded-lg border border-white/10"><Menu className="w-4 h-4" /></button>
          <span className="text-sm font-medium">Portfolio Admin</span>
        </header>
        <main className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto"><Outlet /></main>
      </div>
    </div>
  );
}
