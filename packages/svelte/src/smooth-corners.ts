import { generateClipPath, createSvgEffects, createDropShadow, observeResize, DEFAULT_SHADOW, extractAndStripEffects, restoreStyles, acquirePosition, releasePosition, hasEffects, mergeEffects } from "@lisse/core";
import type { SmoothCornerOptions, EffectsConfig } from "@lisse/core";

export interface SmoothCornersAction {
  update: (options: SmoothCornerOptions | SmoothCornersConfig) => void;
  destroy: () => void;
}

export interface SmoothCornersConfig {
  corners: SmoothCornerOptions;
  effects?: EffectsConfig;
  autoEffects?: boolean;
}

function isConfig(input: SmoothCornerOptions | SmoothCornersConfig): input is SmoothCornersConfig {
  return "corners" in input;
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
  let autoEffects = true;

  if (isConfig(input)) {
    currentOptions = input.corners;
    currentEffects = input.effects;
    autoEffects = input.autoEffects ?? true;
  } else {
    currentOptions = input;
  }

  // Effects handles. The anchor is captured the first time we attach to a
  // parent and reused thereafter, so reparenting the node doesn't strand
  // the SVG overlay on the old parent or leak its position ref-count.
  let effectsHandle: ReturnType<typeof createSvgEffects> | undefined;
  let shadowHandle: ReturnType<typeof createDropShadow> | undefined;
  let extractedResult: ReturnType<typeof extractAndStripEffects> | undefined;
  let attachedAnchor: HTMLElement | null = null;
  let didAcquire = false;

  // Auto-extract CSS effects on init
  if (autoEffects) {
    extractedResult = extractAndStripEffects(node);
  }

  function getMergedEffects(): EffectsConfig {
    return mergeEffects(extractedResult, currentEffects);
  }

  function attachEffects(): void {
    if (effectsHandle || !hasEffects(getMergedEffects())) return;
    const anchor = node.parentElement;
    if (!anchor) return;
    attachedAnchor = anchor;
    didAcquire = acquirePosition(anchor);
    effectsHandle = createSvgEffects(anchor);
    shadowHandle = createDropShadow(anchor);
  }

  attachEffects();

  const savedClipPath = node.style.clipPath;
  node.setAttribute("data-slot", "smooth-corners");
  node.setAttribute("data-state", "pending");

  function apply() {
    const { width, height } = node.getBoundingClientRect();
    if (width > 0 && height > 0) {
      node.style.clipPath = generateClipPath(width, height, currentOptions);
      node.setAttribute("data-state", "ready");

      const merged = getMergedEffects();
      if (effectsHandle) {
        effectsHandle.update(currentOptions, merged, width, height);
      }
      if (shadowHandle) {
        shadowHandle.update(
          currentOptions,
          merged.shadow ?? DEFAULT_SHADOW,
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
      attachEffects();

      apply();
    },
    destroy() {
      unobserve();
      node.style.clipPath = savedClipPath;
      node.removeAttribute("data-slot");
      node.removeAttribute("data-state");
      effectsHandle?.destroy();
      shadowHandle?.destroy();
      if (extractedResult) {
        restoreStyles(node, extractedResult.savedStyles);
      }
      if (didAcquire && attachedAnchor) {
        releasePosition(attachedAnchor);
      }
      attachedAnchor = null;
    },
  };
}
