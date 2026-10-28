import { Lock } from "lucide-react";
import { useLang } from "../lib/i18n";
import { useSettings } from "../lib/useSetting";

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { t } = useLang();
  const cfg = useSettings();

  return (
    <footer>
      <center>
        <hr className="my-3 border-gray-400 opacity-15 sm:mx-auto lg:my-6 text-center" />
        {(cfg.contact_email || cfg.contact_phone || cfg.social_telegram) && (
          <p className="text-sm text-gray-400 pb-2 flex flex-wrap gap-x-4 justify-center">
            {cfg.contact_email && <a className="hover:underline" href={`mailto:${cfg.contact_email}`}>{cfg.contact_email}</a>}
            {cfg.contact_phone && <a className="hover:underline" href={`tel:${cfg.contact_phone}`}>{cfg.contact_phone}</a>}
            {cfg.social_telegram && <a className="hover:underline" href={cfg.social_telegram} target="_blank" rel="noopener noreferrer">Telegram</a>}
          </p>
        )}
        <span className="block text-sm pb-4 text-gray-500 text-center dark:text-gray-400">
          © {currentYear}{" "}
          <a href="https://masatoshi.com" className="hover:underline">
            {cfg.footer_name || "Theng Seangheng™"}
          </a>
          . {t("footer.rights")}
          {/* Small admin entry. Only a link: access is enforced server-side + by database policies. */}
          <a
            href="/admin/"
            title={t("footer.admin")}
            aria-label={t("footer.admin")}
            className="inline-flex align-middle ml-3 p-1.5 rounded-md text-gray-600 hover:text-indigo-300 hover:bg-white/5 transition-colors"
          >
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        </span>
      </center>
    </footer>
  );
};

export default Footer;
