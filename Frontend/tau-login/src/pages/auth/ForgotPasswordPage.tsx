import { useEffect,useRef,useState,type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import AuthShell from '@/components/layout/AuthShell';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import LibraryContacts from '@/components/common/LibraryContacts';
import { getLang } from '@/shared/i18n';
import { ApiError } from '@/shared/api/client';
import { requestPasswordReset,confirmPasswordReset } from '@/features/auth/api';

const recoveryCopy={
  ru:{title:'Восстановить пароль',intro:'Для учётной записи библиотеки по email. Пароль Platonus восстанавливается в университете.',email:'Email учётной записи',send:'Получить код',sending:'Отправляем запрос…',codeTitle:'Код и новый пароль',codeBody:'Если этот адрес связан с подтверждённой email-учётной записью, вы получите код. Он действует 10 минут. Проверьте также папку «Спам».',code:'Код из письма',password:'Новый пароль',confirm:'Повторите пароль',rules:'От 12 символов: строчная и заглавная буквы, цифра и специальный символ.',save:'Сохранить пароль',saving:'Сохраняем…',resend:'Запросить новый код',wait:'Повторный запрос через',seconds:'с',change:'Изменить email',success:'Пароль изменён',successBody:'Прежние сеансы завершены. Войдите с новым паролем.',login:'Войти по email',mismatch:'Пароли не совпадают.',weak:'Проверьте длину и состав пароля.',invalid:'Код неверен или истёк. Проверьте письмо или запросите новый код.',unavailable:'Отправка кодов сейчас недоступна. Попробуйте позже или обратитесь в библиотеку.',limited:'Слишком много запросов. Подождите перед следующей попыткой.',network:'Не удалось связаться с сервером. Проверьте соединение и повторите запрос.',help:'Нужна помощь с доступом?',access:'Как получить доступ'},
  kk:{title:'Құпиясөзді қалпына келтіру',intro:'Кітапхананың email тіркелгісі үшін. Platonus құпиясөзін университетте қалпына келтіру қажет.',email:'Тіркелгінің email мекенжайы',send:'Код алу',sending:'Сұрау жіберілуде…',codeTitle:'Код және жаңа құпиясөз',codeBody:'Бұл мекенжай расталған email тіркелгісімен байланысты болса, код аласыз. Ол 10 минут жарамды. «Спам» бумасын да тексеріңіз.',code:'Хаттағы код',password:'Жаңа құпиясөз',confirm:'Құпиясөзді қайталаңыз',rules:'Кемінде 12 таңба: кіші және бас әріп, сан және арнайы таңба.',save:'Құпиясөзді сақтау',saving:'Сақталуда…',resend:'Жаңа код сұрау',wait:'Қайта сұрауға дейін',seconds:'с',change:'Email мекенжайын өзгерту',success:'Құпиясөз өзгертілді',successBody:'Алдыңғы сеанстар аяқталды. Жаңа құпиясөзбен кіріңіз.',login:'Email арқылы кіру',mismatch:'Құпиясөздер сәйкес емес.',weak:'Құпиясөздің ұзындығы мен құрамын тексеріңіз.',invalid:'Код қате немесе мерзімі өткен. Хатты тексеріңіз немесе жаңа код сұраңыз.',unavailable:'Қазір код жіберу қолжетімсіз. Кейінірек қайталаңыз немесе кітапханаға хабарласыңыз.',limited:'Сұрау тым көп. Келесі әрекетті күтіңіз.',network:'Сервермен байланыс орнатылмады. Қосылымды тексеріп, қайталаңыз.',help:'Кіруге көмек керек пе?',access:'Қолжетімділікті қалай алуға болады'},
  en:{title:'Reset your password',intro:'For your library email account. Contact the university to recover a Platonus password.',email:'Account email',send:'Request a code',sending:'Sending request…',codeTitle:'Code and new password',codeBody:'If this address belongs to a verified email account, you will receive a code valid for 10 minutes. Check your spam folder too.',code:'Code from the email',password:'New password',confirm:'Repeat password',rules:'At least 12 characters with a lowercase letter, uppercase letter, number and symbol.',save:'Save password',saving:'Saving…',resend:'Request another code',wait:'Request again in',seconds:'s',change:'Change email',success:'Password changed',successBody:'Previous sessions have ended. Sign in with your new password.',login:'Sign in with email',mismatch:'The passwords do not match.',weak:'Check the password length and required characters.',invalid:'The code is invalid or expired. Check the email or request a new code.',unavailable:'Code delivery is currently unavailable. Try later or contact the library.',limited:'Too many requests. Wait before trying again.',network:'Could not reach the server. Check your connection and try again.',help:'Need help signing in?',access:'How to get access'},
};

export default function ForgotPasswordPage(){
  const words=recoveryCopy[getLang()];
  const [step,setStep]=useState<'request'|'confirm'|'done'>('request');
  const [email,setEmail]=useState(''),[code,setCode]=useState(''),[password,setPassword]=useState(''),[repeat,setRepeat]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[cooldown,setCooldown]=useState(0);
  const title=useRef<HTMLHeadingElement>(null);
  const countdown=cooldown>0;
  useEffect(()=>{if(step!=='request')title.current?.focus();},[step]);
  useEffect(()=>{if(!countdown)return;const timer=window.setInterval(()=>setCooldown(value=>Math.max(0,value-1)),1000);return()=>window.clearInterval(timer);},[countdown]);
  function handleError(cause:unknown){
    if(cause instanceof ApiError){
      if(cause.status===429){setCooldown(Math.min(3600,cause.retryAfter||60));setError(words.limited);}
      else if(cause.status===503)setError(words.unavailable);
      else if(cause.status===400)setError(words.invalid);
      else if(cause.status===422)setError(words.weak);
      else setError(words.network);
    }else setError(words.network);
  }
  async function requestCode(){
    if(busy||cooldown)return;
    setBusy(true);setError('');
    try{await requestPasswordReset(email.trim().toLowerCase());setEmail(value=>value.trim().toLowerCase());setCode('');setCooldown(60);setStep('confirm');}
    catch(cause){handleError(cause);}finally{setBusy(false);}
  }
  async function submit(event:FormEvent){
    event.preventDefault();if(busy)return;
    if(step==='request'){await requestCode();return;}
    if(password!==repeat){setError(words.mismatch);return;}
    if(password.length<12||!(/\p{Ll}/u.test(password)&&/\p{Lu}/u.test(password)&&/\p{N}/u.test(password)&&/[^\p{L}\p{N}\s]/u.test(password))){setError(words.weak);return;}
    setBusy(true);setError('');
    try{await confirmPasswordReset(email,code,password);setCode('');setPassword('');setRepeat('');setStep('done');}
    catch(cause){handleError(cause);}finally{setBusy(false);}
  }
  return <AuthShell><div className="auth-form-content access-flow">
    <div className="access-language"><LanguageSwitcher/></div>
    <h1 ref={title} tabIndex={-1}>{step==='done'?words.success:step==='confirm'?words.codeTitle:words.title}</h1>
    <p className="access-intro">{step==='done'?words.successBody:step==='confirm'?words.codeBody:words.intro}</p>
    {step==='done'?<Link className="tau-button tau-button--red access-primary" to="/auth/login?method=email">{words.login}<span aria-hidden="true">→</span></Link>:<form className="access-form" onSubmit={submit} aria-busy={busy}>
      <label htmlFor="recovery-email">{words.email}</label><input id="recovery-email" name="email" type="email" autoComplete="email" required maxLength={320} value={email} readOnly={step==='confirm'} onChange={event=>setEmail(event.target.value)} disabled={busy}/>
      {step==='confirm'&&<><label htmlFor="recovery-code">{words.code}</label><input id="recovery-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,'').slice(0,6))} disabled={busy}/>
        <label htmlFor="recovery-password">{words.password}</label><input id="recovery-password" name="new-password" type="password" autoComplete="new-password" minLength={12} maxLength={1024} required value={password} onChange={event=>setPassword(event.target.value)} aria-describedby="recovery-rules" disabled={busy}/><p id="recovery-rules" className="access-help">{words.rules}</p>
        <label htmlFor="recovery-repeat">{words.confirm}</label><input id="recovery-repeat" name="repeat-password" type="password" autoComplete="new-password" minLength={12} maxLength={1024} required value={repeat} onChange={event=>setRepeat(event.target.value)} disabled={busy}/></>}
      {error&&<p className="access-error" role="alert">{error}</p>}
      <button className="tau-button tau-button--red access-primary" type="submit" disabled={busy||(step==='request'&&cooldown>0)}>{busy?(step==='request'?words.sending:words.saving):(step==='request'?words.send:words.save)}<span aria-hidden="true">→</span></button>
      {cooldown>0&&<p className="access-help" role="status">{words.wait} {cooldown} {words.seconds}</p>}
      {step==='confirm'&&<div className="access-secondary"><button type="button" onClick={requestCode} disabled={busy||cooldown>0}>{words.resend}</button><button type="button" onClick={()=>{setStep('request');setError('');setCode('');setPassword('');setRepeat('');}} disabled={busy}>{words.change}</button></div>}
    </form>}
    {step!=='done'&&<Link className="text-action" to="/auth/login?method=email">{words.login}</Link>}
    <aside className="access-support"><h2>{words.help}</h2><Link to="/auth/register" className="text-action">{words.access}<span aria-hidden="true"> ↗</span></Link><LibraryContacts/></aside>
  </div></AuthShell>;
}
