import { Link } from "react-router-dom";
import { Divider } from "../components/Divider.tsx";
import { Header } from "../components/Header.tsx";
import { Layout } from "../components/Layout.tsx";
import { Stagger } from "../components/Stagger.tsx";

// Justified body matches Figma node 35:238 — `text-text-primary`, not the
// muted input colour. `hyphens-auto` is inherited from the global `p` rule
// in global.css but listing it here keeps the intent visible at the call
// site.
const BODY =
  "text-[14px] leading-[1.2] font-medium tracking-[-0.25px] text-text-primary text-justify hyphens-auto";

// Reveal sequence: header heading + 4 definition lines (5), then one
// stagger slot per body paragraph, then the footer nav as a single slot.
const HEADER_FIRST = 0;
const BODY_FIRST = 5;
const PARAGRAPHS = 8;
const FOOTER_INDEX = BODY_FIRST + PARAGRAPHS;

/**
 * Long-form explainer page. Reuses the dictionary `Header` at the top so
 * the brand mark, etymology, and divider stay consistent across routes,
 * then walks through what a squircle is, why CSS quarter-circles fall
 * short, and how Lisse draws the smoother curve.
 *
 * Body copy here is placeholder — the layout, hierarchy, and reveal order
 * are the load-bearing pieces; the words will be rewritten.
 */
export function What() {
  return (
    <Layout articleClassName="gap-figma-9">
      <Header staggerFrom={HEADER_FIRST} />

      <section className="flex w-full flex-col gap-figma-4 pb-figma-6">
        <Stagger index={BODY_FIRST}>
          <p className={BODY}>
            A squircle is a rounded rectangle whose corners ease into the
            straight edges instead of meeting them at a hard tangent. The
            curvature ramps up gradually, peaks at the corner, and ramps
            back down — the same shape Apple uses for app icons and Figma
            uses for any frame with corner smoothing turned on.
          </p>
        </Stagger>

        <Stagger index={BODY_FIRST + 1}>
          <p className={BODY}>
            CSS border-radius doesn't draw this curve. It draws a
            quarter-circle: a single arc with constant curvature that hits
            the edge at a sharp tangent. At small radii nobody notices.
            At the radii most product surfaces use — 12, 16, 24 pixels —
            the seam between arc and edge is visible, and the corner reads
            as harder than it should.
          </p>
        </Stagger>

        <Stagger index={BODY_FIRST + 2}>
          <p className={BODY}>
            Lisse generates the squircle path in SVG and clips the element
            to it. The shape is a superellipse with a smoothing parameter
            that controls how far the curve reaches into the straight edge
            before it starts turning. A smoothing of zero collapses back
            to the CSS quarter-circle; a smoothing of one is the maximally
            soft Apple-style corner. Most surfaces want somewhere around
            0.6.
          </p>
        </Stagger>

        <Stagger index={BODY_FIRST + 3}>
          <p className={BODY}>
            Because the path is generated per element and not inherited
            from the browser's rounded-rectangle primitive, borders and
            drop shadows have to be regenerated too — otherwise they trace
            the wrong shape. Lisse handles both. Strokes follow the same
            superellipse; shadows are rendered as offset copies of the
            clip path, so the soft edge stays consistent with the surface
            it's attached to.
          </p>
        </Stagger>

        <Stagger index={BODY_FIRST + 4}>
          <p className={BODY}>
            Per-corner radii work the same way they do in CSS. Pass a
            single number for a uniform squircle, or four numbers — or an
            object keyed by corner — and each corner gets its own radius
            and smoothing. Mixed corners stay continuous along the edges
            between them; you don't get the kink you'd see if you tried
            to butt two different border-radius values together.
          </p>
        </Stagger>

        <Stagger index={BODY_FIRST + 5}>
          <p className={BODY}>
            The library is small. The core has no dependencies and ships
            as plain ESM. Framework bindings exist for React, Vue, and
            Svelte; each one is a thin wrapper that takes the same props,
            measures the element on mount and on resize, and feeds the
            measurements to the core. There's no runtime cost on top of
            what the browser already does to paint the element.
          </p>
        </Stagger>

        <Stagger index={BODY_FIRST + 6}>
          <p className={BODY}>
            Resize handling is the part that makes the library worth
            installing. A squircle path depends on the element's pixel
            width and height — not on percentages, not on cqi units — so
            the path has to be regenerated whenever the box changes size.
            Lisse uses a single shared ResizeObserver for every mounted
            instance, batches reads against the browser's layout phase,
            and only writes back into the DOM if the new path actually
            differs from the previous one.
          </p>
        </Stagger>

        <Stagger index={BODY_FIRST + 7}>
          <p className={BODY}>
            If you've ever shipped a component library that tried to
            match a Figma file pixel-for-pixel and given up on the
            corners, this is the missing piece. The rest of the design
            translates cleanly into CSS — the curve is the part that
            doesn't, and now it does.
          </p>
        </Stagger>
      </section>

      <Stagger index={FOOTER_INDEX}>
        <footer className="flex w-full flex-col gap-figma-5">
          <Divider />
          <nav
            aria-label="Site"
            className="flex w-full items-start gap-figma-4 text-[14px] leading-[1.2] font-medium tracking-[-0.25px] text-text-secondary whitespace-nowrap"
          >
            {/* `py-2 -my-2` extends tap target to ~33px tall without
                shifting the footer layout — text stays on its baseline. */}
            <Link to="/what" className="py-2 -my-2" data-focus-ring>
              What?
            </Link>
            <Link to="/playground" className="py-2 -my-2" data-focus-ring>
              Playground
            </Link>
            <a
              href="https://github.com/jaceattard/smooth-corners"
              className="py-2 -my-2"
              data-focus-ring
              target="_blank"
              rel="noreferrer"
            >
              Docs
            </a>
          </nav>
        </footer>
      </Stagger>
    </Layout>
  );
}
