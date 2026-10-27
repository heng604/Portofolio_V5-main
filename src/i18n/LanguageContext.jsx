import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { translations } from './translations'

const LanguageContext = createContext(null)
const STORAGE_KEY = 'portfolio_lang'

const initialLang = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'km') return saved
  } catch { /* storage blocked */ }
  return 'km' // the original site was Khmer-first
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(initialLang)
  const [overrides, setOverrides] = useState({ en: {}, km: {} })

  // DB translations override the built-in dictionary (maintained in Dashboard > Translations)
  useEffect(() => {
    let cancelled = false
    supabase.from('translations').select('key,lang,value').then(({ data, error }) => {
      if (cancelled || error || !data) return
      const next = { en: {}, km: {} }
      data.forEach((r) => { if (next[r.lang]) next[r.lang][r.key] = r.value })
      setOverrides(next)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang === 'km' ? 'km' : 'en'
  }, [lang])

  const setLang = useCallback((l) => {
    setLangState(l)
    try { localStorage.setItem(STORAGE_KEY, l) } catch { /* ignore */ }
  }, [])

  const t = useCallback((key, fallback) =>
    overrides[lang]?.[key] ?? translations[lang]?.[key] ?? translations.en[key] ?? fallback ?? key,
  [lang, overrides])

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export const useLang = () => {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLang must be used inside <LanguageProvider>')
  return ctx
}
