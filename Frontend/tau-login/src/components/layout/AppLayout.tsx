import { Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Footer from "./Footer";
import Sidebar from "./Sidebar";
import { SidebarProvider, useSidebar } from "../../shared/SidebarContext";
import { t } from "@/shared/i18n";

function LayoutInner() {
  const { isOpen, close, open } = useSidebar();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const nav = useNavigate();
  const closeSearch = () => setSearchOpen(false);

  useEffect(() => {
    if (!searchOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [searchOpen]);

  // When search overlay is open, submit on Enter to catalog results
  useEffect(() => {
    if (!searchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const q = (searchQuery || '').trim();
        if (q) {
          nav(`/search?q=${encodeURIComponent(q)}`);
          setSearchOpen(false);
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [searchOpen, searchQuery]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* fixed mobile hamburger so it's always reachable on small screens */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <button aria-label="Open menu" onClick={open} className="p-3 rounded-md bg-white shadow-sm hover:bg-slate-100 active:scale-[0.98]">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {/* main area: sidebar flush to the left on md+, overlay on small when open */}
      <div className="flex flex-1">
        {/* persistent sidebar on md+ */}
        <aside className="hidden md:block w-56 border-r bg-white">
          <Sidebar />
        </aside>

        {/* content area */}
        <main className="flex-1 p-6">
          {/* mobile top bar */}
          <div className="md:hidden mb-4 -mt-1">
            <div className="flex items-center justify-between">
              <button aria-label="Open menu" onClick={open} className="p-3 rounded-md hover:bg-slate-100">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div className="text-[#7b0f2b] font-semibold">TAU</div>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Search" onClick={() => setSearchOpen(true)} className="p-3 rounded-md hover:bg-slate-100">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 21l-4.35-4.35"/><circle cx="10" cy="10" r="6"/></svg>
                </button>
              </div>
            </div>
          </div>
          <Outlet />
        </main>
      </div>

      <Footer />

      {searchOpen && (
        <div
          className="md:hidden fixed inset-0 z-[55] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          role="dialog"
          aria-modal="true"
          onClick={closeSearch}
        >
          <div className="w-full max-w-xl" onClick={(event) => event.stopPropagation()}>
            <div className="rounded-[28px] border border-white/40 bg-white/80 p-5 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-[#7b0f2b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M21 21l-4.35-4.35" />
                  <circle cx="10" cy="10" r="6" />
                </svg>
                <input
                  type="search"
                  aria-label="Search"
                  placeholder={t("common.catalogSearchPlaceholder")}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="flex-1 bg-transparent text-lg font-medium text-slate-900 placeholder:text-slate-400 focus-visible:outline-none"
                  autoFocus
                />
                <button type="button" onClick={closeSearch} className="text-sm font-semibold text-[#7b0f2b]">
                  Отмена
                </button>
              </div>
              <p className="text-[11px] text-slate-600 text-center mt-3">
                Пока модальное окно только визуальное — поиск подключим позже.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* mobile overlay sidebar */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={close} />
          <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[84vw] bg-white border-r shadow-lg">
            <div className="p-4 flex justify-end">
              <button aria-label="Close menu" onClick={close} className="p-3 rounded-md hover:bg-slate-100">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <Sidebar />
          </div>
        </div>
      )}
    </div>
  );
}

export default function AppLayout() {
  return (
    <SidebarProvider>
      <LayoutInner />
    </SidebarProvider>
  );
}
