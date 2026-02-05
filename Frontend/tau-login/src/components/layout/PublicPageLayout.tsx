import type { ReactNode } from "react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";

export function PublicPageLayout({
  children,
  hero,
  maxWidthClassName = "max-w-4xl",
}: {
  children?: ReactNode;
  hero?: ReactNode;
  maxWidthClassName?: string;
}) {
  const hasChildren =
    children !== undefined &&
    children !== null &&
    children !== false &&
    !(Array.isArray(children) && children.length === 0);

  return (
    <div className="min-h-screen bg-[color:var(--public-bg)] flex flex-col">
      <PublicHeader />

      <main className="public-main flex-1 w-full">
        {hero}
        {hasChildren ? (
          <div className={["mx-auto grid gap-6 px-4 py-8 w-full", maxWidthClassName].join(" ")}>{children}</div>
        ) : null}
      </main>

      <PublicFooter />
    </div>
  );
}
