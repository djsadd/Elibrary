import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PublicPageLayout } from '@/components/layout/PublicPageLayout';
import LibraryIcon from '@/components/common/LibraryIcon';
import { designCopy } from '@/shared/designCopy';
import { readerGuides } from '@/shared/readerGuides';
import { t } from '@/shared/i18n';
export default function PublicResourcesPage() {
  const copy=designCopy();
  const guides=readerGuides('students');
  useEffect(()=>{document.title=`${copy.resources} — TAU`;},[copy.resources]);
  const items=[
    {to:'/public/links/e_libraries',title:t('publicHome.usefulLinks.categories.eLibraries'),body:copy.resourceDesc,icon:'globe' as const},
    {to:guides[0].to,title:guides[0].title,body:guides[0].body,icon:'search' as const},
    {to:guides[1].to,title:guides[1].title,body:guides[1].body,icon:'document' as const},
    {to:'/public/links/periodicals',title:t('publicHome.usefulLinks.categories.periodicals'),body:copy.researchBody,icon:'book' as const},
    {to:'/public/students',title:t('publicHome.nav.students'),body:copy.studentDesc,icon:'graduate' as const},
    {to:'/public/about#contacts',title:t('publicHome.footer.contactsTitle'),body:t('publicHome.footer.address'),icon:'user' as const},
  ];
  return <PublicPageLayout maxWidthClassName="max-w-5xl"><section className="public-page-intro"><h1>{copy.resources}</h1><p>{copy.researchBody}</p></section><div className="reader-service-grid">{items.map(item=><Link key={item.to} to={item.to} className="reader-service-card"><LibraryIcon name={item.icon}/><div><h2>{item.title}</h2><p>{item.body}</p></div><LibraryIcon name="arrow" size={18}/></Link>)}</div></PublicPageLayout>;
}
