import {
  defineComponent,
  cloneVNode,
  mergeProps,
  Fragment,
  Comment,
  type VNode,
  type SlotsType,
} from "vue";

/**
 * Minimal Radix-style Slot for Vue. Clones the single default slot child
 * vnode, merging the Slot component's attrs onto it (Vue handles ref and
 * event handler composition automatically via mergeProps).
 *
 * Used internally to back the `asChild` prop on <SmoothCorners />.
 */
export const Slot = defineComponent({
  name: "LisseSlot",
  inheritAttrs: false,
  slots: Object as SlotsType<{ default: () => VNode[] }>,
  setup(_props, { attrs, slots }) {
    return () => {
      const children = slots.default?.();
      if (!children || children.length === 0) {
        throw new Error("Slot: `asChild` expects a single default slot child.");
      }
      const elements = children.filter(
        (vnode) => vnode.type !== Comment && vnode.type !== Fragment,
      );
      if (elements.length !== 1) {
        throw new Error("Slot: `asChild` expects exactly one element child.");
      }
      const child = elements[0];
      return cloneVNode(child, mergeProps(attrs, (child.props ?? {}) as Record<string, unknown>));
    };
  },
});
