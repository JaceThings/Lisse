import {
  defineComponent,
  h,
  ref,
  type PropType,
  type SlotsType,
} from "vue";
import { useSmoothCorners } from "./use-smooth-corners.js";
import type { SmoothCornerOptions } from "@smooth-corners/core";

/**
 * Render-function component that applies smooth corners to a wrapper element.
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
  },
  slots: Object as SlotsType<{ default: () => any }>,
  setup(props, { slots }) {
    const elRef = ref<HTMLElement | null>(null);

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

    useSmoothCorners(elRef, options());

    return () =>
      h(
        props.as,
        { ref: elRef },
        slots.default?.()
      );
  },
});
