import {
  cloneVNode,
  Fragment,
  Comment,
  Text,
  type FunctionalComponent,
  type VNode,
} from "vue";

function flatten(vnodes: VNode[]): VNode[] {
  return vnodes.flatMap((vnode) =>
    vnode.type === Fragment && Array.isArray(vnode.children)
      ? flatten(vnode.children as VNode[])
      : [vnode],
  );
}

function isElementVNode(vnode: VNode): boolean {
  if (vnode.type === Comment || vnode.type === Text || vnode.type === Fragment) {
    return false;
  }
  const t = typeof vnode.type;
  return t === "string" || t === "object" || t === "function";
}

type AnyFn = (...args: unknown[]) => unknown;

// cloneVNode's mergeProps concatenates duplicate `on*` listeners into
// `[childHandler, parentHandler]` in that order, so a two-element array
// identifies the pair by shape. Collapse it into one handler where the
// parent is skipped if the child called preventDefault (React Slot contract).
function gateListeners(props: Record<string, unknown>): void {
  for (const key of Object.keys(props)) {
    if (!/^on[A-Z]/.test(key)) continue;
    const value = props[key];
    if (!Array.isArray(value) || value.length !== 2) continue;
    const [childFn, parentFn] = value as [AnyFn, AnyFn];
    props[key] = (...args: unknown[]) => {
      childFn(...args);
      const evt = args[0] as { defaultPrevented?: boolean } | undefined;
      if (evt && evt.defaultPrevented) return;
      parentFn(...args);
    };
  }
}

// Radix-style Slot backing the `asChild` prop: clones the single element
// child, merging the Slot's attrs onto it. A functional component so the
// parent's ref forwards to the clone automatically. Fragments are flattened
// so a <template> wrapping one element is accepted; comment/text vnodes are
// rejected because they cannot carry attrs or refs.
export const Slot: FunctionalComponent<Record<string, unknown>, Record<string, never>, { default: () => VNode[] }> = (
  _props,
  { attrs, slots },
) => {
  const raw = slots.default?.();
  if (!raw || raw.length === 0) {
    throw new Error("Slot: `asChild` expects a single child element, received none.");
  }
  const elements = flatten(raw).filter(isElementVNode);
  if (elements.length === 0) {
    throw new Error(
      "Slot: `asChild` expects a single element child, received only text or comment nodes.",
    );
  }
  if (elements.length > 1) {
    throw new Error(
      "Slot: `asChild` expects a single element child, received " + elements.length + ".",
    );
  }
  const cloned = cloneVNode(elements[0], attrs);
  if (cloned.props) gateListeners(cloned.props as Record<string, unknown>);
  return cloned;
};

Slot.inheritAttrs = false;
Slot.displayName = "LisseSlot";
