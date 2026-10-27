import { useCallback, useEffect, useMemo, useState } from "react";
import { Languages, Plus, Trash2 } from "lucide-react";
import { supabase } from "../../supabase";
import { DICT } from "../../lib/i18n";

// Overrides for UI strings. Saved rows win over the built-in dictionary immediately on reload.
export default function Translations() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ lang: "en", key: "", value: "" });
  const [msg, setMsg] = useState({ type: "", text: "" });

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("translations").select("*").order("key");
    if (error) setMsg({ type: "error", text: error.message }); else setRows(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (e) => {
    e.preventDefault();
    if (!DICT.en[form.key]) return setMsg({ type: "error", text: `Unknown key "${form.key}". Pick one from the list.` });
    if (!form.value.trim()) return setMsg({ type: "error", text: "Value is required." });
    const { error } = await supabase.from("translations").upsert({ lang: form.lang, key: form.key, value: form.value.trim() }, { onConflict: "lang,key" });
    setMsg(error ? { type: "error", text: error.message } : { type: "ok", text: "Saved. Reload the public site to see it." });
    if (!error) { setForm({ ...form, value: "" }); load(); }
  };
  const remove = async (r) => {
    if (!window.confirm(`Remove override ${r.lang}:${r.key}? The built-in text will be used again.`)) return;
    const { error } = await supabase.from("translations").delete().eq("id", r.id);
    if (error) setMsg({ type: "error", text: error.message }); load();
  };
  const shown = useMemo(() => rows.filter((r) => `${r.lang} ${r.key} ${r.value}`.toLowerCase().includes(q.toLowerCase())), [rows, q]);
  const cls = "bg-[#0d0d22] border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-500/60";

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2"><Languages className="w-5 h-5 text-indigo-400" aria-hidden="true" />Translations</h1>
      <form onSubmit={save} className="grid sm:grid-cols-[90px_1fr_2fr_auto] gap-2">
        <select aria-label="Language" value={form.lang} onChange={(e) => setForm({ ...form, lang: e.target.value })} className={cls}><option value="en">EN</option><option value="km">ខ្មែរ</option></select>
        <input aria-label="Key" list="tkeys" placeholder="Key (e.g. contact.send)" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} className={cls} required />
        <datalist id="tkeys">{Object.keys(DICT.en).map((k) => <option key={k} value={k} />)}</datalist>
        <input aria-label="Text" placeholder={form.key ? DICT[form.lang][form.key] || "" : "Text"} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className={cls} maxLength={500} required />
        <button className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm"><Plus className="w-4 h-4" aria-hidden="true" />Save</button>
      </form>
      <input aria-label="Search" placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} className={`${cls} w-full max-w-sm`} />
      {msg.text && <p role={msg.type === "error" ? "alert" : "status"} className={`p-3 rounded-xl text-sm border ${msg.type === "error" ? "bg-red-500/10 border-red-500/30 text-red-300" : "bg-green-500/10 border-green-500/30 text-green-300"}`}>{msg.text}</p>}
      <ul className="space-y-2">
        {shown.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="min-w-0"><p className="text-xs text-gray-500">{r.lang} · {r.key}</p><p className="text-sm text-white break-words">{r.value}</p></div>
            <button onClick={() => remove(r)} aria-label="Delete" className="p-2 rounded-lg border border-red-500/25 text-red-400 hover:bg-red-500/10 shrink-0"><Trash2 className="w-4 h-4" /></button>
          </li>
        ))}
        {shown.length === 0 && <li className="text-gray-500 text-sm">No overrides yet - the built-in EN/ខ្មែរ text is used.</li>}
      </ul>
    </div>
  );
}
