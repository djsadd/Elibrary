import BookCard from "@/components/common/BookCard";
import CatalogSearch from "@/components/common/CatalogSearch";
import LibraryIcon from "@/components/common/LibraryIcon";
import { designCopy } from "@/shared/designCopy";
import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import DashboardHeader from "../../components/layout/DashboardHeader";
import { t } from "@/shared/i18n";
import { api } from "@/shared/api/client";

type Book = {
  id: number | string;
  title: string;
  year?: string | null;
  lang?: string | null;
  pub_info?: string | null;
  summary?: string | null;
  cover?: string | null;
  file_id?: string | null;
  download_url?: string | null;
  authors?: string[];
  subjects?: string[];
};

type BookListResponse = {
  items: Book[];
  page?: { limit: number; offset: number; total: number };
};

type FiltersResponse = {
  authors: string[];
  subjects: string[];
  langs: string[];
  years: Array<string | number>;
};

type FilterDropdownProps = {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  searchPlaceholder: string;
  allLabel: string;
  noMatchesLabel: string;
  onChange: (value: string) => void;
};

const FilterDropdown = ({
  label,
  value,
  options,
  placeholder,
  searchPlaceholder,
  allLabel,
  noMatchesLabel,
  onChange,
}: FilterDropdownProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current && !ref.current.contains(t)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDocClick);
    return () => { document.removeEventListener("mousedown", onDocClick); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const filtered = query
    ? options.filter((s) => s.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    : options;

  return (
    <div className="filter-field">
      <div className="text-xs font-medium text-slate-600">{label}</div>
      <div ref={ref} className="relative mt-1">
        <button
          type="button"
          aria-label={label}
          aria-expanded={open}
          onClick={() => {
            setOpen((prev) => {
              const next = !prev;
              if (next) setQuery("");
              return next;
            });
          }}
          className="w-full border border-slate-200 rounded-full px-3 py-2 text-sm text-left bg-white flex items-center justify-between gap-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#b51e3e]"
        >
          <span className={value ? "text-slate-900" : "text-slate-400"}>
            {value || placeholder}
          </span>
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {open && (
          <div className="absolute z-20 mt-2 w-full bg-white border border-slate-200 rounded-2xl shadow-lg p-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={searchPlaceholder}
              autoFocus
              placeholder={searchPlaceholder}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-[#b51e3e]"
            />
            <div className="max-h-56 overflow-auto">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-slate-50 flex items-center justify-between gap-2 ${!value ? "bg-slate-50" : ""}`}
              >
                <span className="text-slate-800">{allLabel}</span>
                {!value ? (
                  <svg className="w-4 h-4 text-emerald-600" viewBox="0 0 20 20" fill="none" aria-hidden>
                    <path d="M16 6l-7 7-3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </button>
              {filtered.length ? (
                filtered.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      onChange(s);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-slate-50 flex items-center justify-between gap-2 ${
                      s === value ? "bg-slate-50 text-slate-900" : "text-slate-700"
                    }`}
                  >
                    <span className="truncate">{s}</span>
                    {s === value ? (
                      <svg className="w-4 h-4 text-emerald-600 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden>
                        <path d="M16 6l-7 7-3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-slate-400">{noMatchesLabel}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default function CatalogListPage() {
  const [sp, setSp] = useSearchParams();
  const q = (sp.get('q') || '').trim();
  const author = (sp.get('author') || '').trim();
  const subject = (sp.get('subject') || '').trim();
  const lang = (sp.get('lang') || '').trim();
  const year = (sp.get('year') || '').trim();
  const rawPage = Number(sp.get('page') || '1');
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const [items, setItems] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const DEFAULT_LIMIT = 15;
  const [pageInfo, setPageInfo] = useState<{ limit: number; offset: number; total: number }>({ limit: DEFAULT_LIMIT, offset: 0, total: 0 });
  const showError = !!error;
  const [attempt, setAttempt] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const offset = (page - 1) * DEFAULT_LIMIT;
  const [filtersData, setFiltersData] = useState<FiltersResponse>({ authors: [], subjects: [], langs: [], years: [] });

  

  // initial fetch and when search query changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        params.set("limit", String(DEFAULT_LIMIT));
        params.set("offset", String(offset));
        if (q) params.set('q', q);
        if (author) params.set('author', author);
        if (subject) params.set('subject', subject);
        if (lang) params.set('lang', lang);
        if (year) params.set('year', year);
        const hasAdvancedFilters = !!author || !!subject;
        const endpoint = q && !hasAdvancedFilters ? '/api/catalog/books/search' : '/api/catalog/books';
        const url = `${endpoint}?${params.toString()}`;
        let data: BookListResponse;
        try {
          data = await api<BookListResponse>(url);
        } catch (e) {
          // Fallback path for search errors: fetch plain catalog and filter on client
          if (q) {
            try { console.warn('[Catalog] search endpoint failed, falling back to client-side filter:', e); } catch {}
            const p2 = new URLSearchParams();
            // grab more to improve match chance
            p2.set('limit', String(100));
            p2.set('offset', '0');
            const url2 = `/api/catalog/books?${p2.toString()}`;
            const data2 = await api<BookListResponse>(url2);
            const needle = q.toLocaleLowerCase();
            const inText = (s?: string | null) => (s ? s.toLocaleLowerCase().includes(needle) : false);
            const filtered = (Array.isArray(data2.items) ? data2.items : []).filter((b: any) => {
              const authorNames = (b?.authors || []).map((x: any) => (typeof x === 'string' ? x : x?.name || '')).filter(Boolean);
              const subjectNames = (b?.subjects || []).map((x: any) => (typeof x === 'string' ? x : x?.name || '')).filter(Boolean);
              if (inText(b?.title)) return true;
              if (authorNames.some(inText)) return true;
              if (subjectNames.some(inText)) return true;
              return false;
            });
            const filteredWithParams = filtered.filter((b: any) => {
              const authorNames = (b?.authors || []).map((x: any) => (typeof x === 'string' ? x : x?.name || '')).filter(Boolean);
              const subjectNames = (b?.subjects || []).map((x: any) => (typeof x === 'string' ? x : x?.name || '')).filter(Boolean);
              if (author && !authorNames.some((n: string) => n.toLocaleLowerCase().includes(author.toLocaleLowerCase()))) return false;
              if (subject && !subjectNames.some((n: string) => n.toLocaleLowerCase().includes(subject.toLocaleLowerCase()))) return false;
              if (lang && String(b?.lang || '').toLocaleLowerCase() !== lang.toLocaleLowerCase()) return false;
              if (year && String(b?.year || '') !== String(year)) return false;
              return true;
            });
            const pageItems = filteredWithParams.slice(offset, offset + DEFAULT_LIMIT);
            data = { items: pageItems, page: { limit: DEFAULT_LIMIT, offset, total: filteredWithParams.length } };
          } else {
            throw e;
          }
        }
        try {
          console.groupCollapsed('[Catalog] fetch initial', { endpoint, q, limit: pageInfo.limit, offset });
          console.info('URL:', url);
          console.info('Raw response:', data);
        } catch {}
        if (cancelled) return;
        const arr = Array.isArray(data.items) ? data.items : [];
        try { console.info('Items parsed:', arr.length, arr.slice(0, 3)); console.groupEnd?.(); } catch {}
        setItems(arr);
        const total = data.page?.total ?? arr.length;
        const limit = Math.max(1, data.page?.limit ?? DEFAULT_LIMIT);
        const nextOffset = data.page?.offset ?? offset;
        setPageInfo({ limit, offset: nextOffset, total });
      } catch (e: any) {
        try { console.warn('[Catalog] initial fetch failed:', e); } catch {}
        const msg = (e && typeof e.message === 'string')
          ? e.message
          : (typeof e === 'string' ? e : (()=>{ try { return JSON.stringify(e); } catch { return String(e); } })());
        if (!cancelled) setError(msg);
        // For search errors (e.g., 422), keep UI clean: just show empty list
        if (!cancelled && q) {
          setItems([]);
          setPageInfo((p) => ({ ...p, offset: 0, total: 0 }));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, page, author, subject, lang, year, attempt]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<FiltersResponse>("/api/catalog/filters");
        if (!cancelled) setFiltersData(data);
      } catch {
        if (!cancelled) setFiltersData({ authors: [], subjects: [], langs: [], years: [] });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const controller=new AbortController();
    api<Array<{book_id:number}>>("/api/favourites/",{signal:controller.signal}).then(data=>{
      if(!controller.signal.aborted)setFavorites(new Set((Array.isArray(data)?data:[]).map(item=>String(item.book_id))));
    }).catch(()=>{});
    return ()=>controller.abort();
  },[]);
  useEffect(()=>{
    if(!filtersOpen)return;
    const previous=document.body.style.overflow;
    const previousFocus=document.activeElement as HTMLElement | null;
    document.body.style.overflow='hidden';
    sheetRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const handle=(event:KeyboardEvent)=>{
      if(event.key==='Escape')setFiltersOpen(false);
      if(event.key!=='Tab')return;
      const elements=[...(sheetRef.current?.querySelectorAll<HTMLElement>('button,input')||[])].filter(el=>el.getClientRects().length);
      const first=elements[0],last=elements[elements.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    };
    document.addEventListener('keydown',handle);
    return ()=>{document.body.style.overflow=previous;document.removeEventListener('keydown',handle);previousFocus?.focus();};
  },[filtersOpen]);

  const toggleFavorite = async (id: string | number, e?: React.MouseEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const sid = String(id);
    const alreadyFav = favorites.has(sid);

    // optimistic toggle in UI/localStorage
    const next = new Set(favorites);
    if (alreadyFav) next.delete(sid); else next.add(sid);
    setFavorites(next);
    try { localStorage.setItem("favorites", JSON.stringify(Array.from(next))); } catch {}

    // network side-effect:
    // - POST on add
    // - DELETE /{book_id} on remove
    try {
      if (!alreadyFav) {
        await api<any>(`/api/favourites/`, {
          method: "POST",
          body: JSON.stringify({ book_id: Number(id) }),
        });
      } else {
        await api<any>(`/api/favourites/${Number(id)}`, {
          method: "DELETE",
        });
      }
    } catch (err: any) {
      // revert optimistic update on failure
      const reverted = new Set(favorites);
      if (alreadyFav) {
        reverted.add(sid);
      } else {
        reverted.delete(sid);
      }
      setFavorites(reverted);
      try { localStorage.setItem("favorites", JSON.stringify(Array.from(reverted))); } catch {}
      try { console.warn("[Catalog] favourite toggle failed:", err?.message || String(err)); } catch {}
    }
  };

  const totalPages = Math.max(1, Math.ceil(pageInfo.total / DEFAULT_LIMIT));
  const goToPage = (nextPage: number) => {
    const normalized = Math.min(Math.max(1, nextPage), totalPages);
    const params = new URLSearchParams(sp);
    if (q) params.set("q", q); else params.delete("q");
    if (normalized > 1) params.set("page", String(normalized)); else params.delete("page");
    setSp(params, { replace: false });
  };

  const updateFilter = (key: "author" | "subject" | "lang" | "year", value: string) => {
    const params = new URLSearchParams(sp);
    if (q) params.set("q", q); else params.delete("q");
    if (value) params.set(key, value); else params.delete(key);
    params.delete("page");
    setSp(params, { replace: false });
  };

  const clearFilters = () => {
    const params = new URLSearchParams(sp);
    params.delete("author");
    params.delete("subject");
    params.delete("lang");
    params.delete("year");
    params.delete("page");
    if (q) params.set("q", q); else params.delete("q");
    setSp(params, { replace: false });
  };

  const pageNumbers = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const nums = new Set<number>([1, totalPages, page - 2, page - 1, page, page + 1, page + 2]);
    return Array.from(nums).filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  })();

  const filtersBtnLabel = t("catalog.filters.button");
  const filtersTitle = t("catalog.filters.title");
  const closeLabel = t("catalog.filters.close");
  const clearFiltersLabel = t("catalog.filters.clear");
  const authorLabel = t("catalog.filters.author.label");
  const authorPlaceholder = t("catalog.filters.author.placeholder");
  const authorSearchPlaceholder = t("catalog.filters.author.searchPlaceholder");
  const authorAllLabel = t("catalog.filters.author.all");
  const categoryLabel = t("catalog.filters.category.label");
  const categoryPlaceholder = t("catalog.filters.category.placeholder");
  const categorySearchPlaceholder = t("catalog.filters.category.searchPlaceholder");
  const categoryAllLabel = t("catalog.filters.category.all");
  const langLabel = t("catalog.filters.language.label");
  const langPlaceholder = t("catalog.filters.language.placeholder");
  const langSearchPlaceholder = t("catalog.filters.language.searchPlaceholder");
  const langAllLabel = t("catalog.filters.language.all");
  const yearLabel = t("catalog.filters.year.label");
  const yearPlaceholder = t("catalog.filters.year.placeholder");
  const yearSearchPlaceholder = t("catalog.filters.year.searchPlaceholder");
  const yearAllLabel = t("catalog.filters.year.all");
  const noMatchesLabel = t("catalog.filters.noMatches");

  const copy=designCopy();
  const activeFilters=([
    ['author',author,authorLabel],['subject',subject,categoryLabel],['lang',lang,langLabel],['year',year,yearLabel],
  ] as const).filter(([,value])=>Boolean(value));
  const filterControls=()=> <>
    <FilterDropdown label={authorLabel} value={author} options={filtersData.authors} placeholder={authorPlaceholder} searchPlaceholder={authorSearchPlaceholder} allLabel={authorAllLabel} noMatchesLabel={noMatchesLabel} onChange={value=>updateFilter('author',value)}/>
    <FilterDropdown label={categoryLabel} value={subject} options={filtersData.subjects} placeholder={categoryPlaceholder} searchPlaceholder={categorySearchPlaceholder} allLabel={categoryAllLabel} noMatchesLabel={noMatchesLabel} onChange={value=>updateFilter('subject',value)}/>
    <FilterDropdown label={langLabel} value={lang} options={filtersData.langs} placeholder={langPlaceholder} searchPlaceholder={langSearchPlaceholder} allLabel={langAllLabel} noMatchesLabel={noMatchesLabel} onChange={value=>updateFilter('lang',value)}/>
    <FilterDropdown label={yearLabel} value={year} options={filtersData.years.map(String)} placeholder={yearPlaceholder} searchPlaceholder={yearSearchPlaceholder} allLabel={yearAllLabel} noMatchesLabel={noMatchesLabel} onChange={value=>updateFilter('year',value)}/>
  </>;
  return <div className="catalog-page"><DashboardHeader/>
    <div className="workspace-heading"><div><h1>{t('catalog.title')}</h1><p>{copy.catalogIntro}</p></div></div>
    <div className="catalog-layout"><aside className="catalog-filter-sidebar"><div className="filter-sidebar-heading"><h2><LibraryIcon name="filter" size={18}/>{copy.filters}</h2>{activeFilters.length>0&&<button type="button" onClick={clearFilters}>{copy.clear}</button>}</div>{filterControls()}</aside>
      <div className="catalog-main"><div className="catalog-toolbar"><CatalogSearch key={q} initialValue={q}/><button type="button" className="catalog-mobile-filters" onClick={()=>setFiltersOpen(true)}><LibraryIcon name="filter" size={18}/>{copy.filters}{activeFilters.length>0&&<span>{activeFilters.length}</span>}</button></div>
        {activeFilters.length>0&&<div className="active-filter-list">{activeFilters.map(([key,value,label])=><button type="button" key={key} onClick={()=>updateFilter(key,'')} aria-label={`${clearFiltersLabel}: ${label} ${value}`}>{label}: {value}<LibraryIcon name="close" size={14}/></button>)}<button type="button" onClick={clearFilters}>{clearFiltersLabel}</button></div>}
        <div className="catalog-results-line" aria-live="polite"><span>{copy.results}: <strong>{loading?'…':pageInfo.total}</strong></span>{q&&<span>«{q}»</span>}</div>
        {showError ? <div className="empty-state" role="alert"><div><h3>{t('publicHome.common.error')}</h3><p>{copy.noResults}</p></div><button className="text-action" onClick={()=>setAttempt(value=>value+1)}>{copy.retry}</button></div> : loading ? <div className="book-grid">{Array.from({length:6},(_,i)=><div className="book-skeleton animate-pulse" key={i}/>)}</div> : items.length ? <div className="book-grid">{items.map(book=><BookCard key={book.id} book={book} favorite={favorites.has(String(book.id))} onFavorite={event=>toggleFavorite(book.id,event)}/>)}</div> : <div className="empty-state"><LibraryIcon name="search" size={30}/><div><h3>{t('common.noBooks')}</h3><p>{copy.noResults}</p></div></div>}
        {!loading&&!showError&&items.length>0&&totalPages>1&&<nav className="catalog-pagination" aria-label={t('catalog.title')}><button onClick={()=>goToPage(page-1)} disabled={page<=1}>{copy.previous}</button>{pageNumbers.map((n,i)=><span key={n}>{pageNumbers[i-1]&&n-pageNumbers[i-1]>1&&<span>…</span>}<button onClick={()=>goToPage(n)} aria-current={n===page?'page':undefined}>{n}</button></span>)}<button onClick={()=>goToPage(page+1)} disabled={page>=totalPages}>{copy.next}</button></nav>}
      </div>
    </div>
    {filtersOpen&&<div className="catalog-filter-overlay"><div className="catalog-filter-backdrop" onClick={()=>setFiltersOpen(false)}/><div ref={sheetRef} className="catalog-filter-sheet" role="dialog" aria-modal="true" aria-label={copy.filters}><div className="filter-sidebar-heading"><h2>{copy.filters}</h2><button type="button" onClick={()=>setFiltersOpen(false)} aria-label={closeLabel}><LibraryIcon name="close"/></button></div>{filterControls()}<div className="filter-sheet-actions"><button className="tau-button tau-button--dark" onClick={clearFilters}>{copy.clear}</button><button className="tau-button tau-button--red" onClick={()=>setFiltersOpen(false)}>{closeLabel}</button></div></div></div>}
  </div>;
}
