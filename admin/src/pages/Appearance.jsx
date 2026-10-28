import { useState } from "react";
import { ExternalLink } from "lucide-react";
import Settings from "./content/Settings";

export default function Appearance() {
  const [nonce, setNonce] = useState(0);
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-bold text-white">Appearance & settings</h1>
        <p className="text-sm text-gray-400">A safe, structured settings system: SEO/metadata, section visibility, contact + social links and the CV. Each value is validated, saved to Supabase and recorded in the audit log.</p></div>
      <div className="grid xl:grid-cols-[1fr_22rem] gap-6 items-start">
        <Settings title="Site settings" groups={["SEO & metadata", "Sections & visibility", "Contact & social", "Resume"]} />
        <aside className="rounded-2xl border border-white/10 bg-white/5 p-3 xl:sticky xl:top-6 space-y-2" aria-label="Live preview">
          <div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-white">Live preview</h2>
            <div className="flex gap-2 items-center"><button onClick={() => setNonce((n) => n + 1)} className="text-xs px-2 py-1 rounded border border-white/15 text-gray-300 hover:bg-white/5">Reload</button>
              <a href="/" target="_blank" rel="noopener noreferrer" aria-label="Open public site" className="text-indigo-300"><ExternalLink className="w-4 h-4" /></a></div></div>
          <iframe key={nonce} title="Public site preview" src="/" className="w-full h-[28rem] rounded-xl border border-white/10 bg-black" loading="lazy" />
          <p className="text-xs text-gray-500">Save a field, then press Reload to see it on the public site.</p>
        </aside>
      </div>
      <p className="text-xs text-gray-500">Not editable from the dashboard (by design): source code, colors/typography tokens in the stylesheet, and anything secret (API tokens, Bakong account, Resend key) - those stay in the server environment. Tip text and currencies are edited under Portfolio content &rarr; Translations (keys starting with <code>tip.</code>) and Bakong limits come from the server.</p>
    </div>
  );
}
