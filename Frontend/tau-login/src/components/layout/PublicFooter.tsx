import { Link } from "react-router-dom";
import { t } from "@/shared/i18n";

export function PublicFooter({ maxWidthClassName = "max-w-7xl xl:max-w-screen-2xl" }: { maxWidthClassName?: string }) {
  return (
    <footer className="bg-[color:var(--public-accent)] text-white">
      <div className={["mx-auto w-full px-4 py-10", maxWidthClassName].join(" ")}>
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <div className="text-sm font-semibold">{t("publicHome.footer.contactsTitle")}</div>
            <div className="mt-3 text-sm text-white/80 whitespace-pre-line">{t("publicHome.footer.address")}</div>
          </div>

          <div>
            <div className="text-sm font-semibold">{t("publicHome.footer.hoursTitle")}</div>
            <div className="mt-3 text-sm text-white/80 whitespace-pre-line">{t("publicHome.footer.hoursValue")}</div>
          </div>

          <div>
            <div className="text-sm font-semibold">{t("publicHome.footer.quickTitle")}</div>
            <div className="mt-3 flex flex-col gap-2 text-sm text-white/80">
              <Link to="/public/resources" className="hover:text-white">
                {t("publicHome.nav.resources")}
              </Link>
              <Link to="/public/links" className="hover:text-white">
                {t("publicHome.nav.links")}
              </Link>
              <Link to="/public/about" className="hover:text-white">
                {t("publicHome.nav.about")}
              </Link>
              <Link to="/auth/login" className="hover:text-white">
                {t("publicHome.actions.login")}
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-white/15 pt-6 text-xs text-white/70 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>{t("publicHome.footer.left")}</div>
          <div className="flex items-center gap-3">
            <Link to="/public/about" className="hover:text-white">
              {t("publicHome.footer.about")}
            </Link>
            <Link to="/public/links" className="hover:text-white">
              {t("publicHome.footer.links")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

