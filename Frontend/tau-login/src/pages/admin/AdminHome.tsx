import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/shared/api/client';
import { t } from '@/shared/i18n';
import { designCopy } from '@/shared/designCopy';
import { namesFrom } from '@/shared/ui/text';
type Stats = { total_books: number; authors: number; subjects: number; playlists: number };
type Book = { id: number | string; title: string; year?: number; authors?: unknown };
export default function AdminHome() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      api<Stats>('/api/catalog/admin/stats', {signal: controller.signal}),
      api<{items: Book[]}>('/api/catalog/books?limit=5', {signal: controller.signal}),
    ]).then(([summary, result]) => {
      if (!controller.signal.aborted) { setStats(summary); setBooks(result.items || []); }
    }).catch(e => { if (!controller.signal.aborted) setError(e?.message || String(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  return <div className="admin-overview">
    <div className="admin-overview-heading"><div><h2>{t('admin.home.heading')}</h2></div><Link className="tau-button tau-button--red" to="/admin/books/new">{t('admin.home.addBookBtn')} <span>+</span></Link></div>
    {error && <p className="text-red-600 text-sm" role="alert">{error}</p>}
    <div className="admin-metrics">{[{key:'total_books', label:t('admin.nav.books')},{key:'authors',label:t('admin.nav.authors')},{key:'subjects',label:t('admin.nav.subjects')},{key:'playlists',label:t('admin.nav.playlists')}].map(({key,label},i)=><div key={key}><span>0{i+1} / {label}</span><strong>{loading ? '—' : stats ? stats[key as keyof Stats] : '—'}</strong></div>)}</div>
    <div className="admin-action-grid">{[{to:'/admin/articles/quick',label:t('admin.home.quickArticleBtn')},{to:'/admin/playlists/new',label:t('admin.home.addPlaylistBtn')},{to:'/admin/files',label:t('admin.nav.files')}].map(item=><Link key={item.to} to={item.to}>{item.label}<span>↗</span></Link>)}</div>
    <div className="collection-heading"><h2>{t('admin.nav.books')}</h2><Link to="/admin/books">{designCopy().allBooks} ↗</Link></div>
    {!loading && books.length === 0 ? <div className="empty-state"><div><h3>{t('admin.home.empty')}</h3><p>{designCopy().emptyBody}</p></div></div> : <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>{t('admin.home.table.title')}</th><th>{t('admin.home.table.authors')}</th><th>{t('catalog.filters.year.label')}</th><th/></tr></thead><tbody>{books.map(book=><tr key={book.id} className="border-t"><td>{book.title}</td><td>{namesFrom(book.authors).join(', ') || '—'}</td><td>{book.year || '—'}</td><td><Link className="text-[#b51e3e]" to={`/admin/books/${book.id}`}>{t('admin.common.view')} ↗</Link></td></tr>)}</tbody></table></div>}
  </div>;
}
