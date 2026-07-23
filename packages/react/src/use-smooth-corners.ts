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
  // Last-synced snapshot. runSync bails when nothing changed, which keeps
  // the every-commit re-clip at one computed-style read per render. `null`
  // key = invalidated (effects state mutated outside the render keys).
  lastWidth: number;
  lastHeight: number;
  lastSyncKey: string | null;
  // SSR border-radius fallback the wrapper wrote (undefined when the user
  // supplied their own border-radius). CSS intersects border-radius with the
  // clip-path, and the rounded rect is a strict subset of the squircle, so the
  // fallback must be cleared once the clip-path lands or it cancels smoothing
  // on the element's own background. Restored on teardown for remount safety.
  fallbackBorderRadius: string | undefined;
  clearedFallbackRadius: boolean;
}

interface SyncRefs {
  optionsRef: React.MutableRefObject<SmoothCornerOptions>;
  effectsPropRef: React.MutableRefObject<EffectsConfig | undefined>;
  wrapperRefRef: React.MutableRefObject<React.RefObject<HTMLElement | null> | undefined>;
  skipShadowHandleRef: React.MutableRefObject<boolean>;
  onExtractedShadowRef: React.MutableRefObject<
    ((shadow: ShadowConfig | ShadowConfig[] | undefined) => void) | undefined
  >;
  syncKeyRef: React.MutableRefObject<string>;
  fallbackBorderRadiusRef: React.MutableRefObject<string | undefined>;
}

/**
 * Apply the latest corner options and effects. Idempotent and lazy:
 * handles are created on first sight of effects, reused thereafter, and a
 * zero-size element bails out (the next resize tick picks it up).
 */
function runSync(s: State, refs: SyncRefs, size?: { width: number; height: number }): void {
  const merged = mergeEffects(s.extracted, refs.effectsPropRef.current);
  if (hasEffects(merged))
    ensureHandles(s, merged, refs.wrapperRefRef.current, refs.skipShadowHandleRef.current);

  // Resize ticks thread the observer entry's border-box size; the initial
  // mount and the every-commit sync below pass none and read it here (the
  // latter deliberately, for WebKit mid-animation correctness).
  const { width, height } = size ?? getLayoutSize(s.el);
  if (width <= 0 || height <= 0) return;

  const key = refs.syncKeyRef.current;
  if (width === s.lastWidth && height === s.lastHeight && key === s.lastSyncKey) return;
  s.lastWidth = width;
  s.lastHeight = height;
  s.lastSyncKey = key;

  s.el.style.clipPath = generateClipPath(width, height, refs.optionsRef.current);
  s.el.setAttribute("data-state", "ready");

  // The clip-path is now the silhouette; drop the SSR border-radius fallback so
  // it stops intersecting (and squaring off) the squircle. Only clears the
  // fallback the wrapper wrote — a user-supplied border-radius leaves this unset.
  if (s.fallbackBorderRadius !== undefined && !s.clearedFallbackRadius) {
    s.el.style.borderRadius = "";
    s.clearedFallbackRadius = true;
  }

  if (s.effectsHandle) {
    syncEffects(refs.optionsRef.current, merged, s.effectsHandle, s.shadowHandle, width, height);
  }
}

