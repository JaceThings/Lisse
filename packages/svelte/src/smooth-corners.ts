import { createSmoothCornersController } from "@lisse/core";
import type { SmoothCornerOptions, EffectsConfig } from "@lisse/core";

export interface SmoothCornersAction {
  update: (config: SmoothCornersConfig) => void;
  destroy: () => void;
}

export interface SmoothCornersConfig {
  corners: SmoothCornerOptions;
  effects?: EffectsConfig;
  autoEffects?: boolean;
}

/**
 * Svelte action that applies smooth-cornered clip-path to an element.
 * Automatically updates on resize via a shared ResizeObserver.
 * By default, CSS `border` and `box-shadow` are automatically extracted and
 * converted to SVG effects (autoEffects).
 *
 * @example
 * ```svelte
 * <script>
 *   import { smoothCorners } from '@lisse/svelte';
 * </script>
 * <div use:smoothCorners={{ corners: { radius: 20, smoothing: 0.6 } }}>Content</div>
 * ```
 */
export function smoothCorners(
  node: HTMLElement,
  config: SmoothCornersConfig,
): SmoothCornersAction {
  let currentOptions: SmoothCornerOptions = config.corners;
  let currentEffects: EffectsConfig | undefined = config.effects;
  let currentAutoEffects = config.autoEffects ?? true;

  const controller = createSmoothCornersController({
    getOptions: () => currentOptions,
    getEffects: () => currentEffects,
    getAutoEffects: () => currentAutoEffects,
  });

  controller.attach(node);

  return {
    update(newConfig: SmoothCornersConfig) {
      currentOptions = newConfig.corners;
      currentEffects = newConfig.effects;

      const nextAuto = newConfig.autoEffects ?? true;
      if (nextAuto !== currentAutoEffects) {
        currentAutoEffects = nextAuto;
        controller.setAutoEffects(currentAutoEffects);
      } else {
        controller.sync();
      }
    },
    destroy() {
      controller.detach();
    },
  };
}
