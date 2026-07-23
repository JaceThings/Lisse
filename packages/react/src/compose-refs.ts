import type { Ref, MutableRefObject, RefCallback } from "react";

function setRef<T>(ref: Ref<T> | undefined | null, value: T | null): void | (() => void) {
  if (typeof ref === "function") return ref(value);
  if (ref) (ref as MutableRefObject<T | null>).current = value;
}

/**
 * Compose refs (callback or object) into one callback ref, preserving
 * React 19 callback-ref cleanups.
 */
export function composeRefs<T>(
  ...refs: Array<Ref<T> | undefined | null>
): RefCallback<T> {
  return (node) => {
    let hasCleanup = false;
    const cleanups = refs.map((ref) => {
      const cleanup = setRef(ref, node);
      if (typeof cleanup === "function") hasCleanup = true;
      return cleanup;
    });

    if (!hasCleanup) return;

    return () => {
      for (let i = 0; i < cleanups.length; i++) {
        const cleanup = cleanups[i];
        if (typeof cleanup === "function") cleanup();
        else setRef(refs[i], null);
      }
    };
  };
}
