import { useCallback, useEffect, useMemo, useState } from "react";
import { Settings as Cog, Upload, Save, Search } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { refreshSettings } from "../../lib/useSetting";

// Every field is stored in public.site_settings as {"text": "..."} and is editable here.
const FIELDS = [
  // [key, label, kind, group]
  ["site_name", "Website name", "text", "SEO & metadata"], ["seo_title", "SEO title", "text", "SEO & metadata"], ["seo_description", "SEO description", "area", "SEO & metadata"],
  ["cv_url", "CV / Resume (use the upload button)", "cv", "Resume"],
  ["hero_title", "Hero title (e.g. Networking Engineer)", "text", "Home"], ["hero_subtitle", "Hero description", "area", "Home"],
  ["hero_words", "Typing words (comma separated)", "text", "Home"], ["hero_image", "Hero image / animation", "img", "Home"],
  ["home_badge", "Badge text (Ready to Innovate)", "text", "Home"], ["home_btn_projects", "Button: Projects", "text", "Home"], ["home_btn_contact", "Button: Contact", "text", "Home"],
  ["social_github", "GitHub link", "text", "Contact & social"], ["social_facebook", "Facebook link", "text", "Contact & social"], ["social_instagram", "Instagram link", "text", "Contact & social"],
  ["about_title", "Section title (About Me)", "text", "About"], ["about_subtitle", "Section subtitle", "text", "About"],
  ["about_name", "Name shown on About", "text", "About"], ["about_text", "About text", "area", "About"], ["about_quote", "About quote", "text", "About"],
  ["profile_image", "Profile photo", "img", "About"],
  ["experience_title", "Experience heading", "text", "About"], ["experience_text", "Experience (blank = hidden)", "area", "About"],
  ["education_title", "Education heading", "text", "About"], ["education_text", "Education (blank = hidden)", "area", "About"],
  ["stat_projects_label", "Stat 1 label", "text", "About stats"], ["stat_projects_desc", "Stat 1 description", "text", "About stats"],
  ["stat_certs_label", "Stat 2 label", "text", "About stats"], ["stat_certs_desc", "Stat 2 description", "text", "About stats"],
  ["stat_exp_value", "Stat 3 number (months)", "text", "About stats"], ["stat_exp_label", "Stat 3 label", "text", "About stats"], ["stat_exp_desc", "Stat 3 description", "text", "About stats"],
  ["portfolio_title", "Section title (Portfolio Showcase)", "text", "Portfolio"], ["portfolio_subtitle", "Section description", "area", "Portfolio"],
  ["tab_projects", "Tab: Projects", "text", "Portfolio"], ["tab_certs", "Tab: Certificates", "text", "Portfolio"], ["tab_tech", "Tab: Tech Stack", "text", "Portfolio"],
  ["contact_title", "Contact title", "text", "Contact & social"], ["contact_subtitle", "Contact description", "area", "Contact & social"],
  ["contact_email", "Contact email (shown in footer)", "text", "Contact & social"], ["contact_phone", "Contact phone (shown in footer)", "text", "Contact & social"],
  ["social_telegram", "Telegram link (shown in footer)", "text", "Contact & social"], ["footer_name", "Footer name", "text", "Contact & social"],
  ["section_about", "About section", "toggle", "Sections & visibility"], ["section_portfolio", "Portfolio section", "toggle", "Sections & visibility"],
  ["section_tip", "Tip / coffee section", "toggle", "Sections & visibility"], ["section_contact", "Contact section", "toggle", "Sections & visibility"],
  ["og_image", "Open Graph (share) image", "img", "SEO & metadata"],
];
const MAX_CV = 10 * 1024 * 1024;
const MAX_IMG = 5 * 1024 * 1024;

