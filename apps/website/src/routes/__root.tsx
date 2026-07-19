/// <reference types="vite/client" />
import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from "react";
import {
  HeadContent,
  Scripts,
  createRootRoute,
  useRouterState,
} from "@tanstack/react-router";
import { getLocale, getTextDirection } from "../paraglide/runtime.js";

// Style order is load-bearing.
import "@fontsource-variable/inter/standard.css";
import "@fontsource-variable/inter/standard-italic.css";
// Inter has no CJK glyphs; without these, Japanese/Korean fall back to a thin OS
// font. Subset by unicode-range, so non-CJK pages fetch nothing.
import "@fontsource-variable/noto-sans-jp/wght.css";
import "@fontsource-variable/noto-sans-kr/wght.css";
import "../styles/tokens.css";
import "../styles/global.css";

import { FocusRingOverlay } from "../components/FocusRingOverlay.tsx";
import { Header } from "../components/Header.tsx";
import { Layout } from "../components/Layout.tsx";
import { LanguageToast } from "../components/LanguageToast.tsx";
import { Stagger } from "../components/Stagger.tsx";
import { Footer } from "../components/playground/Footer.tsx";
import { cssEase } from "../lib/motion.ts";
import { ogLocale } from "../lib/route-meta.ts";
import { SITE_ORIGIN } from "../lib/site.ts";
import { m } from "../paraglide/messages.js";
import { Home } from "../pages/Home.tsx";
import { What } from "../pages/What.tsx";
import { Playground } from "../pages/Playground.tsx";
import { MathPage } from "../pages/Math.tsx";
import { ChromeRedirect } from "./chrome.tsx";

const FADE_MS = 250;
const FOOTER_SLIDE_MS = 350;
const EASE = [0.4, 0, 0.2, 1] as const;

