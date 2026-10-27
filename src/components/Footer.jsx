import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { useLang } from "../i18n/LanguageContext";

const Footer = () => {
  const { t } = useLang();
  const currentYear = new Date().getFullYear();

  return (
    <footer>
      <center>
        <hr className="my-3 border-gray-400 opacity-15 sm:mx-auto lg:my-6 text-center" />
        <span className="block text-sm pb-4 text-gray-500 text-center dark:text-gray-400">
          © {currentYear}{" "}
          <a href="https://masatoshi.com" className="hover:underline">
            Theng Seangheng™
          </a>
          . {t("footer.rights")}
        </span>
        <Link
          to="/login"
          aria-label="Admin login"
          className="inline-flex items-center gap-1.5 mb-4 px-3 py-1 rounded-full text-[11px] text-gray-500 border border-white/10 hover:text-white hover:border-indigo-500/40 transition-colors"
        >
          <Lock className="w-3 h-3" aria-hidden="true" /> Admin
        </Link>
      </center>
    </footer>
  );
};

export default Footer;