export default function Settings({ groups = null, title = "Site settings" }) {
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

  const validate = (key, text) => {
    const v = (text || "").trim();
    if (!v) return "";
    if (/^(social_|og_image|cv_url|hero_image|profile_image)/.test(key) && !/^(https?:\/\/|\/)/i.test(v)) return "Must be a link starting with https:// (or / for a file on this site).";
    if (key === "contact_email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Enter a valid email address.";
    if (v.length > 5000) return "Too long (max 5000 characters).";
    return "";
  };
  const save = async (key, text) => {
    const problem = validate(key, text);
    if (problem) return setMsg({ type: "error", text: `${key}: ${problem}` });
    setSaving(key); setMsg({ type: "", text: "" });
    const { error } = await supabase.from("site_settings").upsert({ key, value: { text }, is_public: true, updated_at: new Date().toISOString() });
    setSaving("");
    if (!error) refreshSettings();
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

  const uploadImg = async (key, file) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) return setMsg({ type: "error", text: "Image must be JPG, PNG, WEBP or GIF." });
    if (file.size > MAX_IMG) return setMsg({ type: "error", text: "Image must be 5 MB or smaller." });
    setSaving(key);
    const name = `${key}-${Date.now()}.${file.type.split("/")[1]}`;
    const { error } = await supabase.storage.from("site-files").upload(name, file, { contentType: file.type });
    if (error) { setSaving(""); return setMsg({ type: "error", text: `Upload failed: ${error.message}` }); }
    const url = supabase.storage.from("site-files").getPublicUrl(name).data.publicUrl;
    setVals((v) => ({ ...v, [key]: url }));
    await save(key, url);
  };

  const shown = useMemo(() => FIELDS.filter(([k, l, , g]) => (!groups || groups.includes(g)) && `${k} ${l} ${g}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => (groups ? groups.indexOf(a[3]) - groups.indexOf(b[3]) : 0)), [q, groups]);
  const cls = "w-full bg-[#0d0d22] border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-500/60";

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2"><Cog className="w-5 h-5 text-indigo-400" aria-hidden="true" />{title}</h1>
      <div className="relative max-w-sm"><Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
        <input aria-label="Search settings" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search..." className={`${cls} pl-9`} /></div>
      {msg.text && <p role={msg.type === "error" ? "alert" : "status"} className={`p-3 rounded-xl text-sm border ${msg.type === "error" ? "bg-red-500/10 border-red-500/30 text-red-300" : "bg-green-500/10 border-green-500/30 text-green-300"}`}>{msg.text}</p>}
      {loading && <p className="text-gray-500 text-sm">Loading...</p>}
      <div className="grid gap-4">
        {shown.map(([key, label, kind, group], idx) => (
          <div key={key} className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
            {(idx === 0 || shown[idx - 1][3] !== group) && <h2 className="text-sm font-semibold text-white pt-2">{group}</h2>}
            <label htmlFor={key} className="text-xs text-indigo-300/70 uppercase tracking-wider font-medium">{label}</label>
            {kind === "toggle" ? (
              <select id={key} className={cls} value={vals[key] || "show"} onChange={(e) => setVals((v) => ({ ...v, [key]: e.target.value }))}>
                <option value="show">Visible</option><option value="hidden">Hidden</option>
              </select>
            ) : kind === "area" ? <textarea id={key} rows={4} className={cls} value={vals[key] || ""} onChange={(e) => setVals((v) => ({ ...v, [key]: e.target.value }))} />
              : <input id={key} className={cls} value={vals[key] || ""} onChange={(e) => setVals((v) => ({ ...v, [key]: e.target.value }))} />}
            <div className="flex gap-2 items-center flex-wrap">
              <button onClick={() => save(key, vals[key] || (kind === "toggle" ? "show" : ""))} disabled={saving === key} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm"><Save className="w-4 h-4" aria-hidden="true" />{saving === key ? "Saving..." : "Save"}</button>
              {kind === "cv" && (
                <label className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/15 text-gray-200 text-sm cursor-pointer hover:bg-white/5">
                  <Upload className="w-4 h-4" aria-hidden="true" />Upload PDF
                  <input type="file" accept="application/pdf" className="hidden" onChange={(e) => uploadCv(e.target.files?.[0])} />
                </label>
              )}
              {kind === "img" && (
                <label className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/15 text-gray-200 text-sm cursor-pointer hover:bg-white/5">
                  <Upload className="w-4 h-4" aria-hidden="true" />Upload image
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => uploadImg(key, e.target.files?.[0])} />
                </label>
              )}
              {kind === "img" && vals[key] && <img src={vals[key]} alt="" className="h-12 w-12 rounded-lg object-cover border border-white/10" />}
              {kind === "cv" && vals.cv_url && <a href={vals.cv_url} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-300 underline">Open current CV</a>}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500">Empty fields fall back to the built-in text, so the site never shows a blank. Saved values go live on the next page load.</p>
    </div>
  );
}
