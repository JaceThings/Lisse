import {
  watch,
  onMounted,
  onBeforeUnmount,
  unref,
  type Ref,
  type MaybeRef,
} from "vue";
import { generateClipPath } from "@smooth-corners/core";
import type { SmoothCornerOptions } from "@smooth-corners/core";

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
  options: MaybeRef<SmoothCornerOptions>
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
}
