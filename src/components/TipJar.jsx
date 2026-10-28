import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, Loader2, XCircle, Clock, WifiOff, AlertTriangle } from "lucide-react";
import { apiFetch } from "../lib/api";
import { useLang } from "../lib/i18n";

const POLL_MS = 4000;
const MAX_NET_ERRORS_BEFORE_WARN = 2;
const fmt = (amount, currency) =>
  currency === "KHR" ? `${Number(amount).toLocaleString("en-US")} KHR` : `${Number(amount).toFixed(2)} USD`;

function useCountdown(expiresAt) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!expiresAt) return undefined;
    const tick = () => setLeft(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
}

// Official KHQR wordmark on the Bakong red header.
function KhqrHeader() {
  return (
    <div className="bg-[#e2232f] py-4 flex items-center justify-center">
      <img src="/khqr-logo.png" alt="KHQR" className="h-10 w-auto" draggable="false" />
    </div>
  );
}

// The Bakong-style card: red header, white body, dotted separator, KHQR with logo.
export function KhqrCard({ recipient, amount, currency, qr, children, badge }) {
  return (
    <div className="w-full max-w-sm mx-auto rounded-2xl overflow-hidden shadow-2xl bg-white text-gray-900">
      <KhqrHeader />
      {badge}
      <div className="px-6 pt-5 pb-3">
        <p className="text-sm text-gray-500">{recipient?.name}</p>
        <p className="text-3xl font-bold leading-tight">
          {currency === "KHR" ? Number(amount).toLocaleString("en-US") : Number(amount).toFixed(2)}
          <span className="text-base font-semibold ml-1">{currency}</span>
        </p>
      </div>
      <div className="border-t-2 border-dotted border-gray-300 mx-4" />
      <div className="p-5 flex justify-center">
        <QRCodeSVG
          value={qr}
          size={240}
          level="H"
          marginSize={1}
          className="w-full h-auto max-w-[260px]"
          imageSettings={{ src: "/bakong-logo.png", height: 48, width: 48, excavate: true }}
          title="Bakong KHQR"
        />
      </div>
      {children}
    </div>
  );
}

// Shown ONLY after the server reported status "confirmed" (verified against Bakong) - or in the labelled admin preview.
function SuccessModal({ payment, onClose, t, simulated = false }) {
  const btn = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    btn.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="tip-ok" aria-describedby="tip-ok-desc"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <style>{`
        @keyframes tipPop{0%{transform:scale(.3);opacity:0}70%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
        @keyframes tipDraw{to{stroke-dashoffset:0}}
        @keyframes tipRing{0%{transform:scale(.8);opacity:.6}100%{transform:scale(1.7);opacity:0}}
        .tip-ok-circle{animation:tipPop .55s cubic-bezier(.2,.9,.3,1.2) both}
        .tip-ok-check{stroke-dasharray:34;stroke-dashoffset:34;animation:tipDraw .45s .35s ease-out forwards}
        .tip-ok-ring{animation:tipRing 1.1s .2s ease-out both}
        @media (prefers-reduced-motion:reduce){.tip-ok-circle,.tip-ok-ring{animation:none}.tip-ok-check{animation:none;stroke-dashoffset:0}}
      `}</style>
      <div className="bg-white text-gray-900 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
        <div className="relative w-24 h-24 mx-auto" aria-hidden="true">
          <span className="tip-ok-ring absolute inset-0 rounded-full bg-green-400/40" />
          <svg viewBox="0 0 52 52" className="tip-ok-circle relative w-24 h-24">
            <circle cx="26" cy="26" r="25" fill="#22c55e" />
            <path className="tip-ok-check" d="M14 27 l8 8 16-17" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {simulated && <p className="mt-3 inline-block bg-amber-400 text-black text-xs font-bold px-2 py-1 rounded">SIMULATED - NOT A REAL PAYMENT</p>}
        <h3 id="tip-ok" className="text-2xl font-bold mt-5">{t("tip.successTitle")}</h3>
        <p className="text-lg font-semibold text-green-600 mt-1">{t("tip.thanks")}</p>
        <p className="mt-3 font-semibold">{fmt(payment.amount, payment.currency)}</p>
        <p id="tip-ok-desc" className="text-gray-600 mt-2 text-sm">{t("tip.successText")}</p>
        <button ref={btn} onClick={onClose} className="mt-6 w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold">{t("tip.close")}</button>
      </div>
    </div>
  );
}

/**
 * simulate (admin Test Bakong only): when set to "pending" | "expired" | "success" | "error" the card
 * RENDERS that state with a permanent "SIMULATED" banner and never calls the verification API.
 */
