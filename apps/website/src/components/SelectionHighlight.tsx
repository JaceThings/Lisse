import { useEffect, useSyncExternalStore } from "react";
import { highlightSelection } from "@highlighters/core";
import {
  getHighlightOptions,
  subscribeHighlightOptions,
} from "./selectionHighlightOptions.ts";

const STYLE_ID = "selection-highlight-styles";
const TOUCH_MEDIA_QUERY = "(hover: none) and (pointer: coarse)";

/**
 * Paints the live text selection as a highlighter-marker stroke in the site's
 * brown, via @highlighters/core's selection pipeline. Native `::selection` is
 * suppressed behind a readiness class so the browser default still paints if
 * JS never hydrates — and on coarse pointers, where the library defers to the
 * native selection UI, the class is never added.
 *
 * Marker options come from a tiny external store (see selectionHighlightOptions),
 * so the dev-only <SelectionHighlightTuner> can re-tune the stroke live. In
 * production the store never changes; the mark is created once from DEFAULT_OPTIONS.
 *
 * Regions that shouldn't be band-highlighted (visually-hidden `sr-only` a11y
 * text, the demo, install commands, footer nav) opt out with `data-highlight-exclude`;
 * `user-select: none` alone doesn't stop the mark, since the pipeline reads the
 * selection Range, not the browser's visual selection.
 */
export function SelectionHighlight() {
  const options = useSyncExternalStore(
    subscribeHighlightOptions,
    getHighlightOptions,
    getHighlightOptions,
  );

  // Suppress the native ::selection paint once JS is ready (mount-once).
  useEffect(() => {
    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent =
        "html.selection-highlight-ready ::selection { background-color: transparent; color: inherit; }";
      document.head.appendChild(style);
    }
    const touchPrimary = window.matchMedia(TOUCH_MEDIA_QUERY).matches;
    if (!touchPrimary) {
      document.documentElement.classList.add("selection-highlight-ready");
    }
    return () => {
      document.documentElement.classList.remove("selection-highlight-ready");
    };
  }, []);

  // (Re)create the selection mark whenever the tuned options change.
  useEffect(() => {
    const mark = highlightSelection(options);
    return () => mark.remove();
  }, [options]);

  return null;
}
