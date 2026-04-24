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
import { hasEffects } from "@lisse/core";
import type {
  SmoothCornerOptions,
  BorderConfig,
  ShadowConfig,
} from "@lisse/core";

/**
 * Render-function component that applies smooth corners to a wrapper element.
 * When effect props are provided or autoEffects is enabled (default),
 * auto-creates a wrapper element for the SVG overlay.
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
  setup(props, { slots, expose }) {
    const elRef = ref<HTMLElement | null>(null);
    const wrapperRef = ref<HTMLElement | null>(null);

    expose({ el: elRef, wrapper: wrapperRef });

    const options = computed((): SmoothCornerOptions => props.corners ?? { radius: 0 });

    const effectsConfig = computed(() => ({
      innerBorder: props.innerBorder,
      outerBorder: props.outerBorder,
      middleBorder: props.middleBorder,
      innerShadow: props.innerShadow,
      shadow: props.shadow,
    }));

    const needsWrapper = computed(
      () => (props.autoEffects ?? true) || hasEffects(effectsConfig.value),
    );

    useSmoothCorners(elRef, options, {
      wrapper: wrapperRef,
      effects: effectsConfig,
      autoEffects: computed(() => props.autoEffects ?? true),
    });

    return () => {
      const inner = props.asChild
        ? h(Slot, { ref: elRef }, slots.default)
        : h(props.as, { ref: elRef }, slots.default?.());

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
