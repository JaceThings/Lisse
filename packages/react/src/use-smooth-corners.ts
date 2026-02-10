import { useEffect, useRef } from "react";
import { generateClipPath, createSvgEffects, createDropShadow } from "@smooth-corners/core";
import type { SmoothCornerOptions, EffectsConfig } from "@smooth-corners/core";

export interface UseEffectsOptions {
  wrapperRef: React.RefObject<HTMLElement | null>;
  effects: EffectsConfig;
}

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
  options: SmoothCornerOptions,
  effectsOptions?: UseEffectsOptions,
): void {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const effectsRef = useRef(effectsOptions);
  effectsRef.current = effectsOptions;

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

  // Effects overlay (SVG effects + drop shadow)
  useEffect(() => {
    const wrapper = effectsRef.current?.wrapperRef.current;
    const el = ref.current;
    if (!wrapper || !el) return;

    const effectsHandle = createSvgEffects(wrapper);
    const shadowHandle = createDropShadow(wrapper);

    let rafId: number | undefined;

    const updateEffects = () => {
      rafId = requestAnimationFrame(() => {
        rafId = undefined;
        const { width, height } = el.getBoundingClientRect();
        if (width <= 0 || height <= 0) return;
        const eff = effectsRef.current?.effects;
        if (!eff) return;
        effectsHandle.update(optionsRef.current, eff, width, height);
        if (eff.shadow) {
          wrapper.style.filter = shadowHandle.update(eff.shadow);
        } else {
          wrapper.style.filter = "none";
        }
      });
    };

    const observer = new ResizeObserver(updateEffects);
    observer.observe(el);
    updateEffects();

    return () => {
      observer.disconnect();
      if (rafId !== undefined) cancelAnimationFrame(rafId);
      effectsHandle.destroy();
      shadowHandle.destroy();
      wrapper.style.filter = "";
    };
  }, [ref, effectsOptions?.wrapperRef]);
}
