import type { ReactNode } from "react";

/**
 * Shared page shell. Centres a single ~510 px article column over the
 * bg-bg cream and inherits the responsive width flip at 560 px. The
 * `@container/column` token lets descendants read the column width
 * via `100cqi` (the Demo's compare-mode squircle uses this).
 *
 * Layout deliberately does NOT include `FocusRingOverlay` or
 * `SelectionHighlight` — those are mounted once at the App root so
 * they persist across route changes.
 */
const ARTICLE_BASE =
  "@container/column relative flex w-[510px] max-w-full flex-col items-stretch py-figma-20 max-[560px]:w-[calc(100vw-32px)] max-[560px]:py-figma-6";

export function Layout({
  children,
  articleClassName,
}: {
  children: ReactNode;
  /** Tailwind classes appended to the article shell — e.g. `gap-figma-9`
   *  for Home, smaller gaps for text-heavy pages. */
  articleClassName?: string;
}) {
  return (
    <main className="flex min-h-dvh w-full items-stretch justify-center bg-bg">
      <article className={`${ARTICLE_BASE} ${articleClassName ?? "gap-figma-9"}`}>
        {children}
      </article>
    </main>
  );
}
