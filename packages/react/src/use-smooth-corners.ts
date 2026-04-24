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

interface State {
  el: HTMLElement;
  savedClipPath: string;
  extracted: ReturnType<typeof extractAndStripEffects> | undefined;
  effectsHandle: ReturnType<typeof createSvgEffects> | undefined;
  shadowHandle: ReturnType<typeof createDropShadow> | undefined;
  anchor: HTMLElement | null;
  didAcquire: boolean;
}

/**
 * Acquire the anchor (wrapper ref or element parent) and create SVG + drop
 * shadow handles on it. Idempotent: returns early if handles already exist.
 * Shared across the three `useIsoLayoutEffect` blocks so no pathway can
 * accidentally skip a step and double-acquire the anchor.
 */
function ensureHandles(
  s: State,
  wrapperRef: React.RefObject<HTMLElement | null> | undefined,
): void {
  if (s.effectsHandle) return;
  const anchor = wrapperRef?.current ?? s.el.parentElement;
  if (!anchor) return;
  s.anchor = anchor;
  s.didAcquire = acquirePosition(anchor);
  s.effectsHandle = createSvgEffects(anchor);
  s.shadowHandle = createDropShadow(anchor);
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
 * @remarks
 * `effectsOptions.wrapperRef` should be a stable ref (created via
 * `useRef`). Each rendered call to the hook reads `effects` and
 * `autoEffects` via their values, so passing a freshly-allocated object
 * each render is fine.
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
  const { wrapperRef, effects, autoEffects } = effectsOptions ?? {};

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const effectsPropRef = useRef(effects);
  effectsPropRef.current = effects;

  const wrapperRefRef = useRef(wrapperRef);
  wrapperRefRef.current = wrapperRef;

  // Stable signature of the corner options. Bounded object size makes
  // JSON.stringify safe and cheap. A useMemo here would never hit —
  // callers typically pass fresh object literals each render — so we
  // build the strings directly and save a memo cell.
  const optionsKey = JSON.stringify(options);
  const effectsKey = JSON.stringify(effects ?? null);
  const autoEffectsKey = autoEffects ?? true;

  // Per-mount state. SVG handles are created lazily on first sync that
  // sees effects and destroyed only on unmount. Toggling a border or
  // shadow prop on and off no longer tears down and rebuilds the overlay.
  const stateRef = useRef<State | null>(null);

  // Main setup. Re-runs only when the target element ref changes.
  // Captures `autoEffectsKey` at mount for initial extraction; subsequent
  // toggles are handled by the sibling effect below.
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const savedClipPath = el.style.clipPath;
    el.setAttribute("data-slot", "smooth-corners");
    el.setAttribute("data-state", "pending");

    const initialAuto = autoEffectsKey;
    const initialExtracted = initialAuto ? extractAndStripEffects(el) : undefined;

    const s: State = {
      el,
      savedClipPath,
      extracted: initialExtracted,
      effectsHandle: undefined,
      shadowHandle: undefined,
      anchor: null,
      didAcquire: false,
    };
    stateRef.current = s;

    function sync(): void {
      const { width, height } = s.el.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;

      s.el.style.clipPath = generateClipPath(width, height, optionsRef.current);
      s.el.setAttribute("data-state", "ready");

      const merged = mergeEffects(s.extracted, effectsPropRef.current);
      if (hasEffects(merged)) ensureHandles(s, wrapperRefRef.current);
      if (s.effectsHandle && s.shadowHandle) {
        syncEffects(optionsRef.current, merged, s.effectsHandle, s.shadowHandle, width, height);
      }
    }

    // Eager path: create handles immediately when effects are present at
    // mount. Mirrors the Vue `setupEffects` behaviour so the overlay exists
    // before the resize observer's first callback, avoiding a frame where
    // it's missing.
    const initialMerged = mergeEffects(s.extracted, effectsPropRef.current);
    if (hasEffects(initialMerged)) ensureHandles(s, wrapperRefRef.current);

    const unobserve = observeResize(el, sync);

    return () => {
      unobserve();
      s.effectsHandle?.destroy();
      s.shadowHandle?.destroy();
      if (s.extracted) restoreStyles(el, s.extracted.savedStyles);
      if (s.didAcquire && s.anchor) releasePosition(s.anchor);
      stateRef.current = null;

      el.style.clipPath = savedClipPath;
      el.removeAttribute("data-slot");
      el.removeAttribute("data-state");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  // Re-sync on corner-option or explicit-effect change. Reaches into the
  // per-mount state; no setup/teardown.
  useIsoLayoutEffect(() => {
    const s = stateRef.current;
    if (!s) return;
    const { width, height } = s.el.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;

    s.el.style.clipPath = generateClipPath(width, height, optionsRef.current);
    s.el.setAttribute("data-state", "ready");

    const merged = mergeEffects(s.extracted, effectsPropRef.current);
    if (hasEffects(merged)) ensureHandles(s, wrapperRefRef.current);
    if (s.effectsHandle && s.shadowHandle) {
      syncEffects(optionsRef.current, merged, s.effectsHandle, s.shadowHandle, width, height);
    }
  }, [optionsKey, effectsKey]);

  // Handle autoEffects toggling. Starts or stops CSS extraction and
  // restores the original inline styles when turned off.
  useIsoLayoutEffect(() => {
    const s = stateRef.current;
    if (!s) return;
    const hadExtraction = s.extracted !== undefined;
    if (autoEffectsKey && !hadExtraction) {
      s.extracted = extractAndStripEffects(s.el);
    } else if (!autoEffectsKey && hadExtraction) {
      restoreStyles(s.el, s.extracted!.savedStyles);
      s.extracted = undefined;
    } else {
      return;
    }
    const { width, height } = s.el.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    const merged = mergeEffects(s.extracted, effectsPropRef.current);
    if (hasEffects(merged)) ensureHandles(s, wrapperRefRef.current);
    if (s.effectsHandle && s.shadowHandle) {
      syncEffects(optionsRef.current, merged, s.effectsHandle, s.shadowHandle, width, height);
    }
  }, [autoEffectsKey]);
}
