import type { ReactNode } from "react";

// `@container/column` lets descendants read the column width via `100cqi`
// (used by the Demo's compare-mode squircle). Overlay effects
// (`FocusRingOverlay`, `SelectionHighlight`) are intentionally mounted at
// App root, not here, so they persist across route changes.
const ARTICLE_BASE =
  "@container/column relative flex w-[510px] max-w-full flex-col items-stretch py-20 max-[560px]:w-[calc(100vw-32px)] max-[560px]:pt-6 max-[560px]:pb-16";

export function Layout({
  children,
  articleClassName,
}: {
  children: ReactNode;
  /** Tailwind classes appended to the article shell — e.g. `gap-9`
   *  for Home, smaller gaps for text-heavy pages. */
  articleClassName?: string;
}) {
  return (
    <main className="flex min-h-dvh w-full items-stretch justify-center bg-bg">
      <article className={`${ARTICLE_BASE} ${articleClassName ?? "gap-9"}`}>
        {children}
      </article>
    </main>
  );
}
