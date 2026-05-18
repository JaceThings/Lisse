import { useEffect, useLayoutEffect, useRef } from "react";
import {
  generateClipPath,
  createSvgEffects,
  createDropShadow,
  observeResize,
  getLayoutSize,
  DEFAULT_SHADOW,
  extractAndStripEffects,
  restoreStyles,
  acquirePosition,
  releasePosition,
  hasEffects,
  mergeEffects,
} from "@lisse/core";
import type { SmoothCornerOptions, EffectsConfig, ShadowConfig } from "@lisse/core";

/**
 * `useLayoutEffect` on the client, `useEffect` during SSR — mutate the DOM
 * synchronously after layout (no flash of un-clipped corners or un-stripped
 * borders) without triggering React's SSR warning.
 */
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function syncEffects(
  options: SmoothCornerOptions,
  merged: EffectsConfig,
  effectsHandle: ReturnType<typeof createSvgEffects>,
  shadowHandle: ReturnType<typeof createDropShadow> | undefined,
  width: number, height: number,
): void {
  effectsHandle.update(options, merged, width, height);
  // shadowHandle is lazy — border-only consumers never mount the drop-shadow SVG.
  shadowHandle?.update(options, merged.shadow ?? DEFAULT_SHADOW, width, height);
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

interface SyncRefs {
  optionsRef: React.MutableRefObject<SmoothCornerOptions>;
  effectsPropRef: React.MutableRefObject<EffectsConfig | undefined>;
  wrapperRefRef: React.MutableRefObject<React.RefObject<HTMLElement | null> | undefined>;
  skipShadowHandleRef: React.MutableRefObject<boolean>;
  onExtractedShadowRef: React.MutableRefObject<
    ((shadow: ShadowConfig | ShadowConfig[] | undefined) => void) | undefined
  >;
}

/**
 * Apply the latest corner options and effects. Idempotent and lazy:
 * handles are created on first sight of effects, reused thereafter, and a
 * zero-size element bails out (the next resize tick picks it up).
 */
function runSync(s: State, refs: SyncRefs): void {
  const merged = mergeEffects(s.extracted, refs.effectsPropRef.current);
  if (hasEffects(merged))
    ensureHandles(s, merged, refs.wrapperRefRef.current, refs.skipShadowHandleRef.current);

  const { width, height } = getLayoutSize(s.el);
  if (width <= 0 || height <= 0) return;

  s.el.style.clipPath = generateClipPath(width, height, refs.optionsRef.current);
  s.el.setAttribute("data-state", "ready");

  if (s.effectsHandle) {
    syncEffects(refs.optionsRef.current, merged, s.effectsHandle, s.shadowHandle, width, height);
  }
}

/**
 * Ensure the overlay handles exist for `merged`. The anchor is captured
 * once so a late-arriving shadow piggy-backs on the same ref-counted
 * position. Drop-shadow setup (and the `isolation:isolate` anchor
 * mutation) is skipped for border-only configs. Idempotent at every
 * call-site so no path can double-acquire.
 */
function ensureHandles(
  s: State,
  merged: EffectsConfig,
  wrapperRef: React.RefObject<HTMLElement | null> | undefined,
  skipShadowHandle: boolean,
): void {
  if (!s.anchor) {
    const anchor = wrapperRef?.current ?? s.el.parentElement;
    if (!anchor) return;
    s.anchor = anchor;
    s.didAcquire = acquirePosition(anchor);
  }
  if (!s.effectsHandle) {
    s.effectsHandle = createSvgEffects(s.anchor);
  }
  if (!s.shadowHandle && merged.shadow && !skipShadowHandle) {
    s.shadowHandle = createDropShadow(s.anchor);
  }
}

export interface UseEffectsOptions {
  wrapperRef?: React.RefObject<HTMLElement | null>;
  effects?: EffectsConfig;
  autoEffects?: boolean;
  /**
   * Opt out of the SVG drop-shadow handle. Set this when you're rendering
   * the shadow yourself — e.g. a CSS `box-shadow` on a sibling element, or
   * any other non-SVG drop-shadow technique — so the hook doesn't also
   * mount an SVG filter or set `isolation:isolate` on the anchor. Border
   * effects and inner shadows are unaffected; any `effects.shadow` config
   * you pass is ignored while this is true.
   *
   * `<SmoothCorners shadowStrategy="box-shadow">` toggles this internally.
   * Default: `false` (SVG drop-shadow active).
   */
  skipShadowHandle?: boolean;
  /**
   * Called whenever the hook auto-extracts (or stops auto-extracting) a
   * CSS `box-shadow` from the consumer element. Receives the parsed
   * shadow chain, or `undefined` when no shadow is currently extracted
   * (initial mount with no CSS shadow, `autoEffects=false`, or unmount).
   *
   * `<SmoothCorners shadowStrategy="box-shadow">` uses this to route an
   * extracted chain into its CSS sibling div when the SVG handle is
   * skipped — without it the extracted shadow would be stripped from the
   * consumer element and never re-rendered.
   */
  onExtractedShadow?: (shadow: ShadowConfig | ShadowConfig[] | undefined) => void;
}

/**
 * React hook that applies a smooth-cornered clip-path to a referenced
 * element, kept in sync on resize via a shared ResizeObserver.
 *
 * @remarks
 * `effectsOptions.wrapperRef` must be a stable ref (created with
 * `useRef`). `effects` and `autoEffects` are read by value, so passing a
 * freshly-allocated object each render is fine.
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
  const { wrapperRef, effects, autoEffects, skipShadowHandle, onExtractedShadow } =
    effectsOptions ?? {};

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const effectsPropRef = useRef(effects);
  effectsPropRef.current = effects;

  const wrapperRefRef = useRef(wrapperRef);
  wrapperRefRef.current = wrapperRef;

  // Read via ref so the resize callback sees current value without re-subscribing.
  const skipShadowHandleRef = useRef(skipShadowHandle ?? false);
  skipShadowHandleRef.current = skipShadowHandle ?? false;

  const onExtractedShadowRef = useRef(onExtractedShadow);
  onExtractedShadowRef.current = onExtractedShadow;

  const refsRef = useRef<SyncRefs>({
    optionsRef, effectsPropRef, wrapperRefRef, skipShadowHandleRef, onExtractedShadowRef,
  });

  // Stable signatures for the effect deps. JSON.stringify is safe on these
  // bounded objects; useMemo would never hit since callers pass fresh literals.
  const optionsKey = JSON.stringify(options);
  const effectsKey = JSON.stringify(effects ?? null);
  const autoEffectsKey = autoEffects ?? true;
  const skipShadowHandleKey = skipShadowHandle ?? false;

  // Per-mount state. SVG handles are created lazily on first sync that
  // sees effects and destroyed only on unmount — toggling props on/off
  // doesn't rebuild the overlay.
  const stateRef = useRef<State | null>(null);

  // Main setup. Re-runs only when the element ref changes. `autoEffectsKey`
  // is captured at mount; subsequent toggles are handled below.
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const savedClipPath = el.style.clipPath;
    el.setAttribute("data-slot", "smooth-corners");
    el.setAttribute("data-state", "pending");

    const initialExtracted = autoEffectsKey ? extractAndStripEffects(el) : undefined;

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

    // Eager handle creation so the overlay exists before the first resize
    // callback fires, avoiding a frame where it's missing.
    const initialMerged = mergeEffects(s.extracted, effectsPropRef.current);
    if (hasEffects(initialMerged))
      ensureHandles(s, initialMerged, wrapperRefRef.current, skipShadowHandleRef.current);

    onExtractedShadowRef.current?.(s.extracted?.effects.shadow);

    const unobserve = observeResize(el, () => runSync(s, refsRef.current));

    return () => {
      unobserve();
      s.effectsHandle?.destroy();
      s.shadowHandle?.destroy();
      if (s.extracted) restoreStyles(el, s.extracted.savedStyles);
      onExtractedShadowRef.current?.(undefined);
      if (s.didAcquire && s.anchor) releasePosition(s.anchor);
      stateRef.current = null;

      el.style.clipPath = savedClipPath;
      el.removeAttribute("data-slot");
      el.removeAttribute("data-state");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  // Re-sync on prop change. `runSync` attaches handles eagerly before
  // measuring, so a later-appearing `shadow` is ready next callback.
  useIsoLayoutEffect(() => {
    const s = stateRef.current;
    if (!s) return;
    runSync(s, refsRef.current);
  }, [optionsKey, effectsKey]);

  // Tear down the SVG drop-shadow handle when the consumer opts out at
  // runtime (e.g. shadowStrategy "svg" → "box-shadow"). Re-creation in the
  // other direction is handled by `ensureHandles` on the next sync.
  useIsoLayoutEffect(() => {
    if (!skipShadowHandleKey) return;
    const s = stateRef.current;
    if (!s || !s.shadowHandle) return;
    s.shadowHandle.destroy();
    s.shadowHandle = undefined;
  }, [skipShadowHandleKey]);

  // Start/stop CSS extraction when `autoEffects` toggles.
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
    onExtractedShadowRef.current?.(s.extracted?.effects.shadow);
    runSync(s, refsRef.current);
  }, [autoEffectsKey]);
}
