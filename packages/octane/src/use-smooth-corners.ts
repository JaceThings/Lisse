import { useEffect, useLayoutEffect, useRef } from "octane";
import {
  generateClipPath,
  createSvgEffects,
  createDropShadow,
  observeResize,
  observeAnchor,
  getLayoutSize,
  DEFAULT_SHADOW,
  extractAndStripEffects,
  restoreStyles,
  acquirePosition,
  releasePosition,
  hasEffects,
  mergeEffects,
} from "@lisse/core";
import type {
  SmoothCornerOptions,
  EffectsConfig,
  ShadowConfig,
  Measured,
  MeasuredSize,
  OverlayOffset,
} from "@lisse/core";
import { subSlot } from "./manual.js";

// `Octane.Ref<T>` is the ref PROP union, not what `useRef` returns.
interface RefObject<T> {
  current: T;
}

/** Use the synchronous client effect without warning during SSR. */
export const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function syncEffects(
  options: SmoothCornerOptions,
  merged: EffectsConfig,
  effectsHandle: ReturnType<typeof createSvgEffects>,
  shadowHandle: ReturnType<typeof createDropShadow> | undefined,
  width: number,
  height: number,
  offset: OverlayOffset,
): void {
  effectsHandle.update(options, merged, width, height, offset);
  shadowHandle?.update(options, merged.shadow ?? DEFAULT_SHADOW, width, height, offset);
}

interface State {
  el: HTMLElement;
  savedClipPath: string;
  extracted: ReturnType<typeof extractAndStripEffects> | undefined;
  effectsHandle: ReturnType<typeof createSvgEffects> | undefined;
  shadowHandle: ReturnType<typeof createDropShadow> | undefined;
  anchor: HTMLElement | null;
  didAcquire: boolean;
  unobserveAnchor: (() => void) | undefined;
  pendingSize: MeasuredSize | undefined;
  lastWidth: number;
  lastHeight: number;
  lastSyncKey: string | null;
  lastOffsetX: number;
  lastOffsetY: number;
  fallbackBorderRadius: string | undefined;
  clearedFallbackRadius: boolean;
}

interface SyncRefs {
  optionsRef: RefObject<SmoothCornerOptions>;
  effectsPropRef: RefObject<EffectsConfig | undefined>;
  wrapperRefRef: RefObject<RefObject<HTMLElement | null> | undefined>;
  skipShadowHandleRef: RefObject<boolean>;
  onExtractedShadowRef: RefObject<
    ((shadow: ShadowConfig | ShadowConfig[] | undefined) => void) | undefined
  >;
  syncKeyRef: RefObject<string>;
  fallbackBorderRadiusRef: RefObject<string | undefined>;
}

function runSync(s: State, refs: SyncRefs, measured?: Measured | MeasuredSize): void {
  const merged = mergeEffects(s.extracted, refs.effectsPropRef.current);
  if (hasEffects(merged)) {
    ensureHandles(s, merged, refs.wrapperRefRef.current, refs.skipShadowHandleRef.current);
  }

  const pending = s.pendingSize;
  s.pendingSize = undefined;
  const { width, height } = measured ?? pending ?? getLayoutSize(s.el);
  if (width <= 0 || height <= 0) return;

  const placed = measured && "offsetLeft" in measured ? measured : undefined;
  const anchored = s.effectsHandle !== undefined;
  const offsetX = anchored ? (placed?.offsetLeft ?? s.el.offsetLeft) : 0;
  const offsetY = anchored ? (placed?.offsetTop ?? s.el.offsetTop) : 0;

  const key = refs.syncKeyRef.current;
  if (
    width === s.lastWidth &&
    height === s.lastHeight &&
    key === s.lastSyncKey &&
    offsetX === s.lastOffsetX &&
    offsetY === s.lastOffsetY
  ) {
    return;
  }
  s.lastWidth = width;
  s.lastHeight = height;
  s.lastSyncKey = key;
  s.lastOffsetX = offsetX;
  s.lastOffsetY = offsetY;

  s.el.style.clipPath = generateClipPath(width, height, refs.optionsRef.current);
  s.el.setAttribute("data-state", "ready");
  if (s.fallbackBorderRadius !== undefined && !s.clearedFallbackRadius) {
    s.el.style.borderRadius = "";
    s.clearedFallbackRadius = true;
  }

  if (s.effectsHandle) {
    syncEffects(
      refs.optionsRef.current,
      merged,
      s.effectsHandle,
      s.shadowHandle,
      width,
      height,
      { x: offsetX, y: offsetY },
    );
  }
}

