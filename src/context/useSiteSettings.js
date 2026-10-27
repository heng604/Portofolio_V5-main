import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

// Public site settings (Dashboard > Settings). Fetched once and shared; components fall back to
// their built-in defaults when a key is missing or Supabase is unavailable.
let cache = null
let inflight = null

const load = () => {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = supabase.from('site_settings').select('key,value').then(({ data, error }) => {
      cache = error ? {} : Object.fromEntries((data || []).map((r) => [r.key, r.value]))
      return cache
    }).catch(() => (cache = {}))
  }
  return inflight
}

export function useSiteSettings() {
  const [settings, setSettings] = useState(cache || {})
  useEffect(() => {
    let off = false
    load().then((s) => { if (!off) setSettings(s) })
    return () => { off = true }
  }, [])
  const get = (key, fallback = '') => {
    const v = settings[key]
    return typeof v === 'string' && v.trim() ? v : fallback
  }
  return { settings, get }
}
