import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

// ---- Toasts ----
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((text, type = "ok") => {
    const id = Math.random().toString(36).slice(2);
    setItems((l) => [...l, { id, text, type }]);
    setTimeout(() => setItems((l) => l.filter((i) => i.id !== id)), type === "error" ? 7000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[200] space-y-2 w-[min(92vw,22rem)]" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} role={i.type === "error" ? "alert" : "status"} className={`flex items-start gap-2 p-3 rounded-xl border text-sm shadow-xl backdrop-blur ${i.type === "error" ? "bg-red-950/90 border-red-500/40 text-red-200" : "bg-emerald-950/90 border-emerald-500/40 text-emerald-200"}`}>
            {i.type === "error" ? <XCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />}
            <span className="flex-1">{i.text}</span>
            <button aria-label="Dismiss" onClick={() => setItems((l) => l.filter((x) => x.id !== i.id))}><X className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---- Modal / drawer with Escape + focus handling ----
export function Dialog({ title, onClose, children, side = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className={`fixed inset-0 z-[150] bg-black/70 flex ${side ? "justify-end" : "items-center justify-center p-4"}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
        className={`bg-[#0a0a1f] border border-white/10 shadow-2xl overflow-y-auto outline-none ${side ? "w-full max-w-md h-full p-5" : "w-full max-w-md rounded-2xl p-6"}`}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-white">{title}</h2>
          <button aria-label="Close" onClick={onClose} className="p-1 text-gray-400 hover:text-white"><X className="w-5 h-5" /></button></div>
        {children}
      </div>
    </div>
  );
}

export function Skeleton({ className = "h-24" }) { return <div className={`skeleton ${className}`} aria-hidden="true" />; }
export function ErrorBox({ message, onRetry }) {
  return (
    <div role="alert" className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center justify-between gap-3 flex-wrap">
      <span>{message}</span>{onRetry && <button onClick={onRetry} className="px-3 py-1.5 rounded-lg border border-red-400/40 hover:bg-red-500/10">Retry</button>}
    </div>
  );
}
export const money = (n, c) => (c === "KHR" ? `${Number(n).toLocaleString("en-US")} KHR` : `$${Number(n).toFixed(2)}`);
export const when = (d) => (d ? new Date(d).toLocaleString() : "-");
// DB status 'confirmed' means "verified by the server against Bakong".
export const STATUS_LABEL = { confirmed: "verified", pending: "pending", failed: "failed", expired: "expired", cancelled: "cancelled" };
export const STATUS_CLS = {
  confirmed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", pending: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  failed: "bg-red-500/15 text-red-300 border-red-500/30", expired: "bg-gray-500/15 text-gray-300 border-gray-500/30", cancelled: "bg-gray-500/15 text-gray-400 border-gray-500/30",
};
export const StatusBadge = ({ s }) => <span className={`px-2 py-0.5 rounded-full border text-xs ${STATUS_CLS[s] || ""}`}>{STATUS_LABEL[s] || s}</span>;
