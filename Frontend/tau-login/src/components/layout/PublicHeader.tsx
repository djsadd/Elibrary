import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import LanguageSwitcher from "@/components/common/LanguageSwitcher";
import { NavDropdown } from "@/components/common/NavDropdown";
import { UsefulLinksDropdown } from "@/components/common/UsefulLinksDropdown";
import { t } from "@/shared/i18n";
import logoUrl from "@/assets/images/Logo.svg";
import logoWhiteUrl from "@/assets/images/LogoWhite.png";

const PUBLIC_A11Y_STORAGE_KEY = "public_a11y_mode";

type ContentMenuItem = {
  id: number;
  title: string;
  path?: string | null;
  children: ContentMenuItem[];
};

function readA11yModeFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(PUBLIC_A11Y_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function readHasTokenFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(localStorage.getItem("token") || sessionStorage.getItem("token"));
  } catch {
    return false;
  }
}

export function PublicHeader() {
  const location = useLocation();
  const [mobileMenuMounted, setMobileMenuMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [a11yMode, setA11yMode] = useState(readA11yModeFromStorage);
  const [hasToken, setHasToken] = useState(readHasTokenFromStorage);
  const [contentMenu, setContentMenu] = useState<ContentMenuItem[]>([]);

  const openMobileMenu = () => {
    setMobileMenuMounted(true);
    requestAnimationFrame(() => setMobileMenuOpen(true));
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    window.setTimeout(() => setMobileMenuMounted(false), 220);
  };

  useEffect(() => {
    if (!mobileMenuMounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobileMenu();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileMenuMounted]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("public-theme");
    root.classList.toggle("public-a11y", a11yMode);
    try {
      localStorage.setItem(PUBLIC_A11Y_STORAGE_KEY, a11yMode ? "1" : "0");
    } catch {
      // ignore
    }
    return () => {
      root.classList.remove("public-theme");
      root.classList.remove("public-a11y");
    };
  }, [a11yMode]);

  useEffect(() => {
    const update = () => setHasToken(readHasTokenFromStorage());
    update();
    window.addEventListener("storage", update);
    window.addEventListener("auth:changed", update as EventListener);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("auth:changed", update as EventListener);
    };
  }, []);

  useEffect(() => {
    const loadMenu = async () => {
      try {
        const response = await fetch("/api/catalog/public/content/menu");
        if (!response.ok) return;
        const data = await response.json();
        setContentMenu(Array.isArray(data) ? data : []);
      } catch {
        setContentMenu([]);
      }
    };
    void loadMenu();
  }, []);

  const teachersItems = [
    { label: "Все материалы", to: "/public/teachers" },
    { label: "Индекс цитирования", to: "/public/teachers/citation-index" },
    { label: "ГОСТы на оформление научных публикаций", to: "/public/teachers/gost-publications" },
    { label: "Порядок подачи заявок на приобретение литературы", to: "/public/teachers/acquisition-requests" },
  ];

  const studentsItems = [
    { label: "Все материалы", to: "/public/students" },
    { label: "Инструкции по базам данных", to: "/public/students/database-instructions" },
    { label: "Библиографический список литературы", to: "/public/students/bibliographic-list" },
    { label: "Индекс УДК/ББК", to: "/public/students/udc-bbk" },
    { label: "Утрата библиотечной книги", to: "/public/students/lost-book" },
    { label: "Цифровые копии книг", to: "/public/students/digital-copies" },
    { label: "Читальный зал", to: "/public/students/reading-room" },
  ];

  const tone = a11yMode ? "default" : "inverse";
  const headerClassName = [
    "sticky top-0 z-40",
    a11yMode
      ? "bg-white shadow-[0_1px_0_rgba(17,24,39,0.12)]"
      : "bg-[color:var(--public-accent)] shadow-[0_1px_0_rgba(0,0,0,0.18)]",
  ].join(" ");

  const brandTextClassName = a11yMode ? "text-slate-900" : "text-white";
  const subtitleClassName = a11yMode ? "text-slate-500" : "text-white/70";
  const navLinkClassName = a11yMode
    ? "rounded-xl px-4 py-2 text-base font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition"
    : "rounded-xl px-4 py-2 text-base font-medium text-white/90 hover:bg-white/10 hover:text-white transition";
  const mobileButtonClassName = a11yMode
    ? "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
    : "inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15";

  const a11yButtonClassName = a11yMode
    ? "rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
    : "rounded-xl border border-white/25 bg-white/10 px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/15";

  const loginButtonClassName = a11yMode
    ? "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
    : "inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[color:var(--public-accent)] hover:bg-white/90";

  const registerButtonClassName = a11yMode
    ? "inline-flex items-center gap-2 rounded-xl bg-[color:var(--public-accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--public-accent-hover)]"
    : "inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/15";

  const ctaTo = hasToken ? "/" : "/auth/login";
  const ctaLabel = hasToken ? t("publicHome.actions.cabinet") : t("publicHome.actions.loginSystem");
  const ctaClassName = a11yMode ? registerButtonClassName : loginButtonClassName;
  const isPublicHome = location.pathname === "/public";
  const activeNavClassName = a11yMode ? "bg-slate-100 text-slate-900" : "bg-white/15 text-white";
  const hasDynamicMenu = contentMenu.length > 0;

  const isExternal = (href?: string | null) => Boolean(href && /^https?:\/\//i.test(href));

  return (
    <>
      <header className={headerClassName}>
        <div className="mx-auto grid w-full max-w-7xl xl:max-w-screen-2xl grid-cols-[auto_1fr_auto] items-center gap-6 px-4 py-4 sm:py-5">
          <Link to="/public" className="flex items-center gap-3">
            <img
              src={a11yMode ? logoUrl : logoWhiteUrl}
              alt={t("publicHome.logoAlt")}
              className="shrink-0 h-10 sm:h-11 w-auto max-w-none object-contain"
            />
            <div className="hidden sm:block leading-tight">
              <div className={["text-sm font-semibold", brandTextClassName].join(" ")}>{t("publicHome.brand")}</div>
              <div className={["text-[11px]", subtitleClassName].join(" ")}>{t("publicHome.subtitle")}</div>
            </div>
          </Link>

          <div className="lg:hidden flex items-center justify-center">
            <button type="button" onClick={openMobileMenu} className={mobileButtonClassName} aria-label="Open menu">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              </svg>
              <span className="hidden sm:inline">{t("publicHome.nav.home")}</span>
            </button>
          </div>

          <nav className={["hidden lg:flex items-center justify-center gap-1 text-sm"].join(" ")}>
            <Link to="/public" className={[navLinkClassName, isPublicHome ? activeNavClassName : ""].join(" ")}>
              {t("publicHome.nav.home")}
            </Link>
            {hasDynamicMenu ? (
              contentMenu.map((item) =>
                item.children?.length ? (
                  <NavDropdown
                    key={item.id}
                    label={item.title}
                    items={item.children.map((child) => ({
                      label: child.title,
                      to: !isExternal(child.path) ? child.path || "#" : undefined,
                      href: child.path || undefined,
                      external: isExternal(child.path),
                    }))}
                    variant={a11yMode ? "default" : "inverse"}
                  />
                ) : isExternal(item.path) ? (
                  <a
                    key={item.id}
                    href={item.path || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className={navLinkClassName}
                  >
                    {item.title}
                  </a>
                ) : (
                  <Link key={item.id} to={item.path || "#"} className={navLinkClassName}>
                    {item.title}
                  </Link>
                ),
              )
            ) : (
              <>
                <NavDropdown
                  label={t("publicHome.nav.teachers")}
                  items={teachersItems}
                  variant={a11yMode ? "default" : "inverse"}
                />
                <NavDropdown
                  label={t("publicHome.nav.students")}
                  items={studentsItems}
                  variant={a11yMode ? "default" : "inverse"}
                />
                <div>
                  <UsefulLinksDropdown variant="header" basePath="/public/links" tone={tone} />
                </div>
                <Link to="/public/about" className={navLinkClassName}>
                  {t("publicHome.nav.about")}
                </Link>
                <Link to="/public/resources" className={navLinkClassName}>
                  {t("publicHome.nav.resources")}
                </Link>
              </>
            )}
          </nav>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setA11yMode((v) => !v)}
              aria-pressed={a11yMode}
              aria-label={a11yMode ? t("publicHome.a11y.disable") : t("publicHome.a11y.enable")}
              className={a11yButtonClassName}
              title={a11yMode ? t("publicHome.a11y.disable") : t("publicHome.a11y.enable")}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M1.5 12s3.8-7 10.5-7 10.5 7 10.5 7-3.8 7-10.5 7S1.5 12 1.5 12Z" />
                <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
              </svg>
            </button>
            <LanguageSwitcher className="hidden sm:flex" tone={tone} />
            <Link to={ctaTo} className={ctaClassName}>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M15 7a4 4 0 1 1-6 0 4 4 0 0 1 6 0Z" />
                <path d="M4 20a8 8 0 0 1 16 0" strokeLinecap="round" />
              </svg>
              {ctaLabel}
            </Link>
          </div>
        </div>
      </header>

      {mobileMenuMounted && (
        <div className="lg:hidden fixed inset-0 z-[60] isolate">
          <div
            className={[
              "absolute inset-0 bg-black/70 transition-opacity duration-200 ease-out",
              mobileMenuOpen ? "opacity-100" : "opacity-0",
            ].join(" ")}
            onClick={closeMobileMenu}
          />
          <div
            className={[
              "absolute left-0 top-0 bottom-0 w-80 max-w-[88vw] bg-white border-r shadow-2xl backdrop-blur-none",
              "transition-transform duration-200 ease-out will-change-transform",
              mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-3 p-4 border-b bg-white">
              <img src={logoUrl} alt={t("publicHome.logoAlt")} className="h-9 w-auto object-contain" />
              <button type="button" onClick={closeMobileMenu} className="rounded-full p-2 hover:bg-slate-100" aria-label="Close menu">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="p-4 bg-white">
              <LanguageSwitcher className="mb-4" />
              <button
                type="button"
                onClick={() => setA11yMode((v) => !v)}
                aria-pressed={a11yMode}
                className="mb-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                {a11yMode ? t("publicHome.a11y.disable") : t("publicHome.a11y.enable")}
              </button>
              <nav className="space-y-1">
                <Link to="/public" onClick={closeMobileMenu} className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                  {t("publicHome.nav.home")}
                </Link>

                {hasDynamicMenu ? (
                  contentMenu.map((item) => (
                    <div key={item.id} className="pt-2">
                      {item.children?.length ? (
                        <>
                          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{item.title}</div>
                          <div className="space-y-1">
                            {item.children.map((child) =>
                              isExternal(child.path) ? (
                                <a
                                  key={child.id}
                                  href={child.path || "#"}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={closeMobileMenu}
                                  className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                                >
                                  {child.title}
                                </a>
                              ) : (
                                <Link
                                  key={child.id}
                                  to={child.path || "#"}
                                  onClick={closeMobileMenu}
                                  className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                                >
                                  {child.title}
                                </Link>
                              ),
                            )}
                          </div>
                        </>
                      ) : isExternal(item.path) ? (
                        <a
                          href={item.path || "#"}
                          target="_blank"
                          rel="noreferrer"
                          onClick={closeMobileMenu}
                          className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          {item.title}
                        </a>
                      ) : (
                        <Link
                          to={item.path || "#"}
                          onClick={closeMobileMenu}
                          className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          {item.title}
                        </Link>
                      )}
                    </div>
                  ))
                ) : (
                  <>
                    <div className="pt-2">
                      <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("publicHome.nav.teachers")}</div>
                      <div className="space-y-1">
                        {teachersItems.map((item) => (
                          <Link key={item.to} to={item.to} onClick={closeMobileMenu} className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2">
                      <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t("publicHome.nav.students")}</div>
                      <div className="space-y-1">
                        {studentsItems.map((item) => (
                          <Link key={item.to} to={item.to} onClick={closeMobileMenu} className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    </div>

                    <Link to="/public/links" onClick={closeMobileMenu} className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                      {t("publicHome.nav.links")}
                    </Link>
                    <Link to="/public/about" onClick={closeMobileMenu} className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                      {t("publicHome.nav.about")}
                    </Link>
                    <Link to="/public/resources" onClick={closeMobileMenu} className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                      {t("publicHome.nav.resources")}
                    </Link>
                  </>
                )}
              </nav>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
