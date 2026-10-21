import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import LibraryBrand from '@/components/common/LibraryBrand';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import { getLang, t } from '@/shared/i18n';
import { designCopy } from '@/shared/designCopy';
import { USEFUL_LINK_CATEGORIES } from '@/shared/usefulLinks';

type ContentMenuItem = { id: number; title: string; title_ru?: string | null; title_kk?: string | null; title_en?: string | null; path?: string | null; children?: ContentMenuItem[] };
type MenuLink = { title: string; to: string };
type MenuGroup = { id: string; title: string; to?: string; links?: MenuLink[]; description?: string };
const NAV_COPY = {
  ru: {menu:'Меню', close:'Закрыть меню', browse:'Открывайте новые знания', intro:'Всё, что нужно для учёбы, исследований и вдохновения.', all:'Все материалы', catalog:'Каталог', login:'Войти', library:'Электронная библиотека', students:['Инструкции по базам данных','Библиографический список','Индекс УДК / ББК','Утрата библиотечной книги','Цифровые копии книг','Читальный зал'], teachers:['Индекс цитирования','Оформление научных публикаций','Заявка на приобретение литературы']},
  en: {menu:'Menu', close:'Close menu', browse:'Discover your next idea', intro:'Everything you need to learn, research and find inspiration.', all:'All materials', catalog:'Catalogue', login:'Sign in', library:'Digital library', students:['Database guides','Bibliographic references','UDC / LBC index','Lost library book','Digital book copies','Reading room'], teachers:['Citation index','Publication guidelines','Request new literature']},
  kk: {menu:'Мәзір', close:'Мәзірді жабу', browse:'Жаңа білімді ашыңыз', intro:'Оқу, зерттеу және шабыт алу үшін қажеттінің бәрі.', all:'Барлық материалдар', catalog:'Каталог', login:'Кіру', library:'Электрондық кітапхана', students:['Дерекқор нұсқаулықтары','Библиографиялық тізім','ӘОЖ / КБЖ индексі','Жоғалған кітап','Кітаптардың цифрлық көшірмелері','Оқу залы'], teachers:['Дәйексөз индексі','Ғылыми жарияланымды рәсімдеу','Әдебиет сатып алу өтінімі']},
};
const external = (to: string) => /^https?:\/\//i.test(to);
const readStored = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const tokenPresent = () => { try { return Boolean(localStorage.getItem('token') || sessionStorage.getItem('token')); } catch { return false; } };

