import { Link } from 'react-router-dom';
import LibraryBrand from '@/components/common/LibraryBrand';
import { designCopy } from '@/shared/designCopy';
import { getLang } from '@/shared/i18n';

const messages = {
  ru: ['Не удалось открыть страницу', 'Проверьте соединение и попробуйте загрузить страницу ещё раз.'],
  kk: ['Бетті ашу мүмкін болмады', 'Байланысты тексеріп, бетті қайта жүктеп көріңіз.'],
  en: ['Unable to open this page', 'Check your connection and try loading the page again.'],
};

/** Recover a failed route download without exposing an internal stack trace. */
export default function RouteError() {
  const copy = designCopy();
  const [title, body] = messages[getLang()];
  return <main className="route-error">
    <Link to="/public" aria-label={copy.back}><LibraryBrand/></Link>
    <div className="route-error-copy" role="alert"><h1>{title}</h1><p>{body}</p><div><button type="button" className="atlas-primary" onClick={() => window.location.reload()}>{copy.retry}</button><a className="atlas-text-link" href="/public">{copy.back}</a></div></div>
  </main>;
}