/**
 * Ensure the overlay handles exist for `merged`. The anchor is captured
 * once so a late-arriving shadow piggy-backs on the same ref-counted
 * position; drop-shadow setup (and its `isolation:isolate` anchor mutation)
 * is skipped for border-only configs. Idempotent, so no path double-acquires.
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
  /**
   * The inline `border-radius` fallback the caller rendered for SSR/first
   * paint. When set, the hook clears it from the DOM once the clip-path lands
   * (CSS intersects border-radius with clip-path, so leaving it squares off the
   * squircle) and restores it on teardown. Pass `undefined` when the user
   * supplied their own `border-radius` so it's left untouched.
   *
   * `<SmoothCorners>` wires this internally; it's not needed for direct hook use.
   */
  fallbackBorderRadius?: string;
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
  const { wrapperRef, effects, autoEffects, skipShadowHandle, onExtractedShadow, fallbackBorderRadius } =
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

  const fallbackBorderRadiusRef = useRef(fallbackBorderRadius);
  fallbackBorderRadiusRef.current = fallbackBorderRadius;

  // Stable signatures for the effect deps. JSON.stringify is safe on these
  // bounded objects; useMemo would never hit since callers pass fresh literals.
  const optionsKey = JSON.stringify(options);
  const effectsKey = JSON.stringify(effects ?? null);
  const autoEffectsKey = autoEffects ?? true;
  const skipShadowHandleKey = skipShadowHandle ?? false;

  // `skipShadowHandleKey` is part of the sync key: toggling the SVG drop-shadow
  // on/off changes the rendered overlay, so a commit that flips only that flag
  // (options/effects unchanged) must still get past runSync's unchanged-key
  // guard and re-run ensureHandles/syncEffects.
  const syncKeyRef = useRef("");
  syncKeyRef.current = `${optionsKey}|${effectsKey}|${skipShadowHandleKey ? 1 : 0}`;

  const refsRef = useRef<SyncRefs>({
    optionsRef, effectsPropRef, wrapperRefRef, skipShadowHandleRef, onExtractedShadowRef, syncKeyRef,
    fallbackBorderRadiusRef,
  });

  // Per-mount state. SVG handles are created lazily on first sync that
  // sees effects and destroyed only on unmount — toggling props on/off
  // doesn't rebuild the overlay.
  const stateRef = useRef<State | null>(null);

  // `autoEffectsKey` is captured at mount here; later toggles are handled by
  // the separate effect below, so this effect depends only on `ref`.
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
      lastWidth: 0,
      lastHeight: 0,
      lastSyncKey: null,
      fallbackBorderRadius: fallbackBorderRadiusRef.current,
      clearedFallbackRadius: false,
    };
    stateRef.current = s;

    // Eager handle creation so the overlay exists before the first resize
    // callback fires, avoiding a frame where it's missing.
    const initialMerged = mergeEffects(s.extracted, effectsPropRef.current);
    if (hasEffects(initialMerged))
      ensureHandles(s, initialMerged, wrapperRefRef.current, skipShadowHandleRef.current);

    onExtractedShadowRef.current?.(s.extracted?.effects.shadow);

    const unobserve = observeResize(el, (size) => runSync(s, refsRef.current, size));

    return () => {
      unobserve();
      s.effectsHandle?.destroy();
      s.shadowHandle?.destroy();
      if (s.extracted) restoreStyles(el, s.extracted.savedStyles);
      onExtractedShadowRef.current?.(undefined);
      if (s.didAcquire && s.anchor) releasePosition(s.anchor);
      stateRef.current = null;

      // Restore the SSR fallback we cleared, so an SSR→unmount→remount cycle
      // that reuses this element still shows rounded corners pre-clip-path.
      if (s.clearedFallbackRadius && s.fallbackBorderRadius !== undefined) {
        el.style.borderRadius = s.fallbackBorderRadius;
      }

      el.style.clipPath = savedClipPath;
      el.removeAttribute("data-slot");
      el.removeAttribute("data-state");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  // Re-sync on EVERY commit, not just option changes: renders that resize
  // the element through style props would otherwise wait for the resize
  // observer, which delivers a frame late — painted as a stale clip
  // mid-animation (flat corners on WebKit under load). The snapshot memo in
  // runSync keeps the idle-render cost at a single computed-style read.
  useIsoLayoutEffect(() => {
    const s = stateRef.current;
    if (!s) return;
    runSync(s, refsRef.current);
  });

  // Tear down the SVG drop-shadow handle when the consumer opts out at
  // runtime (e.g. shadowStrategy "svg" → "box-shadow"). Re-creation in the
  // other direction is handled by `ensureHandles` on the next sync.
  useIsoLayoutEffect(() => {
    const s = stateRef.current;
    if (!s) return;
    if (skipShadowHandleKey) {
      if (!s.shadowHandle) return;
      s.shadowHandle.destroy();
      s.shadowHandle = undefined;
      s.lastSyncKey = null; // effects state changed outside the render keys
    } else {
      // Re-enabling the SVG drop-shadow: invalidate so the next sync re-runs
      // ensureHandles (which re-creates the handle) and renders the shadow.
      s.lastSyncKey = null;
    }
  }, [skipShadowHandleKey]);

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
    s.lastSyncKey = null; // extraction changed the merged effects
    runSync(s, refsRef.current);
  }, [autoEffectsKey]);
}
