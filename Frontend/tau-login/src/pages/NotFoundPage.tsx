import { Link, useLocation } from "react-router-dom";

export default function NotFoundPage() {
  const location = useLocation();

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_top,_#fff5f7_0%,_#f2f2f5_45%,_#d7dbe2_100%)] flex items-center justify-center px-6 py-12">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/70 bg-white/80 px-8 py-10 shadow-2xl backdrop-blur">
        <div className="absolute -top-20 -right-16 h-48 w-48 rounded-full bg-[#7b0f2b]/10 blur-2xl" />
        <div className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-[#7b0f2b]/15 blur-3xl" />

        <div className="relative">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#7b0f2b]/70">Error</p>
          <h1 className="mt-3 text-6xl font-bold text-[#7b0f2b]">404</h1>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Страница не найдена</h2>
          <p className="mt-3 text-slate-600">
            Возможно, ссылка устарела или вы опечатались в адресе.
          </p>
          <div className="mt-4 rounded-xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-500">
            {location.pathname}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-xl bg-[#7b0f2b] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#6b0d26]"
            >
              Вернуться на главную
            </Link>
            <span className="text-xs text-slate-500">Если ошибка повторяется, сообщите администратору.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
