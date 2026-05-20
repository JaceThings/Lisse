import { useEffect, useRef } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type AnimationPlaybackControls,
} from "framer-motion";
import { generatePath } from "@lisse/core";

// Persistent squircle ring tracking the focused `[data-focus-ring]`.
// Within a `[data-focus-section]` group the ring springs between targets;
// across groups it fades out, snaps while invisible, and fades back in —
// soft cross-dissolve instead of a long visible slide.
//
// Position is in page coordinates (rect.x + scrollX) on an absolute SVG,
// so it stays glued through scroll without a listener. Hides if modality
// flips to mouse.

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

  const d = useTransform([wS, hS], ([wv, hv]) => {
    const ww = Math.max(0, wv as number);
    const hh = Math.max(0, hv as number);
    if (ww === 0 || hh === 0) return "";
    // Cap radius against the rect's min dimension so small elements
    // (e.g. compact footer links) don't render as near-capsules — the
    // smoothing extends the curve past `radius` and eats the straight
    // edge entirely on the short axis without this clamp.
    const r = Math.min(
      radius + Math.min(offsetX, offsetY),
      Math.min(ww, hh) / 2.5,
    );
    return generatePath(ww, hh, { radius: r, smoothing });
  });

  const visible = useRef(false);
  const targetRef = useRef<HTMLElement | null>(null);
  const fadeRef = useRef<AnimationPlaybackControls | null>(null);
  const lastModality = useRef<"keyboard" | "mouse">("mouse");

  useEffect(() => {
    let fadingOut = false;
    type Rect = { nx: number; ny: number; nw: number; nh: number };
    let pendingTarget: Rect | null = null;

    const measure = (el: HTMLElement): Rect => {
      const r = el.getBoundingClientRect();
      return {
        nx: r.left + window.scrollX - offsetX,
        ny: r.top + window.scrollY - offsetY,
        nw: r.width + offsetX * 2,
        nh: r.height + offsetY * 2,
      };
    };

    // Snap spring + raw in lockstep so the spring doesn't slide in from
    // the origin or interpolate across a gap.
    const snap = ({ nx, ny, nw, nh }: Rect) => {
      xS.jump(nx); yS.jump(ny); wS.jump(nw); hS.jump(nh);
      x.set(nx); y.set(ny); w.set(nw); h.set(nh);
    };

    const slide = ({ nx, ny, nw, nh }: Rect) => {
      x.set(nx); y.set(ny); w.set(nw); h.set(nh);
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

    const onFocusIn = (e: FocusEvent) => {
      const t = (e.target as HTMLElement | null)?.closest(RING_SELECTOR) as HTMLElement | null;
      if (!t) return;
      // A click flips modality to mouse; the subsequent focusin must hide
      // the ring rather than stranding it at the previous keyboard position.
      if (lastModality.current !== "keyboard") {
        hide();
        return;
      }
      const dest = measure(t);
      if (fadingOut) {
        // Coalesce — the in-flight onComplete will snap to the most recent.
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
        // Fade out, snap while invisible, fade back in — no long-distance
        // slide between groups (e.g. Comparison pill → first install row).
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
      // Defer one frame so a synchronous focus move (Tab) lands its focusin
      // before we decide whether to hide.
      requestAnimationFrame(() => {
        const active = document.activeElement as HTMLElement | null;
        if (active?.closest(RING_SELECTOR)) return;
        hide();
      });
    };

    // Only navigation keys flip modality to "keyboard". Escape and
    // Enter/Space are activation keys used in both modes — counting them
    // would re-trigger the ring on the next programmatic .focus().
    const onModalityKey = (e: KeyboardEvent) => {
      if (!NAV_KEYS.has(e.key)) return;
      // Cmd/Ctrl/Alt + arrow is a browser shortcut, not in-page navigation.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      lastModality.current = "keyboard";
    };
    const onModalityPointer = () => {
      lastModality.current = "mouse";
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("keydown", onModalityKey, true);
    document.addEventListener("pointerdown", onModalityPointer, true);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("keydown", onModalityKey, true);
      document.removeEventListener("pointerdown", onModalityPointer, true);
      fadeRef.current?.stop();
    };
  }, [x, y, w, h, xS, yS, wS, hS, opacity, offsetX, offsetY]);

  return (
    <motion.svg
      aria-hidden
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        x: xS,
        y: yS,
        width: wS,
        height: hS,
        opacity,
        pointerEvents: "none",
        zIndex: 9999,
        overflow: "visible",
      }}
    >
      <motion.path
        d={d}
        fill="none"
        stroke="var(--color-text-primary)"
        strokeWidth={strokeWidth}
      />
    </motion.svg>
  );
}
