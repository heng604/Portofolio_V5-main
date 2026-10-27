import { useLang } from '../i18n/LanguageContext'

export default function LanguageToggle({ className = '' }) {
  const { lang, setLang, t } = useLang()
  const base = 'px-3 py-1 text-xs font-semibold rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400'
  return (
    <div role="group" aria-label={t('lang.label')} className={`inline-flex items-center gap-1 p-1 rounded-full bg-white/5 border border-white/10 ${className}`}>
      <button type="button" onClick={() => setLang('en')} aria-pressed={lang === 'en'}
        className={`${base} ${lang === 'en' ? 'bg-gradient-to-r from-[#6366f1] to-[#a855f7] text-white' : 'text-gray-300 hover:text-white'}`}>EN</button>
      <button type="button" onClick={() => setLang('km')} aria-pressed={lang === 'km'}
        className={`${base} ${lang === 'km' ? 'bg-gradient-to-r from-[#6366f1] to-[#a855f7] text-white' : 'text-gray-300 hover:text-white'}`}>ខ្មែរ</button>
    </div>
  )
}
