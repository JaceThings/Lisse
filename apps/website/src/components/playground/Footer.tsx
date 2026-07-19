import type { ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Divider } from "../Divider.tsx";
import { playClick } from "../../lib/sounds.ts";
import { cssEase } from "../../lib/motion.ts";
import { m } from "../../paraglide/messages.js";

const LINK = "footer-link py-2 -my-2";
const NAV_EASE = [0.22, 0.61, 0.36, 1] as const;
const NAV_DURATION_MS = 420;

function LinkText({ children }: { children: ReactNode }) {
  return <span className="footer-link-underline">{children}</span>;
}

interface ScrollLinkProps
  extends Omit<React.ComponentPropsWithoutRef<"a">, "href"> {
  to: string;
}

function ScrollLink({ to, onClick, ...rest }: ScrollLinkProps) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
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
    const hasScrollEnd = "onscrollend" in window;
    if (hasScrollEnd) {
      const handler = () => {
        window.removeEventListener("scrollend", handler);
        go();
      };
      window.addEventListener("scrollend", handler, { once: true });
      setTimeout(go, 900);
    } else {
      setTimeout(go, Math.min(700, window.scrollY * 0.6));
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return <a href={to} onClick={handleClick} {...rest} />;
}

export function Footer() {
  const showHome =
    useRouterState({ select: (s) => s.location.pathname }) !== "/";

  return (
    <div className="flex w-full flex-col gap-5" data-highlight-exclude>
      <Divider />
      <nav
        aria-label={m.nav_aria_site()}
        className="flex w-full items-start gap-4 text-[14px] leading-[1.2] font-medium tracking-[-0.25px] text-text-primary whitespace-nowrap"
        style={{ transition: `gap ${NAV_DURATION_MS}ms ${cssEase(NAV_EASE)}` }}
      >
        <span
          className="inline-flex overflow-hidden"
          style={{
            maxWidth: showHome ? "12rem" : "0px",
            opacity: showHome ? 1 : 0,
            transform: showHome ? "translateX(0)" : "translateX(-6px)",
            transition: `max-width ${NAV_DURATION_MS}ms ${cssEase(NAV_EASE)}, opacity ${NAV_DURATION_MS}ms ${cssEase(NAV_EASE)}, transform ${NAV_DURATION_MS}ms ${cssEase(NAV_EASE)}`,
          }}
        >
          <ScrollLink
            to="/"
            className={LINK}
            data-focus-ring
            data-focus-inset-x="6"
          >
            <LinkText>{m.nav_home()}</LinkText>
          </ScrollLink>
        </span>
        <span className="inline-flex">
          <ScrollLink
            to="/what"
            className={LINK}
            data-focus-ring
            data-focus-inset-x="6"
          >
            <LinkText>{m.nav_what()}</LinkText>
          </ScrollLink>
        </span>
        <span className="inline-flex">
          <ScrollLink
            to="/playground"
            className={LINK}
            data-focus-ring
            data-focus-inset-x="6"
          >
            <LinkText>{m.nav_playground()}</LinkText>
          </ScrollLink>
        </span>
        <span className="inline-flex">
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
        </span>
        <span className="ml-auto inline-flex">
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
        </span>
      </nav>
    </div>
  );
}
