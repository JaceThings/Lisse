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
} from "@lisse/core";
import type { SmoothCornerOptions, EffectsConfig } from "@lisse/core";

export interface UseEffectsOptions {
  wrapper?: Ref<HTMLElement | null>;
  effects?: MaybeRef<EffectsConfig>;
  autoEffects?: MaybeRef<boolean>;
}

/**
 * Vue composable that applies smooth-corners clip-path to a template ref.
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

  function update() {
    const el = unref(target);
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    if (width > 0 && height > 0) {
      el.style.clipPath = generateClipPath(width, height, unref(options));
    }
  }

  function setup() {
    cleanup();
    const el = unref(target);
    if (!el) return;

    unobserve = observeResize(el, update);
  }

  function cleanup() {
    unobserve?.();
    unobserve = undefined;
    const el = unref(target);
    if (el) el.style.clipPath = "";
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
    let didAcquire = false;

    function updateEffects() {
      const el = unref(target);
      if (!el) return;

      const { width, height } = el.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;

      // Merge extracted + explicit effects
      const explicit = effectsOptions?.effects
        ? unref(effectsOptions.effects)
        : undefined;
      const mergedEffects: EffectsConfig = {
        ...extractedResult?.effects,
        ...explicit,
      };

      const hasAny = !!(
        mergedEffects.innerBorder ||
        mergedEffects.outerBorder ||
        mergedEffects.middleBorder ||
        mergedEffects.innerShadow ||
        mergedEffects.shadow
      );

      // Lazy handle creation (matches Svelte pattern)
      if (hasAny && !effectsHandle) {
        const explicitWrapper = effectsOptions?.wrapper
          ? unref(effectsOptions.wrapper)
          : null;
        const anchor = explicitWrapper ?? el.parentElement;
        if (!anchor) return;
        didAcquire = acquirePosition(anchor);
        effectsHandle = createSvgEffects(anchor);
        shadowHandle = createDropShadow(anchor);
        if (!unobserveEffects) {
          unobserveEffects = observeResize(el, updateEffects);
        }
      }

      if (!effectsHandle || !shadowHandle) return;

      effectsHandle.update(unref(options), mergedEffects, width, height);
      shadowHandle.update(
        unref(options),
        mergedEffects.shadow ?? DEFAULT_SHADOW,
        width,
        height,
      );
    }

    function setupEffects() {
      cleanupEffects();
      const el = unref(target);
      if (!el) return;

      const autoEffects =
        effectsOptions?.autoEffects !== undefined
          ? unref(effectsOptions.autoEffects)
          : true;

      // Auto-extract CSS effects
      if (autoEffects) {
        extractedResult = extractAndStripEffects(el);
      }

      // Merge extracted + explicit effects
      const explicit = effectsOptions?.effects
        ? unref(effectsOptions.effects)
        : undefined;
      const mergedEffects: EffectsConfig = {
        ...extractedResult?.effects,
        ...explicit,
      };

      const hasAnyEffects = !!(
        mergedEffects.innerBorder ||
        mergedEffects.outerBorder ||
        mergedEffects.middleBorder ||
        mergedEffects.innerShadow ||
        mergedEffects.shadow
      );

      if (!hasAnyEffects) return;

      // Determine anchor element
      const explicitWrapper = effectsOptions?.wrapper
        ? unref(effectsOptions.wrapper)
        : null;
      const anchor = explicitWrapper ?? el.parentElement;
      if (!anchor) return;

      // Ensure anchor has positioning (ref-counted)
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

      if (didAcquire) {
        const explicitWrapper = effectsOptions?.wrapper
          ? unref(effectsOptions.wrapper)
          : null;
        const anchor = explicitWrapper ?? unref(target)?.parentElement;
        if (anchor) releasePosition(anchor);
        didAcquire = false;
      }
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
