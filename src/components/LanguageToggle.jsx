import { useEffect, useState } from 'react';
export default function LanguageToggle() {
  const [language, setLanguage] = useState(() => localStorage.getItem('portfolio-language') || 'en');
  useEffect(() => { document.documentElement.lang = language === 'km' ? 'km' : 'en'; localStorage.setItem('portfolio-language', language); window.dispatchEvent(new CustomEvent('portfolio-language-change', { detail: language })); }, [language]);
  return <div className="fixed right-3 top-24 z-40 flex rounded-full border border-white/15 bg-[#0a0a1a]/90 p-1 shadow-xl backdrop-blur" aria-label="Choose language"><button aria-pressed={language === 'en'} onClick={() => setLanguage('en')} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${language === 'en' ? 'bg-indigo-500 text-white' : 'text-gray-300'}`}>EN</button><button aria-pressed={language === 'km'} onClick={() => setLanguage('km')} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${language === 'km' ? 'bg-indigo-500 text-white' : 'text-gray-300'}`}>ខ្មែរ</button></div>;
}
