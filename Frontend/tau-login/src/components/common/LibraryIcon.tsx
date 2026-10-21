import type { CSSProperties } from 'react';

const paths = {
  search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></>,
  book: <><path d="M3 4h6a4 4 0 0 1 3 1.4A4 4 0 0 1 15 4h6v15h-6a4 4 0 0 0-3 1.4A4 4 0 0 0 9 19H3V4Z"/><path d="M12 5.4v15M6 8h3M15 8h3"/></>,
  arrow: <path d="M4 12h15m-6-6 6 6-6 6"/>,
  bookmark: <path d="M6 3h12v18l-6-4-6 4V3Z"/>,
  globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/></>,
  graduate: <><path d="m2 9 10-5 10 5-10 5L2 9Zm4 3v5c4 3 8 3 12 0v-5M22 9v8"/></>,
  document: <><path d="M6 3h8l4 4v14H6V3ZM14 3v5h4M9 12h6M9 16h6"/></>,
  heart: <path d="M20.8 5.7a5.3 5.3 0 0 0-8.8 1 5.3 5.3 0 0 0-8.8-1c-3.7 4.4 1.2 9.6 8.8 14.5 7.6-4.9 12.5-10.1 8.8-14.5Z"/>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  filter: <path d="M3 6h18M6 12h12M9 18h6"/>,
};

export default function LibraryIcon({ name, size = 20, className, style }: { name: keyof typeof paths; size?: number; className?: string; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={style}>{paths[name]}</svg>;
}
