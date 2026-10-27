import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, Clock, Loader2, QrCode, XCircle, AlertTriangle, Heart, WifiOff } from 'lucide-react'
import { apiFetch } from '../utils/api'
import { useLang } from '../i18n/LanguageContext'
import KhqrCard, { formatAmount } from './KhqrCard'

const SESSION_KEY = 'tip_payment_id'
const POLL_MS = 4000
const MAX_BACKOFF_MS = 15000

const fmtClock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function SuccessModal({ payment, onClose, t }) {
  const btn = useRef(null)
  useEffect(() => {
    btn.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="tip-success-title">
      <div className="w-full max-w-sm bg-[#0b0820] border border-white/15 rounded-3xl p-8 text-center shadow-2xl">
        <div className="mx-auto w-20 h-20 rounded-full bg-green-500/15 flex items-center justify-center mb-5">
          <CheckCircle2 className="w-12 h-12 text-green-500" aria-hidden="true" />
        </div>
        <h3 id="tip-success-title" className="text-2xl font-bold text-white">{t('tip.successTitle')}</h3>
        <p className="mt-1 text-green-400 font-semibold">{formatAmount(payment.amount, payment.currency)} {payment.currency}</p>
        <p className="mt-3 text-gray-300 text-sm">{t('tip.successText')}</p>
        <button ref={btn} onClick={onClose} className="mt-6 w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-300">
          {t('tip.close')}
        </button>
      </div>
    </div>
  )
}

export default function TipJar() {
  const { t, lang } = useLang()
  const [config, setConfig] = useState(null)
  const [configError, setConfigError] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [amount, setAmount] = useState('')
  const [tipper, setTipper] = useState('')
  const [note, setNote] = useState('')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState('')
  const [payment, setPayment] = useState(null)
  const [netIssue, setNetIssue] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [showSuccess, setShowSuccess] = useState(false)
  const failures = useRef(0)

  // ---- load public config ----
  useEffect(() => {
    let off = false
    apiFetch('/api/bakong/config')
      .then((c) => { if (!off) setConfig(c) })
      .catch((e) => { if (!off) setConfigError(e.code === 'not_configured' ? t('tip.notConfigured') : e.message) })
    return () => { off = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- resume a pending payment after refresh ----
  useEffect(() => {
    const id = sessionStorage.getItem(SESSION_KEY)
    if (!id) return
    apiFetch(`/api/bakong/status/${id}`)
      .then(({ payment: p }) => { if (p.status === 'pending') setPayment(p); else sessionStorage.removeItem(SESSION_KEY) })
      .catch(() => sessionStorage.removeItem(SESSION_KEY))
  }, [])

  // ---- countdown ----
  useEffect(() => {
    if (payment?.status !== 'pending') return undefined
    const i = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(i)
  }, [payment?.status])

  // ---- safe polling (server verifies with Bakong; we only ever display the server's verdict) ----
  const id = payment?.id
  const status = payment?.status
  useEffect(() => {
    if (!id || status !== 'pending') return undefined
    let stop = false
    let timer
    const tick = async () => {
      if (stop) return
      if (document.hidden) { timer = setTimeout(tick, POLL_MS); return }
      try {
        const { payment: p } = await apiFetch(`/api/bakong/status/${id}`)
        failures.current = 0
        setNetIssue(false)
        if (stop) return
        setPayment(p)
        if (p.status !== 'pending') {
          sessionStorage.removeItem(SESSION_KEY)
          if (p.status === 'paid') setShowSuccess(true)
          return
        }
        timer = setTimeout(tick, POLL_MS)
      } catch (e) {
        if (stop) return
        if (e.code === 'not_found') { setPayment(null); sessionStorage.removeItem(SESSION_KEY); return }
        failures.current += 1
        setNetIssue(true)
        timer = setTimeout(tick, Math.min(POLL_MS * 2 ** failures.current, MAX_BACKOFF_MS))
      }
    }
    timer = setTimeout(tick, POLL_MS)
    return () => { stop = true; clearTimeout(timer) }
  }, [id, status])

  const limits = config?.limits?.[currency]

  const validate = useCallback(() => {
    const n = Number(amount)
    if (!amount || !Number.isFinite(n) || n <= 0) return 'Enter a valid amount.'
    if (currency === 'KHR' && !Number.isInteger(n)) return 'KHR must be a whole number.'
    if (currency === 'USD' && Math.round(n * 100) / 100 !== n) return 'USD allows at most 2 decimals.'
    if (limits && (n < limits.min || n > limits.max)) return `${t('tip.min')} ${limits.min} - ${t('tip.max')} ${limits.max} ${currency}`
    return ''
  }, [amount, currency, limits, t])

  const submit = async (e) => {
    e.preventDefault()
    if (creating) return // prevents duplicate submissions
    const msg = validate()
    setFormError(msg)
    if (msg) return
    setCreating(true)
    try {
      const { payment: p } = await apiFetch('/api/bakong/create', { method: 'POST', body: { amount: Number(amount), currency, name: tipper, message: note } })
      sessionStorage.setItem(SESSION_KEY, p.id)
      failures.current = 0
      setNetIssue(false)
      setNow(Date.now())
      setPayment(p)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const cancel = async () => {
    if (!payment) return
    try {
      const { payment: p } = await apiFetch(`/api/bakong/cancel/${payment.id}`, { method: 'POST' })
      setPayment(p)
      if (p.status === 'paid') setShowSuccess(true) // paid just before cancel: report the truth
    } catch (err) {
      setFormError(err.message)
    }
    sessionStorage.removeItem(SESSION_KEY)
  }

  const reset = () => { setPayment(null); setFormError(''); setNetIssue(false) }

  const recipientName = lang === 'km' && config?.recipient?.nameKm ? config.recipient.nameKm : config?.recipient?.name
  const remaining = payment?.expiresAt ? new Date(payment.expiresAt).getTime() - now : 0
  const inputCls = 'w-full p-3.5 bg-white/10 rounded-xl border border-white/20 placeholder-gray-500 text-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/40 transition-all'

  return (
    <section id="Tip" className="px-[5%] lg:px-[10%] py-12" aria-labelledby="tip-heading">
      <div className="text-center mb-8">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 text-xs font-medium">
          <Heart className="w-3.5 h-3.5" aria-hidden="true" /> {t('tip.eyebrow')}
        </span>
        <h2 id="tip-heading" className="mt-3 text-3xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#6366f1] to-[#a855f7]">{t('tip.title')}</h2>
        <p className="text-slate-400 max-w-2xl mx-auto text-sm md:text-base mt-2">{t('tip.subtitle')}</p>
      </div>

      <div className="max-w-3xl mx-auto bg-white/5 backdrop-blur-xl rounded-3xl p-5 sm:p-8 border border-white/10">
        {configError && (
          <p className="flex items-center gap-2 text-amber-300 text-sm" role="alert"><AlertTriangle className="w-4 h-4 shrink-0" /> {configError}</p>
        )}
        {!configError && !config && <p className="flex items-center gap-2 text-gray-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> ...</p>}
        {config && !config.enabled && <p className="text-amber-300 text-sm" role="status">{t('tip.disabled')}</p>}

        {config?.enabled && (
          <div className="grid md:grid-cols-2 gap-8 items-start">
            {/* LEFT: form or status */}
            <div className="order-2 md:order-1">
              {config.mode === 'sandbox' && (
                <p className="mb-4 text-xs rounded-lg px-3 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-300" role="note">{t('tip.sandbox')}</p>
              )}

              {!payment && (
                <form onSubmit={submit} className="space-y-4" noValidate>
                  <fieldset>
                    <legend className="text-xs text-gray-400 uppercase tracking-wider mb-1.5">{t('tip.currency')}</legend>
                    <div className="grid grid-cols-2 gap-2">
                      {['USD', 'KHR'].map((c) => (
                        <button key={c} type="button" onClick={() => { setCurrency(c); setAmount(''); setFormError('') }} aria-pressed={currency === c}
                          className={`py-2.5 rounded-xl border text-sm font-semibold transition-colors ${currency === c ? 'bg-gradient-to-r from-[#6366f1] to-[#a855f7] border-transparent text-white' : 'border-white/15 text-gray-300 hover:bg-white/5'}`}>
                          {c === 'USD' ? 'USD ($)' : 'KHR (៛)'}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <div>
                    <label htmlFor="tip-amount" className="text-xs text-gray-400 uppercase tracking-wider">{t('tip.amount')} ({currency})</label>
                    <div className="flex flex-wrap gap-2 my-2">
                      {(config.presets?.[currency] || []).map((p) => (
                        <button key={p} type="button" onClick={() => { setAmount(String(p)); setFormError('') }}
                          className="px-3 py-1.5 text-xs rounded-full border border-white/15 text-gray-300 hover:bg-white/10">{formatAmount(p, currency)}</button>
                      ))}
                    </div>
                    <input id="tip-amount" className={inputCls} inputMode="decimal" autoComplete="off" value={amount}
                      onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                      placeholder={limits ? `${limits.min} - ${limits.max}` : ''} aria-invalid={Boolean(formError)} aria-describedby="tip-error" />
                  </div>

                  <div>
                    <label htmlFor="tip-name" className="text-xs text-gray-400 uppercase tracking-wider">{t('tip.yourName')}</label>
                    <input id="tip-name" className={`${inputCls} mt-1`} maxLength={60} value={tipper} onChange={(e) => setTipper(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="tip-note" className="text-xs text-gray-400 uppercase tracking-wider">{t('tip.yourMessage')}</label>
                    <input id="tip-note" className={`${inputCls} mt-1`} maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} />
                  </div>

                  <p id="tip-error" className="min-h-[1.25rem] text-sm text-red-400" role="alert">{formError}</p>

                  <button type="submit" disabled={creating}
                    className="w-full bg-gradient-to-r from-[#6366f1] to-[#a855f7] text-white py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-[#6366f1]/20 transition-all">
                    {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <QrCode className="w-5 h-5" />}
                    {creating ? t('tip.generating') : t('tip.generate')}
                  </button>
                </form>
              )}

              {payment?.status === 'pending' && (
                <div className="space-y-4" role="status" aria-live="polite">
                  <div className="flex items-center gap-3 text-indigo-200">
                    <Loader2 className="w-5 h-5 animate-spin shrink-0" aria-hidden="true" />
                    <div><p className="font-semibold">{t('tip.waiting')}</p><p className="text-xs text-gray-400">{t('tip.waitingSub')}</p></div>
                  </div>
                  <p className="flex items-center gap-2 text-sm text-gray-300"><Clock className="w-4 h-4" aria-hidden="true" /> {t('tip.expiresIn')} <b className="tabular-nums">{fmtClock(remaining)}</b></p>
                  {netIssue && <p className="flex items-center gap-2 text-sm text-amber-300"><WifiOff className="w-4 h-4" aria-hidden="true" /> {t('tip.networkIssue')}</p>}
                  <p className="text-xs text-gray-400">{t('tip.scan')}</p>
                  <button onClick={cancel} className="px-4 py-2 rounded-xl border border-white/15 text-gray-300 hover:bg-white/5 text-sm">{t('tip.cancel')}</button>
                </div>
              )}

              {payment && payment.status !== 'pending' && payment.status !== 'paid' && (
                <div className="space-y-4" role="alert">
                  <p className="flex items-center gap-2 text-lg font-semibold text-white">
                    <XCircle className="w-6 h-6 text-red-400" aria-hidden="true" />
                    {payment.status === 'expired' ? t('tip.expired') : payment.status === 'cancelled' ? t('tip.cancelled') : t('tip.failed')}
                  </p>
                  {payment.failureReason && <p className="text-xs text-gray-400">{payment.failureReason === 'duplicate_transaction' ? 'This transaction was already used for another payment.' : payment.failureReason}</p>}
                  <button onClick={reset} className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#a855f7] text-white text-sm font-semibold">{t('tip.tryAgain')}</button>
                </div>
              )}

              {payment?.status === 'paid' && !showSuccess && (
                <div className="space-y-4">
                  <p className="flex items-center gap-2 text-lg font-semibold text-green-400"><CheckCircle2 className="w-6 h-6" /> {t('tip.successTitle')}</p>
                  <button onClick={reset} className="px-4 py-2 rounded-xl border border-white/15 text-gray-300 text-sm">{t('tip.tryAgain')}</button>
                </div>
              )}
            </div>

            {/* RIGHT: KHQR card (only ever rendered from a server-generated payload) */}
            <div className="order-1 md:order-2">
              {payment?.status === 'pending' && payment.qr ? (
                <KhqrCard name={recipientName} amount={payment.amount} currency={payment.currency} qr={payment.qr} />
              ) : (
                <div className="w-[300px] max-w-full mx-auto aspect-[2/3] rounded-2xl border border-dashed border-white/15 flex flex-col items-center justify-center text-gray-500 text-sm gap-2 p-6 text-center">
                  <QrCode className="w-10 h-10" aria-hidden="true" />
                  <span>{t('tip.recipient')}: {recipientName}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showSuccess && payment?.status === 'paid' && (
        <SuccessModal payment={payment} t={t} onClose={() => { setShowSuccess(false); reset() }} />
      )}
    </section>
  )
}
