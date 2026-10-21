import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PublicPageLayout } from '@/components/layout/PublicPageLayout';
import { readerGuides } from '@/shared/readerGuides';
import { getLang } from '@/shared/i18n';
import { getGuideContent } from '@/shared/guideContent';
import { libraryInfo } from '@/shared/libraryInfo';
import LibraryContacts from './LibraryContacts';

const guideCopy={
  ru:{contents:'На этой странице',sources:'Источники и инструкции',help:'Помощь библиотекаря',body:'Для консультации укажите тему вопроса и данные нужного издания. По ссылке откроется ваша почтовая программа — письмо можно проверить перед отправкой.',write:'Написать в библиотеку',related:'Другие материалы'},
  en:{contents:'On this page',sources:'Sources and guidance',help:'Ask a librarian',body:'Describe your question and identify the publication you need. The link opens your email application, where you can review the message before sending.',write:'Email the library',related:'Related materials'},
  kk:{contents:'Осы бетте',sources:'Дереккөздер мен нұсқаулықтар',help:'Кітапханашының көмегі',body:'Кеңес алу үшін сұрағыңыздың тақырыбын және қажетті басылымның деректерін көрсетіңіз. Сілтеме пошта бағдарламаңызды ашады — хатты жібермес бұрын тексере аласыз.',write:'Кітапханаға хат жазу',related:'Басқа материалдар'},
};

/** Reader guidance distinguishes published institutional rules from preparation advice. */
export default function PublicGuide({ audience, slug }: { audience:'students'|'teachers'; slug:string }) {
  const guide = readerGuides(audience).find(item=>item.to.endsWith('/'+slug))!;
  const lang=getLang();
  const words=guideCopy[lang];
  const content=getGuideContent(slug,lang);
  useEffect(()=>{ document.title = `${guide.title} — TAU`; },[guide.title]);
  return <PublicPageLayout>
    <section className="public-page-intro"><h1>{guide.title}</h1><p>{content?.lead||guide.body}</p></section>
    {content&&<div className="guide-layout"><aside className="guide-toc"><h2>{words.contents}</h2><nav aria-label={words.contents}>{content.sections.map((section,index)=><a href={`#guide-section-${index}`} key={section.title}>{section.title}</a>)}<a href="#guide-sources">{words.sources}</a><a href="#guide-help">{words.help}</a></nav></aside>
      <div className="guide-content">{content.sections.map((section,index)=><section key={section.title} id={`guide-section-${index}`} className="guide-content-section"><h2>{section.title}</h2>{section.paragraphs?.map(text=><p key={text}>{text}</p>)}{section.steps&&<ol>{section.steps.map(text=><li key={text}>{text}</li>)}</ol>}{section.items&&<ul>{section.items.map(text=><li key={text}>{text}</li>)}</ul>}</section>)}
        <section id="guide-sources" className="guide-content-section guide-sources"><h2>{words.sources}</h2><ul>{content.sources.map(source=><li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.label}<span aria-hidden="true"> ↗</span></a></li>)}</ul></section>
        {content.relatedLinks?.length&&<nav aria-label={words.related} className="guide-related">{content.relatedLinks.map(item=><Link key={item.url} to={item.url}>{item.label}<span aria-hidden="true"> ↗</span></Link>)}</nav>}
        <section id="guide-help" className="guide-content-section guide-help"><h2>{words.help}</h2><p>{words.body}</p><a className="atlas-text-link" href={`mailto:${libraryInfo.email}?subject=${encodeURIComponent(guide.title)}`}>{words.write}<span aria-hidden="true">↗</span></a><LibraryContacts/></section>
      </div>
    </div>}
  </PublicPageLayout>;
}
