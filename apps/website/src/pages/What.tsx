import { Divider } from "../components/Divider.tsx";
import { Stagger } from "../components/Stagger.tsx";

// Figma node 35:238 — `text-text-primary` (not muted input). `hyphens-auto`
// is inherited from global.css; listed here for visibility.
const BODY =
  "text-[14px] leading-[1.4] max-[560px]:leading-[1.6] font-medium tracking-[-0.25px] text-text-primary text-justify hyphens-auto";

// Indices 0–5 are reserved for the Header; body starts at 6.
export function What() {
  return (
    <>
      <section className="flex w-full flex-col gap-4">
        <Stagger index={6}>
          <p className={BODY}>
            A squircle is a rounded rectangle whose corners ease into the
            straight edges with continuous curvature instead of a single
            circular arc. Apple introduced the shape to iOS in 2013 with
            iOS 7, where every app icon was cut to it. Figma and Sketch
            both added corner smoothing in 2018, and the shape has been
            spreading through design tools ever since.
          </p>
        </Stagger>

        <Stagger index={7}>
          <p className={BODY}>
            CSS border-radius draws a single arc at each corner. The arc
            meets the straight edge at a sharp tangent: the curvature
            jumps from nothing to its maximum in one step. The eye reads
            this as a corner bolted on. At small radii nobody notices.
            Past about 16 pixels the seam shows, and the corner reads as
            harder than it should.
          </p>
        </Stagger>

        <Stagger index={8}>
          <Divider />
        </Stagger>

        <Stagger index={9}>
          <p className={BODY}>
            Two shapes fix the seam. A superellipse sits between a circle
            and a square, with one number controlling how round or how
            square it is. The other shape is a small circular arc at the
            apex of the corner, with smooth shoulders on either side that
            ease the arc into the straight edges so the curvature never
            jumps. The two look similar at icon scale, but they're built
            differently underneath.
          </p>
        </Stagger>

        <Stagger index={10}>
          <p className={BODY}>
            Apple uses the arc-with-shoulders shape, and the
            implementation comes with some baggage. The two halves of
            each corner aren't quite mirror images of each other. There's
            a tiny straight segment on one side that almost certainly
            shouldn't be there: the developers who pulled the actual
            path out of iOS describe it as a probable bug, preserved
            across releases. The shape also breaks down at low aspect
            ratios, where it stops looking like a squircle and starts
            looking like a generic rounded rectangle. None of this is
            configurable. Apple's curve is fixed.
          </p>
        </Stagger>

        <Stagger index={11}>
          <p className={BODY}>
            When Figma added smoothing in 2018, they chose to redraw the
            curve from scratch rather than copy Apple's path. Daniel
            Furse's writeup at the time gives the reasoning. Apple's path
            isn't a clean formula you can describe in one line. It
            carries the asymmetry across, has no smoothing dial to turn,
            and falls apart at low aspect ratios. Reimplementing the
            same family of shape solved all three at once. The two halves
            of each corner mirror each other properly. A single smoothing
            dial controls how soft the corner gets: zero gives back a
            plain circular arc, and one gives the maximum smoothness the
            construction allows. Around 0.6 is close enough to Apple's
            shape that nobody can tell at icon scale, but the geometry
            underneath is more sensible to work with.
          </p>
        </Stagger>

        <Stagger index={12}>
          <Divider />
        </Stagger>

        <Stagger index={13}>
          <p className={BODY}>
            CSS itself is catching up. The CSS spec is the rulebook
            every browser agrees to implement, written and revised by a
            working group at the W3C. Anything that lands in the spec
            eventually shows up in Chrome, Safari, and Firefox in some
            form. A new property called corner-shape is going through
            that process now. It sits next to border-radius and changes
            which curve the radius traces, so authors can pick something
            other than the default circular arc without reaching for SVG.
          </p>
        </Stagger>

        <Stagger index={14}>
          <p className={BODY}>
            The spec includes a squircle keyword, which sounds like the
            whole problem is solved. Read the definition closely and the
            keyword resolves to a superellipse with a fixed exponent
            built in. That's the other shape family. It looks close to
            the iOS squircle at first glance, but the curvature is
            distributed differently, and at the sizes used in interfaces
            the difference is visible. Apple, Figma, and Lisse all draw
            arc-with-shoulders. The CSS default draws something else and
            calls it by the same name.
          </p>
        </Stagger>

        <Stagger index={15}>
          <p className={BODY}>
            Browser support isn't there yet either. Chrome added the
            property in August 2025. Safari has it behind a feature flag
            but hasn't shipped it to release. Firefox hasn't started.
            Even on the optimistic timeline where every engine ships in
            the next year, what's landing first isn't the shape that
            matches iOS or Figma. The CSS property is a useful primitive
            for new designs that pick the superellipse on purpose. It
            isn't a substitute for the squircle people already see in
            iOS, in Figma files, and in design systems that copy them.
          </p>
        </Stagger>

        <Stagger index={16}>
          <Divider />
        </Stagger>

        <Stagger index={17}>
          <p className={BODY}>
            That's where Lisse fits. It draws the Figma squircle as an
            SVG path and clips the element to it. Borders and shadows
            trace the same shape: strokes follow the squircle, and
            shadows are offset copies of the clip, so the soft edge
            stays consistent with the surface it sits on. Per-corner
            radii compose cleanly, with no kink at the boundary between
            corners of different roundness. A single observer watches
            every Lisse-wrapped element and only redraws when the box
            actually changes size.
          </p>
        </Stagger>

        <Stagger index={18}>
          <p className={BODY}>
            The rest of a design translates cleanly into CSS. The curve
            is the part that doesn't, and now it does.
          </p>
        </Stagger>

        <Stagger index={19}>
          <p className={`${BODY} text-text-secondary`}>
            A more detailed, heavily technical breakdown — the path math,
            the per-corner composition rules, and Lisse's render strategy —
            lives in the docs linked at the bottom of the page.
          </p>
        </Stagger>
      </section>
    </>
  );
}
