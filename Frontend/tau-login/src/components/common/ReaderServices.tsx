import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import LibraryIcon from './LibraryIcon';
import { PublicPageLayout } from '@/components/layout/PublicPageLayout';
import { designCopy } from '@/shared/designCopy';
import { readerGuides } from '@/shared/readerGuides';
import { t } from '@/shared/i18n';

export default function ReaderServices({ audience }: { audience:'students'|'teachers' }) {
  const copy=designCopy();
  const title=t(`publicHome.sections.${audience}.title`);
  useEffect(()=>{document.title=`${title} — TAU`;},[title]);
  return <PublicPageLayout maxWidthClassName="max-w-5xl"><section className="public-page-intro"><h1>{title}</h1><p>{audience==='students'?copy.studentDesc:copy.teacherDesc}</p></section><div className="reader-service-grid">{readerGuides(audience).map(item=><Link className="reader-service-card" key={item.to} to={item.to}><LibraryIcon name="document"/><div><h2>{item.title}</h2><p>{item.body}</p></div><LibraryIcon name="arrow" size={18}/></Link>)}</div></PublicPageLayout>;
}
