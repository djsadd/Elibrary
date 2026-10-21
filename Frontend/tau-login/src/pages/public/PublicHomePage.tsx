import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicPageLayout } from '@/components/layout/PublicPageLayout';
import CatalogSearch from '@/components/common/CatalogSearch';
import ReaderIndex from '@/components/common/ReaderIndex';
import BookPreviewDialog from '@/components/common/BookPreviewDialog';
import { designCopy } from '@/shared/designCopy';
import { getLang } from '@/shared/i18n';
import editions from '@/shared/libraryPreview.json';

const BookSculpture = lazy(() => import('@/components/common/BookSculpture'));
const sculptureLabels = {
  ru:{pause:'Остановить движение книги',play:'Включить движение книги',description:'Раскрытая объёмная книга'},
  en:{pause:'Pause book motion',play:'Resume book motion',description:'Open three-dimensional book'},
  kk:{pause:'Кітап қозғалысын тоқтату',play:'Кітап қозғалысын қосу',description:'Ашық көлемді кітап'},
};

const translations = {
  ru: { open:'Открыть издание', choose:'Выбрать издание', collection:'Откройте новую главу', collectionBody:'От первой идеи до научной работы. Начните с темы, которая интересна вам.', demo:'Демонстрационная коллекция', subjects:['Программирование','Анализ данных','Data Science','Дизайн продуктов'], all:'Весь каталог', start:'Всё начинается с книги', startBody:'Ваша личная библиотека: читайте в браузере, сохраняйте важное и возвращайтесь к своим заметкам.', login:'Войти в библиотеку', research:'Для ваших открытий', researchBody:'Научные базы данных, электронные библиотеки и периодические издания. Продолжайте поиск за пределами каталога.', resources:'Изучить ресурсы', about:'О библиотеке', languages:'На русском, қазақша и English', caption:'Выберите книгу на развороте' },
  en: { open:'Open publication', choose:'Choose a publication', collection:'Open a new chapter', collectionBody:'From a first idea to your next research paper. Start with a subject that interests you.', demo:'Demonstration collection', subjects:['Programming','Data analysis','Data Science','Product design'], all:'Full catalogue', start:'It starts with a book', startBody:'Your personal library: read in your browser, save what matters and return to your notes.', login:'Sign in to the library', research:'For your next discovery', researchBody:'Research databases, digital libraries and journals. Take your search beyond the catalogue.', resources:'Explore resources', about:'About the library', languages:'In Russian, Kazakh and English', caption:'Choose a book in the spread' },
  kk: { open:'Басылымды ашу', choose:'Басылымды таңдау', collection:'Жаңа тарауды ашыңыз', collectionBody:'Алғашқы идеядан ғылыми жұмысқа дейін. Өзіңізге қызықты тақырыптан бастаңыз.', demo:'Демонстрациялық жинақ', subjects:['Бағдарламалау','Деректерді талдау','Data Science','Өнім дизайны'], all:'Толық каталог', start:'Бәрі кітаптан басталады', startBody:'Жеке кітапханаңыз: браузерде оқыңыз, маңыздысын сақтаңыз және жазбаларыңызға оралыңыз.', login:'Кітапханаға кіру', research:'Жаңа ізденістер үшін', researchBody:'Ғылыми дерекқорлар, электрондық кітапханалар және мерзімді басылымдар. Каталогтан тыс ізденіңіз.', resources:'Ресурстарды қарау', about:'Кітапхана туралы', languages:'Қазақша, орысша және ағылшынша', caption:'Кітапты таңдаңыз' },
};
const previewCopy = {
  ru:{details:'Об издании',collection:'Книги для знакомства',body:'Четыре демонстрационных издания на трёх языках. Посмотрите описание и выберите тему перед входом в каталог.',choose:'Сменить издание',language:{ru:'Русский',kk:'Қазақша',en:'English'}},
  en:{details:'About this book',collection:'Meet the collection',body:'Four demonstration publications in three languages. Explore a description and choose a subject before signing in to the catalogue.',choose:'Choose a book',language:{ru:'Русский',kk:'Қазақша',en:'English'}},
  kk:{details:'Басылым туралы',collection:'Кітаптармен танысыңыз',body:'Үш тілдегі төрт демонстрациялық басылым. Каталогқа кірмес бұрын сипаттамасын қарап, тақырыпты таңдаңыз.',choose:'Басылымды ауыстыру',language:{ru:'Русский',kk:'Қазақша',en:'English'}},
};

