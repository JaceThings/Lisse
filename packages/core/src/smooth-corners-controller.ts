import { generateClipPath } from "./generate-path.js";
import { createSvgEffects, type SvgEffectsHandle } from "./svg-effects.js";
import { createDropShadow, type DropShadowHandle } from "./drop-shadow.js";
import { observeResize } from "./observe-resize.js";
import { getLayoutSize } from "./layout-size.js";
import { DEFAULT_SHADOW } from "./svg-shared.js";
import {
  extractAndStripEffects,
  restoreStyles,
  hasEffects,
  mergeEffects,
  type ExtractedEffects,
} from "./extract-effects.js";
import { acquirePosition, releasePosition } from "./position-ref-count.js";
import type { SmoothCornerOptions, EffectsConfig, ShadowConfig } from "./types.js";

export interface SmoothCornersControllerConfig {
  getOptions: () => SmoothCornerOptions;
  getEffects?: () => EffectsConfig | undefined;
  getAutoEffects?: () => boolean;
  /** Resolve the SVG overlay anchor. Defaults to `el.parentElement`. */
  getAnchor?: (el: HTMLElement) => HTMLElement | null;
  skipShadowHandle?: () => boolean;
  onExtractedShadow?: (shadow: ShadowConfig | ShadowConfig[] | undefined) => void;
  /** When provided, sync bails when width/height/key are unchanged. */
  getSyncKey?: () => string;
}

interface ControllerState {
  el: HTMLElement;
  savedClipPath: string;
  extracted: ExtractedEffects | undefined;
  effectsHandle: SvgEffectsHandle | undefined;
  shadowHandle: DropShadowHandle | undefined;
  anchor: HTMLElement | null;
  didAcquire: boolean;
  lastWidth: number;
  lastHeight: number;
  lastSyncKey: string | null;
  unobserve: (() => void) | undefined;
}

function syncEffects(
  options: SmoothCornerOptions,
  merged: EffectsConfig,
  effectsHandle: SvgEffectsHandle,
  shadowHandle: DropShadowHandle | undefined,
  width: number,
  height: number,
): void {
  effectsHandle.update(options, merged, width, height);
  shadowHandle?.update(options, merged.shadow ?? DEFAULT_SHADOW, width, height);
}

function ensureHandles(
  s: ControllerState,
  merged: EffectsConfig,
  getAnchor: (el: HTMLElement) => HTMLElement | null,
  skipShadowHandle: boolean,
): void {
  if (!s.anchor) {
    const anchor = getAnchor(s.el);
    if (!anchor) return;
    s.anchor = anchor;
    s.didAcquire = acquirePosition(anchor);
  }
  if (!s.effectsHandle) {
    s.effectsHandle = createSvgEffects(s.anchor);
  }
  if (!s.shadowHandle && merged.shadow && !skipShadowHandle) {
    s.shadowHandle = createDropShadow(s.anchor);
  }
}

function notifyExtractedShadow(
  config: SmoothCornersControllerConfig,
  extracted: ExtractedEffects | undefined,
): void {
  config.onExtractedShadow?.(extracted?.effects.shadow);
}

function setAutoExtraction(s: ControllerState, enable: boolean): void {
  if (enable && !s.extracted) {
    s.extracted = extractAndStripEffects(s.el);
  } else if (!enable && s.extracted) {
    restoreStyles(s.el, s.extracted.savedStyles);
    s.extracted = undefined;
  }
}

