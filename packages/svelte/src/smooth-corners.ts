import { generateClipPath, createSvgEffects, createDropShadow, observeResize, DEFAULT_SHADOW } from "@smooth-corners/core";
import type { SmoothCornerOptions, EffectsConfig } from "@smooth-corners/core";

export interface SmoothCornersAction {
  update: (options: SmoothCornerOptions | SmoothCornersConfig) => void;
  destroy: () => void;
}

export interface SmoothCornersConfig {
  corners: SmoothCornerOptions;
  effects?: EffectsConfig;
}

function isConfig(input: SmoothCornerOptions | SmoothCornersConfig): input is SmoothCornersConfig {
  return "corners" in input;
}

/**
 * Svelte action that applies smooth-corners clip-path to an element.
 * Automatically updates on resize via a shared ResizeObserver.
 *
 * @example
 * ```svelte
 * <script>
 *   import { smoothCorners } from '@smooth-corners/svelte';
 * </script>
 * <div use:smoothCorners={{ radius: 20, smoothing: 0.6 }}>Content</div>
 * ```
 *
 * @example With effects (parent must have position:relative)
 * ```svelte
 * <div style="position:relative">
 *   <div use:smoothCorners={{ corners: { radius: 20 }, effects: { innerBorder: { width: 2, color: '#fff', opacity: 0.5 } } }}>
 *     Content
 *   </div>
 * </div>
 * ```
 */
export function smoothCorners(
  node: HTMLElement,
  input: SmoothCornerOptions | SmoothCornersConfig
): SmoothCornersAction {
  let currentOptions: SmoothCornerOptions;
  let currentEffects: EffectsConfig | undefined;

  if (isConfig(input)) {
    currentOptions = input.corners;
    currentEffects = input.effects;
  } else {
    currentOptions = input;
  }

  // Effects handles
  let effectsHandle: ReturnType<typeof createSvgEffects> | undefined;
  let shadowHandle: ReturnType<typeof createDropShadow> | undefined;

  if (currentEffects && node.parentElement) {
    effectsHandle = createSvgEffects(node.parentElement);
    shadowHandle = createDropShadow(node.parentElement);
  }

  function apply() {
    const { width, height } = node.getBoundingClientRect();
    if (width > 0 && height > 0) {
      node.style.clipPath = generateClipPath(width, height, currentOptions);

      if (effectsHandle && currentEffects) {
        effectsHandle.update(currentOptions, currentEffects, width, height);
      }
      if (shadowHandle && currentEffects) {
        shadowHandle.update(
          currentOptions,
          currentEffects.shadow ?? DEFAULT_SHADOW,
          width, height,
        );
      }
    }
  }

  let unobserve = observeResize(node, apply);

  return {
    update(newInput: SmoothCornerOptions | SmoothCornersConfig) {
      if (isConfig(newInput)) {
        currentOptions = newInput.corners;
        currentEffects = newInput.effects;
      } else {
        currentOptions = newInput;
        currentEffects = undefined;
      }

      // Create handles if they didn't exist but now effects are provided
      if (currentEffects && !effectsHandle && node.parentElement) {
        effectsHandle = createSvgEffects(node.parentElement);
        shadowHandle = createDropShadow(node.parentElement);
      }

      apply();
    },
    destroy() {
      unobserve();
      node.style.clipPath = "";
      effectsHandle?.destroy();
      shadowHandle?.destroy();
    },
  };
}
