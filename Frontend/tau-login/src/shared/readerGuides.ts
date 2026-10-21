import { getLang } from './i18n';

const paths = ['students/database-instructions','students/bibliographic-list','students/udc-bbk','students/lost-book','students/digital-copies','students/reading-room','teachers/citation-index','teachers/gost-publications','teachers/acquisition-requests'];
const guides = {
  ru: [
    ['Инструкции по базам данных','Руководства по поиску и работе с электронными ресурсами.'],
    ['Список литературы','Правила и примеры библиографического описания.'],
    ['Индекс УДК / ББК','Получение классификационного индекса для публикации.'],
    ['Утрата книги','Порядок обращения в библиотеку при утрате издания.'],
    ['Цифровые копии','Условия доступа к электронным копиям изданий.'],
    ['Читальный зал','Получение книг и работа с фондом в читальном зале.'],
    ['Индекс цитирования','Информация о научном цитировании и библиометрии.'],
    ['Оформление публикаций','Стандарты и примеры оформления научных работ.'],
    ['Приобретение литературы','Порядок подачи заявки на пополнение фонда.'],
  ],
  en: [
    ['Database guides','Guidance on searching and using electronic resources.'],
    ['Reference lists','Rules and examples for bibliographic references.'],
    ['UDC / LBC index','Obtaining a classification index for a publication.'],
    ['Lost books','How to contact the library about a lost publication.'],
    ['Digital copies','Access conditions for digital copies of publications.'],
    ['Reading room','Borrowing books and using the reading room collection.'],
    ['Citation indexes','Information about scholarly citations and bibliometrics.'],
    ['Publication guidelines','Standards and examples for research publications.'],
    ['Literature acquisition','How to request new books for the library collection.'],
  ],
  kk: [
    ['Дерекқор нұсқаулықтары','Электрондық ресурстарды іздеу және пайдалану нұсқаулықтары.'],
    ['Әдебиеттер тізімі','Библиографиялық сипаттаманың ережелері мен үлгілері.'],
    ['ӘОЖ / КБЖ индексі','Жарияланым үшін жіктеу индексін алу.'],
    ['Кітаптың жоғалуы','Басылым жоғалған жағдайда кітапханаға жүгіну тәртібі.'],
    ['Цифрлық көшірмелер','Басылымдардың электрондық көшірмелеріне қол жеткізу шарттары.'],
    ['Оқу залы','Кітап алу және оқу залы қорымен жұмыс істеу.'],
    ['Дәйексөз индексі','Ғылыми дәйексөздер мен библиометрия туралы ақпарат.'],
    ['Жарияланымды рәсімдеу','Ғылыми жұмыстарды рәсімдеу стандарттары мен үлгілері.'],
    ['Әдебиет сатып алу','Кітапхана қорын толықтыруға өтінім беру тәртібі.'],
  ],
};
export function readerGuides(audience: 'students' | 'teachers') {
  return guides[getLang()].map(([title,body],i)=>({title,body,to:'/public/'+paths[i]})).filter((_,i)=>audience==='students'?i<6:i>=6);
}
