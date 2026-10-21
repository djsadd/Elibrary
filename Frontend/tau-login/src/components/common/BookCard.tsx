import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import LibraryIcon from './LibraryIcon';
import placeholder from '@/assets/images/book-placeholder.svg';
import { namesFrom } from '@/shared/ui/text';
import { designCopy } from '@/shared/designCopy';
import { t } from '@/shared/i18n';

export type BookCardData = { id: string | number; title: string; cover?: string | null; authors?: unknown; year?: string | number | null; lang?: string | null; summary?: string | null };
export default function BookCard({ book, to, favorite, onFavorite, progress }: { book: BookCardData; to?: string; favorite?: boolean; onFavorite?: (event: MouseEvent<HTMLButtonElement>) => void; progress?: number | null }) {
  const authors = namesFrom(book.authors);
  const href = to || `/catalog/${book.id}`;
  const lang = book.lang ? ({ru:'RU',kk:'KZ',kz:'KZ',en:'EN'}[book.lang.toLowerCase()] || book.lang.toUpperCase()) : '';
  return <article className="library-book-card">
    <div className="book-cover-stage"><Link to={href} tabIndex={-1} aria-hidden="true"><img src={book.cover || placeholder} alt="" loading="lazy" onError={event=>{event.currentTarget.onerror=null;event.currentTarget.src=placeholder;}}/></Link>
      {onFavorite && <button type="button" className={`book-favorite ${favorite ? 'is-saved' : ''}`} onClick={onFavorite} aria-pressed={favorite} aria-label={favorite ? t('catalog.removeFav') : t('catalog.addFav')}><LibraryIcon name="heart" size={18}/></button>}
    </div>
    <div className="book-card-copy"><div className="book-card-meta">{lang && <span>{lang}</span>}{book.year && <span>{book.year}</span>}{book.summary?.startsWith('[TAU-DEMO-') && <span>{designCopy().demo}</span>}</div>
      <h3><Link to={href}>{book.title}</Link></h3>{authors.length > 0 && <p>{authors.join(', ')}</p>}
      {progress != null && <div className="book-progress"><progress aria-label={book.title} max="100" value={Math.min(100,Math.max(0,progress))}/><span>{Math.round(Math.min(100,Math.max(0,progress)))}%</span></div>}
    </div>
  </article>;
}
