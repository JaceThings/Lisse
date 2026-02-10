import {
  watch,
  onMounted,
  onBeforeUnmount,
  unref,
  type Ref,
  type MaybeRef,
} from "vue";
import { generateClipPath, createSvgEffects, createDropShadow, observeResize, DEFAULT_SHADOW } from "@smooth-corners/core";
import type { SmoothCornerOptions, EffectsConfig } from "@smooth-corners/core";

export interface UseEffectsOptions {
  wrapper: Ref<HTMLElement | null>;
  effects: MaybeRef<EffectsConfig>;
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
  if (effectsOptions) {
    let effectsHandle: ReturnType<typeof createSvgEffects> | undefined;
    let shadowHandle: ReturnType<typeof createDropShadow> | undefined;
    let unobserveEffects: (() => void) | undefined;

    function updateEffects() {
      const el = unref(target);
      const wrapper = unref(effectsOptions!.wrapper);
      if (!el || !wrapper || !effectsHandle || !shadowHandle) return;

      const { width, height } = el.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      const eff = unref(effectsOptions!.effects);
      effectsHandle!.update(unref(options), eff, width, height);
      shadowHandle!.update(
        unref(options),
        eff.shadow ?? DEFAULT_SHADOW,
        width, height,
      );
    }

    function setupEffects() {
      cleanupEffects();
      const wrapper = unref(effectsOptions!.wrapper);
      const el = unref(target);
      if (!wrapper || !el) return;

      effectsHandle = createSvgEffects(wrapper);
      shadowHandle = createDropShadow(wrapper);

      unobserveEffects = observeResize(el, updateEffects);
    }

    function cleanupEffects() {
      unobserveEffects?.();
      unobserveEffects = undefined;
      effectsHandle?.destroy();
      effectsHandle = undefined;
      shadowHandle?.destroy();
      shadowHandle = undefined;
    }

    watch(() => unref(effectsOptions!.effects), updateEffects, { deep: true });
    watch(() => unref(options), updateEffects, { deep: true });

    onMounted(setupEffects);
    onBeforeUnmount(cleanupEffects);
  }
}