export default function TipJar({ preset = null, simulate = null, onPaymentCreated }) {
  const { t } = useLang();
  const [cfg, setCfg] = useState(null);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [payment, setPayment] = useState(preset);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [netWarn, setNetWarn] = useState(false);
  const [netDetail, setNetDetail] = useState("");
  const [showOk, setShowOk] = useState(false);
  const netErrors = useRef(0);
  const countdown = useCountdown(payment?.status === "pending" ? payment.expiresAt : null);

  const [simClosed, setSimClosed] = useState(false);
  useEffect(() => { setPayment(preset); }, [preset]);
  useEffect(() => { setSimClosed(false); }, [simulate]);

  useEffect(() => {
    let alive = true;
    apiFetch("/api/bakong/config")
      .then((c) => alive && setCfg(c))
      .catch((e) => alive && setCfg({ enabled: true, offline: e.message, currencies: ["USD", "KHR"], limits: { USD: { min: 0.01, max: 1000 }, KHR: { min: 100, max: 4000000 } }, recipient: null }));
    return () => { alive = false; };
  }, []);

  // Poll the SERVER (which verifies with Bakong). The UI never decides success by itself.
  useEffect(() => {
    if (simulate || !payment || payment.status !== "pending") return undefined;
    let stopped = false;
    let timer;
    const poll = async () => {
      try {
        const { payment: p } = await apiFetch("/api/bakong/check", { method: "POST", body: { token: payment.token } });
        if (stopped) return;
        netErrors.current = 0; setNetWarn(false);
        setPayment((cur) => ({ ...cur, ...p, qr: p.qr || cur.qr, token: cur.token }));
        if (p.status === "confirmed") { setShowOk(true); return; }
        if (p.status !== "pending") return;
      } catch (e) {
        if (stopped) return;
        netErrors.current += 1; setNetDetail(e.message || "");
        if (netErrors.current >= MAX_NET_ERRORS_BEFORE_WARN) setNetWarn(true);
        if (e.status === 404 || e.code === "bad_token") { setFormError(e.message); setPayment(null); return; }
      }
      timer = setTimeout(poll, POLL_MS + Math.min(netErrors.current, 5) * 2000); // gentle backoff
    };
    timer = setTimeout(poll, POLL_MS);
    return () => { stopped = true; clearTimeout(timer); };
  }, [payment?.id, payment?.token, payment?.status, simulate]); // eslint-disable-line react-hooks/exhaustive-deps

  const generate = useCallback(async (e) => {
    e.preventDefault();
    setFormError("");
    const n = Number(amount);
    if (!amount || !Number.isFinite(n) || n <= 0) return setFormError(t("tip.invalid"));
    setBusy(true);
    try {
      const { payment: p } = await apiFetch("/api/bakong/create", { method: "POST", body: { amount: n, currency } });
      netErrors.current = 0; setNetWarn(false);
      setPayment(p);
      onPaymentCreated?.(p);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }, [amount, currency, onPaymentCreated, t]);

  const cancel = async () => {
    try { const { payment: p } = await apiFetch("/api/bakong/cancel", { method: "POST", body: { token: payment.token } }); setPayment((c) => ({ ...c, ...p })); }
    catch (err) { setFormError(err.message); }
  };
  const reset = () => { setPayment(null); setAmount(""); setFormError(""); setNetWarn(false); setShowOk(false); };

  const status = simulate === "success" ? "simulated-success" : simulate === "expired" ? "expired" : payment?.status;
  const simBadge = simulate && (
    <div className="bg-amber-400 text-black text-xs font-bold text-center py-1.5 px-2">SIMULATED UI STATE - NOT A REAL PAYMENT</div>
  );
  const envBadge = !simulate && (cfg?.environment === "sandbox" || payment?.environment === "sandbox") && (
    <div className="bg-amber-100 text-amber-800 text-xs font-semibold text-center py-1">{t("tip.sandbox")}</div>
  );

  if (!cfg) return <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" aria-label="Loading" /></div>;
  if (!cfg.enabled && !payment) {
    return <p className="text-center text-gray-400 py-6" role="status">{t("tip.off")}{cfg.error ? ` (${cfg.error})` : ""}</p>;
  }

  // ---- Step 1: amount form ----
  if (!payment) {
    const lim = cfg.limits?.[currency];
    return (
      <form onSubmit={generate} noValidate className="w-full max-w-sm mx-auto rounded-2xl overflow-hidden bg-white text-gray-900 shadow-2xl">
        <KhqrHeader />
        {envBadge}
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-500">{t("tip.to")}: <b className="text-gray-900">{cfg.recipient?.name}</b></p>
          <div className="flex gap-2">
            <div className="flex-1">
              <label htmlFor="tip-amount" className="text-xs text-gray-500 font-medium">{t("tip.amount")}</label>
              <input id="tip-amount" inputMode="decimal" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder={currency === "USD" ? "1.00" : "4000"} aria-invalid={!!formError}
                className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2.5 text-lg focus:outline-none focus:ring-2 focus:ring-[#e1232e]" />
            </div>
            <div>
              <label htmlFor="tip-cur" className="text-xs text-gray-500 font-medium">{t("tip.currency")}</label>
              <select id="tip-cur" value={currency} onChange={(e) => setCurrency(e.target.value)}
                className="block mt-1 border border-gray-300 rounded-xl px-3 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-[#e1232e]">
                {(cfg.currencies || ["USD", "KHR"]).map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          {cfg.offline && <p role="alert" className="text-xs text-amber-700">{cfg.offline}</p>}
          {cfg.verification === false && <p className="text-xs text-amber-700">Payment auto-detection is not set up on the server yet (BAKONG_API_TOKEN), so the success popup will not appear automatically.</p>}
          {lim && <p className="text-xs text-gray-400">{lim.min} - {Number(lim.max).toLocaleString("en-US")} {currency}</p>}
          {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
          <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-[#e1232e] hover:bg-[#c81d27] disabled:opacity-60 text-white font-bold flex items-center justify-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}{busy ? t("tip.generating") : t("tip.generate")}
          </button>
        </div>
      </form>
    );
  }

  // ---- Step 2: QR + status ----
  const terminal = ["expired", "cancelled", "failed"].includes(status);
  return (
    <>
      <KhqrCard recipient={payment.recipient || cfg.recipient} amount={payment.amount} currency={payment.currency} qr={payment.qr || "EXPIRED"} badge={simBadge || envBadge}>
        <div className="px-6 pb-6 text-center space-y-3" aria-live="polite">
          {(status === "pending" || simulate === "pending") && (
            <>
              <p className="flex items-center justify-center gap-2 font-semibold text-gray-700"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />{t("tip.waiting")}</p>
              <p className="text-xs text-gray-500">{t("tip.waitingHint")}</p>
              <p className="text-sm text-gray-600 flex items-center justify-center gap-1"><Clock className="w-4 h-4" aria-hidden="true" />{t("tip.expiresIn")} {countdown}</p>
              {netWarn && <p role="alert" className="text-sm text-amber-700 flex items-center justify-center gap-1"><WifiOff className="w-4 h-4" aria-hidden="true" />{t("tip.netError")}{netDetail && <span className="block text-xs mt-1 text-left">{netDetail}</span>}</p>}
              {!simulate && <button onClick={cancel} className="text-sm text-gray-500 underline">{t("tip.cancel")}</button>}
            </>
          )}
          {simulate === "error" && <p role="alert" className="text-sm text-amber-700 flex items-center justify-center gap-1"><WifiOff className="w-4 h-4" aria-hidden="true" />{t("tip.netError")}</p>}
          {simulate === "success" && <p className="text-sm font-semibold text-gray-700">Success view preview only - no transaction was verified.</p>}
          {status === "expired" && <p role="alert" className="text-red-600 flex items-center justify-center gap-1"><Clock className="w-4 h-4" aria-hidden="true" />{t("tip.expired")}</p>}
          {status === "cancelled" && <p className="text-gray-600 flex items-center justify-center gap-1"><XCircle className="w-4 h-4" aria-hidden="true" />{t("tip.cancelled")}</p>}
          {status === "failed" && <p role="alert" className="text-red-600 text-sm flex items-start gap-1 text-left"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />{t("tip.failed")}</p>}
          {status === "confirmed" && !showOk && <p className="text-green-600 font-semibold flex items-center justify-center gap-1"><CheckCircle2 className="w-5 h-5" aria-hidden="true" />{t("tip.thanks")}</p>}
          {(terminal || status === "confirmed") && !simulate && (
            <button onClick={reset} className="w-full py-2.5 rounded-xl bg-[#e1232e] text-white font-semibold">{terminal ? t("tip.retry") : t("tip.new")}</button>
          )}
        </div>
      </KhqrCard>
      {formError && <p role="alert" className="text-center text-sm text-red-400 mt-2">{formError}</p>}
      {showOk && !simulate && <SuccessModal payment={payment} t={t} onClose={() => setShowOk(false)} />}
      {simulate === "success" && !simClosed && <SuccessModal simulated payment={{ amount: payment.amount, currency: payment.currency }} t={t} onClose={() => setSimClosed(true)} />}
    </>
  );
}
