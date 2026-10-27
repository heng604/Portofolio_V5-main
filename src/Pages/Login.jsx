import { useState } from 'react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { Mail, Sparkles, LogIn } from 'lucide-react';

const ADMIN_EMAIL = 'Seangheng2006@gmail.com';
export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const signInGoogle = async () => {
    setLoading(true); setError('');
    const { error: authError } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/dashboard` } });
    if (authError) { setError(authError.message); setLoading(false); }
  };
  const signInEmail = async (event) => {
    event.preventDefault(); setLoading(true); setError('');
    const form = new FormData(event.currentTarget);
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email: String(form.get('email') || ''), password: String(form.get('password') || '') });
    if (authError || !data.user) { setError(authError?.message || 'Sign-in failed.'); setLoading(false); return; }
    if ((data.user.email || '').toLowerCase() !== ADMIN_EMAIL.toLowerCase()) { await supabase.auth.signOut(); navigate('/404', { replace: true }); return; }
    navigate('/dashboard', { replace: true });
  };
  return <div className="min-h-screen flex items-center justify-center px-4 py-10">
    <div className="w-full max-w-md rounded-2xl border border-white/15 bg-white/5 backdrop-blur-xl p-7 sm:p-8 space-y-6">
      <div className="text-center space-y-3"><div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/25"><Sparkles className="w-4 h-4 text-indigo-400"/><span className="text-indigo-300 text-xs font-medium">Admin Portal</span></div><h1 className="text-3xl font-bold text-white">Welcome Back</h1><p className="text-gray-400 text-sm">Only the authorized administrator can access this dashboard.</p></div>
      <button onClick={signInGoogle} disabled={loading} className="w-full rounded-xl bg-white text-gray-900 py-3 font-semibold flex justify-center items-center gap-2 disabled:opacity-50"><Mail size={18}/>{loading ? 'Redirecting…' : 'Continue with Google'}</button>
      <div className="flex items-center gap-3 text-xs text-gray-500"><span className="h-px flex-1 bg-white/10"/>or sign in with email<span className="h-px flex-1 bg-white/10"/></div>
      <form onSubmit={signInEmail} className="space-y-3"><label className="block text-sm text-gray-300">Email<input name="email" type="email" required autoComplete="username" className="mt-1 w-full rounded-lg border border-white/15 bg-black/20 px-3 py-3 text-white"/></label><label className="block text-sm text-gray-300">Password<input name="password" type="password" required autoComplete="current-password" className="mt-1 w-full rounded-lg border border-white/15 bg-black/20 px-3 py-3 text-white"/></label><button disabled={loading} className="w-full rounded-xl border border-indigo-400/30 bg-indigo-500/15 py-3 text-white font-semibold flex items-center justify-center gap-2"><LogIn size={17}/>Sign in</button></form>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}<p className="text-xs text-gray-500 text-center">Authorized email: {ADMIN_EMAIL}</p>
    </div>
  </div>;
}
