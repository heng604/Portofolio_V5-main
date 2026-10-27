import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { useLang } from "../lib/i18n";

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { t } = useLang();

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
          {/* Small admin entry. Only a link: access is enforced server-side + by database policies. */}
          <Link
            to="/login"
            title={t("footer.admin")}
            aria-label={t("footer.admin")}
            className="inline-flex align-middle ml-3 p-1.5 rounded-md text-gray-600 hover:text-indigo-300 hover:bg-white/5 transition-colors"
          >
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </span>
      </center>
    </footer>
  );
};

export default Footer;
