import { generateClipPath, createSvgEffects, createDropShadow, observeResize, getLayoutSize, DEFAULT_SHADOW, extractAndStripEffects, restoreStyles, acquirePosition, releasePosition, hasEffects, mergeEffects } from "@lisse/core";
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
 * Svelte action that clips an element to smooth corners and re-syncs on
 * resize via a shared ResizeObserver. CSS `border` and `box-shadow` get
 * pulled out and re-rendered as SVG effects by default (autoEffects).
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

  // Serialized options/effects key. Recomputed only when the config changes
  // (init + update), never on a resize tick — the JSON.stringify is the pricey
  // part and the config is identical across every tick between updates.
  function computeSyncKey(): string {
    return `${JSON.stringify(currentOptions)}|${JSON.stringify(currentEffects ?? null)}`;
  }
  let currentSyncKey = computeSyncKey();

  // attachedAnchor is captured once and reused, so reparenting the node
  // can't strand the SVG overlay on the old parent or leak its ref-count.
  let effectsHandle: ReturnType<typeof createSvgEffects> | undefined;
  let shadowHandle: ReturnType<typeof createDropShadow> | undefined;
  let extractedResult: ReturnType<typeof extractAndStripEffects> | undefined;
  let attachedAnchor: HTMLElement | null = null;
  let didAcquire = false;

  function setAutoExtraction(enable: boolean): void {
    if (enable && !extractedResult) {
      extractedResult = extractAndStripEffects(node);
    } else if (!enable && extractedResult) {
      restoreStyles(node, extractedResult.savedStyles);
      extractedResult = undefined;
    }
  }

  setAutoExtraction(currentAutoEffects);

  function getMergedEffects(): EffectsConfig {
    return mergeEffects(extractedResult, currentEffects);
  }

  function attachEffects(): void {
    const merged = getMergedEffects();
    if (!hasEffects(merged)) return;

    if (!attachedAnchor) {
      const anchor = node.parentElement;
      if (!anchor) return;
      attachedAnchor = anchor;
      didAcquire = acquirePosition(anchor);
    }

    if (!effectsHandle) {
      effectsHandle = createSvgEffects(attachedAnchor);
    }
    // Border-only configs skip the shadow handle to avoid its isolation:isolate mutation.
    if (!shadowHandle && merged.shadow) {
      shadowHandle = createDropShadow(attachedAnchor);
    }
  }

  attachEffects();

  const savedClipPath = node.style.clipPath;
  node.setAttribute("data-slot", "smooth-corners");
  node.setAttribute("data-state", "pending");

  // Last-applied width/height/key; apply() bails when all three match, so
  // redundant reactive ticks cost nothing beyond a layout read.
  // lastSyncKey = null forces the next apply() through even when the
  // options/effects key is unchanged (used on an autoEffects toggle).
  let lastWidth = 0;
  let lastHeight = 0;
  let lastSyncKey: string | null = null;

  // size comes from the resize observer's border-box entry; initial attach
  // and update() omit it and fall back to a measured read.
  function apply(size?: { width: number; height: number }) {
    const { width, height } = size ?? getLayoutSize(node);
    if (width <= 0 || height <= 0) return;

    const key = currentSyncKey;
    if (width === lastWidth && height === lastHeight && key === lastSyncKey) return;
    lastWidth = width;
    lastHeight = height;
    lastSyncKey = key;

    node.style.clipPath = generateClipPath(width, height, currentOptions);
    node.setAttribute("data-state", "ready");

    const merged = getMergedEffects();
    if (effectsHandle) {
      effectsHandle.update(currentOptions, merged, width, height);
    }
    if (shadowHandle) {
      shadowHandle.update(currentOptions, merged.shadow ?? DEFAULT_SHADOW, width, height);
    }
  }

  const unobserve = observeResize(node, apply);

  return {
    update(newConfig: SmoothCornersConfig) {
      currentOptions = newConfig.corners;
      currentEffects = newConfig.effects;
      currentSyncKey = computeSyncKey();

      const nextAuto = newConfig.autoEffects ?? true;
      if (nextAuto !== currentAutoEffects) {
        currentAutoEffects = nextAuto;
        setAutoExtraction(currentAutoEffects);
        lastSyncKey = null;
      }

      attachEffects();

      apply();
    },
    destroy() {
      unobserve();
      node.style.clipPath = savedClipPath;
      node.removeAttribute("data-slot");
      node.removeAttribute("data-state");
      effectsHandle?.destroy();
      effectsHandle = undefined;
      shadowHandle?.destroy();
      shadowHandle = undefined;
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
