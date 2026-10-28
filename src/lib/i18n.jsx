import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

// Built-in dictionary (works offline / without database). Rows in the Supabase
// `translations` table override these keys, so the admin can edit texts without code.
export const DICT = {
  en: {
    "nav.home": "Home", "nav.about": "About", "nav.portfolio": "Portofolio", "nav.tip": "Tip", "nav.contact": "Contact",
    "lang.toggle": "Switch language",
    "footer.rights": "All Rights Reserved.", "footer.admin": "Admin login",
    "contact.title": "Contact Me", "contact.subtitle": "Got a question? Send me a message and I'll get back to you.",
    "contact.name": "Name", "contact.email": "Email", "contact.subject": "Subject", "contact.message": "Message",
    "contact.send": "Send Message", "contact.sending": "Sending...", "contact.ok": "Message sent!", "contact.okText": "Thanks, I'll reply soon.",
    "contact.fail": "Could not send", "contact.dup": "You already sent this message.",
    "tip.title": "Support me with a tip", "tip.subtitle": "Pay with any Bakong-supported banking app by scanning the KHQR.",
    "tip.amount": "Amount", "tip.currency": "Currency", "tip.generate": "Generate KHQR", "tip.generating": "Generating...",
    "tip.scan": "Scan with your banking app", "tip.waiting": "Waiting for payment...", "tip.waitingHint": "This page checks with Bakong automatically. Do not close it.",
    "tip.cancel": "Cancel", "tip.new": "New tip", "tip.retry": "Try again", "tip.expiresIn": "Expires in",
    "tip.expired": "This QR code has expired.", "tip.cancelled": "Payment cancelled.", "tip.failed": "The payment could not be verified as matching. Contact me if you were charged.",
    "tip.netError": "Connection problem while checking the payment. Retrying...",
    "tip.successTitle": "Payment Successful!", "tip.thanks": "Thank you for the coffee!", "tip.successText": "Your support means a lot to me. Thank you for supporting my work.", "tip.close": "Close",
    "tip.to": "Recipient", "tip.sandbox": "TEST MODE - not real money", "tip.off": "Tips are not available right now.",
    "tip.invalid": "Enter a valid amount.",
    "login.title": "Admin sign in", "login.sub": "Only the site owner can sign in.", "login.google": "Continue with Google", "login.back": "Back to site",
    "nf.title": "404 - Page not found", "nf.text": "The page you are looking for does not exist.",
  },
  km: {
    "nav.home": "ទំព័រដើម", "nav.about": "អំពីខ្ញុំ", "nav.portfolio": "ផលប័ត្រ", "nav.tip": "គាំទ្រ", "nav.contact": "ទំនាក់ទំនង",
    "lang.toggle": "ប្តូរភាសា",
    "footer.rights": "រក្សាសិទ្ធិគ្រប់យ៉ាង។", "footer.admin": "ចូលជាអ្នកគ្រប់គ្រង",
    "contact.title": "ទំនាក់ទំនងខ្ញុំ", "contact.subtitle": "មានសំណួរមែនទេ? ផ្ញើសារមកខ្ញុំ ខ្ញុំនឹងឆ្លើយតបវិញ។",
    "contact.name": "ឈ្មោះ", "contact.email": "អ៊ីមែល", "contact.subject": "ប្រធានបទ", "contact.message": "សារ",
    "contact.send": "ផ្ញើសារ", "contact.sending": "កំពុងផ្ញើ...", "contact.ok": "បានផ្ញើសារហើយ!", "contact.okText": "អរគុណ ខ្ញុំនឹងឆ្លើយតបឆាប់ៗ។",
    "contact.fail": "មិនអាចផ្ញើបាន", "contact.dup": "អ្នកបានផ្ញើសារនេះរួចហើយ។",
    "tip.title": "គាំទ្រខ្ញុំដោយការបរិច្ចាគ", "tip.subtitle": "ស្កេន KHQR ដោយប្រើកម្មវិធីធនាគារណាមួយដែលគាំទ្រ Bakong។",
    "tip.amount": "ចំនួនទឹកប្រាក់", "tip.currency": "រូបិយប័ណ្ណ", "tip.generate": "បង្កើត KHQR", "tip.generating": "កំពុងបង្កើត...",
    "tip.scan": "ស្កេនជាមួយកម្មវិធីធនាគាររបស់អ្នក", "tip.waiting": "កំពុងរង់ចាំការទូទាត់...", "tip.waitingHint": "ទំព័រនេះពិនិត្យជាមួយ Bakong ដោយស្វ័យប្រវត្តិ។ សូមកុំបិទ។",
    "tip.cancel": "បោះបង់", "tip.new": "ការបរិច្ចាគថ្មី", "tip.retry": "ព្យាយាមម្តងទៀត", "tip.expiresIn": "ផុតកំណត់ក្នុង",
    "tip.expired": "QR នេះបានផុតកំណត់ហើយ។", "tip.cancelled": "បានបោះបង់ការទូទាត់។", "tip.failed": "មិនអាចផ្ទៀងផ្ទាត់ការទូទាត់ថាត្រូវគ្នាបានទេ។ សូមទាក់ទងខ្ញុំប្រសិនបើអ្នកត្រូវបានកាត់ប្រាក់។",
    "tip.netError": "មានបញ្ហាការតភ្ជាប់ពេលពិនិត្យការទូទាត់។ កំពុងព្យាយាមម្តងទៀត...",
    "tip.successTitle": "ទូទាត់ជោគជ័យ!", "tip.thanks": "អរគុណសម្រាប់កាហ្វេ!", "tip.successText": "ការគាំទ្ររបស់អ្នកមានន័យច្រើនសម្រាប់ខ្ញុំ។ សូមអរគុណដែលគាំទ្រការងាររបស់ខ្ញុំ។", "tip.close": "បិទ",
    "tip.to": "អ្នកទទួល", "tip.sandbox": "របៀបសាកល្បង - មិនមែនលុយពិតទេ", "tip.off": "ការបរិច្ចាគមិនទាន់អាចប្រើបានទេ។",
    "tip.invalid": "សូមបញ្ចូលចំនួនទឹកប្រាក់ត្រឹមត្រូវ។",
    "login.title": "ចូលជាអ្នកគ្រប់គ្រង", "login.sub": "មានតែម្ចាស់គេហទំព័រប៉ុណ្ណោះដែលអាចចូលបាន។", "login.google": "បន្តជាមួយ Google", "login.back": "ត្រឡប់ទៅគេហទំព័រ",
    "nf.title": "404 - រកមិនឃើញទំព័រ", "nf.text": "ទំព័រដែលអ្នករកមិនមានទេ។",
  },
};

const Ctx = createContext({ lang: "en", setLang: () => {}, t: (k) => k });
const KEY = "lang";

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try { const v = localStorage.getItem(KEY); return v === "km" || v === "en" ? v : "en"; } catch { return "en"; }
  });
  const [overrides, setOverrides] = useState({ en: {}, km: {} });

  useEffect(() => {
    document.documentElement.lang = lang === "km" ? "km" : "en";
    try { localStorage.setItem(KEY, lang); } catch { /* storage may be blocked */ }
  }, [lang]);

  // Optional DB overrides (editable in the admin dashboard > Translations)
  useEffect(() => {
    let alive = true;
    supabase.from("translations").select("lang,key,value").then(({ data }) => {
      if (!alive || !data) return;
      const o = { en: {}, km: {} };
      data.forEach((r) => { if (o[r.lang]) o[r.lang][r.key] = r.value; });
      setOverrides(o);
    });
    return () => { alive = false; };
  }, []);

  const setLang = useCallback((l) => setLangState(l === "km" ? "km" : "en"), []);
  const t = useCallback((key) => overrides[lang]?.[key] ?? DICT[lang]?.[key] ?? DICT.en[key] ?? key, [lang, overrides]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useLang = () => useContext(Ctx);
