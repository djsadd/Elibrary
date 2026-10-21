import { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { useFolioMotion } from "@/shared/ui/useFolioMotion";
import { designCopy } from "@/shared/designCopy";
import { t } from "@/shared/i18n";

export function PublicPageLayout({
  children,
  hero,
  maxWidthClassName = "max-w-4xl",
}: {
  children?: ReactNode;
  hero?: ReactNode;
  maxWidthClassName?: string;
}) {
  const location = useLocation();
  const copy=designCopy();
  const parent=location.pathname.startsWith('/public/students/')?'students':location.pathname.startsWith('/public/teachers/')?'teachers':null;
  const motionRef = useFolioMotion<HTMLDivElement>();
  const hasChildren =
    children !== undefined &&
    children !== null &&
    children !== false &&
    !(Array.isArray(children) && children.length === 0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const path = `${location.pathname}${location.search || ""}`;
    // Public pages only: ignore any non-public layouts just in case.
    if (!(path === "/public" || path.startsWith("/public/"))) return;

    const payload = {
      path,
      title: document.title || undefined,
      referrer: document.referrer || undefined,
    };

    const token = (() => {
      try {
        return localStorage.getItem("token") || sessionStorage.getItem("token");
      } catch {
        return null;
      }
    })();

    try {
      // keepalive makes it resilient to quick navigations / tab close
      fetch("/api/public/track", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        keepalive: true,
        body: JSON.stringify(payload),
      }).catch(() => {
        /* ignore */
      });
    } catch {
      /* ignore */
    }
  }, [location.pathname, location.search]);

  return (
    <div ref={motionRef} className={`public-layout min-h-screen ${hero ? "public-layout--home" : ""}`}>
      <a href="#public-content" className="public-skip">{copy.skip}</a>
      <PublicHeader />

      <main id="public-content" tabIndex={-1} className="public-main flex-1 w-full">
        {hero}
        {hasChildren ? (
          <div className={["mx-auto grid gap-6 px-4 py-8 w-full", maxWidthClassName].join(" ")}><nav className="public-breadcrumbs" aria-label={copy.navigation}><Link to="/public">{t('publicHome.nav.home')}</Link>{parent&&<><span aria-hidden="true">/</span><Link to={`/public/${parent}`}>{t(`publicHome.nav.${parent}`)}</Link></>}</nav>{children}</div>
        ) : null}
      </main>

      <PublicFooter />
    </div>
  );
}
