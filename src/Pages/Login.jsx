import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'
import LanguageToggle from '../components/LanguageToggle'

const GoogleIcon = () => (
  <svg viewBox="0 0 48 48" className="w-5 h-5" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.5 17.7 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/>
    <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z"/>
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.9 2.3-8.5 2.3-6.3 0-11.6-4-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
  </svg>
)

export default function Login() {
  const { t } = useLang()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Already signed in (e.g. returning from Google)? Go to the dashboard; ProtectedRoute does the real check.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) navigate('/dashboard', { replace: true }) })
  }, [navigate])

  const signInWithGoogle = async () => {
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard`, queryParams: { prompt: 'select_account' } },
    })
    if (err) { setError(err.message); setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-[#6366f1] to-[#a855f7] rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-700" />
          <div className="relative bg-white/5 backdrop-blur-xl border border-white/15 rounded-2xl p-8 space-y-7">
            <div className="flex justify-end"><LanguageToggle /></div>
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/25">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-indigo-300 text-xs font-medium">{t('login.title')}</span>
              </div>
              <h1 className="text-3xl font-bold text-white">{t('login.heading')}</h1>
              <p className="text-gray-400 text-sm">{t('login.sub')}</p>
            </div>

            <button type="button" onClick={signInWithGoogle} disabled={loading} className="relative group/btn w-full">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-[#4f52c9] to-[#8644c5] rounded-xl opacity-70 blur group-hover/btn:opacity-100 transition duration-300" />
              <div className="relative h-12 bg-[#030014] rounded-xl border border-white/10 flex items-center justify-center gap-3">
                {loading ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : (<><GoogleIcon /><span className="text-sm font-medium text-white">{t('login.google')}</span></>)}
              </div>
            </button>
            {error && <p className="text-sm text-red-400 text-center" role="alert">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
