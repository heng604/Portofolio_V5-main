import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { apiFetch } from "./api";

// Asks the SERVER who the current session is (token validated server-side).
// Returns { loading, authenticated, isAdmin, error }.
export function useAdminStatus() {
  const [state, setState] = useState({ loading: true, authenticated: false, isAdmin: false, error: null });

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) return alive && setState({ loading: false, authenticated: false, isAdmin: false, error: null });
      try {
        const r = await apiFetch("/api/admin/me", { auth: true });
        if (alive) setState({ loading: false, authenticated: r.authenticated, isAdmin: r.isAdmin, error: null });
      } catch (e) {
        // Fail CLOSED: if the server cannot confirm admin, the dashboard stays locked.
        if (alive) setState({ loading: false, authenticated: true, isAdmin: false, error: e.message });
      }
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => check());
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  return state;
}
