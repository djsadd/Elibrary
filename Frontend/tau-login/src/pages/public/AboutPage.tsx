import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { PublicPageLayout } from "@/components/layout/PublicPageLayout";
import { getLang, t } from "@/shared/i18n";
import { designCopy } from "@/shared/designCopy";
import LibraryContacts from "@/components/common/LibraryContacts";

const aboutCopy={
  ru:{address:'Адрес библиотеки',error:'Не удалось загрузить историю и миссию библиотеки. Попробуйте ещё раз — адрес и часы работы доступны ниже.'},
  en:{address:'Library address',error:'The library history and mission could not be loaded. Please try again. The address and opening hours are available below.'},
  kk:{address:'Кітапхана мекенжайы',error:'Кітапхананың тарихы мен миссиясы жүктелмеді. Қайталап көріңіз. Мекенжай мен жұмыс уақыты төменде көрсетілген.'},
};

export default function AboutPage() {
  const [aboutData, setAboutData] = useState<{
    founded_date: string;
    mission: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt,setAttempt]=useState(0);
  const words=aboutCopy[getLang()];
  const lang=getLang();
  const copy=designCopy();

  useEffect(() => {
    document.title = `${t("publicHome.nav.about")} - ${t("publicHome.brand")}`;
  }, []);

  useEffect(() => {
    const controller=new AbortController();
    const fetchAboutData = async () => {
      setLoading(true);setError(false);
      try {
        const response = await fetch(`/api/catalog/about?lang=${lang}`,{signal:controller.signal});
        if (!response.ok) throw new Error("Failed to fetch about information");
        const data = await response.json();
        if(!controller.signal.aborted)setAboutData(data);
      } catch {
        if(!controller.signal.aborted)setError(true);
      } finally {
        if(!controller.signal.aborted)setLoading(false);
      }
    };

    fetchAboutData();
    return()=>controller.abort();
  }, [attempt,lang]);

  return (
    <PublicPageLayout>
      <section className="public-page-intro">
        <h1 className="text-3xl font-semibold text-slate-900">{t("publicHome.nav.about")}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-700">{t("publicHome.about.intro")}</p>
      </section>

      {loading && (
        <div className="about-load-state" role="status">
          <p>{t("publicHome.common.loading")}</p>
        </div>
      )}

      {error && (
        <div className="about-load-state" role="alert">
          <p>{words.error}</p><button type="button" className="atlas-text-link" onClick={()=>setAttempt(value=>value+1)}>{copy.retry}<span aria-hidden="true">↗</span></button>
        </div>
      )}

      {aboutData && !loading && (
        <>
          <section className="atlas-document">
            <h2 className="text-xl font-semibold text-slate-900">{t("publicHome.about.historyTitle")}</h2>
            <p className="mt-4 text-sm leading-7 text-slate-700">{aboutData.founded_date}</p>
          </section>

          <section className="atlas-document">
            <h2 className="text-xl font-semibold text-slate-900">{t("publicHome.about.missionTitle")}</h2>
            <div className="mt-4 text-sm leading-7 text-slate-700 space-y-3">
              <p>{aboutData.mission}</p>
            </div>
          </section>
        </>
      )}

      <section id="contacts" className="library-visit" aria-labelledby="library-visit-title">
        <h2 id="library-visit-title">{t('publicHome.footer.contactsTitle')}</h2>
        <LibraryContacts full/>
      </section>

      <div className="atlas-document-cta">
        <p className="text-sm text-slate-700 mb-4">{t("publicHome.about.catalogCta")}</p>
        <Link
          to="/catalog"
          className="inline-block rounded-full bg-[color:var(--public-accent)] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--public-accent-hover)]"
        >
          {copy.explore}
        </Link>
      </div>
    </PublicPageLayout>
  );
}

