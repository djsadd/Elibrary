import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/shared/api/client';
import { t } from '@/shared/i18n';
import { designCopy } from '@/shared/designCopy';
import DashboardHeader from '@/components/layout/DashboardHeader';
import BookCard from '@/components/common/BookCard';
import LibraryIcon from '@/components/common/LibraryIcon';

type Book = { id: number | string; title: string; cover?: string | null; authors?: string[] };
type Playlist = { id: number | string; title: string; description?: string | null; books: Book[] };
export default function DashboardPage() {
  const c = designCopy();
  const [items, setItems] = useState<Book[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pls = await api<Playlist[]>('/api/catalog/playlists');
        if (cancelled) return;
        if (Array.isArray(pls) && pls.length) { setPlaylists(pls); return; }
      } catch { /* The main catalogue remains available without curated collections. */ }
      try {
        const data = await api<{ items: Book[] }>('/api/catalog/books');
        if (!cancelled) setItems(Array.isArray(data.items) ? data.items : []);
      } catch (e: any) { if (!cancelled) setError(e?.message || String(e)); }
      finally { if (!cancelled) setLoading(false); }
    })().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  const collections = playlists.length ? playlists : [{id:'all',title:c.collection,description:c.collectionSubtitle,books:items}];
  return <div className="dashboard-page"><DashboardHeader/>
    <div className="workspace-heading"><div><h1>{c.dashFirst}</h1><p>{c.dashBody}</p></div><Link className="tau-button tau-button--red" to="/catalog">{c.allBooks}<LibraryIcon name="arrow" size={18}/></Link></div>
    <nav className="dashboard-links" aria-label={c.navigation}><Link to="/shelf">{t('nav.shelf')}<LibraryIcon name="arrow" size={16}/></Link><Link to="/favorites">{t('nav.favorites')}<LibraryIcon name="arrow" size={16}/></Link><Link to="/public/resources">{c.resources}<LibraryIcon name="arrow" size={16}/></Link></nav>
    {collections.map(collection=><section className="collection-section" key={collection.id}><div className="collection-heading"><div><h2>{collection.title}</h2>{collection.description && <p>{collection.description}</p>}</div><Link className="text-action" to="/catalog">{c.allBooks}<LibraryIcon name="arrow" size={18}/></Link></div>
      {error ? <div className="empty-state" role="alert"><h3>{t('publicHome.common.error')}</h3><p>{error}</p></div> : loading ? <div className="book-grid">{Array.from({length:4},(_,i)=><div key={i} className="book-skeleton animate-pulse"/>)}</div> : collection.books.length ? <div className="book-grid">{collection.books.slice(0,8).map(book=><BookCard key={book.id} book={book}/>)}</div> : <div className="empty-state"><LibraryIcon name="book" size={32}/><div><h3>{c.emptyTitle}</h3><p>{c.emptyBody}</p></div></div>}
    </section>)}
  </div>;
}