export function PublicHeader() {
  const location = useLocation();
  const lang = getLang();
  const copy = NAV_COPY[lang];
  const [contentMenu, setContentMenu] = useState<ContentMenuItem[]>([]);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [mobileMounted, setMobileMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [a11y, setA11y] = useState(() => readStored('public_a11y_mode') === '1');
  const [hasToken, setHasToken] = useState(tokenPresent);
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const activeTrigger = useRef<HTMLButtonElement | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openFrame = useRef<number | null>(null);
  const cancelHover = () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); };
  const closeMobile = () => {
    if (openFrame.current !== null) cancelAnimationFrame(openFrame.current);
    setMobileOpen(false);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => { setMobileMounted(false); toggleRef.current?.focus(); }, 260);
  };
  const openMobile = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setActiveGroup(null); setMobileMounted(true);
    openFrame.current = requestAnimationFrame(() => {
      openFrame.current = requestAnimationFrame(() => setMobileOpen(true));
    });
  };
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/catalog/public/content/menu', {signal:controller.signal}).then(r => r.ok ? r.json() : []).then(data => { if (!controller.signal.aborted) setContentMenu(Array.isArray(data) ? data : []); }).catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('public-theme'); root.classList.toggle('public-a11y',a11y);
    try { localStorage.setItem('public_a11y_mode',a11y ? '1' : '0'); } catch {}
    return () => { root.classList.remove('public-theme','public-a11y'); };
  }, [a11y]);
  useEffect(() => {
    const sync = () => setHasToken(tokenPresent());
    const scroll = () => setScrolled(window.scrollY > 16);
    scroll();
    window.addEventListener('storage',sync); window.addEventListener('auth:changed',sync); window.addEventListener('auth:logout',sync); window.addEventListener('scroll',scroll,{passive:true});
    return () => { window.removeEventListener('storage',sync); window.removeEventListener('auth:changed',sync); window.removeEventListener('auth:logout',sync); window.removeEventListener('scroll',scroll); cancelHover(); if (closeTimer.current) clearTimeout(closeTimer.current); if (openFrame.current !== null) cancelAnimationFrame(openFrame.current); };
  }, []);
  useEffect(() => {
    cancelHover();
    if (openFrame.current !== null) cancelAnimationFrame(openFrame.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setActiveGroup(null); setMobileOpen(false); setMobileMounted(false);
  }, [location.pathname]);
  useEffect(() => {
    const onPointer = (event: PointerEvent) => { if (!headerRef.current?.contains(event.target as Node)) setActiveGroup(null); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setActiveGroup(null); activeTrigger.current?.focus(); } };
    document.addEventListener('pointerdown',onPointer); document.addEventListener('keydown',onKey);
    return () => { document.removeEventListener('pointerdown',onPointer); document.removeEventListener('keydown',onKey); };
  }, []);
  useEffect(() => {
    if (!mobileMounted) return;
    const previous = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => drawerRef.current?.querySelector<HTMLButtonElement>('button')?.focus());
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeMobile(); }
      if (event.key !== 'Tab') return;
      const focusable = [...(drawerRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),select,summary') || [])].filter(el => el.getClientRects().length);
      const first = focusable[0], last = focusable[focusable.length-1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown',keydown);
    return () => { cancelAnimationFrame(frame); document.body.style.overflow = previous; document.removeEventListener('keydown',keydown); previousFocus?.focus(); };
  }, [mobileMounted]);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1180px)');
    const resize = () => { if (query.matches) { if (openFrame.current !== null) cancelAnimationFrame(openFrame.current); setMobileMounted(false); setMobileOpen(false); } };
    query.addEventListener('change',resize);
    return () => query.removeEventListener('change',resize);
  }, []);

  const studentsPaths = ['database-instructions','bibliographic-list','udc-bbk','lost-book','digital-copies','reading-room'];
  const teachersPaths = ['citation-index','gost-publications','acquisition-requests'];
  const resolveTitle = (item: ContentMenuItem) => item[`title_${lang}`]?.trim() || item.title?.trim() || '';
  const groups: MenuGroup[] = contentMenu.length ? contentMenu.map(item => ({id:`cms-${item.id}`,title:resolveTitle(item),to:item.path || undefined,links:item.children?.length ? item.children.map(child => ({title:resolveTitle(child),to:child.path || '/public'})) : undefined})) : [
    {id:'catalog',title:copy.catalog,to:'/catalog'},
    {id:'students',title:t('publicHome.nav.students'),description:designCopy().studentDesc,links:[{title:copy.all,to:'/public/students'},...studentsPaths.map((path,i)=>({title:copy.students[i],to:'/public/students/'+path}))]},
    {id:'teachers',title:t('publicHome.nav.teachers'),description:designCopy().teacherDesc,links:[{title:copy.all,to:'/public/teachers'},...teachersPaths.map((path,i)=>({title:copy.teachers[i],to:'/public/teachers/'+path}))]},
    {id:'resources',title:t('publicHome.nav.resources'),description:designCopy().researchBody,links:[{title:t('publicHome.nav.resources'),to:'/public/resources'},...USEFUL_LINK_CATEGORIES.map(cat=>({title:t(cat.labelKey),to:'/public/links/'+cat.id}))]},
    {id:'about',title:t('publicHome.nav.about'),to:'/public/about'},
  ];
  const active = (to?: string) => Boolean(to && (to === '/public' ? location.pathname === '/public' || location.pathname === '/' : location.pathname.startsWith(to)));
  const selected = groups.find(group => group.id === activeGroup);
  const ctaTo = hasToken ? '/' : '/auth/login';
  const ctaText = hasToken ? t('publicHome.actions.cabinet') : copy.login;
  const eye = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>;
  const a11yLabel = a11y ? t('publicHome.a11y.disable') : t('publicHome.a11y.enable');
  const renderLink = (item: MenuLink, className: string, onClick?: () => void) => external(item.to) ? <a key={item.to} href={item.to} className={className} target="_blank" rel="noreferrer" onClick={onClick}>{item.title}<span aria-hidden="true">↗</span></a> : <Link key={item.to} to={item.to} className={className} aria-current={active(item.to) ? 'page' : undefined} onClick={onClick}>{item.title}<span aria-hidden="true">→</span></Link>;
  return <>
    <header ref={headerRef} className={`tau-nav ${scrolled ? 'tau-nav--scrolled' : ''}`} onMouseLeave={() => { cancelHover(); hoverTimer.current = setTimeout(()=>setActiveGroup(null),180); }} onMouseEnter={cancelHover}>

      <div className="tau-nav-container tau-nav-main"><Link className="tau-nav-brand" to="/public" aria-label={designCopy().back}><LibraryBrand/></Link>
        <nav className="tau-nav-links" aria-label={copy.menu}>

          {groups.map(group=>group.links?.length ? <button key={group.id} type="button" className={`tau-nav-item ${activeGroup === group.id ? 'is-open' : ''} ${group.links.some(link=>active(link.to)) ? 'is-current' : ''}`} aria-expanded={activeGroup===group.id} aria-controls="tau-mega-menu" onClick={event=>{activeTrigger.current=event.currentTarget;setActiveGroup(value=>value===group.id ? null : group.id);}} onPointerEnter={event=>{if(event.pointerType==='mouse'){cancelHover();setActiveGroup(group.id);}}} onKeyDown={event=>{if(event.key==='ArrowDown'){event.preventDefault();setActiveGroup(group.id);requestAnimationFrame(()=>headerRef.current?.querySelector<HTMLAnchorElement>('.nav-mega-links a')?.focus());}}}>{group.title}<svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5"/></svg></button> : renderLink({title:group.title,to:group.to || '/public'},'tau-nav-item'))}
        </nav>
        <div className="tau-nav-end"><LanguageSwitcher variant="buttons"/><button type="button" className="nav-accessibility" onClick={()=>setA11y(value=>!value)} aria-pressed={a11y} aria-label={a11yLabel} title={a11yLabel}>{eye}</button><Link className="nav-signin" to={ctaTo}>{ctaText}<span aria-hidden="true">→</span></Link><button ref={toggleRef} type="button" className="nav-menu-toggle" aria-label={copy.menu} aria-expanded={mobileOpen} aria-controls="tau-mobile-menu" onClick={openMobile}><span/><span/></button></div>
      </div>
      {selected?.links && <div key={selected.id} className="nav-mega-menu" id="tau-mega-menu" role="region" aria-label={selected.title}><div className="nav-mega-inner"><div className="nav-mega-intro"><h2>{selected.title}</h2><p>{selected.description || copy.library}</p></div><div className="nav-mega-links">{selected.links.map((item,i)=><div key={item.to} style={{'--menu-delay':`${i*35}ms`} as React.CSSProperties}>{renderLink(item,'nav-mega-link',()=>setActiveGroup(null))}</div>)}</div></div></div>}
    </header>
    {activeGroup && <div className="nav-dropdown-scrim" aria-hidden="true" onClick={()=>setActiveGroup(null)}/>}
    {mobileMounted && <div className="nav-mobile-overlay" data-open={mobileOpen}><div className="nav-mobile-backdrop" onClick={closeMobile}/><div ref={drawerRef} id="tau-mobile-menu" className="nav-mobile-drawer" role="dialog" aria-modal="true" aria-label={copy.menu}><div className="nav-mobile-top"><LibraryBrand/><button className="nav-close" type="button" onClick={closeMobile} aria-label={copy.close}>×</button></div><span className="nav-mobile-caption">{designCopy().library}</span><nav aria-label={copy.menu}>{renderLink({title:t('publicHome.nav.home'),to:'/public'},'nav-mobile-link',closeMobile)}{groups.map(group=>group.links?.length ? <details key={group.id} className="nav-mobile-group"><summary>{group.title}<span>+</span></summary><div>{group.links.map(item=>renderLink(item,'nav-mobile-sublink',closeMobile))}</div></details> : renderLink({title:group.title,to:group.to || '/public'},'nav-mobile-link',closeMobile))}</nav><div className="nav-mobile-bottom"><Link to={ctaTo} onClick={closeMobile} className="nav-signin">{ctaText}<span>↗</span></Link><button className="nav-mobile-accessibility" onClick={()=>setA11y(value=>!value)} aria-pressed={a11y}>{eye}{a11yLabel}</button><LanguageSwitcher variant="buttons"/></div></div></div>}
  </>;
}
