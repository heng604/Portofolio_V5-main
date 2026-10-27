import { useCallback, useEffect, useMemo, useState } from "react";
import { Settings as Cog, Upload, Save, Search } from "lucide-react";
import { supabase } from "../../supabase";

// Every field is stored in public.site_settings as {"text": "..."} and is editable here.
const FIELDS = [
  ["cv_url", "CV / Resume URL (use the upload button)", "cv"],
  ["hero_title", "Hero title", "text"], ["hero_subtitle", "Hero subtitle", "text"],
  ["about_text", "About text", "area"], ["experience_text", "Experience", "area"], ["education_text", "Education", "area"],
  ["social_telegram", "Telegram link", "text"], ["social_github", "GitHub link", "text"],
  ["contact_email", "Contact email", "text"], ["contact_phone", "Contact phone", "text"],
  ["seo_title", "SEO title", "text"], ["seo_description", "SEO description", "area"],
  ["site_name", "Website name", "text"],
];
const MAX_CV = 10 * 1024 * 1024;

export default function Settings() {
  const [vals, setVals] = useState({});
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState("");
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("site_settings").select("key,value");
    if (error) setMsg({ type: "error", text: error.message });
    const o = {}; (data || []).forEach((r) => { o[r.key] = r.value?.text ?? ""; });
    setVals(o); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (key, text) => {
    setSaving(key); setMsg({ type: "", text: "" });
    const { error } = await supabase.from("site_settings").upsert({ key, value: { text }, is_public: true, updated_at: new Date().toISOString() });
    setSaving("");
    setMsg(error ? { type: "error", text: `Save failed: ${error.message}` } : { type: "ok", text: `Saved "${key}". It is live on the site.` });
  };

  const uploadCv = async (file) => {
    if (!file) return;
    if (file.type !== "application/pdf") return setMsg({ type: "error", text: "CV must be a PDF file." });
    if (file.size > MAX_CV) return setMsg({ type: "error", text: "CV must be 10 MB or smaller." });
    setSaving("cv_url");
    const name = `cv-${Date.now()}.pdf`;
    const { error } = await supabase.storage.from("site-files").upload(name, file, { contentType: "application/pdf" });
    if (error) { setSaving(""); return setMsg({ type: "error", text: `Upload failed: ${error.message}` }); }
    const url = supabase.storage.from("site-files").getPublicUrl(name).data.publicUrl;
    setVals((v) => ({ ...v, cv_url: url }));
    await save("cv_url", url);
  };

  const shown = useMemo(() => FIELDS.filter(([k, l]) => `${k} ${l}`.toLowerCase().includes(q.toLowerCase())), [q]);
  const cls = "w-full bg-[#0d0d22] border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-500/60";

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2"><Cog className="w-5 h-5 text-indigo-400" aria-hidden="true" />Site settings</h1>
      <div className="relative max-w-sm"><Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
        <input aria-label="Search settings" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search..." className={`${cls} pl-9`} /></div>
      {msg.text && <p role={msg.type === "error" ? "alert" : "status"} className={`p-3 rounded-xl text-sm border ${msg.type === "error" ? "bg-red-500/10 border-red-500/30 text-red-300" : "bg-green-500/10 border-green-500/30 text-green-300"}`}>{msg.text}</p>}
      {loading && <p className="text-gray-500 text-sm">Loading...</p>}
      <div className="grid gap-4">
        {shown.map(([key, label, kind]) => (
          <div key={key} className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
            <label htmlFor={key} className="text-xs text-indigo-300/70 uppercase tracking-wider font-medium">{label}</label>
            {kind === "area" ? <textarea id={key} rows={4} className={cls} value={vals[key] || ""} onChange={(e) => setVals((v) => ({ ...v, [key]: e.target.value }))} />
              : <input id={key} className={cls} value={vals[key] || ""} onChange={(e) => setVals((v) => ({ ...v, [key]: e.target.value }))} />}
            <div className="flex gap-2 items-center flex-wrap">
              <button onClick={() => save(key, vals[key] || "")} disabled={saving === key} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm"><Save className="w-4 h-4" aria-hidden="true" />{saving === key ? "Saving..." : "Save"}</button>
              {kind === "cv" && (
                <label className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/15 text-gray-200 text-sm cursor-pointer hover:bg-white/5">
                  <Upload className="w-4 h-4" aria-hidden="true" />Upload PDF
                  <input type="file" accept="application/pdf" className="hidden" onChange={(e) => uploadCv(e.target.files?.[0])} />
                </label>
              )}
              {kind === "cv" && vals.cv_url && <a href={vals.cv_url} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-300 underline">Open current CV</a>}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500">Currently the CV link (About page) reads from these settings live. Other fields are stored and editable, but the public pages still show their original built-in text until they are wired to read them.</p>
    </div>
  );
}
