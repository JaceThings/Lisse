import { useEffect, useRef } from "react";
import { generateClipPath } from "@smooth-corners/core";
import type { SmoothCornerOptions } from "@smooth-corners/core";

/**
 * React hook that applies a smooth-corners clip-path to a referenced element.
 * Automatically updates on resize via ResizeObserver.
 *
 * @example
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null);
 * useSmoothCorners(ref, { radius: 20, smoothing: 0.6 });
 * return <div ref={ref}>...</div>;
 * ```
 */
export function useSmoothCorners(
  ref: React.RefObject<HTMLElement | null>,
  options: SmoothCornerOptions
): void {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof ResizeObserver === "undefined") return;

    let rafId: number | undefined;

    const update = () => {
      rafId = requestAnimationFrame(() => {
        rafId = undefined;
        const { width, height } = el.getBoundingClientRect();
        if (width > 0 && height > 0) {
          el.style.clipPath = generateClipPath(width, height, optionsRef.current);
        }
      });
    };

    const observer = new ResizeObserver(update);
    observer.observe(el);
    update();

    return () => {
      observer.disconnect();
      if (rafId !== undefined) cancelAnimationFrame(rafId);
      el.style.clipPath = "";
    };
  }, [ref]);
}
