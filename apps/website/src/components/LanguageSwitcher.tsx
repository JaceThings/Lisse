import { useRouterState } from "@tanstack/react-router";
import {
  getLocale,
  localizeHref,
  locales,
} from "../paraglide/runtime.js";
import { localeName } from "../lib/route-meta.ts";
import { m } from "../paraglide/messages.js";

// Crawlable language switcher: one real <a> per locale pointing at the SAME page
// in that locale (endonym label, in its own script — never a flag). These are
// plain anchors, NOT <Link>, so a click does a full document navigation: the
// server re-renders the target locale's HTML (no stale in-place text, and the
// URL — which is the source of truth for the locale — changes). Hidden until a
// second locale is registered in project.inlang/settings.json.
export function LanguageSwitcher() {
  // location.pathname is the de-localized (internal) path, e.g. "/what" even on
  // "/de/what" (the router rewrite strips the prefix). localizeHref re-adds the
  // target locale's prefix.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = getLocale();

  if (locales.length < 2) return null;

  return (
    <nav
      aria-label={m.switcher_aria_label()}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] leading-[1.2] font-medium tracking-[-0.25px] text-text-secondary"
    >
      {locales.map((locale) => {
        const active = locale === current;
        return (
          <a
            key={locale}
            href={localizeHref(pathname, { locale })}
            hrefLang={locale}
            lang={locale}
            aria-current={active ? "true" : undefined}
            className={
              active
                ? "footer-link text-text-primary"
                : "footer-link hover:text-text-primary"
            }
            data-focus-ring
            data-focus-inset-x="4"
          >
            {localeName(locale)}
          </a>
        );
      })}
    </nav>
  );
}
