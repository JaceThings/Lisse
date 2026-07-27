import { useEffect, type RefObject } from "react";
import { getLocale } from "../paraglide/runtime.js";

/**
 * Knuth–Plass line breaking over the justified body copy, replacing the
 * browser's one-line-at-a-time greedy pass. Progressive enhancement: the
 * `text-justify hyphens-auto` classes stay as the no-JS rendering, and justif
 * only upgrades paragraphs it can measure.
 */
type Hyphenate = (word: string) => readonly string[];

// ponytail: only the locales the site ships. ja/ko justify between characters
// under kinsoku rules, which needs no pattern file.
const HYPHENATORS: Record<string, () => Promise<Hyphenate>> = {
  en: () => import("justif/hyphenate/en-gb").then((mod) => mod.hyphenateEnGB),
  de: () => import("justif/hyphenate/de").then((mod) => mod.hyphenateDe),
};

export function useJustif(ref: RefObject<HTMLElement | null>) {
  const locale = getLocale();

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    let controller: { destroy(): void } | undefined;
    let live = true;

    void (async () => {
      const [{ justify }, hyphenate] = await Promise.all([
        import("justif"),
        HYPHENATORS[locale]?.(),
      ]);
      // The await gives React time to unmount us mid-route-transition.
      if (!live) return;
      const paragraphs = root.querySelectorAll("p.text-justify");
      if (paragraphs.length > 0) controller = justify(paragraphs, { hyphenate });
    })();

    return () => {
      live = false;
      controller?.destroy();
    };
  }, [locale]);
}
