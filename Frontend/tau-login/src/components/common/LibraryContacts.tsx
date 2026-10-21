import { getLang, t } from '@/shared/i18n';
import { libraryContactCopy,libraryInfo } from '@/shared/libraryInfo';

export default function LibraryContacts({full=false}:{full?:boolean}){
  const words=libraryContactCopy[getLang()];
  return <div className={`library-contacts${full?' library-contacts--full':''}`}>
    <dl>
      <div><dt>{words.email}</dt><dd><a href={`mailto:${libraryInfo.email}`}>{libraryInfo.email}</a></dd></div>
      <div><dt>{words.phone}</dt><dd><a href={libraryInfo.phoneHref}>{libraryInfo.phone} <span>{words.extension} {libraryInfo.extension}</span></a></dd></div>
      {full&&<><div><dt>{words.address}</dt><dd><address>{t('publicHome.footer.address')}<br/>{words.room}</address></dd></div><div><dt>{words.hours}</dt><dd>{t('publicHome.footer.hoursValue')}</dd></div></>}
    </dl>
    <a className="library-contact-source" href={libraryInfo.directory} target="_blank" rel="noreferrer">{words.source}<span aria-hidden="true"> ↗</span></a>
    {full&&<a className="library-contact-source" href={libraryInfo.profile} target="_blank" rel="noreferrer">{words.profile}<span aria-hidden="true"> ↗</span></a>}
  </div>;
}
