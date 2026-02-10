import {
  watch,
  onMounted,
  onBeforeUnmount,
  unref,
  type Ref,
  type MaybeRef,
} from "vue";
import { generateClipPath, createSvgEffects, createDropShadow, observeResize, DEFAULT_SHADOW, extractAndStripEffects, restoreStyles } from "@smooth-corners/core";
import type { SmoothCornerOptions, EffectsConfig } from "@smooth-corners/core";

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
 * import { useSmoothCorners } from '@smooth-corners/vue';
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
    let didSetPosition = false;

    function updateEffects() {
      const el = unref(target);
      if (!el || !effectsHandle || !shadowHandle) return;

      const { width, height } = el.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;

      // Merge extracted + explicit effects
      const explicit = effectsOptions?.effects ? unref(effectsOptions.effects) : undefined;
      const mergedEffects: EffectsConfig = {
        ...extractedResult?.effects,
        ...explicit,
      };

      effectsHandle.update(unref(options), mergedEffects, width, height);
      shadowHandle.update(
        unref(options),
        mergedEffects.shadow ?? DEFAULT_SHADOW,
        width, height,
      );
    }

    function setupEffects() {
      cleanupEffects();
      const el = unref(target);
      if (!el) return;

      const autoEffects = effectsOptions?.autoEffects !== undefined
        ? unref(effectsOptions.autoEffects)
        : true;

      // Auto-extract CSS effects
      if (autoEffects) {
        extractedResult = extractAndStripEffects(el);
      }

      // Merge extracted + explicit effects
      const explicit = effectsOptions?.effects ? unref(effectsOptions.effects) : undefined;
      const mergedEffects: EffectsConfig = {
        ...extractedResult?.effects,
        ...explicit,
      };

      const hasAnyEffects = !!(
        mergedEffects.innerBorder ||
        mergedEffects.outerBorder ||
        mergedEffects.innerShadow ||
        mergedEffects.shadow
      );

      if (!hasAnyEffects) return;

      // Determine anchor element
      const explicitWrapper = effectsOptions?.wrapper ? unref(effectsOptions.wrapper) : null;
      const anchor = explicitWrapper ?? el.parentElement;
      if (!anchor) return;

      // Ensure anchor has positioning
      if (getComputedStyle(anchor).position === "static") {
        anchor.style.position = "relative";
        didSetPosition = true;
      }

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

      if (didSetPosition) {
        const explicitWrapper = effectsOptions?.wrapper ? unref(effectsOptions.wrapper) : null;
        const anchor = explicitWrapper ?? unref(target)?.parentElement;
        if (anchor) anchor.style.position = "";
        didSetPosition = false;
      }
    }

    if (effectsOptions?.effects) {
      watch(() => unref(effectsOptions!.effects!), updateEffects, { deep: true });
    }
    watch(() => unref(options), updateEffects, { deep: true });

    onMounted(setupEffects);
    onBeforeUnmount(cleanupEffects);
  }
}
