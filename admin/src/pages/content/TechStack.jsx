import { useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, Plus, Trash2, Eye, EyeOff, Download, Upload } from "lucide-react";
import builtIn from "@portfolio/data/techStack";
import { supabase } from "../../lib/supabase";

export default function TechStack() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ name: "", category: "general", icon_url: "" });
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("tech_stack").select("*").order("sort_order").order("id");
    if (error) setMsg({ type: "error", text: error.message }); else setRows(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async (e) => {
    e.preventDefault();
    if (form.name.trim().length < 1) return setMsg({ type: "error", text: "Name is required." });
    setBusy(true);
    const { error } = await supabase.from("tech_stack").insert({ name: form.name.trim(), category: form.category.trim() || "general", icon_url: form.icon_url.trim() || null, sort_order: rows.length });
    setBusy(false);
    if (error) return setMsg({ type: "error", text: error.message });
    setForm({ name: "", category: "general", icon_url: "" }); setMsg({ type: "ok", text: "Added." }); load();
  };
  const importBuiltIn = async () => {
    if (rows.length && !window.confirm("The table already has items. Import the built-in list anyway (may create duplicates)?")) return;
    const payload = builtIn.flatMap((g, gi) => g.items.map((it, i) => ({ name: it.language, category: g.title, icon_url: `/${it.icon}`, sort_order: gi * 100 + i })));
    setBusy(true);
    const { error } = await supabase.from("tech_stack").insert(payload);
    setBusy(false);
    setMsg(error ? { type: "error", text: error.message } : { type: "ok", text: `Imported ${payload.length} items. You can now edit/hide/delete each one.` }); load();
  };
  const uploadIcon = async (file) => {
    if (!file) return;
    if (!["image/png", "image/svg+xml", "image/webp", "image/jpeg"].includes(file.type) || file.size > 2 * 1024 * 1024) return setMsg({ type: "error", text: "Icon must be PNG/SVG/WEBP/JPG up to 2 MB." });
    const name = `tech-${Date.now()}.${file.type === "image/svg+xml" ? "svg" : file.type.split("/")[1]}`;
    const { error } = await supabase.storage.from("project-images").upload(name, file, { contentType: file.type });
    if (error) return setMsg({ type: "error", text: `Upload failed: ${error.message}` });
    setForm((f) => ({ ...f, icon_url: supabase.storage.from("project-images").getPublicUrl(name).data.publicUrl }));
    setMsg({ type: "ok", text: "Icon uploaded. Press Add to save the item." });
  };
  const toggle = async (r) => { const { error } = await supabase.from("tech_stack").update({ is_published: !r.is_published }).eq("id", r.id); if (error) setMsg({ type: "error", text: error.message }); load(); };
  const remove = async (r) => {
    if (!window.confirm(`Delete "${r.name}"?`)) return;
    const { error } = await supabase.from("tech_stack").delete().eq("id", r.id);
    setMsg(error ? { type: "error", text: error.message } : { type: "ok", text: "Deleted." }); load();
  };
  const shown = useMemo(() => rows.filter((r) => `${r.name} ${r.category}`.toLowerCase().includes(q.toLowerCase())), [rows, q]);
  const cls = "bg-[#0d0d22] border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-500/60";

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2"><Boxes className="w-5 h-5 text-indigo-400" aria-hidden="true" />Tech stack</h1>
      <form onSubmit={add} className="grid sm:grid-cols-[1fr_1fr_1fr_auto] gap-2">
        <input aria-label="Name" placeholder="Name (e.g. Wireshark)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={cls} maxLength={60} required />
        <input aria-label="Category" placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={cls} />
        <input aria-label="Icon URL" placeholder="Icon URL (optional)" value={form.icon_url} onChange={(e) => setForm({ ...form, icon_url: e.target.value })} className={cls} />
        <button disabled={busy} className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm"><Plus className="w-4 h-4" aria-hidden="true" />Add</button>
      </form>
      <div className="flex flex-wrap gap-2">
        <label className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/15 text-gray-200 text-sm cursor-pointer hover:bg-white/5"><Upload className="w-4 h-4" aria-hidden="true" />Upload icon<input type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" className="hidden" onChange={(e) => uploadIcon(e.target.files?.[0])} /></label>
        <button type="button" onClick={importBuiltIn} disabled={busy} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/15 text-gray-200 text-sm hover:bg-white/5 disabled:opacity-50"><Download className="w-4 h-4" aria-hidden="true" />Import built-in stack</button>
      </div>
      <input aria-label="Search" placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} className={`${cls} w-full max-w-sm`} />
      {msg.text && <p role={msg.type === "error" ? "alert" : "status"} className={`p-3 rounded-xl text-sm border ${msg.type === "error" ? "bg-red-500/10 border-red-500/30 text-red-300" : "bg-green-500/10 border-green-500/30 text-green-300"}`}>{msg.text}</p>}
      <ul className="space-y-2">
        {shown.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="min-w-0"><p className="text-white text-sm font-medium truncate">{r.name}</p><p className="text-xs text-gray-500">{r.category}</p></div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => toggle(r)} aria-label={r.is_published ? "Unpublish" : "Publish"} className="p-2 rounded-lg border border-white/10 text-gray-300 hover:bg-white/5">{r.is_published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}</button>
              <button onClick={() => remove(r)} aria-label="Delete" className="p-2 rounded-lg border border-red-500/25 text-red-400 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button>
            </div>
          </li>
        ))}
        {shown.length === 0 && <li className="text-gray-500 text-sm">Nothing yet.</li>}
      </ul>
      <p className="text-xs text-gray-500">The public Tech Stack tab shows these items grouped by Category. While this list is empty it shows the built-in icons; use "Import built-in stack" once to start editing them.</p>
    </div>
  );
}
