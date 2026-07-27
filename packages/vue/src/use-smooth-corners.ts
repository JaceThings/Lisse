import {
  watch,
  computed,
  onMounted,
  onBeforeUnmount,
  unref,
  type Ref,
  type MaybeRef,
} from "vue";
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
import type { SmoothCornerOptions, EffectsConfig } from "@lisse/core";

export interface UseEffectsOptions {
  wrapper?: Ref<HTMLElement | null>;
  effects?: MaybeRef<EffectsConfig>;
  autoEffects?: MaybeRef<boolean>;
  /**
   * The inline `border-radius` fallback the caller rendered for SSR/first
   * paint. CSS intersects border-radius with clip-path, and the rounded rect
   * is a strict subset of the squircle, so once the clip-path lands the
   * fallback must go or it squares off the corners. Pass `undefined` when the
   * user supplied their own border-radius. Cleared from the DOM in `syncAll`
   * and restored on teardown.
   */
  fallbackBorderRadius?: string;
  /**
   * Flipped `true` when the clip-path first lands, so the component can stop
   * emitting the fallback border-radius. Vue re-patches every inline style key
   * on each render, so an imperative clear alone would be undone on the next
   * re-render — the component drops the binding based on this flag instead.
   * Reset to `false` on teardown.
   */
  clipPathApplied?: Ref<boolean>;
}

function unrefOr<T, D>(r: MaybeRef<T> | undefined, fallback: D): T | D {
  return r !== undefined ? unref(r) : fallback;
}