function runSync(s: ControllerState, config: SmoothCornersControllerConfig): void {
  const merged = mergeEffects(s.extracted, config.getEffects?.());
  const skipShadow = config.skipShadowHandle?.() ?? false;
  if (hasEffects(merged)) {
    ensureHandles(s, merged, config.getAnchor ?? ((el) => el.parentElement), skipShadow);
  }

  const { width, height } = getLayoutSize(s.el);
  if (width <= 0 || height <= 0) return;

  const syncKey = config.getSyncKey?.();
  if (
    syncKey !== undefined &&
    width === s.lastWidth &&
    height === s.lastHeight &&
    syncKey === s.lastSyncKey
  ) {
    return;
  }
  s.lastWidth = width;
  s.lastHeight = height;
  s.lastSyncKey = syncKey ?? null;

  s.el.style.clipPath = generateClipPath(width, height, config.getOptions());
  s.el.setAttribute("data-state", "ready");

  if (s.effectsHandle) {
    syncEffects(config.getOptions(), merged, s.effectsHandle, s.shadowHandle, width, height);
  }
}

function teardownState(s: ControllerState, config: SmoothCornersControllerConfig): void {
  s.unobserve?.();
  s.unobserve = undefined;

  s.effectsHandle?.destroy();
  s.effectsHandle = undefined;
  s.shadowHandle?.destroy();
  s.shadowHandle = undefined;

  if (s.extracted) {
    restoreStyles(s.el, s.extracted.savedStyles);
    s.extracted = undefined;
  }

  notifyExtractedShadow(config, undefined);

  if (s.didAcquire && s.anchor) {
    releasePosition(s.anchor);
  }
  s.anchor = null;
  s.didAcquire = false;

  s.el.style.clipPath = s.savedClipPath;
  s.el.removeAttribute("data-slot");
  s.el.removeAttribute("data-state");
}

export interface SmoothCornersController {
  attach(el: HTMLElement): void;
  sync(): void;
  setAutoEffects(enable: boolean): void;
  destroyShadowHandle(): void;
  invalidateSync(): void;
  detach(): void;
  readonly isAttached: boolean;
}

export function createSmoothCornersController(
  config: SmoothCornersControllerConfig,
): SmoothCornersController {
  let state: ControllerState | null = null;

  function getState(): ControllerState | null {
    return state;
  }

  return {
    get isAttached() {
      return state !== null;
    },

    attach(el: HTMLElement) {
      if (state?.el === el) return;
      if (state) teardownState(state, config);

      const savedClipPath = el.style.clipPath;
      el.setAttribute("data-slot", "smooth-corners");
      el.setAttribute("data-state", "pending");

      const autoEffects = config.getAutoEffects?.() ?? true;
      const extracted = autoEffects ? extractAndStripEffects(el) : undefined;

      const s: ControllerState = {
        el,
        savedClipPath,
        extracted,
        effectsHandle: undefined,
        shadowHandle: undefined,
        anchor: null,
        didAcquire: false,
        lastWidth: 0,
        lastHeight: 0,
        lastSyncKey: null,
        unobserve: undefined,
      };
      state = s;

      const initialMerged = mergeEffects(s.extracted, config.getEffects?.());
      const skipShadow = config.skipShadowHandle?.() ?? false;
      if (hasEffects(initialMerged)) {
        ensureHandles(s, initialMerged, config.getAnchor ?? ((node) => node.parentElement), skipShadow);
      }

      notifyExtractedShadow(config, s.extracted);

      s.unobserve = observeResize(el, () => runSync(s, config));
      runSync(s, config);
    },

    sync() {
      const s = getState();
      if (!s) return;
      runSync(s, config);
    },

    setAutoEffects(enable: boolean) {
      const s = getState();
      if (!s) return;
      const hadExtraction = s.extracted !== undefined;
      if (enable === hadExtraction) return;

      setAutoExtraction(s, enable);
      notifyExtractedShadow(config, s.extracted);
      s.lastSyncKey = null;
      runSync(s, config);
    },

    destroyShadowHandle() {
      const s = getState();
      if (!s?.shadowHandle) return;
      s.shadowHandle.destroy();
      s.shadowHandle = undefined;
      s.lastSyncKey = null;
    },

    invalidateSync() {
      const s = getState();
      if (!s) return;
      s.lastSyncKey = null;
    },

    detach() {
      const s = getState();
      if (!s) return;
      teardownState(s, config);
      state = null;
    },
  };
}
