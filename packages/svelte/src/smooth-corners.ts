import { generateClipPath } from "@smooth-corners/core";
import type { SmoothCornerOptions } from "@smooth-corners/core";

export interface SmoothCornersAction {
  update: (options: SmoothCornerOptions) => void;
  destroy: () => void;
}

/**
 * Svelte action that applies smooth-corners clip-path to an element.
 * Automatically updates on resize via ResizeObserver.
 *
 * @example
 * ```svelte
 * <script>
 *   import { smoothCorners } from '@smooth-corners/svelte';
 * </script>
 * <div use:smoothCorners={{ radius: 20, smoothing: 0.6 }}>Content</div>
 * ```
 */
export function smoothCorners(
  node: HTMLElement,
  options: SmoothCornerOptions
): SmoothCornersAction {
  let currentOptions = options;
  let rafId: number | undefined;
  let observer: ResizeObserver | undefined;

  function apply() {
    rafId = requestAnimationFrame(() => {
      rafId = undefined;
      const { width, height } = node.getBoundingClientRect();
      if (width > 0 && height > 0) {
        node.style.clipPath = generateClipPath(width, height, currentOptions);
      }
    });
  }

  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(apply);
    observer.observe(node);
  }

  apply();

  return {
    update(newOptions: SmoothCornerOptions) {
      currentOptions = newOptions;
      apply();
    },
    destroy() {
      observer?.disconnect();
      if (rafId !== undefined) cancelAnimationFrame(rafId);
      node.style.clipPath = "";
    },
  };
}
