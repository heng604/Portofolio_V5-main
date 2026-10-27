import { useEffect, useState } from "react";
import { supabase } from "../supabase";

// Who is signed in, and are they the admin?
// The answer comes from the DATABASE: public.is_admin() runs inside Supabase against the verified JWT and checks
// the admin email (seangheng2006@gmail.com, see supabase/schema.sql). It does not need the Node API to be running,
// and every dashboard read/write is enforced by the same function through RLS, so a fake client flag cannot help anyone.
// Returns { loading, authenticated, isAdmin, email, error }.
export function useAdminStatus() {
  const [state, setState] = useState({ loading: true, authenticated: false, isAdmin: false, email: "", error: null });

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      if (!session) return alive && setState({ loading: false, authenticated: false, isAdmin: false, email: "", error: null });
      const email = session.user?.email || "";
      const { data: ok, error } = await supabase.rpc("is_admin");
      // Fail CLOSED on any error.
      if (alive) setState({ loading: false, authenticated: true, isAdmin: !error && ok === true, email, error: error ? error.message : null });
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => check());
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  return state;
}