export const Route = createRootRoute({
  // Site-wide default meta = the home route's localized title/description.
  // Per-route head() overrides title/description/og/canonical for deeper
  // matches; these remain for unlisted internal pages. Built per-request so the
  // m.* messages + getLocale() resolve the URL's locale under concurrent SSR.
  head: () => ({
    meta: [
      { charSet: "UTF-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      { title: m.meta_home_title() },
      { name: "description", content: m.meta_home_description() },
      { name: "theme-color", content: "#f7f6f2" },
      { name: "robots", content: "index,follow" },

      { property: "og:type", content: "website" },
      { property: "og:locale", content: ogLocale(getLocale()) },
      { property: "og:title", content: m.meta_home_title() },
      { property: "og:description", content: m.meta_home_description() },
      { property: "og:url", content: `${SITE_ORIGIN}/` },
      { property: "og:image", content: `${SITE_ORIGIN}/og-image.png` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:alt", content: "lisse" },

      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: m.meta_home_title() },
      { name: "twitter:description", content: m.meta_home_description() },
      { name: "twitter:image", content: `${SITE_ORIGIN}/og-image.png` },

      // Structured data — index.html's @graph split into two equivalent
      // ld+json descriptors (plain objects; HeadContent serialises them).
      {
        "script:ld+json": {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Lisse",
          alternateName: "@lisse/core",
          description: m.meta_app_description(),
          applicationCategory: "DeveloperApplication",
          operatingSystem: "Cross-platform (browser, Node, edge runtimes)",
          url: "https://corne.rs/",
          downloadUrl: "https://www.npmjs.com/package/@lisse/core",
          license: "https://opensource.org/licenses/MIT",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          author: {
            "@type": "Person",
            name: "Jace Attard",
            url: "https://github.com/JaceThings",
          },
        },
      },
      {
        "script:ld+json": {
          "@context": "https://schema.org",
          "@type": "SoftwareSourceCode",
          name: "Lisse",
          codeRepository: "https://github.com/JaceThings/Lisse",
          programmingLanguage: "TypeScript",
          license: "https://opensource.org/licenses/MIT",
          url: "https://github.com/JaceThings/Lisse",
          author: {
            "@type": "Person",
            name: "Jace Attard",
            url: "https://github.com/JaceThings",
          },
        },
      },
    ],
    links: [
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16.png" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      // No canonical here: TanStack dedupes meta by name/property but NOT links by
      // rel, so a root canonical would double up with each route's own one.
    ],
    scripts: [
      {
        // data-platform=mac sniffer (from index.html). Runs pre-hydration,
        // only sets an <html> attribute, never branches React render.
        children:
          'if(/Macintosh/.test(navigator.userAgent)){document.documentElement.setAttribute("data-platform","mac");}',
      },
    ],
  }),
  component: RootComponent,
});

// Body renders via an explicit pathname -> component map, NOT <Outlet/>.
// <Outlet/> subscribes to a LIVE router store, so an exiting element would
// re-render to the DESTINATION route and the old page would never fade out.
// A distinct plain per-pathname element freezes the exiting page. New animated
// routes must be added here. ($.tsx redirects unknowns.)
const PAGES: Record<string, ComponentType> = {
  "/": Home,
  "/what": What,
  "/playground": Playground,
  "/math": MathPage,
  "/chrome": ChromeRedirect,
};

interface BodyFrame {
  pathname: string;
  Page: ComponentType;
  visible: boolean;
}

function AnimatedBody() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isFirstMount = useRef(true);
  const [frame, setFrame] = useState<BodyFrame>(() => ({
    pathname,
    Page: PAGES[pathname] ?? Home,
    visible: true,
  }));

  useEffect(() => {
    isFirstMount.current = false;
  }, []);

  useEffect(() => {
    if (pathname === frame.pathname) return;
    if (isFirstMount.current) {
      setFrame({
        pathname,
        Page: PAGES[pathname] ?? Home,
        visible: true,
      });
      return;
    }

    setFrame((prev) => ({ ...prev, visible: false }));
    let fadeIn: number | undefined;
    const fadeOut = window.setTimeout(() => {
      const Page = PAGES[pathname] ?? Home;
      setFrame({ pathname, Page, visible: false });
      fadeIn = window.setTimeout(() => {
        setFrame({ pathname, Page, visible: true });
      }, FOOTER_SLIDE_MS);
    }, FADE_MS);

    return () => {
      window.clearTimeout(fadeOut);
      if (fadeIn !== undefined) window.clearTimeout(fadeIn);
    };
  }, [pathname, frame.pathname]);

  const { Page, visible } = frame;

  return (
    <div
      className="w-full"
      style={{
        opacity: isFirstMount.current ? 1 : visible ? 1 : 0,
        transition: isFirstMount.current
          ? undefined
          : `opacity ${FADE_MS}ms ${cssEase(EASE)}`,
      }}
    >
      <Page />
    </div>
  );
}

function PersistentFooter() {
  const footerRef = useRef<HTMLElement>(null);
  const prevTop = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = footerRef.current;
    if (!el) return;
    const nextTop = el.offsetTop;
    if (prevTop.current !== null && prevTop.current !== nextTop) {
      const delta = prevTop.current - nextTop;
      el.style.transform = `translateY(${delta}px)`;
      el.style.transition = "transform 0ms";
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.transition = `transform ${FOOTER_SLIDE_MS}ms ${cssEase(EASE)}`;
          el.style.transform = "";
        });
      });
    }
    prevTop.current = nextTop;
  });

  return (
    <footer ref={footerRef} className="w-full">
      <Stagger index={14}>
        <Footer />
      </Stagger>
    </footer>
  );
}

function RootComponent() {
  const locale = getLocale();
  return (
    <html lang={locale} dir={getTextDirection(locale)}>
      <head>
        <HeadContent />
      </head>
      <body>
        <Layout>
          <Header staggerFrom={0} />
          <AnimatedBody />
          <PersistentFooter />
        </Layout>
        <FocusRingOverlay />
        <LanguageToast />
        <Scripts />
      </body>
    </html>
  );
}
