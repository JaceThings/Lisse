import {
  watch,
  onMounted,
  onBeforeUnmount,
  unref,
  type Ref,
  type MaybeRef,
} from "vue";
import { generateClipPath, createSvgEffects, createDropShadow } from "@smooth-corners/core";
import type { SmoothCornerOptions, EffectsConfig } from "@smooth-corners/core";

export interface UseEffectsOptions {
  wrapper: Ref<HTMLElement | null>;
  effects: MaybeRef<EffectsConfig>;
}

/**
 * Vue composable that applies smooth-corners clip-path to a template ref.
 * Reactive to option changes and auto-resizes via ResizeObserver.
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
  let observer: ResizeObserver | undefined;
  let rafId: number | undefined;

  function update() {
    const el = unref(target);
    if (!el) return;

    rafId = requestAnimationFrame(() => {
      rafId = undefined;
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) {
        el.style.clipPath = generateClipPath(width, height, unref(options));
      }
    });
  }

  function setup() {
    cleanup();
    const el = unref(target);
    if (!el) return;
    if (typeof ResizeObserver === "undefined") return;

    observer = new ResizeObserver(update);
    observer.observe(el);
    update();
  }

  function cleanup() {
    observer?.disconnect();
    observer = undefined;
    if (rafId !== undefined) cancelAnimationFrame(rafId);
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
    let effectsObserver: ResizeObserver | undefined;
    let effectsRafId: number | undefined;

    function updateEffects() {
      const el = unref(target);
      const wrapper = unref(effectsOptions!.wrapper);
      if (!el || !wrapper || !effectsHandle || !shadowHandle) return;

      effectsRafId = requestAnimationFrame(() => {
        effectsRafId = undefined;
        const { width, height } = el.getBoundingClientRect();
        if (width <= 0 || height <= 0) return;
        const eff = unref(effectsOptions!.effects);
        effectsHandle!.update(unref(options), eff, width, height);
        if (eff.shadow) {
          wrapper.style.filter = shadowHandle!.update(eff.shadow);
        } else {
          wrapper.style.filter = "none";
        }
      });
    }

    function setupEffects() {
      cleanupEffects();
      const wrapper = unref(effectsOptions!.wrapper);
      const el = unref(target);
      if (!wrapper || !el) return;

      effectsHandle = createSvgEffects(wrapper);
      shadowHandle = createDropShadow(wrapper);

      if (typeof ResizeObserver !== "undefined") {
        effectsObserver = new ResizeObserver(updateEffects);
        effectsObserver.observe(el);
      }
      updateEffects();
    }

    function cleanupEffects() {
      effectsObserver?.disconnect();
      effectsObserver = undefined;
      if (effectsRafId !== undefined) cancelAnimationFrame(effectsRafId);
      effectsHandle?.destroy();
      effectsHandle = undefined;
      shadowHandle?.destroy();
      shadowHandle = undefined;
      const wrapper = unref(effectsOptions!.wrapper);
      if (wrapper) wrapper.style.filter = "";
    }

    watch(() => unref(effectsOptions!.effects), updateEffects, { deep: true });
    watch(() => unref(options), updateEffects, { deep: true });

    onMounted(setupEffects);
    onBeforeUnmount(cleanupEffects);
  }
}
