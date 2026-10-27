import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sparkles, LogIn, ArrowLeft } from "lucide-react";
import { supabase } from "../supabase";
import { useAdminStatus } from "../lib/useAdminStatus";
import { useLang } from "../lib/i18n";

export default function Login() {
  const navigate = useNavigate();
  const { t } = useLang();
  const { loading, authenticated, isAdmin, email, error: adminError } = useAdminStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Already signed in as admin -> straight to the dashboard.
  useEffect(() => { if (!loading && isAdmin) navigate("/dashboard", { replace: true }); }, [loading, isAdmin, navigate]);

  const signIn = async () => {
    setBusy(true); setError("");
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/login`, queryParams: { prompt: "select_account" } },
    });
    if (err) { setError(err.message); setBusy(false); }
  };
  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-[#6366f1] to-[#a855f7] rounded-2xl blur opacity-30" />
        <div className="relative bg-white/5 backdrop-blur-xl border border-white/15 rounded-2xl p-8 space-y-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/25">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" />
            <span className="text-indigo-300 text-xs font-medium">Admin Portal</span>
          </div>
          <h1 className="text-3xl font-bold text-white">{t("login.title")}</h1>
          <p className="text-gray-400 text-sm">{t("login.sub")}</p>

          {!loading && authenticated && !isAdmin ? (
            <div className="space-y-3">
              <p role="alert" className="text-sm text-red-300">This Google account{email ? ` (${email})` : ""} is not authorized for the dashboard.</p>
              {adminError && <p className="text-xs text-amber-300">Could not verify admin status: {adminError}. If this is the admin email, run supabase/schema.sql again in the Supabase SQL editor.</p>}
              <button onClick={signOut} className="w-full py-3 rounded-xl border border-white/15 text-gray-200 hover:bg-white/5">Sign out</button>
            </div>
          ) : (
            <button onClick={signIn} disabled={busy || loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-gray-900 font-semibold hover:bg-gray-100 disabled:opacity-60">
              <LogIn className="w-4 h-4" aria-hidden="true" />{busy ? "..." : t("login.google")}
            </button>
          )}
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white"><ArrowLeft className="w-4 h-4" aria-hidden="true" />{t("login.back")}</Link>
        </div>
      </div>
    </div>
  );
}
