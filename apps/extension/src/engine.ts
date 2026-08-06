import { observeResize, getLayoutSize, parseColor } from "@lisse/core";
import {
  computeElementPlan,
  parseCornerRadius,
  isElliptical,
  pseudoEscapesBox,
  isDefaultCornerShape,
  MIN_RADIUS,
  DEFAULT_SMOOTHING,
  type Radii,
  type PlanInput,
  type BorderInput,
  type BackgroundInput,
} from "./plan.js";

export interface EngineSettings {
  enabled: boolean;
  /** Fixed per build; the userscript exposes it as an editable constant. */
  smoothing?: number;
}

const MAX_STYLED = 1500;
/** Stamped by every Lisse framework binding, so its presence means the page ships Lisse. */
const LISSE_MARKER = '[data-slot="smooth-corners"]';
/** Replaced elements are a single box even at display:inline. */
const REPLACED_TAGS = new Set(["IMG", "VIDEO", "CANVAS", "IFRAME", "EMBED", "OBJECT"]);
const FRAME_BUDGET_MS = 6;
const CHUNK = 32;

interface BorderColors {
  top: string;
  right: string;
  bottom: string;
  left: string;
}

/** Site-original computed values: our own writes corrupt the readback, so a re-plan reuses these. */
interface SiteStyles {
  filter: string;
  borderColors: BorderColors;
  bg: BackgroundInput;
}

interface OriginalStyles {
  clipPath: string;
  filter: string;
  borderColor: string;
  bgImage: string;
  bgOrigin: string;
  bgClip: string;
  bgRepeat: string;
  bgSize: string;
}

interface Applied extends OriginalStyles {
  site: SiteStyles;
  // What we last wrote, pre-serialisation — readback normalises values.
  // A null filter means the site owns the property and we never wrote one.
  lastClip: string;
  lastFilter: string | null;
  lastBorderColor: string;
  lastBgImage: string;
  unobserve: () => void;
}

interface PlanResult {
  plan: ReturnType<typeof computeElementPlan>;
  site: SiteStyles;
}

function readBorder(cs: CSSStyleDeclaration, colors: BorderColors): BorderInput {
  const side = (name: string, color: string) => ({
    width: parseFloat(cs.getPropertyValue(`border-${name}-width`)),
    style: cs.getPropertyValue(`border-${name}-style`),
    color,
  });
  return {
    top: side("top", colors.top),
    right: side("right", colors.right),
    bottom: side("bottom", colors.bottom),
    left: side("left", colors.left),
  };
}

function visibleOutline(cs: CSSStyleDeclaration): boolean {
  if (cs.outlineStyle === "none" || parseFloat(cs.outlineWidth) <= 0.01) return false;
  const colour = parseColor(cs.outlineColor);
  return !colour || colour.opacity > 0;
}

function pseudoOutside(el: HTMLElement, w: number, h: number): boolean {
  for (const which of ["::before", "::after"]) {
    const ps = getComputedStyle(el, which);
    if (ps.content === "none" || ps.position !== "absolute") continue;
    const o = {
      top: parseFloat(ps.top),
      right: parseFloat(ps.right),
      bottom: parseFloat(ps.bottom),
      left: parseFloat(ps.left),
      width: parseFloat(ps.width),
      height: parseFloat(ps.height),
    };
    if (pseudoEscapesBox(o, { width: w, height: h })) return true;
  }
  return false;
}

const ESCAPE_SCAN_CAP = 200;

/**
 * A visible descendant sticking out of the border box gets amputated by
 * clip-path (GitHub avatar stacks: 20px avatars overflowing a 9px capsule
 * container). Escapes are often deep, so this walks — capped, since huge
 * containers must stay cheap.
 * ponytail: beyond the cap we assume no escape — widen if real sites bite.
 */
