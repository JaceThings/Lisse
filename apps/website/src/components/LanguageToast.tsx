import { useEffect, useState } from "react";
import { SmoothCorners } from "@lisse/react";
import type { ShadowConfig } from "@lisse/core";
import {
  type Locale,
  deLocalizeHref,
  getLocale,
  locales,
  localizeHref,
} from "../paraglide/runtime.js";
import { Fade } from "./Presence.tsx";

const OFFER: Record<string, { prompt: string; accept: string; dismiss: string }> = {
  ja: { prompt: "このページを日本語で表示しますか？", accept: "日本語で表示", dismiss: "英語のまま" },
  ko: { prompt: "이 페이지를 한국어로 볼까요?", accept: "한국어로 보기", dismiss: "영어로 유지" },
  de: { prompt: "Diese Seite auf Deutsch anzeigen?", accept: "Auf Deutsch", dismiss: "Bei Englisch bleiben" },
  en: { prompt: "View this page in English?", accept: "English", dismiss: "Not now" },
};

const TOAST_SHADOW: ShadowConfig[] = [
  { offsetX: 0, offsetY: 0, blur: 0, spread: 1, color: "#777777", opacity: 0.08 },
  { offsetX: 0, offsetY: 2, blur: 1, spread: -0.5, color: "#777777", opacity: 0.08 },
];

const ALL = locales as readonly string[];

const PROMPT_COOKIE = "lisse_lang_prompt";
const setCookie = (name: string, value: string) => {
  document.cookie = `${name}=${value};path=/;max-age=31536000;samesite=lax;secure`;
};
const remember = (loc: string) => {
  setCookie("PARAGLIDE_LOCALE", loc);
  setCookie(PROMPT_COOKIE, "1");
};
const responded = () => new RegExp(`(?:^|; )${PROMPT_COOKIE}=`).test(document.cookie);

function gotoLocale(loc: string, replace: boolean) {
  remember(loc);
  const url = new URL(location.href);
  url.searchParams.delete("lang");
  url.searchParams.delete("toast");
  const href = localizeHref(
    deLocalizeHref(`${url.pathname}${url.search}${url.hash}`),
    { locale: loc as Locale },
  );
  if (replace) location.replace(href);
  else location.assign(href);
}

function preferred(): string | null {
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of tags) {
    if (ALL.includes(tag)) return tag;
    const base = tag.toLowerCase().split("-")[0];
    const hit = ALL.find((l) => l.toLowerCase().split("-")[0] === base);
    if (hit) return hit;
  }
  return null;
}

const BTN =
  "flex flex-1 cursor-pointer items-center justify-center px-2.5 py-1.5 text-[14px] leading-[1.2] font-medium tracking-[-0.25px] whitespace-nowrap text-text-input transition-colors";

export function LanguageToast() {
  const [offer, setOffer] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const forced = params.get("lang");
    if (forced && ALL.includes(forced)) {
      if (forced === getLocale()) {
        remember(forced);
        const u = new URL(location.href);
        u.searchParams.delete("lang");
        u.searchParams.delete("toast");
        history.replaceState(null, "", `${u.pathname}${u.search}${u.hash}`);
      } else {
        gotoLocale(forced, true);
      }
      return;
    }
    const demo = params.get("toast");
    if (demo && OFFER[demo] && demo !== getLocale()) {
      setOffer(demo);
      setOpen(true);
      setPreview(true);
      return;
    }
    if (responded()) return;
    const want = preferred();
    if (want && want !== getLocale() && OFFER[want]) {
      setOffer(want);
      setOpen(true);
    }
  }, []);

  if (!offer) return null;
  const copy = OFFER[offer];

  const accept = () => gotoLocale(offer, false);
  const dismiss = () => {
    if (!preview) setCookie(PROMPT_COOKIE, "1");
    setOpen(false);
  };

  return (
    <Fade
      show={open}
      className="fixed right-4 bottom-4 z-50 w-[277px] max-w-[calc(100vw-2rem)]"
      durationMs={240}
      y={12}
    >
      <div lang={offer} role="region" aria-label={copy.prompt}>
        <SmoothCorners
          autoEffects={false}
          corners={{ topLeft: 12, topRight: 12, bottomRight: 20, bottomLeft: 20 }}
          shadow={TOAST_SHADOW}
          className="flex flex-col gap-3 bg-white p-3"
        >
          <p className="text-[14px] leading-[1.2] font-medium tracking-[-0.25px] text-text-primary">
            {copy.prompt}
          </p>
          <div className="flex gap-2.5">
            <SmoothCorners
              as="button"
              type="button"
              autoEffects={false}
              corners={{ radius: 8 }}
              onClick={accept}
              className={`${BTN} bg-[#7e756c]/12 hover:bg-[#7e756c]/[0.18]`}
              data-focus-ring
              data-focus-inset-x="6"
            >
              {copy.accept}
            </SmoothCorners>
            <SmoothCorners
              as="button"
              type="button"
              autoEffects={false}
              corners={{ radius: 8 }}
              onClick={dismiss}
              className={`${BTN} hover:bg-[#7e756c]/[0.08]`}
              data-focus-ring
              data-focus-inset-x="6"
            >
              {copy.dismiss}
            </SmoothCorners>
          </div>
        </SmoothCorners>
      </div>
    </Fade>
  );
}
