import { generateClipPath, createSvgEffects, createDropShadow, observeResize, observeAnchor, getLayoutSize, DEFAULT_SHADOW, extractAndStripEffects, restoreStyles, acquirePosition, releasePosition, hasEffects, mergeEffects } from "@lisse/core";
import type { SmoothCornerOptions, EffectsConfig, Measured, MeasuredSize, OverlayOffset } from "@lisse/core";

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
  let unobserveAnchor: (() => void) | undefined;
  // The border-box size `extractAndStripEffects` already measured, handed to
  // the next apply() and then cleared. Extraction pays for a computed-style
  // declaration on the node and reads its size off that same declaration;
  // without this, the apply() that immediately follows an autoEffects toggle in
  // update() paid for a second full computed-style read of a node nothing had
  // resized.
  let pendingSize: MeasuredSize | undefined;

  function setAutoExtraction(enable: boolean): void {
    if (enable && !extractedResult) {
      extractedResult = extractAndStripEffects(node);
      pendingSize = extractedResult.size;
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
      // The parent, never the node: `clip-path` clips its own subtree, so an
      // overlay nested there could never paint an outer border.
      const anchor = node.parentElement;
      if (!anchor) return;
      attachedAnchor = anchor;
      didAcquire = acquirePosition(anchor);
      // An anchor can move the node without resizing it. Runs in the write
      // pass, so measure nothing — re-queue instead. The anchor's first
      // dispatch is suppressed by observeAnchor: it lands in the same flush
      // that already measured the node for its own subscribe, so re-queueing
      // there would only buy the node a second identical measurement.
      unobserveAnchor = observeAnchor(anchor, node);
    }

    if (!effectsHandle) {
      effectsHandle = createSvgEffects(attachedAnchor, node);
    }
    // Border-only configs skip the shadow handle to avoid its isolation:isolate mutation.
    if (!shadowHandle && merged.shadow) {
      shadowHandle = createDropShadow(attachedAnchor, node);
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
  let lastOffsetX = 0;
  let lastOffsetY = 0;

  // size comes from the resize flush's read pass; update() passes nothing and
  // takes the one-shot pendingSize extraction already measured, falling back to
  // its own read when there is none left to consume.
  function apply(measured?: Measured | MeasuredSize) {
    const size = measured ?? pendingSize ?? getLayoutSize(node);
    pendingSize = undefined;
    const { width, height } = size;
    if (width <= 0 || height <= 0) return;

    // In the guard because an anchor can move the node without resizing it;
    // threaded from the read pass so it never becomes a write-pass layout read.
    // A size threaded out of extraction carries no offsets on purpose —
    // `offsetLeft`/`offsetTop` are not computed-style reads, so taking them
    // directly here costs nothing this pass was trying to save.
    const placed = measured && "offsetLeft" in measured ? measured : undefined;
    const anchored = attachedAnchor !== null;
    const offsetX = anchored ? (placed?.offsetLeft ?? node.offsetLeft) : 0;
    const offsetY = anchored ? (placed?.offsetTop ?? node.offsetTop) : 0;

    const key = currentSyncKey;
    if (
      width === lastWidth && height === lastHeight && key === lastSyncKey &&
      offsetX === lastOffsetX && offsetY === lastOffsetY
    ) return;
    lastWidth = width;
    lastHeight = height;
    lastSyncKey = key;
    lastOffsetX = offsetX;
    lastOffsetY = offsetY;

    node.style.clipPath = generateClipPath(width, height, currentOptions);
    node.setAttribute("data-state", "ready");

    const merged = getMergedEffects();
    const offset: OverlayOffset = { x: offsetX, y: offsetY };
    if (effectsHandle) {
      effectsHandle.update(currentOptions, merged, width, height, offset);
    }
    if (shadowHandle) {
      shadowHandle.update(currentOptions, merged.shadow ?? DEFAULT_SHADOW, width, height, offset);
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
      unobserveAnchor?.();
      unobserveAnchor = undefined;
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
      // Nothing may consume a size measured before the styles were restored.
      pendingSize = undefined;
      if (didAcquire && attachedAnchor) {
        releasePosition(attachedAnchor);
      }
      attachedAnchor = null;
      didAcquire = false;
    },
  };
}
