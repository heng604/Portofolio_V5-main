import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

const ADMIN_EMAIL = 'Seangheng2006@gmail.com';
export default function ProtectedRoute({ children }) {
  const [state, setState] = useState('checking');
  useEffect(() => {
    let alive = true;
    const check = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!alive) return;
      if (error || !user) return setState('signed-out');
      if ((user.email || '').toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return setState('not-found');
      setState('allowed');
    };
    check();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => check());
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);
  if (state === 'checking') return <div className="min-h-screen bg-[#030014] text-white flex items-center justify-center" role="status">Checking administrator session…</div>;
  if (state === 'not-found') return <Navigate to="/404" replace />;
  if (state === 'signed-out') return <Navigate to="/login" replace />;
  return children;
}
