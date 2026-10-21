import { Link } from 'react-router-dom';
import { designCopy } from '@/shared/designCopy';
import { t } from '@/shared/i18n';
import logo from '@/assets/images/Logo.svg';
import LibraryContacts from '@/components/common/LibraryContacts';
export function PublicFooter() {
  const copy=designCopy();
  return <footer className="public-site-footer"><div className="footer-sheet" data-motion="curtain">
    <div className="footer-columns">
      <div className="footer-imprint"><img src={logo} alt="TAU — Turan-Astana University" width="482" height="287" loading="lazy"/><p>{copy.footer}</p></div>
      <div><div className="footer-contacts"><div><p>{t('publicHome.footer.address')}</p><p>{t('publicHome.footer.hoursValue')}</p></div></div><LibraryContacts/>
        <nav className="footer-links" aria-label={copy.navigation}><Link to="/public/resources">{copy.resources}</Link><Link to="/public/links">{t('publicHome.nav.links')}</Link><Link to="/public/about#contacts">{t('publicHome.footer.contactsTitle')}</Link><Link to="/auth/login">{copy.loginHeading}</Link></nav>
      </div>
    </div>
    <div className="footer-wordmark" aria-hidden="true">TAU Library</div>
    <div className="footer-bottom"><p className="footer-copyright">© {new Date().getFullYear()} {copy.university}</p><a className="footer-top" href="#root" aria-label={copy.top}>↑</a></div>
  </div></footer>;
}
