import type { Ref } from "./types.js";

type RefLike<T> = Ref<T> | null | undefined;

function setRef<T>(ref: RefLike<T>, value: T | null): void | (() => void) {
  if (Array.isArray(ref)) {
    const cleanups = ref.map((item) => setRef(item, value));
    if (!cleanups.some((cleanup) => typeof cleanup === "function")) return;
    return () => {
      for (let index = 0; index < cleanups.length; index++) {
        const cleanup = cleanups[index];
        if (typeof cleanup === "function") cleanup();
        else setRef(ref[index], null);
      }
    };
  }
  if (typeof ref === "function") return ref(value);
  if (ref) (ref as { current: T | null }).current = value;
}

/** Compose object, callback, and array refs while preserving callback cleanup. */
export function composeRefs<T>(...refs: RefLike<T>[]): (value: T | null) => void | (() => void) {
  return (value) => {
    const cleanups = refs.map((ref) => setRef(ref, value));
    if (!cleanups.some((cleanup) => typeof cleanup === "function")) return;
    return () => {
      for (let index = 0; index < cleanups.length; index++) {
        const cleanup = cleanups[index];
        if (typeof cleanup === "function") cleanup();
        else setRef(refs[index], null);
      }
    };
  };
}