function childrenEscapeBox(el: HTMLElement, cs: CSSStyleDeclaration): boolean {
  if (cs.overflowX !== "visible" && cs.overflowY !== "visible") return false;
  if (el.childElementCount === 0) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  const eps = 0.6;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode() as Element | null;
  let seen = 0;
  while (node && seen++ < ESCAPE_SCAN_CAP) {
    const kr = node.getBoundingClientRect();
    if (kr.width > 0 && kr.height > 0 &&
        (kr.left < r.left - eps || kr.top < r.top - eps ||
         kr.right > r.right + eps || kr.bottom > r.bottom + eps)) {
      const kcs = getComputedStyle(node);
      // visibility inherits, so one check covers hidden subtrees; fixed
      // descendants are viewport-anchored portals, not box content.
      if (kcs.visibility !== "hidden" && kcs.opacity !== "0" && kcs.position !== "fixed") {
        return true;
      }
    }
    node = walker.nextNode() as Element | null;
  }
  return false;
}

function readRadii(cs: CSSStyleDeclaration, w: number, h: number): { radii: Radii; elliptical: boolean } | null {
  const tl = parseCornerRadius(cs.borderTopLeftRadius, w, h);
  const tr = parseCornerRadius(cs.borderTopRightRadius, w, h);
  const br = parseCornerRadius(cs.borderBottomRightRadius, w, h);
  const bl = parseCornerRadius(cs.borderBottomLeftRadius, w, h);
  if (!tl || !tr || !br || !bl) return null;
  const elliptical = isElliptical(tl) || isElliptical(tr) || isElliptical(br) || isElliptical(bl);
  return { radii: { tl: tl.h, tr: tr.h, br: br.h, bl: bl.h }, elliptical };
}

