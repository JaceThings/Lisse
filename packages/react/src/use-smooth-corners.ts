import { useEffect, useRef } from "react";
import { generateClipPath, createSvgEffects, createDropShadow, observeResize, DEFAULT_SHADOW } from "@smooth-corners/core";
import type { SmoothCornerOptions, EffectsConfig } from "@smooth-corners/core";

export interface UseEffectsOptions {
  wrapperRef: React.RefObject<HTMLElement | null>;
  effects: EffectsConfig;
}

/**
 * React hook that applies a smooth-corners clip-path to a referenced element.
 * Automatically updates on resize via a shared ResizeObserver.
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

    const unobserve = observeResize(el, () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) {
        el.style.clipPath = generateClipPath(width, height, optionsRef.current);
      }
    });

    return () => {
      unobserve();
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

    const unobserve = observeResize(el, () => {
      const { width, height } = el.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      const eff = effectsRef.current?.effects;
      if (!eff) return;
      effectsHandle.update(optionsRef.current, eff, width, height);
      shadowHandle.update(
        optionsRef.current,
        eff.shadow ?? DEFAULT_SHADOW,
        width, height,
      );
    });

    return () => {
      unobserve();
      effectsHandle.destroy();
      shadowHandle.destroy();
    };
  }, [ref, effectsOptions?.wrapperRef]);
}
