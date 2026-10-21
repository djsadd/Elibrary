import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import LibraryIcon from './LibraryIcon';
import { designCopy } from '@/shared/designCopy';

export default function CatalogSearch({ className = '', initialValue = '' }: { className?: string; initialValue?: string }) {
  const [query, setQuery] = useState(initialValue);
  const navigate = useNavigate();
  const copy = designCopy();
  const location = useLocation();
  return <form className={`catalog-search ${className}`} role="search" onSubmit={event=>{event.preventDefault();const q=query.trim();const params=new URLSearchParams(location.pathname==='/catalog'?location.search:'');if(q)params.set('q',q);else params.delete('q');params.delete('page');navigate('/catalog'+(params.size?'?'+params.toString():''),{});}}>
    <LibraryIcon name="search" size={22}/><input type="search" value={query} onChange={event=>setQuery(event.target.value)} aria-label={copy.searchLabel} placeholder={copy.searchHint}/><button type="submit">{copy.search}<LibraryIcon name="arrow" size={18}/></button>
  </form>;
}
