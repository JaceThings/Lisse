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

  function update() {
    const el = unref(target);
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    if (width > 0 && height > 0) {
      el.style.clipPath = generateClipPath(width, height, unref(options));
      el.setAttribute("data-state", "ready");
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

    unobserve = observeResize(el, update);
  }

  function cleanup() {
    unobserve?.();
    unobserve = undefined;
    if (attachedEl) {
      attachedEl.style.clipPath = savedClipPath ?? "";
      attachedEl.removeAttribute("data-slot");
      attachedEl.removeAttribute("data-state");
    }
    attachedEl = null;
    savedClipPath = undefined;
  }

  watch(() => unref(target), setup);
  watch(() => unref(options), update, { deep: true });

  onMounted(setup);
  onBeforeUnmount(cleanup);

  // Effects overlay
  {
    let effectsHandle: ReturnType<typeof createSvgEffects> | undefined;
    let shadowHandle: ReturnType<typeof createDropShadow> | undefined;
    let unobserveEffects: (() => void) | undefined;
    let extractedResult: ReturnType<typeof extractAndStripEffects> | undefined;
    // Captured at attach so cleanup releases the same element we acquired
    // on, even if the target element is reparented between setup and unmount.
    let attachedAnchor: HTMLElement | null = null;
    let didAcquire = false;

    function updateEffects() {
      const el = unref(target);
      if (!el) return;

      const { width, height } = el.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;

      const merged = mergeEffects(extractedResult, unrefOr(effectsOptions?.effects, undefined));

      // Lazy handle creation (matches Svelte pattern)
      if (hasEffects(merged) && !effectsHandle) {
        const anchor = unrefOr(effectsOptions?.wrapper, null) ?? el.parentElement;
        if (!anchor) return;
        attachedAnchor = anchor;
        didAcquire = acquirePosition(anchor);
        effectsHandle = createSvgEffects(anchor);
        shadowHandle = createDropShadow(anchor);
        if (!unobserveEffects) {
          unobserveEffects = observeResize(el, updateEffects);
        }
      }

      if (!effectsHandle || !shadowHandle) return;

      effectsHandle.update(unref(options), merged, width, height);
      shadowHandle.update(
        unref(options),
        merged.shadow ?? DEFAULT_SHADOW,
        width,
        height,
      );
    }

    function setupEffects() {
      cleanupEffects();
      const el = unref(target);
      if (!el) return;

      // Auto-extract CSS effects
      if (unrefOr(effectsOptions?.autoEffects, true)) {
        extractedResult = extractAndStripEffects(el);
      }

      const merged = mergeEffects(extractedResult, unrefOr(effectsOptions?.effects, undefined));
      if (!hasEffects(merged)) return;

      const anchor = unrefOr(effectsOptions?.wrapper, null) ?? el.parentElement;
      if (!anchor) return;

      // Ensure anchor has positioning (ref-counted)
      attachedAnchor = anchor;
      didAcquire = acquirePosition(anchor);

      effectsHandle = createSvgEffects(anchor);
      shadowHandle = createDropShadow(anchor);

      unobserveEffects = observeResize(el, updateEffects);
    }

    function cleanupEffects() {
      unobserveEffects?.();
      unobserveEffects = undefined;
      effectsHandle?.destroy();
      effectsHandle = undefined;
      shadowHandle?.destroy();
      shadowHandle = undefined;

      const el = unref(target);
      if (el && extractedResult) {
        restoreStyles(el, extractedResult.savedStyles);
      }
      extractedResult = undefined;

      if (didAcquire && attachedAnchor) {
        releasePosition(attachedAnchor);
      }
      attachedAnchor = null;
      didAcquire = false;
    }

    if (effectsOptions?.effects) {
      watch(() => unref(effectsOptions!.effects!), updateEffects, {
        deep: true,
      });
    }
    watch(() => unref(options), updateEffects, { deep: true });

    watch(() => unref(target), setupEffects);
    if (effectsOptions?.autoEffects !== undefined) {
      watch(() => unref(effectsOptions!.autoEffects!), setupEffects);
    }

    onMounted(setupEffects);
    onBeforeUnmount(cleanupEffects);
  }
}
