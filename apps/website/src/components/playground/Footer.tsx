import { AnimatePresence, motion } from "framer-motion";
import { useNavigate, useLocation, type LinkProps } from "react-router-dom";
import { Divider } from "../Divider.tsx";

const LINK = "py-2 -my-2 hover:text-text-primary";
// Nav-row layout transition is just for the home-link width change in/out
// of `/`. The whole-footer slide is owned by App.tsx's motion.footer +
// LayoutGroup pair; this transition only governs the local home-link
// width-collapse when toggling between root and a sub-page.
const NAV_LAYOUT_TRANSITION = {
  layout: { duration: 0.32, ease: [0.32, 0.72, 0, 1] as const },
};

interface ScrollLinkProps extends Omit<LinkProps, "to"> {
  to: string;
}

// The Header is mounted at App level and persists across routes. When a
// user clicks a footer link from a scrolled-down page, we scroll the page
// back to the top first so they *see* the persistent header before the
// route swap — reinforcing that the chrome is stable. The scroll uses
// the `scrollend` event when available; falls back to a timeout sized to
// the scroll distance.
function ScrollLink({ to, onClick, ...rest }: ScrollLinkProps) {
  const navigate = useNavigate();
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    if (window.scrollY <= 0) {
      navigate(to);
      return;
    }
    let navigated = false;
    const go = () => {
      if (navigated) return;
      navigated = true;
      navigate(to);
    };
    // `scrollend` exists in lib.dom but isn't actually implemented in
    // every browser we ship to (notably older Safari). Feature-detect at
    // runtime; fall back to a distance-scaled timeout.
    const hasScrollEnd =
      typeof (window as unknown as { onscrollend?: unknown }).onscrollend !==
      "undefined";
    if (hasScrollEnd) {
      const handler = () => {
        window.removeEventListener("scrollend", handler);
        go();
      };
      window.addEventListener("scrollend", handler, { once: true });
      // Safety net — if scrollend never fires (browser quirk, or user
      // re-clicks mid-scroll), navigate after a reasonable max.
      setTimeout(go, 900);
    } else {
      setTimeout(go, Math.min(700, window.scrollY * 0.6));
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return <a href={to} onClick={handleClick} {...rest} />;
}

// Footer renders the divider + nav contents only. The <footer> element
// itself lives in App.tsx as a motion.footer so it can participate in
// the LayoutGroup's position tracking — that's what makes it slide
// smoothly to its new Y when the body content above it changes size.
// The flex+gap classes live HERE (on the inner wrapper) rather than on
// motion.footer because the Stagger sits between them, so a gap class
// at the footer level would have nothing to space.
export function Footer() {
  // Home link only shows when the user is somewhere else; on `/` the
  // nav drops it so the current page isn't repeated.
  const showHome = useLocation().pathname !== "/";

  return (
    <div className="flex w-full flex-col gap-figma-5">
      <Divider />
      <motion.nav
        layout
        transition={NAV_LAYOUT_TRANSITION}
        aria-label="Site"
        className="flex w-full items-start gap-figma-4 text-[14px] leading-[1.2] font-medium tracking-[-0.25px] text-text-secondary whitespace-nowrap"
      >
        {/* `py-2 -my-2` extends tap target to ~33px tall without
            changing the visible footer layout — text stays on baseline.
            `ScrollLink` keeps internal navigation client-side and runs
            a smooth scroll-to-top before the route swap so the
            persistent header animates back into view. */}
        {/* `mode="popLayout"` sets the exiting Home link to
            position:absolute as soon as exit begins. Without it the
            element keeps its flex space for the full exit duration, so
            the sibling links can't reflow until exit completes — they
            snap to their new positions only after the Home link is
            gone. With popLayout the siblings see the freed space
            immediately and their `layout` props animate them sideways
            in lockstep with the Home link's fade. */}
        <AnimatePresence mode="popLayout" initial={false}>
          {showHome && (
            <motion.span
              key="home"
              layout
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{
                duration: NAV_LAYOUT_TRANSITION.layout.duration,
                ease: NAV_LAYOUT_TRANSITION.layout.ease,
                layout: NAV_LAYOUT_TRANSITION.layout,
              }}
              className="inline-flex"
            >
              <ScrollLink to="/" className={LINK} data-focus-ring>
                Home
              </ScrollLink>
            </motion.span>
          )}
        </AnimatePresence>
        {/* Each remaining link is a motion.span with `layout` so that
            when the Home link's AnimatePresence inserts or removes its
            element, these siblings smoothly slide to their new flex
            positions instead of snapping. */}
        <motion.span layout transition={NAV_LAYOUT_TRANSITION} className="inline-flex">
          <ScrollLink to="/what" className={LINK} data-focus-ring>
            What?
          </ScrollLink>
        </motion.span>
        <motion.span layout transition={NAV_LAYOUT_TRANSITION} className="inline-flex">
          <ScrollLink to="/playground" className={LINK} data-focus-ring>
            Playground
          </ScrollLink>
        </motion.span>
        <motion.span layout transition={NAV_LAYOUT_TRANSITION} className="inline-flex">
          <a
            href="https://github.com/JaceThings/Lisse/wiki"
            className={LINK}
            data-focus-ring
            target="_blank"
            rel="noreferrer"
          >
            Docs
          </a>
        </motion.span>
      </motion.nav>
    </div>
  );
}
