import { useCallback, useEffect, useState } from 'react'
import { Settings as SettingsIcon, Save, Loader2 } from 'lucide-react'
import { supabase } from '../../supabase'
import { Card, PageHeader, FileDrop, inputCls, btnPrimary, toast } from './ui'

// Every field is stored as one row in public.site_settings (key -> jsonb value).
// type: text | textarea | number | bool | url | image | pdf
const GROUPS = [
  { id: 'hero', title: 'Hero content', fields: [
    { key: 'hero.name', label: 'Display name', type: 'text' },
    { key: 'hero.role', label: 'Role / headline', type: 'text' },
  ] },
  { id: 'contact', title: 'Contact details', fields: [
    { key: 'contact.email', label: 'Public contact email', type: 'text' },
    { key: 'contact.phone', label: 'Phone (optional)', type: 'text' },
    { key: 'contact.location', label: 'Location (optional)', type: 'text' },
  ] },
  { id: 'social', title: 'Social links', fields: [
    { key: 'social.telegram', label: 'Telegram URL', type: 'url' },
    { key: 'social.github', label: 'GitHub URL', type: 'url' },
    { key: 'social.linkedin', label: 'LinkedIn URL', type: 'url' },
    { key: 'social.facebook', label: 'Facebook URL', type: 'url' },
    { key: 'social.instagram', label: 'Instagram URL', type: 'url' },
  ] },
  { id: 'cv', title: 'CV / Resume', fields: [
    { key: 'cv.url', label: 'CV file (PDF) - upload or paste a link', type: 'pdf' },
  ] },
  { id: 'seo', title: 'SEO metadata', fields: [
    { key: 'seo.title', label: 'Page title', type: 'text' },
    { key: 'seo.description', label: 'Meta description', type: 'textarea' },
    { key: 'seo.image', label: 'Share image (Open Graph)', type: 'image' },
  ] },
  { id: 'bakong', title: 'Bakong recipient (public, non-secret)', fields: [
    { key: 'bakong.enabled', label: 'Accept tips', type: 'bool' },
    { key: 'bakong.recipient_name_en', label: 'Recipient name (Latin, max 25 chars, shown in QR)', type: 'text', max: 25 },
    { key: 'bakong.recipient_name_km', label: 'Recipient name (Khmer, shown on the card)', type: 'text', max: 25 },
    { key: 'bakong.city', label: 'City', type: 'text' },
    { key: 'bakong.usd_min', label: 'Minimum tip (USD)', type: 'number' },
    { key: 'bakong.usd_max', label: 'Maximum tip (USD)', type: 'number' },
    { key: 'bakong.khr_min', label: 'Minimum tip (KHR)', type: 'number' },
    { key: 'bakong.khr_max', label: 'Maximum tip (KHR)', type: 'number' },
  ] },
  { id: 'general', title: 'General', fields: [
    { key: 'site.footer_text', label: 'Footer text (optional)', type: 'text' },
  ] },
]

export default function Settings() {
  const [values, setValues] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [errors, setErrors] = useState({})

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('site_settings').select('key,value')
    if (error) toast('error', error.message)
    setValues(Object.fromEntries((data || []).map((r) => [r.key, r.value])))
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const set = (k, v) => setValues((s) => ({ ...s, [k]: v }))

  const save = async (group) => {
    const errs = {}
    group.fields.forEach((f) => {
      const v = values[f.key]
      if (f.type === 'number' && v !== undefined && v !== '' && !Number.isFinite(Number(v))) errs[f.key] = 'Must be a number'
      if (f.type === 'url' && v && !/^https?:\/\//i.test(v)) errs[f.key] = 'Must start with http:// or https://'
      if (f.max && String(v || '').length > f.max) errs[f.key] = `Max ${f.max} characters`
    })
    setErrors(errs)
    if (Object.keys(errs).length) return toast('error', 'Fix the highlighted fields')
    setSaving(group.id)
    const rows = group.fields
      .filter((f) => values[f.key] !== undefined)
      .map((f) => ({ key: f.key, group_name: group.id, is_public: true, value: f.type === 'number' ? Number(values[f.key]) : values[f.key] }))
    const { error } = await supabase.from('site_settings').upsert(rows, { onConflict: 'key' })
    setSaving('')
    if (error) return toast('error', error.message)
    toast('success', `${group.title} saved`)
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={SettingsIcon} title="Settings" subtitle={loading ? 'Loading...' : 'Saved to the database; public pages read them without a code change'} />
      <p className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
        Secrets (Bakong API token, Resend key, service-role key) are never stored here - they live in server environment variables only.
        The Bakong account ID also comes from the server environment (BAKONG_ACCOUNT_ID).
      </p>
      {GROUPS.map((g) => (
        <Card key={g.id} className="p-5 space-y-4">
          <h2 className="font-semibold text-white">{g.title}</h2>
          {g.fields.map((f) => (
            <div key={f.key}>
              <label className="text-xs text-gray-400 uppercase tracking-wider block mb-1.5" htmlFor={f.key}>{f.label}</label>
              {f.type === 'bool' ? (
                <label className="inline-flex items-center gap-2 text-sm text-gray-200"><input id={f.key} type="checkbox" checked={Boolean(values[f.key])} onChange={(e) => set(f.key, e.target.checked)} /> Enabled</label>
              ) : f.type === 'textarea' ? (
                <textarea id={f.key} rows={3} className={inputCls} value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} />
              ) : f.type === 'image' || f.type === 'pdf' ? (
                <div className="space-y-2">
                  <input id={f.key} className={inputCls} value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} placeholder="https://..." />
                  <FileDrop bucket={f.type === 'pdf' ? 'cv-files' : 'site-assets'} pdf={f.type === 'pdf'}
                    accept={f.type === 'pdf' ? 'application/pdf' : 'image/jpeg,image/png,image/webp'} maxMB={f.type === 'pdf' ? 10 : 5}
                    value={values[f.key]} onUploaded={(url) => set(f.key, url)} label={f.type === 'pdf' ? 'Drop a PDF here or click to browse' : undefined} />
                </div>
              ) : (
                <input id={f.key} className={inputCls} type={f.type === 'number' ? 'number' : 'text'} step="any" value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} />
              )}
              {errors[f.key] && <p className="text-xs text-red-400 mt-1" role="alert">{errors[f.key]}</p>}
            </div>
          ))}
          <button onClick={() => save(g)} disabled={saving === g.id || loading} className={btnPrimary}>
            {saving === g.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save {g.title}
          </button>
        </Card>
      ))}
    </div>
  )
}
