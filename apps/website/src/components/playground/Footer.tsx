import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { useNavigate, useLocation, type LinkProps } from "react-router-dom";
import { Divider } from "../Divider.tsx";

const LINK =
  "py-2 -my-2 hover:text-text-primary transition-[color] duration-150 ease-out";
// Governs the home-link's width-collapse only; the whole-footer slide
// is App.tsx's motion.footer + LayoutGroup pair.
const NAV_LAYOUT_TRANSITION = {
  layout: { duration: 0.32, ease: [0.32, 0.72, 0, 1] as const },
};

// Wraps a plain nav link so framer-motion tracks its position; when the
// Home link enters or exits, siblings slide to their new flex positions
// instead of snapping.
function NavSlot({ children }: { children: ReactNode }) {
  return (
    <motion.span
      layout
      transition={NAV_LAYOUT_TRANSITION}
      className="inline-flex"
    >
      {children}
    </motion.span>
  );
}

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
    // `scrollend` is in lib.dom but missing in older Safari — feature-
    // detect at runtime; fall back to a distance-scaled timeout.
    const hasScrollEnd = "onscrollend" in window;
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

// Gap classes live here (not on App.tsx's motion.footer) because the
// Stagger between them would leave a footer-level gap with nothing to
// space.
export function Footer() {
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
        {/* popLayout makes the exiting Home link position:absolute so
            siblings see the freed flex space immediately and slide in
            lockstep with its fade — instead of waiting out the exit
            then snapping. */}
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
              <ScrollLink
                to="/"
                className={LINK}
                data-focus-ring
                data-focus-inset-x="6"
              >
                Home
              </ScrollLink>
            </motion.span>
          )}
        </AnimatePresence>
        <NavSlot>
          <ScrollLink
            to="/what"
            className={LINK}
            data-focus-ring
            data-focus-inset-x="6"
          >
            What?
          </ScrollLink>
        </NavSlot>
        <NavSlot>
          <ScrollLink
            to="/playground"
            className={LINK}
            data-focus-ring
            data-focus-inset-x="6"
          >
            Playground
          </ScrollLink>
        </NavSlot>
        <NavSlot>
          <a
            href="https://github.com/JaceThings/Lisse/wiki"
            className={LINK}
            data-focus-ring
            data-focus-inset-x="6"
            target="_blank"
            rel="noreferrer"
          >
            Docs
          </a>
        </NavSlot>
      </motion.nav>
    </div>
  );
}