// Applies a smooth-cornered clip-path to a template ref, reactive to option
// changes and auto-resizing via a shared ResizeObserver.
export function useSmoothCorners(
  target: Ref<HTMLElement | null>,
  options: MaybeRef<SmoothCornerOptions>,
  effectsOptions?: UseEffectsOptions,
): void {
  let unobserve: (() => void) | undefined;
  // Captured at setup so cleanup restores onto the exact element we mutated,
  // even if target.value is reassigned before cleanup.
  let attachedEl: HTMLElement | null = null;
  let savedClipPath: string | undefined;

  let effectsHandle: ReturnType<typeof createSvgEffects> | undefined;
  let shadowHandle: ReturnType<typeof createDropShadow> | undefined;
  let extractedResult: ReturnType<typeof extractAndStripEffects> | undefined;
  // Captured at attach so cleanup releases the same element we acquired on,
  // even if the target is reparented before unmount.
  let attachedAnchor: HTMLElement | null = null;
  let didAcquire = false;

  // Change guard: syncAll bails when width, height, and the serialized
  // options/effects key are all unchanged, so no-op reactive/resize ticks
  // issue zero regenerations and zero DOM writes. lastSyncKey starts null and
  // is reset in cleanup, so a fresh setup (including an autoEffects toggle,
  // which re-runs setup) always re-syncs once.
  let lastWidth = 0;
  let lastHeight = 0;
  let lastSyncKey: string | null = null;
  // Whether we've cleared the SSR border-radius fallback for the current setup.
  let clearedFallbackRadius = false;

  // Vue's computed caches these, so JSON.stringify runs at most once per
  // underlying change, not per tick.
  const optionsKey = computed(() => JSON.stringify(unref(options)));
  const effectsKey = computed(() =>
    JSON.stringify(unrefOr(effectsOptions?.effects, null)),
  );
  const syncKey = computed(() => `${optionsKey.value}|${effectsKey.value}`);

  // Attach or top-up the effects overlay. The anchor is captured once and
  // reused, so a late-arriving shadow piggy-backs on the same ref-counted
  // position. Drop-shadow nodes are created only when a shadow config exists.
  function ensureHandles(el: HTMLElement, merged: EffectsConfig): boolean {
    if (!attachedAnchor) {
      const anchor = unrefOr(effectsOptions?.wrapper, null) ?? el.parentElement;
      if (!anchor) return false;
      attachedAnchor = anchor;
      didAcquire = acquirePosition(anchor);
    }
    if (!effectsHandle) {
      effectsHandle = createSvgEffects(attachedAnchor);
    }
    if (!shadowHandle && merged.shadow) {
      shadowHandle = createDropShadow(attachedAnchor);
    }
    return !!effectsHandle;
  }

  // Resize ticks pass the size the observer measured for this flush;
  // watcher-driven syncs pass none and fall back to a measured read.
  function syncAll(size?: { width: number; height: number }) {
    const el = unref(target);
    if (!el) return;
    const { width, height } = size ?? getLayoutSize(el);
    if (width <= 0 || height <= 0) return;

    const key = syncKey.value;
    if (width === lastWidth && height === lastHeight && key === lastSyncKey) return;
    lastWidth = width;
    lastHeight = height;
    lastSyncKey = key;

    el.style.clipPath = generateClipPath(width, height, unref(options));
    el.setAttribute("data-state", "ready");

    // The clip-path is the silhouette now; drop the SSR border-radius fallback
    // so it stops intersecting (squaring off) the squircle. Clear it in the DOM
    // and flip the reactive flag so the component stops re-emitting it.
    if (effectsOptions?.fallbackBorderRadius !== undefined && !clearedFallbackRadius) {
      el.style.borderRadius = "";
      clearedFallbackRadius = true;
    }
    if (effectsOptions?.clipPathApplied && !effectsOptions.clipPathApplied.value) {
      effectsOptions.clipPathApplied.value = true;
    }

    const merged = mergeEffects(extractedResult, unrefOr(effectsOptions?.effects, undefined));
    if (hasEffects(merged)) ensureHandles(el, merged);
    if (effectsHandle) {
      effectsHandle.update(unref(options), merged, width, height);
    }
    if (shadowHandle) {
      shadowHandle.update(
        unref(options),
        merged.shadow ?? DEFAULT_SHADOW,
        width,
        height,
      );
    }
  }

  function setup() {
    cleanup();
    const el = unref(target);
    if (!el) return;

    attachedEl = el;
    savedClipPath = el.style.clipPath;
    el.setAttribute("data-slot", "smooth-corners");
    el.setAttribute("data-state", "pending");

    // Auto-extract CSS effects before first sync so handles are created with
    // the merged config on the first observeResize tick.
    if (unrefOr(effectsOptions?.autoEffects, true)) {
      extractedResult = extractAndStripEffects(el);
    }

    // Eager handle creation so the overlay exists before the resize observer's
    // first callback fires.
    const merged = mergeEffects(extractedResult, unrefOr(effectsOptions?.effects, undefined));
    if (hasEffects(merged)) ensureHandles(el, merged);

    unobserve = observeResize(el, syncAll);
  }

  function cleanup() {
    unobserve?.();
    unobserve = undefined;

    effectsHandle?.destroy();
    effectsHandle = undefined;
    shadowHandle?.destroy();
    shadowHandle = undefined;

    if (attachedEl && extractedResult) {
      restoreStyles(attachedEl, extractedResult.savedStyles);
    }
    extractedResult = undefined;

    if (didAcquire && attachedAnchor) {
      releasePosition(attachedAnchor);
    }
    attachedAnchor = null;
    didAcquire = false;

    // Invalidate the change guard so the next setup re-syncs from scratch
    // (e.g. after an autoEffects toggle resets the effect lifecycle).
    lastWidth = 0;
    lastHeight = 0;
    lastSyncKey = null;

    clearedFallbackRadius = false;
    // We deliberately do NOT restore the SSR border-radius fallback here, nor
    // reset `clipPathApplied`. Vue re-runs setup()→cleanup() on every
    // re-render (the `watch(target)` fires), and a real unmount → remount builds
    // a fresh component with a fresh `clipPathApplied = ref(false)` that re-emits
    // the fallback on its own. Restoring/resetting here would instead resurrect
    // the fallback on every re-render and re-square the squircle.

    if (attachedEl) {
      attachedEl.style.clipPath = savedClipPath ?? "";
      attachedEl.removeAttribute("data-slot");
      attachedEl.removeAttribute("data-state");
    }
    attachedEl = null;
    savedClipPath = undefined;
  }

  watch(() => unref(target), setup);
  // Watch the cheap serialized keys, not the deep trees. Wrapped so the
  // watcher's (newValue, oldValue) args aren't mistaken for a border-box size;
  // watcher-driven syncs always re-measure.
  watch(optionsKey, () => syncAll());
  if (effectsOptions?.effects) {
    watch(effectsKey, () => syncAll());
  }
  // Re-run setup (not just syncAll) when autoEffects toggles so the extraction
  // lifecycle — stripping / restoring CSS — stays correct.
  if (effectsOptions?.autoEffects !== undefined) {
    watch(() => unref(effectsOptions!.autoEffects!), setup);
  }

  onMounted(setup);
  onBeforeUnmount(cleanup);
}
