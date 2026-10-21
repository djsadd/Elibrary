import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { designCopy } from '@/shared/designCopy';
import { readerGuides } from '@/shared/readerGuides';
import { t } from '@/shared/i18n';
import { USEFUL_LINK_CATEGORIES } from '@/shared/usefulLinks';
import LibraryIcon from './LibraryIcon';
export default function ReaderIndex() {
  const copy=designCopy();
  const [active,setActive]=useState(0);
  const tabs=useRef<Array<HTMLButtonElement|null>>([]);
  const sheets=[
    {title:t('publicHome.nav.students'),body:copy.studentDesc,to:'/public/students',links:readerGuides('students')},
    {title:t('publicHome.nav.teachers'),body:copy.teacherDesc,to:'/public/teachers',links:readerGuides('teachers')},
    {title:copy.resources,body:copy.researchBody,to:'/public/resources',links:USEFUL_LINK_CATEGORIES.map(item=>({title:t(item.labelKey),to:'/public/links/'+item.id}))},
  ];
  return <section className="reader-index" aria-labelledby="reader-index-title"><div className="reader-index-stage folio-section">
    <div className="reader-index-heading"><h2 id="reader-index-title" data-motion="title">{copy.helpTitle}</h2></div>
    <div className="reader-tab-list" role="tablist" aria-label={copy.servicesTitle}>{sheets.map((sheet,i)=><button key={sheet.to} ref={element=>{tabs.current[i]=element;}} type="button" role="tab" id={`reader-tab-${i}`} aria-selected={active===i} aria-controls={`reader-panel-${i}`} tabIndex={active===i?0:-1} onClick={()=>setActive(i)} onKeyDown={event=>{
      const next=event.key==='ArrowRight'?(i+1)%3:event.key==='ArrowLeft'?(i+2)%3:event.key==='Home'?0:event.key==='End'?2:null;
      if(next!==null){event.preventDefault();setActive(next);tabs.current[next]?.focus();}
    }}>{sheet.title}</button>)}</div>
    <select className="reader-index-select" aria-label={copy.servicesTitle} value={active} onChange={event=>setActive(Number(event.target.value))}>{sheets.map((sheet,i)=><option key={sheet.to} value={i}>{sheet.title}</option>)}</select>
    <div className="reader-panels">{sheets.map((sheet,i)=><article key={sheet.to} id={`reader-panel-${i}`} className="reader-panel" role="tabpanel" aria-labelledby={`reader-tab-${i}`} hidden={active!==i} tabIndex={0}>
      <p>{sheet.body}</p><ul>{sheet.links.map(item=><li key={item.to}><Link to={item.to}>{item.title}<LibraryIcon name="arrow" size={18}/></Link></li>)}</ul><Link className="sheet-all" to={sheet.to}>{copy.helpMore}<LibraryIcon name="arrow"/></Link>
    </article>)}</div>
  </div></section>;
}
