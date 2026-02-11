import { useEffect, useRef } from "react";
import {
  generateClipPath,
  createSvgEffects,
  createDropShadow,
  observeResize,
  DEFAULT_SHADOW,
  extractAndStripEffects,
  restoreStyles,
  acquirePosition,
  releasePosition,
} from "@smooth-corners/core";
import type { SmoothCornerOptions, EffectsConfig } from "@smooth-corners/core";

export interface UseEffectsOptions {
  wrapperRef?: React.RefObject<HTMLElement | null>;
  effects?: EffectsConfig;
  autoEffects?: boolean;
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

  const handlesRef = useRef<{
    effectsHandle: ReturnType<typeof createSvgEffects>;
    shadowHandle: ReturnType<typeof createDropShadow>;
    extracted: ReturnType<typeof extractAndStripEffects> | undefined;
    el: HTMLElement;
  } | null>(null);

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

  // Re-apply clip-path on every render to pick up option changes
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    if (width > 0 && height > 0) {
      el.style.clipPath = generateClipPath(width, height, optionsRef.current);
    }
  });

  // Effects overlay (SVG effects + drop shadow)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const autoEffects = effectsRef.current?.autoEffects ?? true;
    const explicitEffects = effectsRef.current?.effects;
    let explicitWrapper = effectsRef.current?.wrapperRef?.current;

    // Auto-extract CSS effects
    let extracted: ReturnType<typeof extractAndStripEffects> | undefined;
    if (autoEffects) {
      extracted = extractAndStripEffects(el);
    }

    // Merge: explicit effects override auto-extracted
    const mergedEffects: EffectsConfig = {
      ...extracted?.effects,
      ...explicitEffects,
    };

    // Determine if there are any effects to render
    const hasAnyEffects = !!(
      mergedEffects.innerBorder ||
      mergedEffects.outerBorder ||
      mergedEffects.innerShadow ||
      mergedEffects.shadow
    );

    if (!hasAnyEffects) {
      return () => {
        if (extracted) restoreStyles(el, extracted.savedStyles);
      };
    }

    // Determine anchor element
    const anchor = explicitWrapper ?? el.parentElement;
    if (!anchor) {
      if (extracted) restoreStyles(el, extracted.savedStyles);
      return;
    }

    // Ensure anchor has positioning (ref-counted)
    const didAcquire = acquirePosition(anchor);

    const effectsHandle = createSvgEffects(anchor);
    const shadowHandle = createDropShadow(anchor);

    handlesRef.current = { effectsHandle, shadowHandle, extracted, el };

    const unobserve = observeResize(el, () => {
      const { width, height } = el.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      const currentExplicit = effectsRef.current?.effects;
      const currentMerged: EffectsConfig = {
        ...extracted?.effects,
        ...currentExplicit,
      };
      effectsHandle.update(optionsRef.current, currentMerged, width, height);
      shadowHandle.update(
        optionsRef.current,
        currentMerged.shadow ?? DEFAULT_SHADOW,
        width,
        height,
      );
    });

    return () => {
      unobserve();
      effectsHandle.destroy();
      shadowHandle.destroy();
      handlesRef.current = null;
      if (extracted) restoreStyles(el, extracted.savedStyles);
      if (didAcquire) releasePosition(anchor);
    };
  }, [ref, effectsOptions?.wrapperRef]);

  // Sync SVG effects on every render to pick up explicit effect prop changes
  useEffect(() => {
    const handles = handlesRef.current;
    if (!handles) return;
    const { effectsHandle, shadowHandle, extracted, el } = handles;
    const currentExplicit = effectsRef.current?.effects;
    const currentMerged: EffectsConfig = {
      ...extracted?.effects,
      ...currentExplicit,
    };
    const { width, height } = el.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    effectsHandle.update(optionsRef.current, currentMerged, width, height);
    shadowHandle.update(
      optionsRef.current,
      currentMerged.shadow ?? DEFAULT_SHADOW,
      width,
      height,
    );
  });
}
