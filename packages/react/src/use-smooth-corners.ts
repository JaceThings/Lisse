import { useEffect, useLayoutEffect, useRef } from "react";
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
  hasEffects,
  mergeEffects,
} from "@lisse/core";
import type { SmoothCornerOptions, EffectsConfig } from "@lisse/core";

/**
 * useLayoutEffect on the client, useEffect during SSR. Lets us mutate the
 * DOM synchronously after layout (avoiding a flash of un-clipped corners
 * or un-stripped CSS borders) without warning under server rendering.
 */
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function syncEffects(
  options: SmoothCornerOptions,
  merged: EffectsConfig,
  effectsHandle: ReturnType<typeof createSvgEffects>,
  shadowHandle: ReturnType<typeof createDropShadow>,
  width: number, height: number,
): void {
  effectsHandle.update(options, merged, width, height);
  shadowHandle.update(options, merged.shadow ?? DEFAULT_SHADOW, width, height);
}

export interface UseEffectsOptions {
  wrapperRef?: React.RefObject<HTMLElement | null>;
  effects?: EffectsConfig;
  autoEffects?: boolean;
}

/**
 * React hook that applies a smooth-cornered clip-path to a referenced element.
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

  useIsoLayoutEffect(() => {
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
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    if (width > 0 && height > 0) {
      el.style.clipPath = generateClipPath(width, height, optionsRef.current);
    }
  });

  // Track whether explicit effects are present so the setup/teardown effect
  // re-runs when the wrapper div mounts or unmounts (needsWrapper toggles).
  const hasExplicitEffects = hasEffects(effectsOptions?.effects);

  // Effects overlay (SVG effects + drop shadow)
  useIsoLayoutEffect(() => {
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
    const mergedEffects = mergeEffects(extracted, explicitEffects);

    if (!hasEffects(mergedEffects)) {
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
      const currentMerged = mergeEffects(extracted, effectsRef.current?.effects);
      syncEffects(optionsRef.current, currentMerged, effectsHandle, shadowHandle, width, height);
    });

    return () => {
      unobserve();
      effectsHandle.destroy();
      shadowHandle.destroy();
      handlesRef.current = null;
      if (extracted) restoreStyles(el, extracted.savedStyles);
      if (didAcquire) releasePosition(anchor);
    };
  }, [ref, effectsOptions?.wrapperRef, hasExplicitEffects]);

  // Sync SVG effects on every render to pick up explicit effect prop changes
  useIsoLayoutEffect(() => {
    const handles = handlesRef.current;
    if (!handles) return;
    const { effectsHandle, shadowHandle, extracted, el } = handles;
    const currentMerged = mergeEffects(extracted, effectsRef.current?.effects);
    const { width, height } = el.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    syncEffects(optionsRef.current, currentMerged, effectsHandle, shadowHandle, width, height);
  });
}
