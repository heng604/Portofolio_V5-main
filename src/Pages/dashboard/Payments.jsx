import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CreditCard, Search, RefreshCw, FlaskConical, Trash2, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { supabase } from '../../supabase'
import { apiFetch } from '../../utils/api'
import KhqrCard, { formatAmount } from '../../components/KhqrCard'
import { Card, PageHeader, inputCls, btnPrimary, btnGhost, toast, confirmDestructive } from './ui'

const STATUS_STYLE = {
  paid: 'bg-green-500/15 text-green-400 border-green-500/30',
  pending: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  expired: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  cancelled: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  failed: 'bg-red-500/15 text-red-400 border-red-500/30',
}

// ---------- Test Bakong panel ----------
function TestBakong() {
  const [currency, setCurrency] = useState('USD')
  const [busy, setBusy] = useState(false)
  const [payment, setPayment] = useState(null)
  const [error, setError] = useState('')
  const [simulated, setSimulated] = useState(null) // null | pending | paid | expired | failed
  const timer = useRef(null)

  const poll = useCallback(async (id) => {
    try {
      const { payment: p } = await apiFetch(`/api/bakong/status/${id}`)
      setPayment(p)
      if (p.status === 'pending') timer.current = setTimeout(() => poll(id), 4000)
    } catch (e) { setError(e.message); timer.current = setTimeout(() => poll(id), 8000) }
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])

  const generate = async () => {
    setBusy(true); setError(''); setSimulated(null); clearTimeout(timer.current)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { payment: p } = await apiFetch('/api/admin/bakong/test', { method: 'POST', token: session?.access_token, body: { currency } })
      setPayment(p)
      timer.current = setTimeout(() => poll(p.id), 4000)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const sim = (s) => { clearTimeout(timer.current); setPayment(null); setError(''); setSimulated(s) }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2"><FlaskConical className="w-4 h-4 text-indigo-400" /><h2 className="font-semibold text-white">Test Bakong</h2></div>
      <p className="text-xs text-gray-400">
        <b>Generate test QR</b> calls the real server API and creates a tiny KHQR for your own account. It only becomes "paid" if the Bakong API
        genuinely reports a matching transaction (in <b>sandbox</b> mode that is NOT real money; in <b>production</b> mode it IS real money).
        <b> Preview states</b> are simulated UI only and never mean a payment happened.
      </p>
      <div className="flex flex-wrap gap-2 items-center">
        <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={`${inputCls} !w-auto`} aria-label="Test currency">
          <option>USD</option><option>KHR</option>
        </select>
        <button onClick={generate} disabled={busy} className={btnPrimary}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}Generate test QR</button>
        {['pending', 'paid', 'expired', 'failed'].map((s) => <button key={s} onClick={() => sim(s)} className={btnGhost}>Preview: {s}</button>)}
      </div>
      {error && <p className="text-sm text-red-400" role="alert">{error}</p>}

      {payment && (
        <div className="grid sm:grid-cols-2 gap-4 items-start">
          <div>
            <p className="text-xs mb-2"><span className="px-2 py-0.5 rounded-full border border-amber-500/40 text-amber-300">{payment.mode === 'sandbox' ? 'SANDBOX TEST' : 'PRODUCTION TEST - real money'}</span></p>
            <p className="text-sm text-gray-300">Status (from server): <b className="text-white">{payment.status}</b></p>
            {payment.status === 'paid' && <p className="text-xs text-green-400 mt-1">Verified by the Bakong API (matching transaction, amount, currency, recipient).</p>}
          </div>
          {payment.qr ? <KhqrCard name={payment.recipient.nameKm || payment.recipient.name} amount={payment.amount} currency={payment.currency} qr={payment.qr} size={200} /> : <p className="text-sm text-gray-400">QR no longer active.</p>}
        </div>
      )}

      {simulated && (
        <div className="rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/5 p-4" role="status">
          <p className="text-xs font-bold text-fuchsia-300 mb-2">SIMULATED UI PREVIEW - NOT A PAYMENT</p>
          {simulated === 'pending' && <p className="flex items-center gap-2 text-gray-200"><Loader2 className="w-4 h-4 animate-spin" /> Waiting for payment...</p>}
          {simulated === 'paid' && <p className="flex items-center gap-2 text-green-400"><CheckCircle2 className="w-5 h-5" /> Success modal would appear here (preview only)</p>}
          {simulated === 'expired' && <p className="flex items-center gap-2 text-gray-300"><XCircle className="w-5 h-5" /> This QR has expired</p>}
          {simulated === 'failed' && <p className="flex items-center gap-2 text-red-400"><XCircle className="w-5 h-5" /> Payment could not be verified</p>}
        </div>
      )}
    </Card>
  )
}

