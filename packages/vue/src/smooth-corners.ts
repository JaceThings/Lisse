import {
  defineComponent,
  h,
  ref,
  computed,
  type PropType,
  type SlotsType,
} from "vue";
import { useSmoothCorners } from "./use-smooth-corners.js";
import type { SmoothCornerOptions, BorderConfig, ShadowConfig } from "@smooth-corners/core";

/**
 * Render-function component that applies smooth corners to a wrapper element.
 * When effect props are provided, auto-creates a wrapper element for the SVG overlay.
 *
 * @example
 * ```vue
 * <SmoothCorners :radius="20" :smoothing="0.6">
 *   Content
 * </SmoothCorners>
 * ```
 */
export const SmoothCorners = defineComponent({
  name: "SmoothCorners",
  props: {
    as: {
      type: String as PropType<string>,
      default: "div",
    },
    radius: {
      type: Number,
      default: undefined,
    },
    smoothing: {
      type: Number,
      default: undefined,
    },
    preserveSmoothing: {
      type: Boolean,
      default: undefined,
    },
    topLeft: {
      type: [Number, Object] as PropType<number | { radius: number; smoothing?: number; preserveSmoothing?: boolean }>,
      default: undefined,
    },
    topRight: {
      type: [Number, Object] as PropType<number | { radius: number; smoothing?: number; preserveSmoothing?: boolean }>,
      default: undefined,
    },
    bottomRight: {
      type: [Number, Object] as PropType<number | { radius: number; smoothing?: number; preserveSmoothing?: boolean }>,
      default: undefined,
    },
    bottomLeft: {
      type: [Number, Object] as PropType<number | { radius: number; smoothing?: number; preserveSmoothing?: boolean }>,
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
    innerShadow: {
      type: Object as PropType<ShadowConfig>,
      default: undefined,
    },
    shadow: {
      type: Object as PropType<ShadowConfig>,
      default: undefined,
    },
  },
  slots: Object as SlotsType<{ default: () => any }>,
  setup(props, { slots }) {
    const elRef = ref<HTMLElement | null>(null);
    const wrapperRef = ref<HTMLElement | null>(null);

    const options = (): SmoothCornerOptions => {
      if (props.radius !== undefined) {
        return {
          radius: props.radius,
          smoothing: props.smoothing,
          preserveSmoothing: props.preserveSmoothing,
        };
      }
      return {
        topLeft: props.topLeft,
        topRight: props.topRight,
        bottomRight: props.bottomRight,
        bottomLeft: props.bottomLeft,
      };
    };

    const hasEffects = computed(
      () => !!(props.innerBorder || props.outerBorder || props.innerShadow || props.shadow),
    );

    const effectsConfig = computed(() => ({
      innerBorder: props.innerBorder,
      outerBorder: props.outerBorder,
      innerShadow: props.innerShadow,
      shadow: props.shadow,
    }));

    useSmoothCorners(
      elRef,
      options(),
      hasEffects.value
        ? { wrapper: wrapperRef, effects: effectsConfig }
        : undefined,
    );

    return () => {
      if (hasEffects.value) {
        return h(
          "div",
          { ref: wrapperRef, style: { position: "relative" } },
          h(props.as, { ref: elRef }, slots.default?.()),
        );
      }
      return h(props.as, { ref: elRef }, slots.default?.());
    };
  },
});
