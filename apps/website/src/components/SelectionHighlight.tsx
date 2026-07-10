import { useEffect } from "react";
import { highlightSelection } from "@highlighters/core";

const STYLE_ID = "selection-highlight-styles";
const TOUCH_MEDIA_QUERY = "(hover: none) and (pointer: coarse)";

/**
 * Paints the live text selection as a highlighter-marker stroke in the site's
 * brown, via @highlighters/core's selection pipeline. Native `::selection` is
 * suppressed behind a readiness class so the browser default still paints if
 * JS never hydrates — and on coarse pointers, where the library defers to the
 * native selection UI, the class is never added.
 */
export function SelectionHighlight() {
  useEffect(() => {
    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent =
        "html.selection-highlight-ready ::selection { background-color: transparent; color: inherit; }";
      document.head.appendChild(style);
    }

    const mark = highlightSelection({
      color: "rgb(115, 87, 74)", // --primary-rgb: marker brown on cream
      opacity: 0.45,
    });
    const touchPrimary = window.matchMedia(TOUCH_MEDIA_QUERY).matches;
    if (!touchPrimary) {
      document.documentElement.classList.add("selection-highlight-ready");
    }

    return () => {
      document.documentElement.classList.remove("selection-highlight-ready");
      mark.remove();
    };
  }, []);

  return null;
}
