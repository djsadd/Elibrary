import { Link, useLocation } from 'react-router-dom';
import LibraryBrand from '@/components/common/LibraryBrand';
import { designCopy } from '@/shared/designCopy';
import { getLang } from '@/shared/i18n';
export default function NotFoundPage() {
  const location = useLocation();
  const lang = getLang();
  const title = lang === 'ru' ? 'Страница не найдена' : lang === 'kk' ? 'Бет табылмады' : 'Page not found';
  const body = lang === 'ru' ? 'Страница не найдена. Вернитесь в библиотеку, чтобы продолжить поиск.' : lang === 'kk' ? 'Бет табылмады. Іздеуді жалғастыру үшін кітапханаға оралыңыз.' : 'The page could not be found. Return to the library to continue exploring.';
  return <main className="not-found-page"><Link to="/public"><LibraryBrand/></Link><div className="not-found-content"><span className="not-found-number" aria-hidden="true">404<span>↗</span></span><h1>{title}</h1><p>{body}</p><code>{location.pathname}</code><Link className="tau-button tau-button--red" to="/">{designCopy().back}<span>↗</span></Link></div></main>;
}
