import {
  watch,
  onMounted,
  onBeforeUnmount,
  unref,
  type Ref,
  type MaybeRef,
} from "vue";
import { createSmoothCornersController } from "@lisse/core";
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
  const controller = createSmoothCornersController({
    getOptions: () => unref(options),
    getEffects: () => unrefOr(effectsOptions?.effects, undefined),
    getAutoEffects: () => unrefOr(effectsOptions?.autoEffects, true),
    getAnchor: (el) => unrefOr(effectsOptions?.wrapper, null) ?? el.parentElement,
  });

  function setup() {
    controller.detach();
    const el = unref(target);
    if (!el) return;
    controller.attach(el);
  }

  watch(() => unref(target), setup);
  watch(() => unref(options), () => controller.sync(), { deep: true });
  if (effectsOptions?.effects) {
    watch(() => unref(effectsOptions!.effects!), () => controller.sync(), { deep: true });
  }
  if (effectsOptions?.autoEffects !== undefined) {
    watch(
      () => unref(effectsOptions!.autoEffects!),
      (enable) => controller.setAutoEffects(enable),
    );
  }

  onMounted(setup);
  onBeforeUnmount(() => controller.detach());
}
