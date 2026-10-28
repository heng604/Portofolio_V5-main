import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, ShieldCheck } from "lucide-react";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { useAdminStatus } from "../lib/useAdminStatus";

export default function Login() {
  const nav = useNavigate();
  const { loading, authenticated, isAdmin, email, error: adminError } = useAdminStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (!loading && isAdmin) nav("/", { replace: true }); }, [loading, isAdmin, nav]);

  const signIn = async () => {
    setBusy(true); setError("");
    const { error: e } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/admin/login`, queryParams: { prompt: "select_account" } } });
    if (e) { setError(e.message); setBusy(false); }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-8 text-center space-y-5">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 grid place-items-center"><ShieldCheck className="w-7 h-7 text-white" aria-hidden="true" /></div>
        <h1 className="text-2xl font-bold text-white">Admin sign in</h1>
        <p className="text-sm text-gray-400">Only the site owner's Google account can access this area.</p>
        {!supabaseConfigured && <p role="alert" className="text-sm text-amber-300">VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing in .env.</p>}
        {!loading && authenticated && !isAdmin ? (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-red-300">{email ? `${email} is` : "This account is"} not authorized.</p>
            {adminError && <p className="text-xs text-amber-300">Could not verify admin status: {adminError}</p>}
            <button onClick={() => supabase.auth.signOut()} className="w-full py-3 rounded-xl border border-white/15 hover:bg-white/5">Sign out</button>
          </div>
        ) : (
          <button onClick={signIn} disabled={busy || loading} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-gray-900 font-semibold hover:bg-gray-100 disabled:opacity-60">
            <LogIn className="w-4 h-4" aria-hidden="true" />{busy ? "Redirecting..." : "Continue with Google"}
          </button>
        )}
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <a href="/" className="text-sm text-gray-400 hover:text-white">Back to portfolio</a>
      </div>
    </div>
  );
}
