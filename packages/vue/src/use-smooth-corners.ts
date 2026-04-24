import {
  watch,
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
}

function unrefOr<T, D>(r: MaybeRef<T> | undefined, fallback: D): T | D {
  return r !== undefined ? unref(r) : fallback;
}

/**
 * Vue composable that applies smooth-cornered clip-path to a template ref.
 * Reactive to option changes and auto-resizes via a shared ResizeObserver.
 *
 * @example
 * ```vue
 * <script setup>
 * import { ref } from 'vue';
 * import { useSmoothCorners } from '@lisse/vue';
 *
 * const el = ref(null);
 * useSmoothCorners(el, { radius: 20, smoothing: 0.6 });
 * </script>
 * <template><div ref="el">...</div></template>
 * ```
 */
export function useSmoothCorners(
  target: Ref<HTMLElement | null>,
  options: MaybeRef<SmoothCornerOptions>,
  effectsOptions?: UseEffectsOptions,
): void {
  let unobserve: (() => void) | undefined;
  // Captured at setup so cleanup restores onto the exact element we
  // mutated, even if target.value was reassigned to a different element
  // between setup and cleanup.
  let attachedEl: HTMLElement | null = null;
  let savedClipPath: string | undefined;

  // Effects state. Hoisted so the shared resize callback can reach it.
  let effectsHandle: ReturnType<typeof createSvgEffects> | undefined;
  let shadowHandle: ReturnType<typeof createDropShadow> | undefined;
  let extractedResult: ReturnType<typeof extractAndStripEffects> | undefined;
  // Captured at attach so cleanup releases the same element we acquired
  // on, even if the target element is reparented between setup and unmount.
  let attachedAnchor: HTMLElement | null = null;
  let didAcquire = false;

  // Attach or top-up the effects overlay. Anchor is captured on first
  // attach and reused, so a late-arriving shadow piggy-backs on the same
  // ref-counted position. Drop-shadow DOM nodes are created only when a
  // shadow config is actually present.
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

  // Single resize-synchronised callback. Mirrors the React hook's sync()
  // pattern: one observeResize registration per element routes both the
  // clip-path update and the effects update through one getBoundingClientRect
  // read per frame.
  function syncAll() {
    const el = unref(target);
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;

    el.style.clipPath = generateClipPath(width, height, unref(options));
    el.setAttribute("data-state", "ready");

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

    // Auto-extract CSS effects before first sync so handles, if needed,
    // are created with the merged config on the first observeResize tick.
    if (unrefOr(effectsOptions?.autoEffects, true)) {
      extractedResult = extractAndStripEffects(el);
    }

    // Eager handle creation when effects are present at setup so the overlay
    // exists before the resize observer's first callback fires.
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

    if (attachedEl) {
      attachedEl.style.clipPath = savedClipPath ?? "";
      attachedEl.removeAttribute("data-slot");
      attachedEl.removeAttribute("data-state");
    }
    attachedEl = null;
    savedClipPath = undefined;
  }

  watch(() => unref(target), setup);
  watch(() => unref(options), syncAll, { deep: true });
  if (effectsOptions?.effects) {
    watch(() => unref(effectsOptions!.effects!), syncAll, { deep: true });
  }
  // Re-run setup when autoEffects toggles so extraction lifecycle stays
  // correct (stripping / restoring CSS). syncAll alone can't express the
  // teardown half.
  if (effectsOptions?.autoEffects !== undefined) {
    watch(() => unref(effectsOptions!.autoEffects!), setup);
  }

  onMounted(setup);
  onBeforeUnmount(cleanup);
}
