import { Link } from 'react-router-dom';
import AuthShell from '@/components/layout/AuthShell';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import LibraryContacts from '@/components/common/LibraryContacts';
import { getLang } from '@/shared/i18n';

const accessCopy={
  ru:{title:'Как получить доступ',intro:'Самостоятельная регистрация закрыта. Выберите подходящий способ входа.',study:'Учётная запись Platonus',studyBody:'Студенты и сотрудники входят с логином и паролем Platonus. Если система запросит email, укажите доступный вам адрес и подтвердите его кодом из письма.',login:'Войти через Platonus',first:'Нет логина Platonus?',firstBody:'Логин и пароль для Platonus выдаёт офис-регистратор / ЦОС. Уточните получение учётной записи в этом подразделении.',registrar:'Офис-регистратор на сайте TAU',email:'Уже есть вход по email',emailBody:'Используйте ранее созданную email-учётную запись библиотеки. Забытый пароль можно восстановить по коду.',emailLogin:'Войти по email',reset:'Восстановить пароль',help:'Помощь библиотеки'},
  kk:{title:'Қолжетімділікті қалай алуға болады',intro:'Өз бетінше тіркелу жабық. Сәйкес кіру тәсілін таңдаңыз.',study:'Platonus тіркелгісі',studyBody:'Студенттер мен қызметкерлер Platonus логині және құпиясөзімен кіреді. Жүйе email сұраса, өзіңіз қолданатын мекенжайды көрсетіп, хаттағы кодпен растаңыз.',login:'Platonus арқылы кіру',first:'Platonus логині жоқ па?',firstBody:'Platonus логині мен құпиясөзін офис-тіркеуші / СҚКО береді. Тіркелгі алу мәселесін осы бөлімнен нақтылаңыз.',registrar:'TAU сайтындағы офис-тіркеуші',email:'Email арқылы кіру бар',emailBody:'Кітапхананың бұрын ашылған email тіркелгісін пайдаланыңыз. Ұмытылған құпиясөзді код арқылы қалпына келтіруге болады.',emailLogin:'Email арқылы кіру',reset:'Құпиясөзді қалпына келтіру',help:'Кітапхана көмегі'},
  en:{title:'How to get access',intro:'Self-registration is closed. Choose the sign-in method that applies to you.',study:'Platonus account',studyBody:'Students and staff sign in with their Platonus credentials. If asked for an email, enter an address you can access and confirm it using the emailed code.',login:'Sign in with Platonus',first:'No Platonus login?',firstBody:'The Registrar’s Office / Student Service Centre issues Platonus credentials. Contact that department to ask about obtaining your account.',registrar:'Registrar’s Office on the TAU website',email:'Existing email account',emailBody:'Use your previously created library email account. A forgotten password can be reset using an emailed code.',emailLogin:'Sign in with email',reset:'Reset password',help:'Library support'},
};
export default function RegisterPage(){
  const words=accessCopy[getLang()];
  return <AuthShell><div className="auth-form-content access-flow"><div className="access-language"><LanguageSwitcher/></div><h1>{words.title}</h1><p className="access-intro">{words.intro}</p>
    <section className="access-option"><h2>{words.study}</h2><p>{words.studyBody}</p><Link className="tau-button tau-button--red access-primary" to="/auth/login">{words.login}<span aria-hidden="true">→</span></Link></section>
    <section className="access-option"><h2>{words.first}</h2><p>{words.firstBody}</p><a className="text-action" href="https://tau-edu.kz/department/ofis-registrator" target="_blank" rel="noreferrer">{words.registrar}<span aria-hidden="true"> ↗</span></a></section>
    <section className="access-option"><h2>{words.email}</h2><p>{words.emailBody}</p><div className="access-secondary"><Link to="/auth/login?method=email">{words.emailLogin}</Link><Link to="/auth/forgot">{words.reset}</Link></div></section>
    <aside className="access-support"><h2>{words.help}</h2><LibraryContacts/></aside>
  </div></AuthShell>;
}
