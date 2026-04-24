import type { Ref, MutableRefObject } from "react";

/**
 * Compose multiple refs into a single callback ref. Forwards the node to
 * each provided ref, supporting both callback refs and ref objects.
 */
export function composeRefs<T>(...refs: Array<Ref<T> | undefined | null>): (node: T | null) => void {
  return (node: T | null) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") {
        ref(node);
      } else {
        (ref as MutableRefObject<T | null>).current = node;
      }
    }
  };
}
