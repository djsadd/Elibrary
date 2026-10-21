import { useEffect, useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getLang } from '@/shared/i18n';
import '@/styles/book-preview.css';

export type PreviewBook = {
  id: number;
  title: string;
  lang: string;
  year: string;
  cover: string;
};

type BookPreviewDialogProps = {
  book: PreviewBook;
  onClose: () => void;
};

const copy = {
  ru: {
    close: 'Закрыть предпросмотр',
    preview: 'TAU / Из коллекции',
    demo: 'Демонстрационное издание',
    language: 'Язык',
    year: 'Год',
    open: 'Открыть в каталоге',
    access: 'Для поиска и чтения материалов нужен вход в библиотеку.',
    note: 'Краткий тестовый материал библиотеки для знакомства с каталогом, чтением и заметками.',
    fallback: 'Материал из демонстрационной коллекции электронной библиотеки TAU.',
    languages: { ru: 'Русский', kk: 'Казахский', en: 'Английский' },
    descriptions: {
      1: 'Алгоритмы и данные, условия и циклы, проверка результата. Три короткие темы с примерами для первого знакомства с программированием.',
      4: 'От исследовательского вопроса к чистой таблице и понятному выводу. Три короткие темы по работе с данными на казахском языке.',
      6: 'Как поставить точный вопрос, изучить данные перед моделированием и объяснить результат. Краткое введение на английском языке.',
      7: 'Задача пользователя, визуальная иерархия и проверка прототипа. Три короткие темы о создании цифровых продуктов на английском языке.',
    },
  },
  kk: {
    close: 'Алдын ала қарауды жабу',
    preview: 'TAU / Жинақтан',
    demo: 'Демонстрациялық басылым',
    language: 'Тілі',
    year: 'Жылы',
    open: 'Каталогтан ашу',
    access: 'Материалдарды іздеу және оқу үшін кітапханаға кіру қажет.',
    note: 'Каталогпен, оқумен және жазбалармен танысуға арналған кітапхананың қысқа тест материалы.',
    fallback: 'TAU электрондық кітапханасының демонстрациялық жинағындағы материал.',
    languages: { ru: 'Орысша', kk: 'Қазақша', en: 'Ағылшынша' },
    descriptions: {
      1: 'Алгоритмдер мен деректер, шарттар мен циклдер, нәтижені тексеру. Бағдарламалаумен танысуға арналған орыс тіліндегі үш қысқа тақырып.',
      4: 'Зерттеу сұрағынан таза кесте мен түсінікті қорытындыға дейін. Деректермен жұмыс істеуге арналған қазақ тіліндегі үш қысқа тақырып.',
      6: 'Нақты сұрақ қою, модельдеуге дейін деректерді зерттеу және нәтижені түсіндіру. Ағылшын тіліндегі қысқа кіріспе.',
      7: 'Пайдаланушының міндеті, визуалды иерархия және прототипті тексеру. Цифрлық өнімдер туралы ағылшын тіліндегі үш қысқа тақырып.',
    },
  },
  en: {
    close: 'Close preview',
    preview: 'TAU / From the collection',
    demo: 'Demonstration publication',
    language: 'Language',
    year: 'Year',
    open: 'Open in catalogue',
    access: 'Sign in to the library to search and read materials.',
    note: 'A short library test material for exploring the catalogue, reader and notes.',
    fallback: 'A publication from the TAU digital library demonstration collection.',
    languages: { ru: 'Russian', kk: 'Kazakh', en: 'English' },
    descriptions: {
      1: 'Algorithms and data, conditions and loops, and checking results. Three short topics introducing programming in Russian.',
      4: 'From a research question to a clean table and a clear conclusion. Three short topics about working with data in Kazakh.',
      6: 'Ask a focused question, explore before modelling and communicate the result. A short introduction to Data Science in English.',
      7: 'The user’s task, visual hierarchy and testing a prototype. Three short topics about designing digital products in English.',
    },
  },
};

export default function BookPreviewDialog({ book, onClose }: BookPreviewDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const backdropPointerDown = useRef(false);
  const titleId = useId();
  const noteId = useId();
  const lang = getLang();
  const words = copy[lang];
  const languageCode = book.lang.toLowerCase().split(/[-_]/)[0];
  const language = words.languages[languageCode as keyof typeof words.languages] || book.lang;
  const description = words.descriptions[book.id as keyof typeof words.descriptions] || words.fallback;

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const handleClose = () => {
      // Ignore a queued cleanup event if StrictMode has already reopened the dialog.
      if (!dialog.open) onCloseRef.current();
    };

    dialog.addEventListener('close', handleClose);
    dialog.showModal();
    document.body.style.overflow = 'hidden';

    return () => {
      dialog.removeEventListener('close', handleClose);
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  const closeDialog = () => dialogRef.current?.close();
  const isBackdrop = (dialog: HTMLDialogElement, target: EventTarget, x: number, y: number) => {
    if (target !== dialog) return false;
    const bounds = dialog.getBoundingClientRect();
    return x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom;
  };

  return (
    <dialog
      ref={dialogRef}
      className="book-preview-dialog"
      lang={lang}
      aria-labelledby={titleId}
      aria-describedby={noteId}
      onCancel={(event) => { event.preventDefault(); closeDialog(); }}
      onKeyDown={(event) => {
        if(event.key!=='Tab')return;
        const controls=[...event.currentTarget.querySelectorAll<HTMLElement>('button,a[href]')];
        const first=controls[0],last=controls[controls.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }}
      onPointerDown={(event) => {
        backdropPointerDown.current = isBackdrop(event.currentTarget, event.target, event.clientX, event.clientY);
      }}
      onClick={(event) => {
        const endedOnBackdrop = isBackdrop(event.currentTarget, event.target, event.clientX, event.clientY);
        if (backdropPointerDown.current && endedOnBackdrop) closeDialog();
        backdropPointerDown.current = false;
      }}
    >
      <div className="book-preview-toolbar">
        <button type="button" className="book-preview-close" onClick={closeDialog} aria-label={words.close} autoFocus>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>

      <div className="book-preview-spread">
        <div className="book-preview-cover-page">
          <span className="book-preview-imprint">{words.preview}</span>
          <div className="book-preview-cover-stage">
            <img src={book.cover} alt={book.title} lang={book.lang} width="700" height="980" />
          </div>
          <span className="book-preview-edition-number">TAU / {String(book.id).padStart(2, '0')}</span>
        </div>

        <div className="book-preview-copy">
          <p className="book-preview-label">{words.demo}</p>
          <h2 id={titleId} className="book-preview-title" lang={book.lang}>{book.title}</h2>
          <dl className="book-preview-metadata">
            <div><dt>{words.language}</dt><dd>{language || '—'}</dd></div>
            <div><dt>{words.year}</dt><dd>{book.year || '—'}</dd></div>
          </dl>
          <p className="book-preview-description">{description}</p>
          <p id={noteId} className="book-preview-note">{words.note}</p>
          <div className="book-preview-actions">
            <Link to={`/catalog/${book.id}`} className="book-preview-catalog" onClick={onClose}>
              <span>{words.open}</span><span aria-hidden="true">↗</span>
            </Link>
            <p className="book-preview-access">{words.access}</p>
          </div>
        </div>
      </div>
    </dialog>
  );
}
