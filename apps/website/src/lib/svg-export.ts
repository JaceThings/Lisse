// SVG export — serialise a live SVG DOM node into a standalone string
// that renders correctly outside the site. The Copy SVG / Download
// buttons on /math use this to produce files a user can paste into
// other tools.
//
// The non-obvious work is `inlineTokens`: the diagram refers to its
// colours via CSS custom properties (`var(--color-text-primary)`,
// etc.) which only resolve when the SVG lives inside the page. When
// exported, those `var()` references would point at undefined tokens
// and the browser would fall back to black. We replace them with the
// literal hex values from `styles/tokens.css` so the exported file is
// self-contained. The duplication of those hex values here is
// unfortunate but necessary — the tokens file is CSS, not JS, so we
// can't read it at runtime without parsing.

const TOKEN_FALLBACKS: Record<string, string> = {
  "var(--color-text-primary)": "#73574a",
  "var(--color-text-input)": "#7e756c",
  "var(--color-accent-green)": "#5b793f",
  "var(--color-accent-red)": "#a45c5c",
  "var(--font-mono)":
    "SF Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
};

function inlineTokens(svgText: string): string {
  let out = svgText;
  for (const [token, literal] of Object.entries(TOKEN_FALLBACKS)) {
    out = out.split(token).join(literal);
  }
  return out;
}

/** Serialise a live SVG element to a standalone string. Ensures the
 *  required xmlns attributes are present and inlines CSS-token
 *  references so the output renders outside the site. */
export function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  if (!clone.getAttribute("xmlns:xlink")) {
    clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  }
  const raw = new XMLSerializer().serializeToString(clone);
  return inlineTokens(raw);
}