function ensureHandles(
  s: State,
  merged: EffectsConfig,
  wrapperRef: RefObject<HTMLElement | null> | undefined,
  skipShadowHandle: boolean,
): void {
  if (!s.anchor) {
    const supplied = wrapperRef?.current;
    const wrapper = supplied && supplied !== s.el ? supplied : null;
    const anchor = wrapper ?? s.el.parentElement;
    if (!anchor) return;
    s.anchor = anchor;
    s.didAcquire = acquirePosition(anchor);
    s.unobserveAnchor = observeAnchor(anchor, s.el);
  }
  if (!s.effectsHandle) {
    s.effectsHandle = createSvgEffects(s.anchor, s.el);
  }
  if (!s.shadowHandle && merged.shadow && !skipShadowHandle) {
    s.shadowHandle = createDropShadow(s.anchor, s.el);
  }
}

export interface UseEffectsOptions {
  wrapperRef?: RefObject<HTMLElement | null>;
  effects?: EffectsConfig;
  autoEffects?: boolean;
  skipShadowHandle?: boolean;
  onExtractedShadow?: (shadow: ShadowConfig | ShadowConfig[] | undefined) => void;
  fallbackBorderRadius?: string;
}

export function useSmoothCorners(
  ref: RefObject<HTMLElement | null>,
  options: SmoothCornerOptions,
  effectsOptions?: UseEffectsOptions,
): void;
export function useSmoothCorners(
  ref: RefObject<HTMLElement | null>,
  options: SmoothCornerOptions,
  slot: symbol,
): void;
export function useSmoothCorners(
  ref: RefObject<HTMLElement | null>,
  options: SmoothCornerOptions,
  effectsOptions: UseEffectsOptions,
  slot: symbol,
): void;
export function useSmoothCorners(
  ref: RefObject<HTMLElement | null>,
  options: SmoothCornerOptions,
  effectsOptionsOrSlot?: UseEffectsOptions | symbol,
  slotArg?: symbol,
): void {
  const slot = typeof effectsOptionsOrSlot === "symbol" ? effectsOptionsOrSlot : slotArg;
  const effectsOptions = typeof effectsOptionsOrSlot === "symbol" ? undefined : effectsOptionsOrSlot;
  const { wrapperRef, effects, autoEffects, skipShadowHandle, onExtractedShadow, fallbackBorderRadius } =
    effectsOptions ?? {};

  const optionsRef = useRef(options, subSlot(slot, "options"));
  optionsRef.current = options;

  const effectsPropRef = useRef(effects, subSlot(slot, "effects"));
  effectsPropRef.current = effects;

  const wrapperRefRef = useRef(wrapperRef, subSlot(slot, "wrapper"));
  wrapperRefRef.current = wrapperRef;

  const skipShadowHandleRef = useRef(skipShadowHandle ?? false, subSlot(slot, "skip-shadow"));
  skipShadowHandleRef.current = skipShadowHandle ?? false;

  const onExtractedShadowRef = useRef(onExtractedShadow, subSlot(slot, "shadow-callback"));
  onExtractedShadowRef.current = onExtractedShadow;

  const fallbackBorderRadiusRef = useRef(fallbackBorderRadius, subSlot(slot, "fallback-radius"));
  fallbackBorderRadiusRef.current = fallbackBorderRadius;

  const optionsKey = JSON.stringify(options);
  const effectsKey = JSON.stringify(effects ?? null);
  const autoEffectsKey = autoEffects ?? true;
  const skipShadowHandleKey = skipShadowHandle ?? false;

  const syncKeyRef = useRef("", subSlot(slot, "sync-key"));
  syncKeyRef.current = `${optionsKey}|${effectsKey}|${skipShadowHandleKey ? 1 : 0}`;

  const refsRef = useRef<SyncRefs>(
    {
      optionsRef,
      effectsPropRef,
      wrapperRefRef,
      skipShadowHandleRef,
      onExtractedShadowRef,
      syncKeyRef,
      fallbackBorderRadiusRef,
    },
    subSlot(slot, "refs"),
  );

  const stateRef = useRef<State | null>(null, subSlot(slot, "state"));

  useIsoLayoutEffect(
    () => {
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
        unobserveAnchor: undefined,
        pendingSize: initialExtracted?.size,
        lastWidth: 0,
        lastHeight: 0,
        lastSyncKey: null,
        lastOffsetX: 0,
        lastOffsetY: 0,
        fallbackBorderRadius: fallbackBorderRadiusRef.current,
        clearedFallbackRadius: false,
      };
      stateRef.current = s;

      const initialMerged = mergeEffects(s.extracted, effectsPropRef.current);
      if (hasEffects(initialMerged)) {
        ensureHandles(s, initialMerged, wrapperRefRef.current, skipShadowHandleRef.current);
      }

      onExtractedShadowRef.current?.(s.extracted?.effects.shadow);
      const unobserve = observeResize(el, (size) => runSync(s, refsRef.current, size));

      return () => {
        unobserve();
        s.unobserveAnchor?.();
        s.effectsHandle?.destroy();
        s.shadowHandle?.destroy();
        if (s.extracted) restoreStyles(el, s.extracted.savedStyles);
        onExtractedShadowRef.current?.(undefined);
        if (s.didAcquire && s.anchor) releasePosition(s.anchor);
        stateRef.current = null;

        if (s.clearedFallbackRadius && s.fallbackBorderRadius !== undefined) {
          el.style.borderRadius = s.fallbackBorderRadius;
        }
        el.style.clipPath = savedClipPath;
        el.removeAttribute("data-slot");
        el.removeAttribute("data-state");
      };
    },
    [ref],
    subSlot(slot, "mount"),
  );

  useIsoLayoutEffect(
    () => {
      const s = stateRef.current;
      if (!s) return;
      runSync(s, refsRef.current);
    },
    undefined,
    subSlot(slot, "commit-sync"),
  );

  useIsoLayoutEffect(
    () => {
      const s = stateRef.current;
      if (!s) return;
      if (skipShadowHandleKey) {
        if (!s.shadowHandle) return;
        s.shadowHandle.destroy();
        s.shadowHandle = undefined;
        s.lastSyncKey = null;
      } else {
        s.lastSyncKey = null;
      }
    },
    [skipShadowHandleKey],
    subSlot(slot, "shadow-toggle"),
  );

  useIsoLayoutEffect(
    () => {
      const s = stateRef.current;
      if (!s) return;
      const hadExtraction = s.extracted !== undefined;
      if (autoEffectsKey && !hadExtraction) {
        s.extracted = extractAndStripEffects(s.el);
        s.pendingSize = s.extracted.size;
      } else if (!autoEffectsKey && hadExtraction) {
        restoreStyles(s.el, s.extracted!.savedStyles);
        s.extracted = undefined;
      } else {
        return;
      }
      onExtractedShadowRef.current?.(s.extracted?.effects.shadow);
      s.lastSyncKey = null;
      runSync(s, refsRef.current);
    },
    [autoEffectsKey],
    subSlot(slot, "auto-effects"),
  );
}
