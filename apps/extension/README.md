# Lisse extension

A cross-browser WebExtension (and a userscript) that swaps the plain circular
corners on any website for Lisse's smooth (squircle) curves. It reads each
element's computed `border-radius`, keeps the radius exactly as the site set it,
and only replaces the corner geometry via `clip-path`.

It leaves everything else alone. When an element carries an outer box-shadow —
which `clip-path` would otherwise clip away — the shadow is re-expressed as an
equivalent `drop-shadow()` filter so it survives. A uniform solid border
(0.5–6px, same width/style/colour on all four sides) is redrawn as a stroked
SVG that follows the smooth path: the native border paint is hidden with
`border-color: transparent` (layout is preserved) and the stroke is injected as
an extra `background-image` layer, prepended ahead of any existing layers so
they keep their own values.

It runs at `document_start` and attaches a `MutationObserver` before the parser
streams the page in, so corners are smoothed as elements arrive rather than a
few seconds after load. A time-sliced `requestAnimationFrame` loop applies the
work before paint, so elements never flash square. Animated state changes
(hover, focus) that transition a radius, size, or colour are re-processed when
their `transitionend`/`animationend` fires.

## Build

```sh
pnpm --filter @lisse/extension build
```

This produces:

- `dist/chrome/` — Chrome/Chromium MV3 (manifest, content + background scripts, icons)
- `dist/firefox/` — the same, plus a Gecko add-on id
- `dist/lisse.user.js` — a userscript for Tampermonkey/Violentmonkey/Safari

## Install unpacked

**Chrome:** go to `chrome://extensions`, turn on Developer mode, choose *Load
unpacked*, and pick `dist/chrome`.

**Firefox:** go to `about:debugging` → *This Firefox* → *Load Temporary
Add-on…* and pick `dist/firefox/manifest.json`. (Temporary add-ons clear on
restart.)

Click the toolbar icon to toggle smoothing for the current site: a coloured
icon means it's on, a grey one means it's off. State is remembered per hostname
(on by default), and the click is a no-op on pages we can't touch (`chrome://`,
`about:`, and the like). Smoothing is fixed at 0.6, the iOS match. Toggling
applies and restores instantly — animating clip-path between an arc and a
squircle interpolates control points, which wobbles mid-flight rather than
easing cleanly, so we don't.

## Userscript

`dist/lisse.user.js` is the same engine wrapped in a userscript. It's always
on (no toolbar toggle); edit the `SMOOTHING` constant at the top to taste.

**Tampermonkey** (Chrome, Edge, Firefox, Safari, Opera): open the Tampermonkey
dashboard → *Utilities* → *Import from file* and pick `lisse.user.js`, or drag
the file onto the dashboard. If the script is hosted somewhere, opening any URL
ending in `.user.js` prompts an install automatically.

**Violentmonkey** (Chrome, Edge, Firefox): dashboard → `+` → *Install from
local file*.

**Greasemonkey** (Firefox): Greasemonkey installs from URLs rather than local
files — either host the file (opening the URL prompts the install) or use
*New user script* and paste the contents in.

**Safari on macOS and iOS**: the free [Userscripts](https://apps.apple.com/app/userscripts/id1463298887)
app is the least-friction route — enable it in Safari's extension settings,
put `lisse.user.js` in its scripts folder (on iOS: the *Userscripts* folder in
Files), and it runs on both desktop and mobile Safari. No developer account
needed.

Hosting the file publicly (e.g. `https://corne.rs/lisse.user.js`) makes
installs one click for every manager above, and adding `@downloadURL`/
`@updateURL` lines to the banner then gives users automatic updates.

## Safari

Wrap the Chrome build into a Safari app extension with Apple's converter:

```sh
xcrun safari-web-extension-converter dist/chrome
```

You can run the result locally after enabling *Allow unsigned extensions* in
Safari's Develop menu. App Store distribution needs the paid Apple Developer
Programme.

## Publishing to the stores

No separate repository is needed for any store — they all take a zip of the
built output, which the build emits as `dist/lisse-chrome.zip` and
`dist/lisse-firefox.zip`.

**Chrome Web Store**: register as a developer at the
[developer dashboard](https://chrome.google.com/webstore/devconsole) ($5
one-time), create an item, and upload `lisse-chrome.zip`. The listing
(description, screenshots, category, privacy declarations) is filled in on the
dashboard, not in the zip. Review typically takes a day or two; updates are
the same zip upload with a bumped manifest `version`.

**Firefox Add-ons (AMO)**: free account at
[addons.mozilla.org](https://addons.mozilla.org/developers/), upload
`lisse-firefox.zip`. Because the shipped code is bundled and minified, AMO's
reviewers will ask for the source: upload a zip of this package's `src/` plus
build instructions (`pnpm install && pnpm --filter @lisse/extension build`)
in the "source code" step of the same submission form.

**Safari / App Store**: run the converter (below), open the generated Xcode
project, and archive it with an Apple Developer Programme membership ($99/yr).
The Userscripts route above covers Safari users without it.

## Known limitations

- **Native `corner-shape`.** Any element whose `corner-shape` isn't the
  default `round` is left untouched — smooth (`squircle`, x.com ships it) or
  decorative (`scoop`, `bevel`, `notch`, `square`). The site chose its own
  geometry: overriding a native squircle with our smoothing visibly fattens
  the corners, and replicating it exactly would change nothing.

- **Non-uniform borders.** Only a uniform solid border is redrawn. Dashed,
  dotted, double, per-side, or multi-colour borders — and anything outside
  0.5–6px — are skipped entirely (correctness over coverage), so the element
  keeps its plain circular corners.
- **Border colour on hover.** A redrawn border's colour is snapshotted the
  first time we touch the element (our own `border-color: transparent` hides
  the site's value from later reads), so a border whose *colour* animates on
  hover keeps its initial colour. Its width and radius still track.
- **Elliptical corners.** Corners with two different radii (`10px 20px`) are
  skipped; Lisse paths are circular-cornered only.
- **Instant pseudo-class changes.** State changes that animate (transition or
  keyframes) are tracked via their end events, but an *instant* `:hover` restyle
  fires no DOM signal, so a radius/size that jumps with no transition isn't
  re-processed until the next mutation or resize.
- **Animated radii.** We apply a static path, so a site that transitions or
  animates its `border-radius` won't animate smoothly through our curve — it
  reprocesses when the transition ends instead.
- **Canvas/WebGL UIs.** Anything drawn to a canvas rather than laid out as DOM
  (some map, editor, and game UIs) can't be reached.
- **Closed shadow roots.** Only open shadow roots are walked; closed ones are
  invisible to any content script.
- **`filter` containing block.** Converting a shadow to `drop-shadow` sets
  `filter`, which establishes a containing block — a rare edge case for
  descendants positioned against a further-out ancestor.

Child clipping mostly just works: `clip-path` on a parent clips its children,
so an element that relied on `overflow: hidden` + `border-radius` to round its
contents stays rounded.
