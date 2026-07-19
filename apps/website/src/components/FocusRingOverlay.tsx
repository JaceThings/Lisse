import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { generatePath } from "@lisse/core";
import {
  animate,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  useTransform,
  type AnimationControls,
  type MotionValue,
} from "../lib/motion.ts";

const RING_SELECTOR = "[data-focus-ring]";
const SECTION_SELECTOR = "[data-focus-section]";
const SPRING = { stiffness: 1100, damping: 60, mass: 0.4 };
const FADE_IN = { duration: 0.18, ease: [0.2, 0, 0, 1] as const };
const FADE_OUT = { duration: 0.18, ease: [0.4, 0, 0.2, 1] as const };

const NAV_KEYS = new Set([
  "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
  "Home", "End", "PageUp", "PageDown",
]);

export function FocusRingOverlay({
  radius = 14,
  smoothing = 0.6,
  offsetX = 0,
  offsetY = 0,
  strokeWidth = 2,
}: {
  radius?: number;
  smoothing?: number;
  offsetX?: number;
  offsetY?: number;
  strokeWidth?: number;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const w = useMotionValue(0);
  const h = useMotionValue(0);

  const xS = useSpring(x, SPRING);
  const yS = useSpring(y, SPRING);
  const wS = useSpring(w, SPRING);
  const hS = useSpring(h, SPRING);
  const opacity = useMotionValue(0);

  const d = useTransform([wS, hS], (wv, hv) => {
    const ww = Math.max(0, wv);
    const hh = Math.max(0, hv);
    if (ww === 0 || hh === 0) return "";
    const r = Math.min(
      radius + Math.min(offsetX, offsetY),
      Math.min(ww, hh) / 2.5,
    );
    return generatePath(ww, hh, { radius: r, smoothing });
  });

  const svgX = useStateSync(xS);
  const svgY = useStateSync(yS);
  const svgW = useStateSync(wS);
  const svgH = useStateSync(hS);
  const svgOpacity = useStateSync(opacity);

  const visible = useRef(false);
  const targetRef = useRef<HTMLElement | null>(null);
  const fadeRef = useRef<AnimationControls | null>(null);
  const lastModality = useRef<"keyboard" | "mouse">("mouse");
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hideRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let fadingOut = false;
    type Rect = { nx: number; ny: number; nw: number; nh: number };
    let pendingTarget: Rect | null = null;

    const measure = (el: HTMLElement): Rect => {
      const r = el.getBoundingClientRect();
      const insetX = Number(el.dataset.focusInsetX) || offsetX;
      const insetY = Number(el.dataset.focusInsetY) || offsetY;
      return {
        nx: r.left + window.scrollX - insetX,
        ny: r.top + window.scrollY - insetY,
        nw: r.width + insetX * 2,
        nh: r.height + insetY * 2,
      };
    };

    const snap = ({ nx, ny, nw, nh }: Rect) => {
      xS.jump(nx);
      yS.jump(ny);
      wS.jump(nw);
      hS.jump(nh);
      x.set(nx);
      y.set(ny);
      w.set(nw);
      h.set(nh);
    };

    const slide = ({ nx, ny, nw, nh }: Rect) => {
      x.set(nx);
      y.set(ny);
      w.set(nw);
      h.set(nh);
    };

    const fadeTo = (to: number, opts: typeof FADE_IN | typeof FADE_OUT) => {
      fadeRef.current?.stop();
      fadeRef.current = animate(opacity, to, opts);
    };

    const getSection = (el: HTMLElement | null): string | null =>
      el?.closest(SECTION_SELECTOR)?.getAttribute("data-focus-section") ?? null;

    const hide = () => {
      if (!visible.current) return;
      visible.current = false;
      targetRef.current = null;
      fadingOut = false;
      pendingTarget = null;
      fadeTo(0, FADE_OUT);
    };
    hideRef.current = hide;

    const onFocusIn = (e: FocusEvent) => {
      const t = (e.target as HTMLElement | null)?.closest(RING_SELECTOR) as HTMLElement | null;
      if (!t) return;
      if (lastModality.current !== "keyboard") {
        hide();
        return;
      }
      const dest = measure(t);
      if (fadingOut) {
        pendingTarget = dest;
        targetRef.current = t;
        return;
      }

      if (!visible.current) {
        snap(dest);
        visible.current = true;
        targetRef.current = t;
        fadeTo(1, FADE_IN);
        return;
      }

      const crossingSections =
        getSection(targetRef.current) !== getSection(t);

      if (crossingSections) {
        targetRef.current = t;
        fadingOut = true;
        pendingTarget = dest;
        fadeRef.current?.stop();
        fadeRef.current = animate(opacity, 0, {
          ...FADE_OUT,
          onComplete: () => {
            const next = pendingTarget;
            fadingOut = false;
            pendingTarget = null;
            if (!next) return;
            snap(next);
            fadeTo(1, FADE_IN);
          },
        });
        return;
      }

      slide(dest);
      targetRef.current = t;
      fadeTo(1, FADE_IN);
    };

    const onFocusOut = () => {
      requestAnimationFrame(() => {
        const active = document.activeElement as HTMLElement | null;
        if (active?.closest(RING_SELECTOR)) return;
        hide();
      });
    };

    const onModalityKey = (e: KeyboardEvent) => {
      if (!NAV_KEYS.has(e.key)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      lastModality.current = "keyboard";
    };
    const onModalityPointer = () => {
      lastModality.current = "mouse";
    };

    const isMidExit = (el: HTMLElement): boolean => {
      let node: HTMLElement | null = el;
      while (node && node !== document.body) {
        const op = parseFloat(getComputedStyle(node).opacity);
        if (Number.isFinite(op) && op < 1) return true;
        node = node.parentElement;
      }
      return false;
    };

    let rafId = 0;
    const follow = () => {
      if (visible.current && targetRef.current && !fadingOut) {
        const el = targetRef.current;
        if (!el.isConnected || isMidExit(el)) {
          hide();
        } else {
          slide(measure(el));
        }
      }
      rafId = requestAnimationFrame(follow);
    };
    rafId = requestAnimationFrame(follow);

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("keydown", onModalityKey, true);
    document.addEventListener("pointerdown", onModalityPointer, true);
    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("keydown", onModalityKey, true);
      document.removeEventListener("pointerdown", onModalityPointer, true);
      fadeRef.current?.stop();
      hideRef.current = null;
    };
  }, [x, y, w, h, xS, yS, wS, hS, opacity, offsetX, offsetY]);

  useEffect(() => {
    hideRef.current?.();
  }, [pathname]);

  return (
    <svg
      aria-hidden
      x={svgX}
      y={svgY}
      width={svgW}
      height={svgH}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        opacity: svgOpacity,
        pointerEvents: "none",
        zIndex: 9999,
        overflow: "visible",
      }}
    >
      <path
        d={d}
        fill="none"
        stroke="var(--color-text-primary)"
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}

function useStateSync(value: MotionValue) {
  const [state, setState] = useState(value.get());
  useMotionValueEvent(value, "change", setState);
  return state;
}