// ---------- Payment log ----------
export default function Payments() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [mode, setMode] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('payments')
      .select('id,created_at,paid_at,amount,currency,status,mode,is_test,tipper_name,message,bakong_hash,failure_reason')
      .order('created_at', { ascending: false }).limit(300)
    if (error) toast('error', error.message)
    setRows(data || [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => rows.filter((r) =>
    (status === 'all' || r.status === status) &&
    (mode === 'all' || (mode === 'test' ? r.is_test : mode === r.mode && !r.is_test)) &&
    (!q || [r.id, r.tipper_name, r.message, r.bakong_hash].some((v) => String(v || '').toLowerCase().includes(q.toLowerCase())))
  ), [rows, q, status, mode])

  const remove = async (r) => {
    if (!(await confirmDestructive('Delete this payment log?', 'This only removes the log entry, not the bank transaction.'))) return
    const { error } = await supabase.from('payments').delete().eq('id', r.id)
    if (error) return toast('error', error.message)
    toast('success', 'Deleted'); load()
  }

  const totals = useMemo(() => {
    const t = { USD: 0, KHR: 0 }
    rows.filter((r) => r.status === 'paid' && !r.is_test && r.mode === 'production').forEach((r) => { t[r.currency] += Number(r.amount) })
    return t
  }, [rows])

  return (
    <div className="space-y-6">
      <PageHeader icon={CreditCard} title="Payments" subtitle={loading ? 'Loading...' : `${rows.length} records - verified production total: $${formatAmount(totals.USD, 'USD')} + ${formatAmount(totals.KHR, 'KHR')} KHR`}>
        <button onClick={load} className={btnGhost} aria-label="Refresh"><RefreshCw className="w-4 h-4" /></button>
      </PageHeader>

      <TestBakong />

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]"><Search className="w-4 h-4 text-gray-500 absolute left-3 top-3" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, message, id, hash" className={`${inputCls} pl-9`} aria-label="Search payments" /></div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} !w-auto`} aria-label="Status filter">
            {['all', 'pending', 'paid', 'expired', 'cancelled', 'failed'].map((s) => <option key={s}>{s}</option>)}
          </select>
          <select value={mode} onChange={(e) => setMode(e.target.value)} className={`${inputCls} !w-auto`} aria-label="Mode filter">
            {['all', 'production', 'sandbox', 'test'].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase text-gray-500"><tr><th className="py-2 pr-3">Date</th><th className="pr-3">Amount</th><th className="pr-3">Status</th><th className="pr-3">Mode</th><th className="pr-3">From</th><th className="pr-3">Bakong hash</th><th /></tr></thead>
            <tbody className="text-gray-300">
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-white/5 align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="pr-3 whitespace-nowrap font-semibold">{formatAmount(r.amount, r.currency)} {r.currency}</td>
                  <td className="pr-3"><span className={`px-2 py-0.5 rounded-full text-xs border ${STATUS_STYLE[r.status]}`}>{r.status}</span>{r.failure_reason && <p className="text-[11px] text-red-400">{r.failure_reason}</p>}</td>
                  <td className="pr-3 whitespace-nowrap">{r.is_test ? 'TEST ' : ''}{r.mode}</td>
                  <td className="pr-3 max-w-[220px]"><span className="block truncate">{r.tipper_name || '-'}</span>{r.message && <span className="block truncate text-xs text-gray-500">{r.message}</span>}</td>
                  <td className="pr-3 max-w-[140px]"><span className="block truncate font-mono text-xs">{r.bakong_hash || '-'}</span></td>
                  <td><button onClick={() => remove(r)} className="p-2 text-gray-500 hover:text-red-400" aria-label="Delete payment log"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-gray-500">No payments found.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