export function createEngine(initial: EngineSettings) {
  const settings = { enabled: initial.enabled, smoothing: initial.smoothing ?? DEFAULT_SMOOTHING };
  const applied = new Map<HTMLElement, Applied>();
  const seen = new WeakSet<HTMLElement>();
  const queue = new Set<HTMLElement>();
  // MutationObserver on `document` cannot see inside shadow roots, so every
  // discovered root gets observed individually (Reddit-class apps mutate
  // almost exclusively inside shadow DOM).
  const observedRoots = new WeakSet<ShadowRoot>();
  let rafHandle: number | undefined;
  let mo: MutationObserver | undefined;
  /** Latched once the page is found to ship Lisse; never unset. */
  let stoodDown = false;

  const MO_OPTS: MutationObserverInit = {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["style", "class"],
  };

  function planFor(el: HTMLElement): PlanResult | null {
    const cs = getComputedStyle(el);
    // A non-replaced inline element fragments across line boxes — no single
    // path describes it, and its computed width/height are unresolved.
    if (cs.display === "inline" && !REPLACED_TAGS.has(el.tagName)) return null;
    // A fieldset's legend rides a notch cut into the border (Material-style
    // outlined inputs) — no single path + uniform stroke can represent it.
    if (el.tagName === "FIELDSET" && el.querySelector(":scope > legend")) return null;
    // Native CSS corner-shape (x.com ships `squircle`): the site has already
    // chosen its geometry — smooth or decorative, ours has no business there.
    const cornerShape = cs.getPropertyValue("corner-shape");
    if (cornerShape && !isDefaultCornerShape(cornerShape)) return null;
    // Border-box floats; clip-path's default reference box is the border box.
    const { width: w, height: h } = getLayoutSize(el);
    if (isNaN(w) || isNaN(h)) return null;
    // Page position feeds border pixel-snapping (untransformed page coords).
    const rect = el.getBoundingClientRect();
    const read = readRadii(cs, w, h);
    if (!read) return null;
    // Bail before the expensive reads (pseudo styles, descendant rects) —
    // most mutation-enqueued elements have negligible radius.
    const { tl, tr, br, bl } = read.radii;
    if (Math.max(tl, tr, br, bl) < MIN_RADIUS) return null;

    const site: SiteStyles = applied.get(el)?.site ?? {
      filter: cs.filter,
      borderColors: {
        top: cs.borderTopColor,
        right: cs.borderRightColor,
        bottom: cs.borderBottomColor,
        left: cs.borderLeftColor,
      },
      bg: {
        image: cs.backgroundImage,
        origin: cs.backgroundOrigin,
        clip: cs.backgroundClip,
        repeat: cs.backgroundRepeat,
        size: cs.backgroundSize,
      },
    };

    const bgColor = parseColor(cs.backgroundColor);
    const paintsNothing =
      (!bgColor || bgColor.opacity === 0) &&
      (site.bg.image === "none" || site.bg.image === "") &&
      cs.boxShadow === "none" &&
      cs.overflowX === "visible" && cs.overflowY === "visible";

    const input: PlanInput = {
      width: w,
      height: h,
      radii: read.radii,
      elliptical: read.elliptical,
      border: readBorder(cs, site.borderColors),
      hasBorderImage: cs.borderImageSource !== "none" && cs.borderImageSource !== "",
      background: site.bg,
      paintsNothing,
      hasOutline: visibleOutline(cs),
      pseudoOutside: pseudoOutside(el, w, h),
      childOutside: childrenEscapeBox(el, cs),
      boxShadow: cs.boxShadow,
      existingFilter: site.filter,
      smoothing: settings.smoothing,
      pageLeft: rect.left + window.scrollX,
      pageTop: rect.top + window.scrollY,
      dpr: window.devicePixelRatio || 1,
    };
    return { plan: computeElementPlan(input), site };
  }

  function writePlan(el: HTMLElement, result: PlanResult | null) {
    if (!result || result.plan.action !== "apply") {
      if (applied.has(el)) undo(el);
      return;
    }
    const { plan } = result;
    const record = applied.get(el);
    const orig: OriginalStyles = record ?? {
      clipPath: el.style.clipPath,
      filter: el.style.filter,
      borderColor: el.style.borderColor,
      bgImage: el.style.backgroundImage,
      bgOrigin: el.style.backgroundOrigin,
      bgClip: el.style.backgroundClip,
      bgRepeat: el.style.backgroundRepeat,
      bgSize: el.style.backgroundSize,
    };

    const b = plan.border;
    // Only a shadow plan gives us a filter. Otherwise the property is the site's:
    // `orig.filter` is an inline snapshot from whenever we first landed on the
    // element, routinely mid-animation, so writing it back on a later re-plan
    // replays a stale frame over what the site is animating now.
    const targetFilter = plan.filter ?? null;
    const targetBorderColor = b ? "transparent" : orig.borderColor;
    const targetBgImage = b ? b.backgroundImage : orig.bgImage;

    // Our writes re-trigger the MutationObserver (it fires async, so a flag
    // can't intercept them) — skipping no-op writes breaks the feedback loop.
    // Compare against what we last wrote, not readback: data URIs and colours
    // re-serialise and won't match.
    if (record &&
        record.lastClip === plan.clipPath &&
        record.lastFilter === targetFilter &&
        record.lastBorderColor === targetBorderColor &&
        record.lastBgImage === targetBgImage) {
      return;
    }

    el.style.clipPath = plan.clipPath;

    // Filter and border/background follow the same rule: write while the
    // property is ours, hand it back once when it stops being.
    if (targetFilter !== null) el.style.filter = targetFilter;
    else if (record && record.lastFilter !== null) el.style.filter = orig.filter;

    if (b || record?.lastBorderColor === "transparent") {
      el.style.borderColor = targetBorderColor;
      el.style.backgroundImage = targetBgImage;
      el.style.backgroundOrigin = b ? b.backgroundOrigin : orig.bgOrigin;
      el.style.backgroundClip = b ? b.backgroundClip : orig.bgClip;
      el.style.backgroundRepeat = b ? b.backgroundRepeat : orig.bgRepeat;
      el.style.backgroundSize = b ? b.backgroundSize : orig.bgSize;
    }

    if (record) {
      record.lastClip = plan.clipPath;
      record.lastFilter = targetFilter;
      record.lastBorderColor = targetBorderColor;
      record.lastBgImage = targetBgImage;
    } else {
      applied.set(el, {
        ...orig,
        site: result.site,
        lastClip: plan.clipPath,
        lastFilter: targetFilter,
        lastBorderColor: targetBorderColor,
        lastBgImage: targetBgImage,
        unobserve: observeResize(el, () => enqueue(el)),
      });
    }
  }

  function restore(el: HTMLElement, record: Applied) {
    el.style.clipPath = record.clipPath;
    if (record.lastFilter !== null) el.style.filter = record.filter;
    el.style.borderColor = record.borderColor;
    el.style.backgroundImage = record.bgImage;
    el.style.backgroundOrigin = record.bgOrigin;
    el.style.backgroundClip = record.bgClip;
    el.style.backgroundRepeat = record.bgRepeat;
    el.style.backgroundSize = record.bgSize;
  }

  function undo(el: HTMLElement) {
    const record = applied.get(el);
    if (!record) return;
    restore(el, record);
    record.unobserve();
    applied.delete(el);
  }

  function skip(el: Element): boolean {
    return el.tagName === "HTML" || el.tagName === "BODY" ||
      el.namespaceURI === "http://www.w3.org/2000/svg";
  }

  function enqueue(el: HTMLElement) {
    queue.add(el);
    scheduleFlush();
  }

  function scheduleFlush() {
    if (rafHandle !== undefined) return;
    rafHandle = requestAnimationFrame(flush);
  }

  /**
   * Whether the page ships Lisse itself, in which case we hand the whole page
   * back to it. Its bindings mount SVG overlays for borders and shadows into
   * *ancestor* boxes, which our clip-path amputates — so the bail is page-wide
   * rather than per-element, since the damage lands on elements carrying no
   * marker of their own. Probed per flush because at document_start the page is
   * empty and bindings only mark elements once their framework mounts; latched,
   * so it costs one selector per frame that had work and nothing afterwards.
   * ponytail: light DOM only — a site using Lisse exclusively inside shadow
   * roots goes undetected; probe observedRoots too if that ever shows up.
   */
  function siteShipsLisse(): boolean {
    if (stoodDown) return true;
    if (!document.querySelector(LISSE_MARKER)) return false;
    stoodDown = true;
    // Full undo, not disableAll(): permanent, so the records and their resize
    // observers go too.
    for (const el of [...applied.keys()]) undo(el);
    mo?.disconnect();
    document.removeEventListener("transitionend", onTransition, true);
    document.removeEventListener("animationend", onTransition, true);
    document.removeEventListener("focusin", onFocusChange, true);
    document.removeEventListener("focusout", onFocusChange, true);
    return true;
  }

  // rAF runs before paint, so elements styled in the frame they arrive never
  // flash square. ALL reads run before ANY write — interleaving would force a
  // layout recomputation per chunk.
  function flush() {
    rafHandle = undefined;
    if (!settings.enabled || siteShipsLisse()) {
      queue.clear();
      return;
    }
    const deadline = performance.now() + FRAME_BUDGET_MS;
    const ops: Array<{ el: HTMLElement; result: PlanResult | null }> = [];
    let n = 0;
    for (const el of queue) {
      queue.delete(el);
      ops.push({ el, result: el.isConnected ? planFor(el) : null });
      if (++n % CHUNK === 0 && performance.now() >= deadline) break;
    }
    for (const { el, result } of ops) writePlan(el, result);
    if (queue.size > 0) scheduleFlush();
  }

  function scanRoot(root: Document | ShadowRoot) {
    if (root instanceof ShadowRoot && mo && !observedRoots.has(root)) {
      observedRoots.add(root);
      mo.observe(root, MO_OPTS);
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode() as Element | null;
    while (node) {
      if (applied.size + queue.size >= MAX_STYLED) break;
      const el = node as HTMLElement;
      node = walker.nextNode() as Element | null;
      if (skip(el)) continue;
      if (el.shadowRoot) scanRoot(el.shadowRoot);
      if (seen.has(el)) continue;
      seen.add(el);
      const cs = getComputedStyle(el);
      if (cs.borderTopLeftRadius === "0px" && cs.borderTopRightRadius === "0px" &&
          cs.borderBottomRightRadius === "0px" && cs.borderBottomLeftRadius === "0px") {
        continue;
      }
      enqueue(el);
    }
  }

  function onMutations(records: MutationRecord[]) {
    if (!settings.enabled) return;
    for (const rec of records) {
      if (rec.type === "attributes") {
        const el = rec.target as HTMLElement;
        if (el.nodeType === 1 && !skip(el)) {
          enqueue(el);
          enqueueAppliedAncestors(el);
        }
      } else {
        // Re-plan the parent too: a new child may now escape its box (or an
        // escaping one may be gone), flipping the child-outside verdict.
        const parent = rec.target as HTMLElement;
        if (parent.nodeType === 1 && !skip(parent)) enqueue(parent);
        for (const added of rec.addedNodes) {
          if (added.nodeType !== 1) continue;
          const el = added as HTMLElement;
          if (el.shadowRoot) scanRoot(el.shadowRoot);
          scanSubtree(el);
        }
        for (const removed of rec.removedNodes) {
          if (removed.nodeType !== 1) continue;
          const root = removed as HTMLElement;
          if (applied.has(root)) undo(root);
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
          let node = walker.nextNode() as HTMLElement | null;
          while (node) {
            if (applied.has(node)) undo(node);
            node = walker.nextNode() as HTMLElement | null;
          }
        }
      }
    }
  }

  // A child's own change can invalidate an ancestor's verdict: a floating label
  // transitioning out of its field's box, an avatar joining a stack.
  function enqueueAppliedAncestors(el: Element) {
    const up = (x: Element): Element | null =>
      x.parentElement ?? ((x.getRootNode() as ShadowRoot).host ?? null);
    for (let n = up(el), d = 0; n && d < 12; n = up(n), d++) {
      if (applied.has(n as HTMLElement)) enqueue(n as HTMLElement);
    }
  }

  // Animated hover/state changes (radius, size, colours) surface here.
  // ponytail: instant pseudo-class restyles fire no DOM signal at all — no
  // coverage for those, accept it.
  function onTransition(e: Event) {
    if (!settings.enabled) return;
    const t = e.composedPath()[0] as Node | undefined;
    if (t && t.nodeType === 1 && !skip(t as Element)) {
      enqueue(t as HTMLElement);
      enqueueAppliedAncestors(t as Element);
    }
  }

  // Focus rings are :focus/:focus-within outlines and fire no mutation, so the
  // focus chain is re-planned to let the outline skip engage and release.
  function onFocusChange(e: Event) {
    if (!settings.enabled) return;
    for (const n of e.composedPath().slice(0, 10)) {
      const el = n as Element;
      if (el.nodeType === 1 && !skip(el)) enqueue(el as HTMLElement);
    }
  }

  // Capped like scanRoot: a SPA route change can add thousands of elements in
  // one mutation batch, which would otherwise all hit planFor.
  function scanSubtree(el: HTMLElement) {
    if (skip(el)) return;
    if (applied.size + queue.size >= MAX_STYLED) return;
    enqueue(el);
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode() as HTMLElement | null;
    while (node) {
      if (applied.size + queue.size >= MAX_STYLED) break;
      if (!skip(node)) {
        if (node.shadowRoot) scanRoot(node.shadowRoot);
        enqueue(node);
      }
      node = walker.nextNode() as HTMLElement | null;
    }
  }

  function start() {
    // At document_start documentElement may be absent, so observe the document
    // node — the parser then streams elements in as childList mutations.
    mo = new MutationObserver(onMutations);
    mo.observe(document, MO_OPTS);
    document.addEventListener("transitionend", onTransition, true);
    document.addEventListener("animationend", onTransition, true);
    document.addEventListener("focusin", onFocusChange, true);
    document.addEventListener("focusout", onFocusChange, true);
    scanRoot(document);
    // SPA hydration can invalidate a verdict (size, escaping children) with no
    // signal any observer delivers, so re-plan once the tree settles.
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => scanRoot(document), { once: true });
    }
    const settle = () => {
      scanRoot(document);
      reapplyAll();
    };
    if (document.readyState === "complete") {
      window.setTimeout(settle, 2500);
    } else {
      window.addEventListener("load", () => {
        settle();
        window.setTimeout(settle, 2500);
      }, { once: true });
    }
  }

  function reapplyAll() {
    for (const el of applied.keys()) enqueue(el);
  }

  // Restores styles but keeps records + observers so re-enable can reapply;
  // undo() would forget them. Resetting lastX defeats writePlan's no-op guard.
  function disableAll() {
    for (const [el, record] of applied) {
      restore(el, record);
      record.lastClip = record.clipPath;
      if (record.lastFilter !== null) record.lastFilter = record.filter;
      record.lastBorderColor = record.borderColor;
      record.lastBgImage = record.bgImage;
    }
  }

  if (settings.enabled) start();

  return {
    setEnabled(enabled: boolean) {
      if (enabled === settings.enabled) return;
      settings.enabled = enabled;
      if (enabled) {
        if (!mo) start();
        else {
          reapplyAll();
          scanRoot(document); // catch elements added while disabled (seen-set keeps this cheap)
        }
      } else {
        disableAll();
      }
    },
  };
}
