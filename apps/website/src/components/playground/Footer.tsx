import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Divider } from "../Divider.tsx";
import { LanguageSwitcher } from "../LanguageSwitcher.tsx";
import { playClick } from "../../lib/sounds.ts";
import { m } from "../../paraglide/messages.js";

// Full-contrast primary text by deliberate choice — these links sit at the
// page foot and must read without hovering. `py-2 -my-2` grows the tap target
// without shifting layout (the negative margin cancels the padding). The
// hover underline lives on the inner span (see global.css); LinkText wraps
// the text so the line hugs the glyphs, not the padded box.
const LINK = "footer-link py-2 -my-2";

function LinkText({ children }: { children: ReactNode }) {
  return <span className="footer-link-underline">{children}</span>;
}
// Governs the home-link's width-collapse only; the whole-footer slide
// is App.tsx's motion.footer + LayoutGroup pair.
const NAV_LAYOUT_TRANSITION = {
  layout: { duration: 0.42, ease: [0.22, 0.61, 0.36, 1] as const },
};

// Wraps a plain nav link so framer-motion tracks its position; when the
// Home link enters or exits, siblings slide to their new flex positions
// instead of snapping.
function NavSlot({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.span
      layout
      transition={NAV_LAYOUT_TRANSITION}
      className={`inline-flex${className ? ` ${className}` : ""}`}
    >
      {children}
    </motion.span>
  );
}

interface ScrollLinkProps
  extends Omit<React.ComponentPropsWithoutRef<"a">, "href"> {
  to: string;
}

// Scrolls to the top before navigating so the user sees the persistent
// header re-enter before the route swap. Uses `scrollend` when available
// with a distance-scaled timeout fallback.
function ScrollLink({ to, onClick, ...rest }: ScrollLinkProps) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    // Suppress the click sound when clicking the link for the route
    // we're already on. The scroll-to-top behaviour below still runs
    // so the link is useful as a "jump to top" affordance.
    if (to !== pathname) playClick();
    if (window.scrollY <= 0) {
      navigate({ to });
      return;
    }
    let navigated = false;
    const go = () => {
      if (navigated) return;
      navigated = true;
      navigate({ to });
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
  const showHome =
    useRouterState({ select: (s) => s.location.pathname }) !== "/";

  return (
    <div className="flex w-full flex-col gap-5">
      <Divider />
      <motion.nav
        layout
        transition={NAV_LAYOUT_TRANSITION}
        aria-label={m.nav_aria_site()}
        className="flex w-full items-start gap-4 text-[14px] leading-[1.2] font-medium tracking-[-0.25px] text-text-primary whitespace-nowrap"
      >
        {/* popLayout sets the exiting Home link to position:absolute so
            siblings slide to fill the gap in lockstep with the fade. */}
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
                <LinkText>{m.nav_home()}</LinkText>
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
            <LinkText>{m.nav_what()}</LinkText>
          </ScrollLink>
        </NavSlot>
        <NavSlot>
          <ScrollLink
            to="/playground"
            className={LINK}
            data-focus-ring
            data-focus-inset-x="6"
          >
            <LinkText>{m.nav_playground()}</LinkText>
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
            onClick={() => playClick()}
          >
            <LinkText>{m.nav_docs()}</LinkText>
          </a>
        </NavSlot>
        {/* ml-auto pins Follow to the far right; the auto margin absorbs the
            Home link's enter/exit so it stays put while the left group shifts. */}
        <NavSlot className="ml-auto">
          <a
            href="https://x.com/JaceThings"
            className={LINK}
            data-focus-ring
            data-focus-inset-x="6"
            target="_blank"
            rel="noreferrer"
            onClick={() => playClick()}
          >
            <LinkText>{m.nav_follow()}</LinkText>
          </a>
        </NavSlot>
      </motion.nav>
      <LanguageSwitcher />
    </div>
  );
}
