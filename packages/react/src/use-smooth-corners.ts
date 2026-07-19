import { useEffect, useLayoutEffect, useRef } from "react";
import { createSmoothCornersController } from "@lisse/core";
import type { SmoothCornerOptions, EffectsConfig, ShadowConfig } from "@lisse/core";

/**
 * `useLayoutEffect` on the client, `useEffect` during SSR — mutate the DOM
 * synchronously after layout (no flash of un-clipped corners or un-stripped
 * borders) without triggering React's SSR warning.
 */
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

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

  const skipShadowHandleRef = useRef(skipShadowHandle ?? false);
  skipShadowHandleRef.current = skipShadowHandle ?? false;

  const onExtractedShadowRef = useRef(onExtractedShadow);
  onExtractedShadowRef.current = onExtractedShadow;

  const optionsKey = JSON.stringify(options);
  const effectsKey = JSON.stringify(effects ?? null);
  const autoEffectsKey = autoEffects ?? true;
  const skipShadowHandleKey = skipShadowHandle ?? false;

  const syncKeyRef = useRef("");
  syncKeyRef.current = `${optionsKey}|${effectsKey}`;

  const controllerRef = useRef<ReturnType<typeof createSmoothCornersController> | null>(null);

  useIsoLayoutEffect(() => {
    const controller = createSmoothCornersController({
      getOptions: () => optionsRef.current,
      getEffects: () => effectsPropRef.current,
      getAutoEffects: () => autoEffectsKey,
      getAnchor: (el) => wrapperRefRef.current?.current ?? el.parentElement,
      skipShadowHandle: () => skipShadowHandleRef.current,
      onExtractedShadow: (shadow) => onExtractedShadowRef.current?.(shadow),
      getSyncKey: () => syncKeyRef.current,
    });
    controllerRef.current = controller;

    const el = ref.current;
    if (!el) return;

    controller.attach(el);

    return () => {
      controller.detach();
      controllerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  useIsoLayoutEffect(() => {
    controllerRef.current?.sync();
  });

  useIsoLayoutEffect(() => {
    if (!skipShadowHandleKey) return;
    controllerRef.current?.destroyShadowHandle();
  }, [skipShadowHandleKey]);

  useIsoLayoutEffect(() => {
    controllerRef.current?.setAutoEffects(autoEffectsKey);
  }, [autoEffectsKey]);
}
