import {
  defineComponent,
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

// True when a consumer-supplied `style` (object, string, or nested array —
// Vue's accepted forms) already sets a border-radius, so the SSR fallback must
// defer to it and never clear it.
function styleHasBorderRadius(style: unknown): boolean {
  if (!style) return false;
  if (Array.isArray(style)) return style.some(styleHasBorderRadius);
  if (typeof style === "string") return /border-radius/i.test(style);
  if (typeof style === "object") {
    const s = style as Record<string, unknown>;
    return s.borderRadius !== undefined || s["border-radius"] !== undefined;
  }
  return false;
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
    const userSuppliedRadius = styleHasBorderRadius(attrs.style);
    const fallbackStyle = computed(() =>
      clipPathApplied.value || userSuppliedRadius
        ? undefined
        : { borderRadius: cornerOptionsToBorderRadius(options.value) },
    );

    useSmoothCorners(elRef, options, {
      wrapper: wrapperRef,
      effects: effectsConfig,
      autoEffects: computed(() => props.autoEffects ?? true),
      fallbackBorderRadius: userSuppliedRadius
        ? undefined
        : cornerOptionsToBorderRadius(options.value),
      clipPathApplied,
    });

    return () => {
      const innerProps = {
        ...attrs,
        ref: elRef,
        style: [fallbackStyle.value, attrs.style],
      };
      const inner = props.asChild
        ? h(Slot, innerProps, slots.default)
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
