import { useCallback, useEffect, useMemo, useState } from 'react'
import { Languages, Search, Save, Trash2, Plus, Loader2 } from 'lucide-react'
import { supabase } from '../../supabase'
import { translations } from '../../i18n/translations'
import { Card, PageHeader, inputCls, btnPrimary, btnGhost, toast, confirmDestructive } from './ui'

// Shows every built-in key; a row saved here overrides the built-in text on the public site.
export default function Translations() {
  const [db, setDb] = useState({ en: {}, km: {} })
  const [edit, setEdit] = useState({ en: {}, km: {} })
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [newKey, setNewKey] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('translations').select('key,lang,value')
    if (error) toast('error', error.message)
    const next = { en: {}, km: {} }
    ;(data || []).forEach((r) => { next[r.lang][r.key] = r.value })
    setDb(next); setEdit({ en: {}, km: {} }); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const keys = useMemo(() => {
    const all = new Set([...Object.keys(translations.en), ...Object.keys(translations.km), ...Object.keys(db.en), ...Object.keys(db.km)])
    return [...all].sort().filter((k) => !q || k.toLowerCase().includes(q.toLowerCase()) || (edit.en[k] ?? db.en[k] ?? translations.en[k] ?? '').toLowerCase().includes(q.toLowerCase()))
  }, [db, edit, q])

  const current = (lang, k) => edit[lang][k] ?? db[lang][k] ?? translations[lang][k] ?? ''
  const dirty = (k) => ['en', 'km'].some((l) => edit[l][k] !== undefined)

  const saveKey = async (k) => {
    const rows = ['en', 'km'].filter((l) => edit[l][k] !== undefined && edit[l][k].trim() !== '').map((l) => ({ key: k, lang: l, value: edit[l][k].trim() }))
    if (!rows.length) return toast('error', 'Nothing to save (values cannot be empty)')
    setSaving(k)
    const { error } = await supabase.from('translations').upsert(rows, { onConflict: 'key,lang' })
    setSaving('')
    if (error) return toast('error', error.message)
    toast('success', 'Saved'); load()
  }
  const resetKey = async (k) => {
    if (!(await confirmDestructive(`Reset "${k}"?`, 'The built-in text will be used again.'))) return
    const { error } = await supabase.from('translations').delete().eq('key', k)
    if (error) return toast('error', error.message)
    toast('success', 'Reset'); load()
  }
  const addKey = () => {
    const k = newKey.trim()
    if (!/^[a-zA-Z0-9_.-]{2,120}$/.test(k)) return toast('error', 'Key: letters, numbers, . _ - (2-120 chars)')
    setEdit((e) => ({ en: { ...e.en, [k]: e.en[k] ?? '' }, km: { ...e.km, [k]: e.km[k] ?? '' } })); setNewKey(''); setQ(k)
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={Languages} title="Translations" subtitle={loading ? 'Loading...' : `${keys.length} keys`} />
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]"><Search className="w-4 h-4 text-gray-500 absolute left-3 top-3" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search key or text" aria-label="Search translations" className={`${inputCls} pl-9`} /></div>
          <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="new.key" aria-label="New translation key" className={`${inputCls} !w-40`} />
          <button onClick={addKey} className={btnGhost}><Plus className="w-4 h-4 inline" /> Add key</button>
        </div>
        <div className="divide-y divide-white/5">
          {keys.map((k) => (
            <div key={k} className="py-3 grid gap-2 md:grid-cols-[200px_1fr_1fr_auto] items-start">
              <code className="text-xs text-indigo-300 break-all pt-2.5">{k}{db.en[k] || db.km[k] ? ' *' : ''}</code>
              <input aria-label={`${k} English`} className={inputCls} value={current('en', k)} placeholder="English" onChange={(e) => setEdit((s) => ({ ...s, en: { ...s.en, [k]: e.target.value } }))} />
              <input aria-label={`${k} Khmer`} className={inputCls} value={current('km', k)} placeholder="ខ្មែរ" onChange={(e) => setEdit((s) => ({ ...s, km: { ...s.km, [k]: e.target.value } }))} />
              <div className="flex gap-1">
                <button onClick={() => saveKey(k)} disabled={!dirty(k) || saving === k} className={`${btnPrimary} !px-3`} aria-label={`Save ${k}`}>{saving === k ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}</button>
                {(db.en[k] || db.km[k]) && <button onClick={() => resetKey(k)} className={btnGhost} aria-label={`Reset ${k}`}><Trash2 className="w-4 h-4" /></button>}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gray-500">* = overridden in the database. Existing Home / About / Portfolio page text is not yet routed through this table (see README, "Known gaps").</p>
      </Card>
    </div>
  )
}