export default function PublicHomePage() {
  const copy = designCopy();
  const words = translations[getLang()];
  const previewWords=previewCopy[getLang()];
  const [selected, setSelected] = useState(0);
  const [preview,setPreview]=useState<number|null>(null);
  const book = editions[selected];
  useEffect(() => { document.title = `${copy.library} — TAU`; }, [copy.library]);

  return <PublicPageLayout hero={<div className="library-folio">
    <section className="atlas-hero" aria-labelledby="library-title">
      <div className="atlas-cover">
        <div className="atlas-cover-copy">
          <h1 id="library-title"><span data-motion="title">{copy.first}</span><span data-motion="title">{copy.second}</span></h1>
          <p className="atlas-intro" data-motion="copy">{copy.intro}</p>
          <div className="atlas-search" data-motion="form"><CatalogSearch/></div>
          <p className="atlas-access" data-motion="copy">{copy.searchHelp}</p>
        </div>
        <div className="atlas-cover-foot" data-motion="row"><span>{copy.university}</span><a href="#collection">{words.collection}<span aria-hidden="true">↓</span></a></div>
      </div>
      <div className="atlas-art">
        <div className="atlas-book-stage" data-motion="plate">
          <Suspense fallback={null}>
            <BookSculpture book={book} labels={sculptureLabels[getLang()]}/>
          </Suspense>
        </div>
        <div className="atlas-book-caption" aria-live="polite" aria-atomic="true"><div><p className="atlas-book-name" key={book.id}>{book.title}</p><p>{previewWords.language[book.lang as keyof typeof previewWords.language]} · {book.year}</p></div><button className="atlas-book-details" type="button" onClick={()=>setPreview(selected)} aria-label={`${previewWords.details}: ${book.title}`}><span>{previewWords.details}</span><span aria-hidden="true">↗</span></button></div>
        <div className="atlas-art-bottom"><p className="atlas-art-note">{previewWords.choose}</p><div className="atlas-book-controls" role="group" aria-label={words.choose}>{editions.map((edition,index)=><button key={edition.id} type="button" aria-label={`${words.choose}: ${edition.title}`} aria-pressed={selected===index} onClick={()=>setSelected(index)}><img src={edition.cover} alt="" width="38" height="52"/></button>)}</div></div>
      </div>
    </section>

    <section id="collection" className="atlas-collection" aria-labelledby="collection-title">
      <div className="atlas-section-head"><h2 id="collection-title" data-motion="title">{previewWords.collection}</h2><div><p data-motion="copy">{previewWords.body}</p><Link to="/catalog" className="atlas-text-link" data-motion="row">{words.all}<span aria-hidden="true">↗</span></Link></div></div>
      <div className="atlas-editions">{editions.map((edition,index) => <article className="atlas-edition" key={edition.id} data-motion="plate"><button className="atlas-edition-preview" type="button" onClick={()=>setPreview(index)} aria-label={`${previewWords.details}: ${edition.title}`}><div className="atlas-edition-media"><img src={edition.cover} alt="" width="700" height="980" loading="lazy"/><span className="atlas-edition-open" aria-hidden="true">{previewWords.details}<span>↗</span></span></div><div className="atlas-edition-meta"><p className="atlas-edition-data">{previewWords.language[edition.lang as keyof typeof previewWords.language]} · {edition.year}</p><h3>{edition.title}</h3><p>{words.subjects[index]}</p></div></button></article>)}</div>
    </section>

    <ReaderIndex/>
    {preview!==null&&<BookPreviewDialog book={editions[preview]} onClose={()=>setPreview(null)}/>}

  </div>}/>;
}
