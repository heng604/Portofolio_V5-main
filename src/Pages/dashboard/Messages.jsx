import { useCallback, useEffect, useMemo, useState } from 'react'
import { Inbox, Search, Trash2, MailOpen, Mail, RefreshCw } from 'lucide-react'
import { supabase } from '../../supabase'
import { Card, PageHeader, inputCls, btnGhost, toast, confirmDestructive } from './ui'

export default function Messages() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('contact_submissions').select('id,name,email,subject,message,status,error,is_read,created_at').order('created_at', { ascending: false }).limit(300)
    if (error) toast('error', error.message)
    setRows(data || [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const list = useMemo(() => rows.filter((r) =>
    (filter === 'all' || (filter === 'unread' ? !r.is_read : r.status === filter)) &&
    (!q || [r.name, r.email, r.subject, r.message].some((v) => String(v).toLowerCase().includes(q.toLowerCase())))), [rows, q, filter])

  const setRead = async (r, is_read) => {
    const { error } = await supabase.from('contact_submissions').update({ is_read }).eq('id', r.id)
    if (error) return toast('error', error.message)
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, is_read } : x)))
  }
  const remove = async (r) => {
    if (!(await confirmDestructive('Delete this message?', 'This cannot be undone.'))) return
    const { error } = await supabase.from('contact_submissions').delete().eq('id', r.id)
    if (error) return toast('error', error.message)
    toast('success', 'Deleted'); setOpen(null); load()
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={Inbox} title="Messages" subtitle={loading ? 'Loading...' : `${rows.filter((r) => !r.is_read).length} unread / ${rows.length} total`}>
        <button onClick={load} className={btnGhost} aria-label="Refresh"><RefreshCw className="w-4 h-4" /></button>
      </PageHeader>
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]"><Search className="w-4 h-4 text-gray-500 absolute left-3 top-3" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search messages" aria-label="Search messages" className={`${inputCls} pl-9`} /></div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className={`${inputCls} !w-auto`} aria-label="Filter">
            {['all', 'unread', 'sent', 'failed', 'received'].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <ul className="divide-y divide-white/5">
          {list.map((r) => (
            <li key={r.id} className="py-3">
              <button className="w-full text-left" onClick={() => { setOpen(open === r.id ? null : r.id); if (!r.is_read) setRead(r, true) }}>
                <div className="flex items-center gap-2">
                  {r.is_read ? <MailOpen className="w-4 h-4 text-gray-600" /> : <Mail className="w-4 h-4 text-indigo-400" />}
                  <span className={`text-sm ${r.is_read ? 'text-gray-400' : 'text-white font-semibold'}`}>{r.subject}</span>
                  <span className={`ml-auto text-[11px] px-2 py-0.5 rounded-full border ${r.status === 'sent' ? 'border-green-500/30 text-green-400' : r.status === 'failed' ? 'border-red-500/30 text-red-400' : 'border-white/15 text-gray-400'}`}>email {r.status}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{r.name} &lt;{r.email}&gt; - {new Date(r.created_at).toLocaleString()}</p>
              </button>
              {open === r.id && (
                <div className="mt-3 rounded-xl bg-black/30 border border-white/10 p-4">
                  <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">{r.message}</p>
                  {r.error && <p className="mt-2 text-xs text-red-400">Delivery error: {r.error}</p>}
                  <div className="mt-3 flex gap-2">
                    <a className={btnGhost} href={`mailto:${r.email}?subject=${encodeURIComponent('Re: ' + r.subject)}`}>Reply</a>
                    <button className={btnGhost} onClick={() => setRead(r, !r.is_read)}>Mark {r.is_read ? 'unread' : 'read'}</button>
                    <button className={`${btnGhost} text-red-400`} onClick={() => remove(r)}><Trash2 className="w-4 h-4 inline mr-1" />Delete</button>
                  </div>
                </div>
              )}
            </li>
          ))}
          {!loading && list.length === 0 && <li className="py-8 text-center text-sm text-gray-500">No messages.</li>}
        </ul>
      </Card>
    </div>
  )
}
