import {
  defineComponent,
  Fragment,
  h,
  ref,
  computed,
  type PropType,
  type SlotsType,
  type VNode,
} from "vue";
import { useSmoothCorners } from "./use-smooth-corners.js";
import { Slot } from "./slot.js";
import { hasEffects, cornerOptionsToBorderRadius } from "@lisse/core";
import type {
  SmoothCornerOptions,
  BorderConfig,
  ShadowConfig,
  EffectsConfig,
} from "@lisse/core";

// `border-radius` plus every per-corner longhand, physical and logical
// (`border-top-left-radius`, `border-start-end-radius`, …), in both the kebab
// and camel spellings Vue accepts.
const RADIUS_PROPERTY = /^border[a-z-]*-radius$|^border[A-Za-z]*Radius$/;

// A declaration list is walked rather than matched: `border(?:-[a-z]+)*-radius`
// backtracks polynomially on a consumer-supplied string.
function radiusDeclaration(text: string): boolean {
  for (const declaration of text.split(";")) {
    const colon = declaration.indexOf(":");
    if (colon < 0) continue;
    if (declaration.slice(0, colon).trim().toLowerCase().endsWith("-radius")) return true;
  }
  return false;
}

// True when a consumer-supplied `style` (object, string, or nested array —
// Vue's accepted forms) already sets a corner radius, so the SSR fallback must
// defer to it and never clear it. Longhands count: the teardown clears the
// `border-radius` shorthand, which erases the longhands with it.
function styleHasBorderRadius(style: unknown): boolean {
  if (!style) return false;
  if (Array.isArray(style)) return style.some(styleHasBorderRadius);
  if (typeof style === "string") return radiusDeclaration(style);
  if (typeof style === "object") {
    const s = style as Record<string, unknown>;
    return Object.keys(s).some((key) => s[key] !== undefined && RADIUS_PROPERTY.test(key));
  }
  return false;
}

// True when the single element `asChild` clones onto sets its own
// border-radius. `Slot` merges the parent's style last, so the fallback would
// override a radius the consumer put on the child — including in SSR markup,
// where the child's value never reaches the DOM at all. Fragments are walked
// because Slot flattens them before picking the element.
function childStyleHasBorderRadius(vnodes: VNode[] | undefined): boolean {
  if (!vnodes) return false;
  return vnodes.some((vnode) => {
    if (vnode.type === Fragment && Array.isArray(vnode.children)) {
      return childStyleHasBorderRadius(vnode.children as VNode[]);
    }
    return styleHasBorderRadius((vnode.props as { style?: unknown } | null)?.style);
  });
}

export const SmoothCorners = defineComponent({
  name: "SmoothCorners",
  // Consumer attrs must land on the inner clipped element, not on the wrapper
  // div injected when effects are present, so we disable automatic fallthrough
  // and forward attrs explicitly below.
  inheritAttrs: false,
  props: {
    as: {
      type: String as PropType<keyof HTMLElementTagNameMap | keyof SVGElementTagNameMap>,
      default: "div",
    },
    corners: {
      type: Object as PropType<SmoothCornerOptions>,
      default: undefined,
    },
    innerBorder: {
      type: Object as PropType<BorderConfig>,
      default: undefined,
    },
    outerBorder: {
      type: Object as PropType<BorderConfig>,
      default: undefined,
    },
    middleBorder: {
      type: Object as PropType<BorderConfig>,
      default: undefined,
    },
    innerShadow: {
      type: [Object, Array] as PropType<ShadowConfig | ShadowConfig[]>,
      default: undefined,
    },
    shadow: {
      type: [Object, Array] as PropType<ShadowConfig | ShadowConfig[]>,
      default: undefined,
    },
    autoEffects: {
      type: Boolean as PropType<boolean>,
      default: undefined,
    },
    asChild: {
      type: Boolean as PropType<boolean>,
      default: false,
    },
  },
  slots: Object as SlotsType<{ default: () => VNode[] }>,
  setup(props, { slots, expose, attrs }) {
    const elRef = ref<HTMLElement | null>(null);
    const wrapperRef = ref<HTMLElement | null>(null);

    expose({ el: elRef, wrapper: wrapperRef });

    const options = computed((): SmoothCornerOptions => props.corners ?? { radius: 0 });

    // Identity-stable effects config: a new object is produced only when the
    // serialized values change, so an unrelated prop change does not churn the
    // reference the composable watches.
    let effectsCache: EffectsConfig = {
      innerBorder: props.innerBorder,
      outerBorder: props.outerBorder,
      middleBorder: props.middleBorder,
      innerShadow: props.innerShadow,
      shadow: props.shadow,
    };
    let effectsCacheKey = JSON.stringify(effectsCache);
    const effectsConfig = computed<EffectsConfig>(() => {
      const next: EffectsConfig = {
        innerBorder: props.innerBorder,
        outerBorder: props.outerBorder,
        middleBorder: props.middleBorder,
        innerShadow: props.innerShadow,
        shadow: props.shadow,
      };
      const key = JSON.stringify(next);
      if (key !== effectsCacheKey) {
        effectsCacheKey = key;
        effectsCache = next;
      }
      return effectsCache;
    });

    const needsWrapper = computed(
      () => (props.autoEffects ?? true) || hasEffects(effectsConfig.value),
    );

    // SSR fallback border-radius. Emitted for server markup and first paint,
    // then dropped once the clip-path lands: CSS intersects border-radius with
    // clip-path, and the rounded rect is a strict subset of the squircle, so
    // keeping it would cancel corner smoothing on the element's own background.
    // A user-supplied border-radius wins and disables the fallback entirely.
    const clipPathApplied = ref(false);
    // Written while rendering, where both the `asChild` child's own style and
    // the current `attrs.style` are visible — a snapshot taken here in setup
    // would go stale the moment either one changes. The composable reads it
    // only once the clip-path lands, which is always after a render, and
    // nothing reads it reactively during one.
    const fallbackRadius = ref<string | undefined>(
      styleHasBorderRadius(attrs.style) ? undefined : cornerOptionsToBorderRadius(options.value),
    );

    useSmoothCorners(elRef, options, {
      wrapper: wrapperRef,
      effects: effectsConfig,
      autoEffects: computed(() => props.autoEffects ?? true),
      fallbackBorderRadius: fallbackRadius,
      clipPathApplied,
    });

    return () => {
      const childNodes = props.asChild ? slots.default?.() : undefined;
      const suppressFallback =
        styleHasBorderRadius(attrs.style) ||
        (props.asChild && childStyleHasBorderRadius(childNodes));
      const radius = suppressFallback ? undefined : cornerOptionsToBorderRadius(options.value);
      fallbackRadius.value = radius;
      const fallbackStyle =
        clipPathApplied.value || radius === undefined ? undefined : { borderRadius: radius };
      const innerProps = {
        ...attrs,
        ref: elRef,
        style: [fallbackStyle, attrs.style],
      };
      const inner = props.asChild
        ? h(Slot, innerProps, () => childNodes ?? [])
        : h(props.as, innerProps, slots.default?.());

      if (needsWrapper.value) {
        return h(
          "div",
          { ref: wrapperRef, style: { position: "relative" } },
          inner,
        );
      }
      return inner;
    };
  },
});
