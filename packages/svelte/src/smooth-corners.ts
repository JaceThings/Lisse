import { generateClipPath, createSvgEffects, createDropShadow, observeResize, DEFAULT_SHADOW, extractAndStripEffects, restoreStyles, acquirePosition, releasePosition, hasEffects, mergeEffects } from "@lisse/core";
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
  config: SmoothCornersConfig,
): SmoothCornersAction {
  let currentOptions: SmoothCornerOptions = config.corners;
  let currentEffects: EffectsConfig | undefined = config.effects;
  let currentAutoEffects = config.autoEffects ?? true;

  // Effects handles. The anchor is captured the first time we attach to a
  // parent and reused thereafter, so reparenting the node doesn't strand
  // the SVG overlay on the old parent or leak its position ref-count.
  let effectsHandle: ReturnType<typeof createSvgEffects> | undefined;
  let shadowHandle: ReturnType<typeof createDropShadow> | undefined;
  let extractedResult: ReturnType<typeof extractAndStripEffects> | undefined;
  let attachedAnchor: HTMLElement | null = null;
  let didAcquire = false;

  // Start or stop auto-extraction to match the desired state.
  function setAutoExtraction(enable: boolean): void {
    if (enable && !extractedResult) {
      extractedResult = extractAndStripEffects(node);
    } else if (!enable && extractedResult) {
      restoreStyles(node, extractedResult.savedStyles);
      extractedResult = undefined;
    }
  }

  // Auto-extract CSS effects on init
  setAutoExtraction(currentAutoEffects);

  function getMergedEffects(): EffectsConfig {
    return mergeEffects(extractedResult, currentEffects);
  }

  function attachEffects(): void {
    const merged = getMergedEffects();
    if (!hasEffects(merged)) return;

    // Lazy anchor capture. Only happens once; reused if the shadow
    // handle is added later.
    if (!attachedAnchor) {
      const anchor = node.parentElement;
      if (!anchor) return;
      attachedAnchor = anchor;
      didAcquire = acquirePosition(anchor);
    }

    if (!effectsHandle) {
      effectsHandle = createSvgEffects(attachedAnchor);
    }
    // Skip drop-shadow DOM nodes and the isolation:isolate mutation when
    // only border effects are in play.
    if (!shadowHandle && merged.shadow) {
      shadowHandle = createDropShadow(attachedAnchor);
    }
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
    update(newConfig: SmoothCornersConfig) {
      currentOptions = newConfig.corners;
      currentEffects = newConfig.effects;

      const nextAuto = newConfig.autoEffects ?? true;
      if (nextAuto !== currentAutoEffects) {
        currentAutoEffects = nextAuto;
        setAutoExtraction(currentAutoEffects);
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
        extractedResult = undefined;
      }
      if (didAcquire && attachedAnchor) {
        releasePosition(attachedAnchor);
      }
      attachedAnchor = null;
      didAcquire = false;
    },
  };
}
