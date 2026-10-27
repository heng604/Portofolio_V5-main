import { Navigate } from 'react-router-dom'
import { useEffect, useState, lazy, Suspense } from 'react'
import { supabase } from '../supabase'
import { apiFetch } from '../utils/api'

const NotFoundPage = lazy(() => import('../Pages/404'))

/**
 * Admin gate.
 *  - not signed in            -> /login
 *  - signed in, NOT the admin -> 404-style page (the admin area is not revealed)
 *  - signed in as the admin   -> dashboard
 * The decision comes from the SERVER (/api/admin/me validates the Supabase token and compares it with
 * ADMIN_EMAIL) and, independently, from database RLS (public.is_admin()). No e-mail is checked in the browser.
 */
export default function ProtectedRoute({ children }) {
  const [state, setState] = useState('checking') // checking | anon | admin | denied

  useEffect(() => {
    let off = false
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return !off && setState('anon')
      try {
        await apiFetch('/api/admin/me', { token: session.access_token })
        if (!off) setState('admin')
      } catch (e) {
        if (!off) setState(e.status === 404 ? 'denied' : 'error')
      }
    }
    check()
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setState('anon')
    })
    return () => { off = true; sub.subscription.unsubscribe() }
  }, [])

  if (state === 'checking') return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">...</div>
  if (state === 'anon') return <Navigate to="/login" replace />
  if (state === 'denied') return <Suspense fallback={null}><NotFoundPage /></Suspense>
  if (state === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center text-gray-300 text-sm">
        Could not verify admin access. Make sure the API server is running (npm run dev) and .env is configured.
      </div>
    )
  }
  return children
}
