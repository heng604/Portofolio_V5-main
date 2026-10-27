import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock3, LoaderCircle, QrCode, XCircle } from 'lucide-react';

const API = import.meta.env.VITE_API_BASE_URL || '';
const formatAmount = (amount, currency) => `${Number(amount).toLocaleString(undefined, { minimumFractionDigits: currency === 'USD' ? 2 : 0, maximumFractionDigits: currency === 'USD' ? 2 : 0 })} ${currency}`;

export default function TipJar() {
  const [amount, setAmount] = useState('1.00');
  const [currency, setCurrency] = useState('USD');
  const [payment, setPayment] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [testResult, setTestResult] = useState('');
  const pollLock = useRef(false);

  useEffect(() => {
    if (!payment?.paymentId || status !== 'pending') return undefined;
    let cancelled = false;
    const check = async () => {
      if (pollLock.current) return;
      pollLock.current = true;
      try {
        const response = await fetch(`${API}/api/tips/${encodeURIComponent(payment.paymentId)}/status`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not verify payment status.');
        if (cancelled) return;
        if (data.status === 'success') setStatus('success');
        else if (data.status === 'expired') setStatus('expired');
      } catch (e) { if (!cancelled) setError(e.message); }
      finally { pollLock.current = false; }
    };
    check();
    const timer = setInterval(check, 5000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [payment?.paymentId, status]);

  const createQr = async (event) => {
    event.preventDefault(); setError(''); setTestResult(''); setPayment(null); setStatus('creating');
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || (currency === 'KHR' && !Number.isInteger(numericAmount))) {
      setStatus('idle'); setError(currency === 'KHR' ? 'Enter a positive whole-number KHR amount.' : 'Enter a valid positive amount.'); return;
    }
    try {
      const response = await fetch(`${API}/api/tips`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: numericAmount, currency }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not generate a KHQR.');
      setPayment(data); setStatus('pending');
    } catch (e) { setStatus('idle'); setError(e.message || 'Payment service unavailable.'); }
  };

  const cancelPayment = async () => {
    if (payment?.paymentId && status === 'pending') {
      try { await fetch(`${API}/api/tips/${encodeURIComponent(payment.paymentId)}/cancel`, { method: 'POST' }); } catch { /* UI cancellation still proceeds; server expiry remains the fallback. */ }
    }
    setPayment(null); setStatus('idle'); setError('');
  };

  const runTest = async () => {
    setError(''); setTestResult('');
    try {
      const { supabase } = await import('../../supabase');
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${API}/api/admin/bakong-test`, { method: 'POST', headers: { Authorization: `Bearer ${session?.access_token || ''}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Admin test failed.');
      setTestResult(`${data.message} Mode: ${data.mode}.`);
    } catch (e) { setError(e.message); }
  };

  return <section id="Tips" className="px-[5%] lg:px-[10%] py-14 sm:py-20">
    <div className="max-w-3xl mx-auto text-center mb-8" data-aos="fade-up">
      <p className="text-xs uppercase tracking-[.25em] text-red-300 mb-3">Support my work</p>
      <h2 className="text-3xl md:text-5xl font-bold text-white">Buy me a coffee</h2>
      <p className="mt-3 text-slate-400">Send a voluntary tip securely with Bakong KHQR. Payment is marked successful only after server-side transaction verification.</p>
    </div>
    <div className="max-w-[420px] mx-auto overflow-hidden rounded-2xl bg-white text-neutral-950 shadow-2xl" aria-live="polite">
      <div className="relative bg-[#d50000] text-white text-center py-4 rounded-t-2xl"><div className="font-bold text-2xl tracking-wide">KHQR</div><div className="absolute right-0 -bottom-7 border-t-[28px] border-t-[#d50000] border-l-[28px] border-l-transparent" /></div>
      <div className="px-6 pt-5 pb-4"><p className="text-sm text-neutral-600">Recipient</p><p className="text-lg font-semibold">{payment?.recipientName || 'Theng Seangheng'}</p><p className="text-2xl font-bold mt-1">{payment ? formatAmount(payment.amount, payment.currency) : `${currency === 'USD' ? Number(amount || 0).toFixed(2) : Number(amount || 0).toLocaleString()} ${currency}`}</p><div className="border-b border-dashed border-neutral-400 mt-4" /></div>
      <div className="px-5 pb-5">
        {!payment && <form onSubmit={createQr} className="space-y-3 mb-5">
          <label className="block text-sm font-medium">Tip amount</label>
          <div className="flex gap-2"><input aria-label="Tip amount" inputMode="decimal" type="number" min={currency === 'USD' ? '0.01' : '100'} step={currency === 'USD' ? '0.01' : '1'} required value={amount} onChange={e => setAmount(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-red-500"/><select aria-label="Currency" value={currency} onChange={e => { setCurrency(e.target.value); setAmount(e.target.value === 'USD' ? '1.00' : '4000'); }} className="rounded-lg border border-neutral-300 px-3 py-2.5"><option value="USD">USD</option><option value="KHR">KHR</option></select></div>
          <button disabled={status === 'creating'} className="w-full rounded-lg bg-[#d50000] hover:bg-red-700 text-white font-semibold py-3 flex items-center justify-center gap-2 disabled:opacity-60">{status === 'creating' ? <LoaderCircle className="animate-spin" size={18}/> : <QrCode size={18}/>} Generate payment QR</button>
        </form>}
        {payment && <div className="text-center">
          <div className="relative mx-auto w-full max-w-[280px] aspect-square p-2 bg-white">{payment.qrImage && <img src={payment.qrImage} alt="Bakong KHQR payment code" className="w-full h-full object-contain"/>}<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full w-8 h-8 bg-[#e51b23] border-4 border-white flex items-center justify-center shadow"><span aria-hidden="true" className="text-white text-sm font-black">K</span></div></div>
          <p className="font-semibold mt-2">{status === 'success' ? 'Payment verified' : status === 'expired' ? 'QR expired' : 'Waiting for payment'}</p>
          <p className="text-xs text-neutral-500 mt-1">{payment.mode === 'sandbox' ? 'SANDBOX MODE — test environment' : 'Production payment'}</p>
          {status === 'pending' && <p className="flex items-center justify-center gap-2 text-sm text-neutral-600 mt-3"><Clock3 size={16}/> Awaiting server verification…</p>}
          {status === 'expired' && <div className="mt-3 text-red-700 text-sm flex justify-center gap-2"><XCircle size={17}/>This QR expired. Generate a new one to try again.</div>}
          <button onClick={cancelPayment} className="mt-4 w-full rounded-lg border border-neutral-300 py-2.5 font-medium hover:bg-neutral-50">{status === 'pending' ? 'Cancel / start over' : 'Create another tip'}</button>
        </div>}
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</p>}
        {window.location.pathname.startsWith('/dashboard') && <button onClick={runTest} className="mt-4 text-xs underline text-neutral-500">Test Bakong status UI (simulation only)</button>}
        {testResult && <p className="mt-2 text-xs text-amber-800 bg-amber-50 p-3 rounded-lg">{testResult}</p>}
      </div>
    </div>
    {status === 'success' && <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="tip-success-title" aria-describedby="tip-success-description" className="w-full max-w-sm rounded-3xl bg-white p-7 text-center text-slate-900 shadow-2xl animate-[fadeIn_.25s_ease-out]">
        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-green-100 ring-8 ring-green-50">
          <CheckCircle2 size={60} strokeWidth={2.5} className="text-green-600" aria-hidden="true"/>
        </div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-green-700">Payment verified</p>
        <h3 id="tip-success-title" className="text-2xl font-extrabold text-green-700">Payment Successful!</h3>
        <p id="tip-success-description" className="mt-3 text-sm leading-6 text-slate-600">Thank you for your support. Your Bakong payment has been confirmed by the server.</p>
        <div className="mt-5 rounded-xl border border-green-100 bg-green-50 p-4 text-left">
          <div className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-500">Amount paid</span><strong className="text-slate-900">{formatAmount(payment?.amount, payment?.currency)}</strong></div>
          <div className="mt-2 flex items-center justify-between gap-3 text-sm"><span className="text-slate-500">Status</span><span className="inline-flex items-center gap-1.5 font-semibold text-green-700"><CheckCircle2 size={16}/> Verified</span></div>
        </div>
        <button type="button" onClick={() => { setPayment(null); setStatus('idle'); setError(''); }} className="mt-6 w-full rounded-xl bg-green-600 px-4 py-3 font-bold text-white transition hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-200">Done</button>
      </div>
    </div>}
  </section>;
}
